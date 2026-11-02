// Typed PayPal REST client for the sandbox (spec §9). Server-side only.
// Every create/capture/void call sends PayPal-Request-Id for idempotency.
// Endpoints marked VERIFY in docs/DECISIONS.md are exercised by `pnpm paypal:smoke`.
import { centsToPayPalValue } from "@/lib/money";
import {
  PayPalError,
  type AuthorizeResult,
  type CaptureResult,
  type CreateOrderInput,
  type OrderResult,
  type PayPalGateway,
  type PaymentTokenResult,
  type SetupTokenResult,
  type VoidResult,
} from "./types";

interface TokenCache {
  token: string;
  expiresAt: number;
}

function apiBase(): string {
  return (process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com").replace(/\/$/, "");
}

export function isPayPalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

let tokenCache: TokenCache | null = null;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const id = process.env.PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!id || !secret) throw new PayPalError("PayPal credentials are not set", 0);

  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new PayPalError(`PayPal auth failed: ${body.error_description ?? res.status}`, res.status, undefined, body);
  }
  tokenCache = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  requestId?: string,
): Promise<{ data: T; status: number; debugId?: string }> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (requestId) headers["PayPal-Request-Id"] = requestId;

  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const debugId = res.headers.get("paypal-debug-id") ?? undefined;
  const text = await res.text();
  const data = (text ? safeJson(text) : {}) as T;
  if (!res.ok) {
    const b = data as { message?: string; name?: string; details?: Array<{ issue?: string; description?: string }> };
    const detail = b?.details?.map((d) => d.issue ?? d.description).filter(Boolean).join(", ");
    throw new PayPalError(`PayPal ${method} ${path} → ${res.status} ${b?.name ?? ""} ${b?.message ?? ""} ${detail ?? ""}`.trim(), res.status, debugId, data);
  }
  return { data, status: res.status, debugId };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ---- Orders -------------------------------------------------------------

interface OrderResponse {
  id: string;
  status: string;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{ id: string; status: string }>;
      authorizations?: Array<{ id: string; status: string; expiration_time?: string }>;
    };
  }>;
}

function pickPayments(order: OrderResponse) {
  const pu = order.purchase_units?.[0]?.payments;
  return { captureId: pu?.captures?.[0]?.id, authorizationId: pu?.authorizations?.[0]?.id, authExpires: pu?.authorizations?.[0]?.expiration_time };
}

export const sandboxGateway: PayPalGateway = {
  mode: "sandbox",

  async createOrder(input: CreateOrderInput): Promise<OrderResult> {
    const body = {
      intent: input.intent,
      purchase_units: [
        {
          reference_id: input.referenceId,
          description: input.description.slice(0, 127),
          custom_id: input.referenceId,
          amount: { currency_code: "USD", value: centsToPayPalValue(input.amountCents) },
          ...(input.payeeEmail ? { payee: { email_address: input.payeeEmail } } : {}),
        },
      ],
      payment_source: {
        paypal: {
          vault_id: input.vaultId,
          // VERIFY: stored_credential fields for merchant-initiated vaulted payments
          stored_credential: { payment_initiator: "MERCHANT", payment_type: "UNSCHEDULED", usage: "SUBSEQUENT" },
        },
      },
    };
    const { data, debugId } = await request<OrderResponse>("POST", "/v2/checkout/orders", body, `order-${input.referenceId}`);
    const picked = pickPayments(data);
    return { orderId: data.id, status: data.status, captureId: picked.captureId, authorizationId: picked.authorizationId, raw: { ...data, debugId } };
  },

  async authorizeOrder(orderId, requestId): Promise<AuthorizeResult> {
    const { data, debugId } = await request<OrderResponse>("POST", `/v2/checkout/orders/${orderId}/authorize`, {}, `auth-${requestId}`);
    const picked = pickPayments(data);
    if (!picked.authorizationId) throw new PayPalError("authorize returned no authorization id", 500, debugId, data);
    return { authorizationId: picked.authorizationId, status: data.status, expiresAt: picked.authExpires, raw: { ...data, debugId } };
  },

  async captureOrder(orderId, requestId): Promise<CaptureResult> {
    const { data, debugId } = await request<OrderResponse>("POST", `/v2/checkout/orders/${orderId}/capture`, {}, `cap-${requestId}`);
    const picked = pickPayments(data);
    if (!picked.captureId) throw new PayPalError("capture returned no capture id", 500, debugId, data);
    return { captureId: picked.captureId, status: data.status, raw: { ...data, debugId } };
  },

  async captureAuthorization(authorizationId, amountCents, requestId): Promise<CaptureResult> {
    const { data, debugId } = await request<{ id: string; status: string }>(
      "POST",
      `/v2/payments/authorizations/${authorizationId}/capture`,
      { amount: { currency_code: "USD", value: centsToPayPalValue(amountCents) }, final_capture: true },
      `cap-${requestId}`,
    );
    return { captureId: data.id, status: data.status, raw: { ...data, debugId } };
  },

  async voidAuthorization(authorizationId, requestId): Promise<VoidResult> {
    const { data, status, debugId } = await request<{ status?: string }>(
      "POST",
      `/v2/payments/authorizations/${authorizationId}/void`,
      undefined,
      `void-${requestId}`,
    );
    return { status: data?.status ?? (status === 204 ? "VOIDED" : String(status)), raw: { ...(data ?? {}), debugId } };
  },

  // ---- Vault --------------------------------------------------------------

  async createSetupToken(returnUrl, cancelUrl): Promise<SetupTokenResult> {
    // VERIFY: exact payment_source.paypal shape for "save without purchase"
    const body = {
      payment_source: {
        paypal: {
          usage_type: "MERCHANT",
          customer_type: "CONSUMER",
          permit_multiple_payment_tokens: false,
          usage_pattern: "IMMEDIATE",
          experience_context: {
            return_url: returnUrl,
            cancel_url: cancelUrl,
            brand_name: "Allowance (demo)",
            shipping_preference: "NO_SHIPPING",
          },
        },
      },
    };
    const { data } = await request<{ id: string; links?: Array<{ rel: string; href: string }> }>(
      "POST",
      "/v3/vault/setup-tokens",
      body,
      `setup-${crypto.randomUUID()}`,
    );
    return { setupTokenId: data.id, approveUrl: data.links?.find((l) => l.rel === "approve")?.href, raw: data };
  },

  async createPaymentToken(setupTokenId): Promise<PaymentTokenResult> {
    const { data } = await request<{ id: string; payment_source?: { paypal?: { email_address?: string } } }>(
      "POST",
      "/v3/vault/payment-tokens",
      { payment_source: { token: { id: setupTokenId, type: "SETUP_TOKEN" } } },
      `ptoken-${setupTokenId}`,
    );
    return { vaultId: data.id, payerEmail: data.payment_source?.paypal?.email_address, raw: data };
  },

  // ---- Webhooks -----------------------------------------------------------

  async verifyWebhookSignature(headers, rawBody): Promise<boolean> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) return false;
    const body = {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    };
    const { data } = await request<{ verification_status?: string }>("POST", "/v1/notifications/verify-webhook-signature", body);
    return data.verification_status === "SUCCESS";
  },
};
