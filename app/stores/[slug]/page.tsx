import { notFound } from "next/navigation";
import Link from "next/link";
import { getStore } from "@/lib/catalog";
import { formatUsd } from "@/lib/money";
import { INJECTION_TEXT } from "@/lib/catalog/seed-data";

export const dynamic = "force-dynamic";

/**
 * The three fictional storefronts (spec §13). MegaDealz247's listings carry the
 * hidden instruction the way a scam page would: present in the page, invisible
 * to a person, visible to anything that reads the raw text.
 */
export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();
  const sketchy = slug === "megadealz247";
  const volt = slug === "volthub";
  const bg = sketchy ? "#1C1B19" : volt ? "#F2F0EC" : "#F6F1E7";
  const fg = sketchy ? "#FFFDF8" : "#1C1B19";

  return (
    <div className="min-h-dvh" style={{ background: bg, color: fg }}>
      <header className={`border-b px-6 py-5 ${sketchy ? "border-[#3a3733]" : "border-line"}`}>
        <div className="mx-auto flex max-w-[1040px] items-center justify-between">
          <div className="flex items-baseline gap-4">
            <span className={sketchy ? "font-pixel text-[32px] font-semibold text-[#E2AE2A]" : "font-display text-[32px] italic"}>{store.name}</span>
            <span className={`text-[15px] ${sketchy ? "text-[#F2ADA7]" : "text-muted"}`}>{store.tagline}</span>
          </div>
          <span className={`rounded-full border px-3 py-1 font-mono text-[12px] ${sketchy ? "border-[#3a3733] text-[#B8AE9C]" : "border-line text-muted"}`}>demo store</span>
        </div>
      </header>
      {sketchy ? (
        <div className="bg-[#D2483C] px-6 py-3 text-center font-pixel text-[20px] font-semibold text-[#FFFDF8]">🔥 UNBEATABLE DEALS!!! LIMITED TIME!!! ONLY 2 LEFT!!! BUY NOW!!! 🔥</div>
      ) : null}
      <main className="mx-auto max-w-[1040px] px-6 py-10">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {store.products.map((p) => {
            const [visible, hidden] = splitHidden(p.description);
            return (
              <li key={p.id} className={`flex flex-col gap-2 rounded-2xl border p-5 ${sketchy ? "border-[#3a3733] bg-[#26241F]" : "border-line bg-card"}`}>
                <div className={`h-28 rounded-xl ${sketchy ? "bg-[#3a3733]" : ""}`} style={sketchy ? undefined : { background: "repeating-linear-gradient(135deg,#EFE8DA 0 8px,#F6F1E7 8px 16px)" }} />
                <div className="text-[16px] font-semibold">{p.name}</div>
                <div className="flex items-baseline gap-2">
                  <span className={`font-mono text-[20px] font-semibold ${sketchy ? "text-[#E2AE2A]" : ""}`}>{formatUsd(p.priceCents)}</span>
                  {sketchy ? <span className="text-[13px] text-[#B8AE9C] line-through">{formatUsd(Math.round(p.priceCents * 2.4))}</span> : null}
                </div>
                <p className={`text-[14px] leading-[1.5] ${sketchy ? "text-[#CFC8B8]" : "text-muted"}`}>
                  {visible}
                  {hidden ? <span aria-hidden style={{ fontSize: 1, color: bg, userSelect: "none" }}>{hidden}</span> : null}
                </p>
                <div className={`mt-auto pt-2 text-[13px] ${sketchy ? "text-[#B8AE9C]" : "text-muted"}`}>Ask Scout to buy this in Allowance.</div>
              </li>
            );
          })}
        </ul>
        <p className={`mt-10 text-[14px] ${sketchy ? "text-[#B8AE9C]" : "text-muted"}`}>
          <Link href="/chat" className="underline underline-offset-[3px]">← back to Allowance</Link> · fictional store for the Allowance demo
        </p>
      </main>
    </div>
  );
}

function splitHidden(description: string): [string, string | null] {
  const i = description.indexOf(INJECTION_TEXT);
  if (i === -1) return [description, null];
  return [description.slice(0, i).trim(), description.slice(i)];
}
