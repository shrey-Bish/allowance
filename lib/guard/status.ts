// Internal status machine (spec §9). Transitions are enforced here so a bug
// can never, say, capture a BLOCKED request.
import type { RequestStatus } from "@/lib/types";

const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  RECEIVED: ["EVALUATING", "FAILED"],
  EVALUATING: ["BLOCKED", "APPROVED_AUTO", "PENDING_APPROVAL", "FAILED"],
  BLOCKED: [],
  APPROVED_AUTO: ["CAPTURING", "FAILED"],
  PENDING_APPROVAL: ["APPROVED_BY_USER", "DENIED", "EXPIRED", "FAILED"],
  APPROVED_BY_USER: ["CAPTURING", "FAILED"],
  CAPTURING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  DENIED: ["VOIDED", "FAILED"],
  EXPIRED: ["VOIDED", "FAILED"],
  VOIDED: [],
  FAILED: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal status transition ${from} → ${to}`);
  }
}

export const TERMINAL_STATUSES: RequestStatus[] = ["BLOCKED", "COMPLETED", "VOIDED", "FAILED"];

/** Statuses that count against the weekly budget (money is or will be spent). */
export const SPENT_STATUSES: RequestStatus[] = [
  "APPROVED_AUTO",
  "APPROVED_BY_USER",
  "CAPTURING",
  "COMPLETED",
];

/** Statuses where PayPal is holding money right now. */
export const HELD_STATUSES: RequestStatus[] = ["PENDING_APPROVAL"];
