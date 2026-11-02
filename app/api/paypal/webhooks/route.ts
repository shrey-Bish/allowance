import { prisma } from "@/lib/db";
import { getPayPal } from "@/lib/paypal";
import { audit } from "@/lib/audit";

/**
 * PayPal webhook receiver (spec §9). We verify the signature and record the
 * event; the happy path already uses synchronous API responses, so this only
 * confirms state and catches out-of-band changes (e.g. a void from the PayPal UI).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const paypal = getPayPal();
  let verified = false;
  try {
    verified = await paypal.verifyWebhookSignature(req.headers, raw);
  } catch (err) {
    console.error("[webhook] verify failed", err);
  }
  if (!verified && paypal.mode === "sandbox") {
    return Response.json({ error: "signature not verified" }, { status: 400 });
  }

  let event: { id?: string; event_type?: string; resource?: { id?: string; status?: string; custom_id?: string; supplementary_data?: { related_ids?: { order_id?: string; authorization_id?: string } } } } = {};
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const type = event.event_type ?? "unknown";
  const res = event.resource ?? {};
  const requestId = res.custom_id ?? null;
  const payment = requestId
    ? await prisma.payment.findUnique({ where: { purchaseRequestId: requestId } })
    : await prisma.payment.findFirst({
        where: { OR: [{ paypalCaptureId: res.id ?? "" }, { paypalAuthorizationId: res.id ?? "" }, { paypalOrderId: res.supplementary_data?.related_ids?.order_id ?? "" }] },
      });

  await audit("paypal_webhook", `PayPal confirmed: ${type.replace(/_/g, " ").toLowerCase()}.`, {
    requestId: payment?.purchaseRequestId ?? requestId,
    data: { eventId: event.id, type, resourceId: res.id, status: res.status, verified },
  });

  if (payment) {
    if (type === "PAYMENT.AUTHORIZATION.VOIDED" && payment.status !== "VOIDED") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "VOIDED" } });
    }
    if (type === "PAYMENT.CAPTURE.COMPLETED" && payment.status !== "CAPTURED") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "CAPTURED", paypalCaptureId: res.id ?? payment.paypalCaptureId } });
    }
  }
  return Response.json({ received: true });
}
