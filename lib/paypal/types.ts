export interface PayPalMoney {
  currency_code: string;
  value: string;
}

export interface CreateOrderInput {
  intent: "CAPTURE" | "AUTHORIZE";
  amountCents: number;
  description: string;
  referenceId: string; // our PurchaseRequest id
  vaultId: string;
  /** Option B only: pay the demo merchant's sandbox account directly */
  payeeEmail?: string;
}

export interface OrderResult {
  orderId: string;
  status: string;
  /** present when the order completed synchronously */
  captureId?: string;
  authorizationId?: string;
  raw: unknown;
}

export interface CaptureResult {
  captureId: string;
  status: string;
  raw: unknown;
}

export interface AuthorizeResult {
  authorizationId: string;
  status: string;
  expiresAt?: string;
  raw: unknown;
}

export interface VoidResult {
  status: string;
  raw: unknown;
}

export interface SetupTokenResult {
  setupTokenId: string;
  approveUrl?: string;
  raw: unknown;
}

export interface PaymentTokenResult {
  vaultId: string;
  /** PayPal customer id — reuse for later setup-token swaps for the same payer */
  customerId?: string;
  payerEmail?: string;
  raw: unknown;
}

/** The only surface the Guard talks to. Both sandbox and mock implement it. */
export interface PayPalGateway {
  readonly mode: "sandbox" | "mock";
  createOrder(input: CreateOrderInput): Promise<OrderResult>;
  authorizeOrder(orderId: string, requestId: string): Promise<AuthorizeResult>;
  captureOrder(orderId: string, requestId: string): Promise<CaptureResult>;
  captureAuthorization(authorizationId: string, amountCents: number, requestId: string): Promise<CaptureResult>;
  voidAuthorization(authorizationId: string, requestId: string): Promise<VoidResult>;
  createSetupToken(returnUrl: string, cancelUrl: string): Promise<SetupTokenResult>;
  createPaymentToken(setupTokenId: string): Promise<PaymentTokenResult>;
  verifyWebhookSignature(headers: Headers, rawBody: string): Promise<boolean>;
}

export class PayPalError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly debugId?: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}
