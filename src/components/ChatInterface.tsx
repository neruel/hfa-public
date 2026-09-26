"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUpRight, Loader2, Sparkles, SquarePen } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import MessageInput from "./MessageInput";
import { MessageCard } from "./MessageCard";

const suggestions = [
  "관리비 납부일은 언제인가요?",
  "주차 등록은 어떻게 하나요?",
  "누수가 생겼을 때 어디로 연락하나요?",
  "전입신고에 필요한 서류를 알려 주세요.",
];

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Smart auto-scroll: only scroll down when user is near the bottom
  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    if (isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, pending, isNearBottom]);

  function clearHistory() {
    if (messages.length === 0) return;
    if (window.confirm("대화 내역을 모두 삭제하고 새로 시작할까요?")) {
      setMessages([]);
    }
  }

  async function send(message: string, options?: { regenerateId?: string; existingUser?: ChatMessage }) {
    if (!message.trim() || pending) return;
    const user = options?.existingUser ?? { id: crypto.randomUUID(), role: "user" as const, content: message.trim() };
    setMessages((old) => options?.regenerateId ? old.filter((item) => item.id !== options.regenerateId) : [...old, user]);
    setPending(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    try {
      const previousMessages = options?.regenerateId ? messages.slice(0, messages.findIndex((item) => item.id === options.regenerateId)) : messages;
      const history = previousMessages.slice(-6).map(({ role, content }) => ({ role, content }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: user.content, history }),
        signal: controller.signal,
      });
      const raw = await response.text();
      let data: {
        answer?: string;
        sources?: ChatMessage["sources"];
        confidence?: ChatMessage["confidence"];
        answerMode?: ChatMessage["answerMode"];
        error?: string;
      };
      try { data = JSON.parse(raw) as typeof data; } catch { throw new Error("서버 응답을 해석하지 못했습니다."); }
      if (!response.ok) throw new Error(data.error || "답변을 가져오지 못했습니다.");
      setMessages((old) => [
        ...old,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer ?? "답변을 받지 못했습니다.",
          sources: data.sources,
          confidence: data.confidence,
          answerMode: data.answerMode,
        },
      ]);
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError" ? "응답 시간이 초과되었습니다. 다시 시도해 주세요." : error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.";
      setMessages((old) => [
        ...old,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `죄송합니다. ${message}`,
        },
      ]);
    } finally {
      window.clearTimeout(timeout);
      setPending(false);
    }
  }

  return (
    <section className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col overflow-hidden">
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center py-8 animate-fade-up">
            <div className="mb-8">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary dark:bg-emerald-500/15 dark:text-emerald-400">
                <Sparkles size={22} />
              </span>
              <h2 className="mt-5 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-[28px]">
                무엇을 도와드릴까요?
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                아파트 관리규약과 자주 묻는 질문을 찾아보고 답변해 드려요.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {suggestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void send(question)}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-left text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70"
                >
                  <span>{question}</span>
                  <ArrowUpRight size={16} className="shrink-0 text-zinc-300 transition-colors group-hover:text-primary dark:text-zinc-600" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearHistory}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <SquarePen size={14} />
                새 대화
              </button>
            </div>

            {messages.map((message) => (
              <MessageCard
                key={message.id}
                message={message}
                onRegenerate={() => {
                  const messageIndex = messages.indexOf(message);
                  if (messageIndex > 0) {
                    const prevMessage = messages[messageIndex - 1];
                    if (prevMessage.role === "user") {
                      void send(prevMessage.content, { regenerateId: message.id, existingUser: prevMessage });
                    }
                  }
                }}
              />
            ))}

            {pending && (
              <article className="flex items-start gap-3 animate-fade-up" aria-live="polite">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary dark:bg-emerald-500/15 dark:text-emerald-400">
                  <Loader2 size={16} className="animate-spin" />
                </span>
                <div className="flex items-center gap-1.5 pt-2" aria-label="답변을 생성하고 있습니다">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
                  <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">답변을 준비하고 있어요</span>
                </div>
              </article>
            )}

            <div ref={messagesEndRef} className="h-px" />
          </div>
        )}
      </div>

      <div className="shrink-0 pb-3 pt-2 md:pb-5">
        <MessageInput onSend={send} disabled={pending} />
        <p className="mt-2 text-center text-[11px] text-zinc-400 dark:text-zinc-500 md:text-xs">
          AI 답변은 참고용입니다. 중요한 계약·법률 사항은 관리사무소에 확인해 주세요.
        </p>
      </div>
    </section>
  );
}
