"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";
import { APP_VERSION, isActive, navItems } from "./navigation";

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-[100dvh] w-64 shrink-0 flex-col border-r border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="px-5 py-5">
        <Brand subtitle="입주민 AI 안내" />
      </div>
      <nav aria-label="주 메뉴" className="flex-1 space-y-0.5 px-3 pt-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/80 dark:text-white"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Icon size={18} className={active ? "text-primary" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-xs text-zinc-400 dark:text-zinc-500">v{APP_VERSION}</div>
    </aside>
  );
}
