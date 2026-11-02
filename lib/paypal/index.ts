import { isPayPalConfigured, sandboxGateway } from "./client";
import { mockGateway } from "./mock";
import type { PayPalGateway } from "./types";

export * from "./types";
export { isPayPalConfigured } from "./client";

export function getPayPal(): PayPalGateway {
  const mode = process.env.PAYPAL_MODE;
  if (mode === "mock") return mockGateway;
  if (mode === "sandbox" || isPayPalConfigured()) return sandboxGateway;
  if (process.env.DEMO_MODE === "true") return mockGateway;
  return sandboxGateway; // will throw a clear "credentials not set" error
}
