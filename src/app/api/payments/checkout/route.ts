import { session, body, HttpError, responseError } from "@/lib/scms/server";
import { merchant, billplz, safeCheckout } from "@/lib/payments/billplz";
import { gatewayDb } from "@/lib/payments/admin";
export async function POST(req: Request) {
  try {
    const { db, user } = await session();
    const { invoiceId } = await body(req);
    const { data: i, error } = await db
      .from("scms_records")
      .select("*")
      .eq("id", invoiceId)
      .eq("kind", "invoice")
      .single();
    if (error || !i) throw new HttpError(404, "Invoice unavailable");
    const m = merchant(i.club_id, i.branch_id);
    const origin = process.env.SCMS_PUBLIC_URL;
    if (!origin || new URL(origin).protocol !== "https:")
      throw new HttpError(
        503,
        "The secure payment return URL is not configured",
      );
    const admin = gatewayDb();
    const { data: a, error: ae } = await db.rpc("scms_reserve_checkout", {
      p_invoice: invoiceId,
    });
    if (ae) throw new HttpError(403, ae.message);
    if (a.checkout_url)
      return Response.json({ url: safeCheckout(a.checkout_url, m) });
    if (
      a.created_by !== user.id ||
      Date.now() - Date.parse(a.created_at) > 60000
    )
      throw new HttpError(
        409,
        "A checkout is being prepared or needs reconciliation. Contact your club.",
      );
    // An atomic claim prevents two tabs from creating different bills for one attempt.
    const { data: claim, error: ce } = await admin
      .from("scms_payment_attempts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", a.id)
      .eq("updated_at", a.created_at)
      .select("id");
    if (ce || !claim?.length)
      throw new HttpError(
        409,
        "Checkout already in progress. Refresh before retrying",
      );
    try {
      const bill = await billplz(m, "bills", {
        collection_id: m.collectionId,
        email: user.email || "",
        name: String(i.data.title).slice(0, 100),
        amount: String(a.amount_sen),
        description:
          String(i.data.number) + " · " + String(i.data.title).slice(0, 150),
        callback_url: new URL("/api/payments/billplz/callback", origin).href,
        redirect_url: new URL("/dashboard", origin).href,
        reference_1_label: "SCMS attempt",
        reference_1: a.id,
      });
      if (
        bill.collection_id !== m.collectionId ||
        Number(bill.amount) !== Number(a.amount_sen) ||
        typeof bill.id !== "string"
      )
        throw Error("Payment provider response mismatch");
      const url = safeCheckout(bill.url, m);
      const { error: attach } = await admin.rpc("scms_gateway_event", {
        p_attempt: a.id,
        p_action: "attach",
        p_bill: bill.id,
        p_url: url,
      });
      if (attach) throw attach;
      return Response.json({ url });
    } catch {
      await admin.rpc("scms_gateway_event", {
        p_attempt: a.id,
        p_action: "review",
        p_bill: "",
      });
      throw new HttpError(
        503,
        "Checkout needs reconciliation before retrying. Use bank transfer or contact your club.",
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("not yet enabled"))
      return Response.json({ error: e.message }, { status: 503 });
    return responseError(e);
  }
}
