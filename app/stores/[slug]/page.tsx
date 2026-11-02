import { notFound } from "next/navigation";
import Link from "next/link";
import { getStore } from "@/lib/catalog";
import { formatUsd } from "@/lib/money";

export const dynamic = "force-dynamic";

/** Simple fictional storefront (spec §13). Styled in Phase 3. */
export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-5xl italic">{store.name}</h1>
          <p className="mt-1 text-muted">{store.tagline}</p>
        </div>
        <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">demo store</span>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {store.products.map((p) => (
          <li key={p.id} className="rounded-2xl border border-line bg-card p-5">
            <div className="font-medium">{p.name}</div>
            <div className="font-mono text-lg">{formatUsd(p.priceCents)}</div>
            <p className="mt-2 text-sm text-muted">{p.description}</p>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-sm text-muted">
        <Link href="/chat" className="underline">← back to Allowance</Link>
      </p>
    </div>
  );
}
