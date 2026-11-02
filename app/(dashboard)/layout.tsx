import { AppHeader } from "@/components/shell/app-header";
import { PrefsProvider } from "@/components/shell/prefs";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <PrefsProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
        <AppHeader />
        {children}
      </div>
    </PrefsProvider>
  );
}
