"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";

interface MessageInputProps {
  onSend: (msg: string) => Promise<void>;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto height adjustment
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await submit();
    }
  };

  const submit = async () => {
    if (!value.trim() || pending || disabled) return;
    setPending(true);
    try {
      await onSend(value.trim());
      setValue("");
    } finally {
      setPending(false);
    }
  };

  const isBusy = pending || disabled;

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 pl-4 shadow-float transition-colors focus-within:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-600">
      <textarea
        id="chat-input"
        ref={textareaRef}
        className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent py-2 text-base leading-6 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus-visible:outline-none disabled:opacity-50 dark:text-zinc-100 dark:placeholder:text-zinc-500 md:text-[15px]"
        placeholder="궁금한 내용을 입력해 주세요"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isBusy}
        rows={1}
        aria-label="채팅 입력"
        aria-describedby="chat-help"
      />
      <button
        type="button"
        onClick={submit}
        disabled={isBusy || !value.trim()}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white transition hover:bg-primary-dark active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
        aria-label="메시지 전송"
      >
        <ArrowUp size={19} strokeWidth={2.25} />
      </button>
      <p id="chat-help" className="sr-only">
        Shift+Enter 로 줄바꿈, Enter 로 전송
      </p>
    </div>
  );
}
