import { Building2, ChevronRight, Siren, Wrench, type LucideIcon } from "lucide-react";

type Contact = {
  title: string;
  number?: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
};

const contacts: Contact[] = [
  {
    title: "관리사무소",
    detail: "공개 데모에는 조직 연락처를 포함하지 않습니다.",
    icon: Building2,
    tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  {
    title: "긴급 시설 접수",
    detail: "공개 데모에는 조직 연락처를 포함하지 않습니다.",
    icon: Wrench,
    tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  },
  {
    title: "화재·구급",
    number: "119",
    detail: "화재, 구조, 응급 의료 상황",
    icon: Siren,
    tone: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  },
];

export function ContactCard() {
  return (
    <section className="mx-auto w-full max-w-3xl overflow-y-auto pb-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight">도움이 필요하신가요?</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">관리사무소와 시설 접수 번호는 공개 데모에서 제외했습니다.</p>
      </div>
      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {contacts.map(({ title, number, detail, icon: Icon, tone }) => {
          const body = (
            <>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}>
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</span>
                {number ? (
                  <span className="block text-lg font-bold tracking-tight tabular-nums text-zinc-900 dark:text-white">{number}</span>
                ) : (
                  <span className="block py-0.5 text-sm font-medium text-zinc-400 dark:text-zinc-500">연락처 비공개</span>
                )}
                <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{detail}</span>
              </span>
            </>
          );
          return (
            <li key={title}>
              {number ? (
                <a
                  href={`tel:${number.replace(/-/g, "")}`}
                  aria-label={`${title} ${number} 전화 걸기`}
                  className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 sm:px-5"
                >
                  {body}
                  <ChevronRight size={18} className="shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600" />
                </a>
              ) : (
                <div className="flex items-center gap-4 px-4 py-4 sm:px-5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
