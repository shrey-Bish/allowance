import { searchProducts } from "@/lib/catalog";
import { dollarsToCents } from "@/lib/money";
import { handle, ok } from "@/lib/api/http";

export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const maxPrice = url.searchParams.get("maxPrice");
    const store = url.searchParams.get("store") ?? undefined;
    const results = await searchProducts(q, maxPrice ? dollarsToCents(maxPrice) : undefined, store);
    return ok({ results });
  });
}
