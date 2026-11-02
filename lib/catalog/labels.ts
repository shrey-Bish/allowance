// Plain-English labels shared by the activity + approvals APIs.
const CATEGORY_WORD: Record<string, string> = { groceries: "grocery", electronics: "electronics", gift_cards: "gift card", deals: "" };

/** "9 grocery items" / "USB-C charger" / "2× Bananas, bunch" — the card headline. */
export function itemsLabel(items: Array<{ name: string; quantity: number; category: string }>): string {
  const count = items.reduce((s, i) => s + i.quantity, 0);
  if (items.length === 1) return items[0].quantity > 1 ? `${items[0].quantity}× ${items[0].name}` : items[0].name;
  const cats = new Map<string, number>();
  for (const i of items) cats.set(i.category, (cats.get(i.category) ?? 0) + i.quantity);
  const top = [...cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const word = CATEGORY_WORD[top] ?? top.replace(/_/g, " ");
  return `${count} ${word ? word + " " : ""}items`;
}
