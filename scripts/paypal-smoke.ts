// Phase-0 PayPal spike: token → (vault) → order AUTHORIZE → authorize → capture;
// second order → authorize → void. Prints PayPal ids. Needs PAYPAL_* in .env
// and a VAULT_ID (link a sandbox buyer once through the app, or pass --vault <id>).
import "dotenv/config";
import { getAccessToken, isPayPalConfigured, sandboxGateway as pp } from "../lib/paypal/client";

async function main() {
  if (!isPayPalConfigured()) {
    console.error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set.");
    process.exit(1);
  }
  const t0 = Date.now();
  await getAccessToken();
  console.log(`✓ access token (${Date.now() - t0} ms)`);

  const vaultArg = process.argv.indexOf("--vault");
  const vaultId = vaultArg > -1 ? process.argv[vaultArg + 1] : process.env.PAYPAL_SMOKE_VAULT_ID;

  if (!vaultId) {
    const setup = await pp.createSetupToken(`${process.env.APP_BASE_URL}/connect?paypal=return`, `${process.env.APP_BASE_URL}/connect?paypal=cancel`);
    console.log("✓ setup token:", setup.setupTokenId);
    console.log("  approve URL (open as the sandbox BUYER, then run again with --vault <id> after the app exchanges it):");
    console.log("  ", setup.approveUrl);
    console.log("\nNo vault id yet — stopping here. Link PayPal in the app at /connect, then re-run with --vault <vault_id>.");
    return;
  }

  const ref1 = `smoke-${Date.now()}-a`;
  const o1 = await pp.createOrder({ intent: "AUTHORIZE", amountCents: 1900, description: "smoke: charger", referenceId: ref1, vaultId });
  console.log("✓ order 1:", o1.orderId, o1.status, o1.authorizationId ? `(auth ${o1.authorizationId} inline)` : "");
  const a1 = o1.authorizationId ? { authorizationId: o1.authorizationId } : await pp.authorizeOrder(o1.orderId, ref1);
  console.log("✓ authorization 1:", a1.authorizationId);
  const c1 = await pp.captureAuthorization(a1.authorizationId, 1900, ref1);
  console.log("✓ capture 1:", c1.captureId, c1.status);

  const ref2 = `smoke-${Date.now()}-b`;
  const o2 = await pp.createOrder({ intent: "AUTHORIZE", amountCents: 12900, description: "smoke: headphones", referenceId: ref2, vaultId });
  const a2 = o2.authorizationId ? { authorizationId: o2.authorizationId } : await pp.authorizeOrder(o2.orderId, ref2);
  console.log("✓ authorization 2:", a2.authorizationId);
  const v2 = await pp.voidAuthorization(a2.authorizationId, ref2);
  console.log("✓ void 2:", v2.status);

  const ref3 = `smoke-${Date.now()}-c`;
  const o3 = await pp.createOrder({ intent: "CAPTURE", amountCents: 500, description: "smoke: direct capture", referenceId: ref3, vaultId });
  const c3 = o3.captureId ? { captureId: o3.captureId, status: o3.status } : await pp.captureOrder(o3.orderId, ref3);
  console.log("✓ direct capture 3:", c3.captureId, c3.status);

  console.log("\nAll good. Record the observed behaviour in docs/DECISIONS.md.");
}

main().catch((e) => {
  console.error("✗", e.message);
  if (e.body) console.error(JSON.stringify(e.body, null, 2));
  process.exit(1);
});
