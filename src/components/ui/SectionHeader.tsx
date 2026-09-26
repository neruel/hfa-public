interface SectionHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  eyebrow = "우리집 도우미",
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`mb-6 space-y-2 ${className}`}>
      <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:bg-primary/15 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {eyebrow}
      </span>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">{description}</p>
      )}
    </div>
  );
}
