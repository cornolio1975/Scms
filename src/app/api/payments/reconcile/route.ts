import { session, body, HttpError, responseError } from "@/lib/scms/server";
import { canManage } from "@/lib/scms/access";
import { gatewayDb } from "@/lib/payments/admin";
import { merchant, billplz, safeCheckout } from "@/lib/payments/billplz";
export async function POST(req: Request) {
  try {
    const { db, roles } = await session();
    const { attemptId, providerBillId } = await body(req);
    const { data: a, error } = await db
      .from("scms_payment_attempts")
      .select("*")
      .eq("id", attemptId)
      .single();
    if (error || !a) throw new HttpError(404, "Payment attempt unavailable");
    if (!canManage(roles, a.club_id, a.branch_id, true))
      throw new HttpError(403, "Finance permission required");
    const id = a.provider_bill_id || providerBillId;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
      throw new HttpError(400, "Bill ID is required for reconciliation");
    const m = merchant(a.club_id, a.branch_id);
    const bill = await billplz(m, "bills/" + encodeURIComponent(id));
    if (
      bill.id !== id ||
      bill.collection_id !== m.collectionId ||
      Number(bill.amount) !== Number(a.amount_sen) ||
      bill.reference_1 !== a.id
    )
      throw new HttpError(409, "The bill does not match this payment attempt");
    const admin = gatewayDb();
    if (!a.provider_bill_id) {
      const { error: link } = await admin
        .from("scms_payment_attempts")
        .update({
          provider_bill_id: id,
          checkout_url: safeCheckout(bill.url, m),
        })
        .eq("id", a.id)
        .is("provider_bill_id", null);
      if (link) throw link;
    }
    if (bill.paid === true) {
      if (Number(bill.paid_amount) !== Number(a.amount_sen))
        throw new HttpError(409, "Paid amount needs manual review");
      const { data, error: settle } = await admin.rpc("scms_gateway_event", {
        p_attempt: a.id,
        p_action: "paid",
        p_bill: id,
        p_paid_amount: a.amount_sen,
      });
      if (settle) throw settle;
      return Response.json({ ok: true, result: data });
    }
    return Response.json({
      ok: true,
      result: { providerState: bill.state, paid: false },
    });
  } catch (e) {
    return responseError(e);
  }
}
