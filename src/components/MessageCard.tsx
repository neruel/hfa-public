import { useState } from "react";
import { Bot, Check, Copy, FileText, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";

interface MessageCardProps {
  message: ChatMessage;
  onRegenerate: () => void;
}

export function MessageCard({ message, onRegenerate }: MessageCardProps) {
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(message.content);
      else {
        const textarea = document.createElement("textarea");
        textarea.value = message.content; textarea.style.position = "fixed"; textarea.style.opacity = "0";
        document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); textarea.remove();
      }
      setCopied(true); window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }

  if (message.role === "user") {
    return (
      <article className="flex justify-end animate-fade-up">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-zinc-900 px-4 py-2.5 text-[15px] leading-relaxed text-white dark:bg-zinc-800 sm:max-w-[75%]">
          <span className="sr-only">나: </span>
          {message.content}
        </div>
      </article>
    );
  }

  return (
    <article className="flex items-start gap-3 animate-fade-up">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary dark:bg-emerald-500/15 dark:text-emerald-400">
        <Bot size={17} />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="prose max-w-none text-[15px] text-zinc-800 dark:text-zinc-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">참고한 문서</p>
            <ol className="grid gap-2 sm:grid-cols-2">
              {message.sources.map((source, index) => (
                <li key={`${source.chunkId}-${index}`} className="rounded-lg border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-200">
                    <FileText size={13} className="shrink-0 text-primary dark:text-emerald-400" />
                    <span className="truncate">{index + 1}. {source.documentName}{source.pageNumber ? ` · ${source.pageNumber}쪽` : ""}</span>
                  </p>
                  {source.excerpt && <p className="mt-1.5 line-clamp-2 leading-relaxed text-zinc-500 dark:text-zinc-400">{source.excerpt}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          <button
            type="button"
            onClick={() => void copyMessage()}
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
            {copied ? "복사됨" : "복사"}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <RotateCcw size={14} />
            다시 생성
          </button>
        </div>
      </div>
    </article>
  );
}
