interface BadgeProps {
  variant?: "primary" | "secondary" | "success" | "warning" | "destructive";
  children: React.ReactNode;
  className?: string;
}

export function Badge({
  variant = "primary",
  children,
  className = "",
}: BadgeProps) {
  const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";

  const variantClasses = {
    primary: "bg-primary/20 text-primary dark:bg-primary/20 dark:text-primary",
    secondary: "bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300",
    success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    destructive: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  }[variant];

  return (
    <span className={`${baseClasses} ${variantClasses} ${className}`}>
      {children}
    </span>
  );
}