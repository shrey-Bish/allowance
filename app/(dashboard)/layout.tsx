import { AppHeader } from "@/components/shell/app-header";
import { MobileNav } from "@/components/shell/mobile-nav";
import { PrefsProvider } from "@/components/shell/prefs";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <PrefsProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
        <AppHeader />
        <div className="flex min-h-0 flex-1 flex-col pb-16 lg:pb-0">{children}</div>
        <MobileNav />
      </div>
    </PrefsProvider>
  );
}
