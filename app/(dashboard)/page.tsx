import { redirect } from "next/navigation";
import { getDemoUser } from "@/lib/user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getDemoUser();
  redirect(user.paypalVaultId ? "/chat" : "/connect");
}
