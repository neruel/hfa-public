import { useId } from "react";

interface InputFieldProps {
  label: string;
  id?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  textarea?: boolean;
  rows?: number;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export function InputField({
  label,
  id: idProp,
  type = "text",
  value,
  onChange,
  placeholder,
  className = "",
  error,
  disabled = false,
  required = false,
  textarea = false,
  rows = 4,
  onKeyDown,
}: InputFieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}{required && " *"}
      </label>
      {textarea ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={
            "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:text-zinc-100 dark:bg-zinc-800 dark:border-zinc-600 " +
            "focus:ring-2 focus:ring-primary focus:border-primary " +
            "disabled:opacity-50 disabled:cursor-not-allowed " +
            className
          }
          rows={rows}
          disabled={disabled}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={
            "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:text-zinc-100 dark:bg-zinc-800 dark:border-zinc-600 " +
            "focus:ring-2 focus:ring-primary focus:border-primary " +
            "disabled:opacity-50 disabled:cursor-not-allowed " +
            className
          }
          disabled={disabled}
        />
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}