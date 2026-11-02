// Catalog service used by the demo stores, the catalog API and the agent tools.
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/money";

export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  price: string;
  imageUrl: string | null;
  referenceKey: string | null;
  merchant: { id: string; slug: string; name: string; category: string; accountAgeDays: number; tagline: string };
}

const SELECT = {
  id: true,
  name: true,
  category: true,
  priceCents: true,
  imageUrl: true,
  referenceKey: true,
  merchant: { select: { id: true, slug: true, name: true, category: true, accountAgeDays: true, tagline: true } },
} as const;

type Row = { id: string; name: string; category: string; priceCents: number; imageUrl: string | null; referenceKey: string | null; merchant: CatalogProduct["merchant"] };

function toProduct(r: Row): CatalogProduct {
  return { ...r, price: formatUsd(r.priceCents) };
}

export async function searchProducts(query: string, maxPriceCents?: number, merchantSlug?: string): Promise<CatalogProduct[]> {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  const rows = await prisma.product.findMany({
    where: {
      ...(maxPriceCents != null ? { priceCents: { lte: maxPriceCents } } : {}),
      ...(merchantSlug ? { merchant: { slug: merchantSlug } } : {}),
    },
    select: SELECT,
    orderBy: [{ merchant: { accountAgeDays: "desc" } }, { priceCents: "asc" }],
  });
  const scored = rows
    .map((r) => {
      const hay = `${r.name} ${r.category} ${r.merchant.name} ${r.merchant.category}`.toLowerCase();
      const score = terms.length ? terms.filter((t) => hay.includes(t) || synonyms(t).some((s) => hay.includes(s))).length : 1;
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => toProduct(x.r));
}

export async function getProduct(id: string): Promise<(CatalogProduct & { description: string }) | null> {
  const r = await prisma.product.findUnique({ where: { id }, select: { ...SELECT, description: true } });
  return r ? { ...toProduct(r), description: r.description } : null;
}

export async function listMerchants() {
  return prisma.merchant.findMany({ orderBy: { accountAgeDays: "desc" }, include: { _count: { select: { products: true } } } });
}

export async function getStore(slug: string) {
  return prisma.merchant.findUnique({ where: { slug }, include: { products: { orderBy: { priceCents: "asc" } } } });
}

function synonyms(term: string): string[] {
  const map: Record<string, string[]> = {
    grocery: ["groceries", "milk", "eggs", "bread", "rice", "chicken", "spinach", "tomato", "yogurt", "apple", "pasta", "banana", "oil"],
    groceries: ["groceries", "milk", "eggs", "bread"],
    food: ["groceries"],
    charger: ["charger"],
    phone: ["charger", "cable", "power"],
    headphone: ["headphones"],
    headphones: ["headphones"],
    electronics: ["electronics"],
    gift: ["gift"],
  };
  return map[term] ?? [];
}
