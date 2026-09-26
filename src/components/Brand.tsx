import Link from "next/link";
import { House } from "lucide-react";

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <Link href="/chat" className="flex items-center gap-2.5 rounded-lg">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">
        <House size={17} strokeWidth={2.25} />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white">우리집 도우미</span>
        {subtitle && <span className="block text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</span>}
      </span>
    </Link>
  );
}
