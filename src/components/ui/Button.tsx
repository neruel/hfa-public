import { forwardRef } from "react";

interface ButtonProps {
  variant?: "primary" | "secondary" | "outline" | "destructive";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", children, className = "", onClick, disabled = false, type = "button" }, ref) => {
    const baseClasses = "inline-flex items-center justify-center gap-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

    const variantClasses = {
      primary: "bg-primary text-white hover:bg-primary-dark",
      secondary: "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
      outline: "border border-primary text-primary hover:bg-primary-light dark:hover:bg-emerald-500/10",
      destructive: "bg-red-600 text-white hover:bg-red-700",
    }[variant];

    const sizeClasses = {
      sm: "h-9 rounded-lg px-3.5 text-sm",
      md: "h-10 rounded-lg px-4 text-sm",
      lg: "h-12 rounded-xl px-6 text-base",
    }[size];

    return (
      <button
        ref={ref}
        type={type}
        className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
