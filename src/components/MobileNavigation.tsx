"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, navItems } from "./navigation";

export function MobileNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="주 메뉴" className="grid grid-cols-3 px-2 py-1.5">
      {navItems.map(({ href, shortLabel, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors active:scale-95 ${
              active ? "text-primary dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
            <span>{shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
