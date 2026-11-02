import { getProduct } from "@/lib/catalog";
import { fail, handle, ok } from "@/lib/api/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const p = await getProduct(id);
    return p ? ok(p) : fail("Not found", 404);
  });
}
