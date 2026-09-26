"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { Brand } from "./Brand";
import { hiddenPages, isActive, navItems } from "./navigation";

export default function Header() {
  const pathname = usePathname();
  const current = [...navItems, ...hiddenPages].find((item) => isActive(pathname, item.href));
  const [dark, setDark] = useState<boolean | null>(null);

  // The initial class is set by the inline script in the root layout.
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* storage unavailable */ }
    setDark(next);
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200/80 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80 md:h-16 md:px-8">
      <div className="md:hidden"><Brand /></div>
      <div className="hidden min-w-0 md:block">
        {current && (
          <>
            <h1 className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white">{current.label}</h1>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{current.description}</p>
          </>
        )}
      </div>
      <button
        type="button"
        aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
        onClick={toggle}
        className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}
