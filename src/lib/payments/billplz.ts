import { createHmac, timingSafeEqual } from "node:crypto";
export type Merchant = {
  apiKey: string;
  signatureKey: string;
  collectionId: string;
  sandbox: boolean;
};
export function merchant(club: string, branch?: string | null): Merchant {
  let accounts: Record<string, Merchant>;
  try {
    accounts = JSON.parse(process.env.BILLPLZ_CLUB_ACCOUNTS || "{}");
  } catch {
    throw Error("Payment provider configuration is invalid");
  }
  const m = accounts[branch ? `${club}:${branch}` : ""] || accounts[club];
  if (!m?.apiKey || !m.signatureKey || !m.collectionId)
    throw Error(
      "Online payments are not yet enabled for this club. Use the bank-transfer option.",
    );
  return { ...m, sandbox: m.sandbox !== false };
}
export function signatureSource(params: URLSearchParams) {
  const entries = [...params.entries()]
    .filter(([k]) => k !== "x_signature")
    .map(([k, v]) => k + v);
  return entries
    .sort((a, b) =>
      a.toLowerCase() < b.toLowerCase()
        ? -1
        : a.toLowerCase() > b.toLowerCase()
          ? 1
          : 0,
    )
    .join("|");
}
export function verifySignature(params: URLSearchParams, key: string) {
  if (
    params.getAll("x_signature").length !== 1 ||
    new Set([...params.keys()]).size !== [...params.keys()].length
  )
    return false;
  const signature = params.get("x_signature") || "";
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", key)
    .update(signatureSource(params))
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export async function billplz(
  m: Merchant,
  path: string,
  data?: Record<string, string>,
) {
  const origin = m.sandbox
    ? "https://www.billplz-sandbox.com"
    : "https://www.billplz.com";
  const r = await fetch(origin + "/api/v3/" + path, {
    method: data ? "POST" : "GET",
    headers: {
      Authorization: "Basic " + Buffer.from(m.apiKey + ":").toString("base64"),
      ...(data ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: data ? new URLSearchParams(data) : undefined,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const value = await r.json();
  if (!r.ok) throw Error("Payment provider could not complete the request");
  return value;
}
export function safeCheckout(url: string, m: Merchant) {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    (u.hostname !==
      (m.sandbox ? "www.billplz-sandbox.com" : "www.billplz.com") &&
      u.hostname !== (m.sandbox ? "billplz-sandbox.com" : "billplz.com")) ||
    u.username ||
    u.password
  )
    throw Error("Payment provider returned an invalid checkout URL");
  return u.href;
}
