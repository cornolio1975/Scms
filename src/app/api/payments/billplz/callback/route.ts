import { gatewayDb } from "@/lib/payments/admin";
import { merchant, billplz, verifySignature } from "@/lib/payments/billplz";
export async function POST(req: Request) {
  try {
    if (
      !req.headers
        .get("content-type")
        ?.includes("application/x-www-form-urlencoded")
    )
      return new Response("Unsupported payload", { status: 415 });
    const raw = await req.text();
    if (raw.length > 16000)
      return new Response("Payload too large", { status: 413 });
    const p = new URLSearchParams(raw);
    const db = gatewayDb();
    const { data: a, error } = await db
      .from("scms_payment_attempts")
      .select("*")
      .eq("provider_bill_id", p.get("id") || "")
      .single();
    if (error || !a) return new Response("Invalid callback", { status: 400 });
    const m = merchant(a.club_id, a.branch_id);
    if (!verifySignature(p, m.signatureKey))
      return new Response("Invalid signature", { status: 401 });
    if (p.get("collection_id") !== m.collectionId)
      return new Response("Collection mismatch", { status: 400 });
    if (p.get("paid") !== "true") return new Response("Acknowledged");
    // Confirm the signed callback against the provider and the reserved invoice amount.
    const bill = await billplz(
      m,
      "bills/" + encodeURIComponent(a.provider_bill_id),
    );
    if (
      bill.id !== a.provider_bill_id ||
      bill.collection_id !== m.collectionId ||
      bill.paid !== true ||
      Number(bill.amount) !== Number(a.amount_sen) ||
      Number(bill.paid_amount) !== Number(a.amount_sen) ||
      Number(p.get("paid_amount")) !== Number(a.amount_sen)
    )
      return new Response("Payment mismatch", { status: 409 });
    const { error: settle } = await db.rpc("scms_gateway_event", {
      p_attempt: a.id,
      p_action: "paid",
      p_bill: a.provider_bill_id,
      p_paid_amount: a.amount_sen,
    });
    if (settle) throw settle;
    return new Response("Acknowledged");
  } catch {
    return new Response("Callback could not be reconciled", { status: 503 });
  }
}
