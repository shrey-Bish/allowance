// Local-dev stand-in used ONLY when PAYPAL_MODE=mock (or no sandbox creds are
// set and DEMO_MODE=true). Ids are prefixed MOCK- and the UI shows a
// "mock payments" chip so nothing is ever presented as a real PayPal result.
import type { PayPalGateway } from "./types";

const id = (prefix: string) => `MOCK-${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

export const mockGateway: PayPalGateway = {
  mode: "mock",
  async createOrder(input) {
    const orderId = id("ORDER");
    return { orderId, status: input.intent === "CAPTURE" ? "COMPLETED" : "APPROVED", raw: { mock: true, input } };
  },
  async authorizeOrder(orderId) {
    return { authorizationId: id("AUTH"), status: "CREATED", expiresAt: new Date(Date.now() + 29 * 864e5).toISOString(), raw: { mock: true, orderId } };
  },
  async captureOrder(orderId) {
    return { captureId: id("CAP"), status: "COMPLETED", raw: { mock: true, orderId } };
  },
  async captureAuthorization(authorizationId) {
    return { captureId: id("CAP"), status: "COMPLETED", raw: { mock: true, authorizationId } };
  },
  async voidAuthorization(authorizationId) {
    return { status: "VOIDED", raw: { mock: true, authorizationId } };
  },
  async createSetupToken() {
    return { setupTokenId: id("SETUP"), approveUrl: undefined, raw: { mock: true } };
  },
  async createPaymentToken(setupTokenId) {
    return { vaultId: id("VAULT"), payerEmail: "sandbox-buyer@example.com", raw: { mock: true, setupTokenId } };
  },
  async verifyWebhookSignature() {
    return true;
  },
};
