import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { MobileNavigation } from "@/components/MobileNavigation";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] bg-[var(--color-background)]">
      <div className="hidden md:block"><Sidebar /></div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main id="main" className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4 md:px-8 md:pt-6">
          {children}
        </main>
        <div className="shrink-0 border-t border-zinc-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 md:hidden">
          <MobileNavigation />
        </div>
      </div>
    </div>
  );
}
