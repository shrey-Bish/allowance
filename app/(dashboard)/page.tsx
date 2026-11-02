import { redirect } from "next/navigation";

/** Welcome / Link PayPal is designed next round; until then the home goes to Scout. */
export default function Home() {
  redirect("/chat");
}
