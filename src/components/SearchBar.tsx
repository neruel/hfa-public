"use client";
import { useState } from "react";
import { FileText, Loader2, Search, SearchX } from "lucide-react";
import type { SearchResult } from "@/lib/types";
import { Button } from "./ui/Button";

export function SearchBar({ embedded = false }: { embedded?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function run() {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    setHasSearched(false);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json() as { results?: SearchResult[]; error?: string };
      if (!response.ok) throw new Error(data.error || "검색에 실패했습니다.");
      setResults(data.results ?? []);
    } catch (error) {
      setResults([]);
      setError(error instanceof Error ? error.message : "검색에 실패했습니다.");
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }

  return (
    <section className={embedded ? "" : "mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden"}>
      <div className="shrink-0">
        {!embedded && (
          <div className="mb-5">
            <h2 className="text-xl font-bold tracking-tight">문서 검색</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">관리규정과 안내문을 의미 기반으로 검색합니다.</p>
          </div>
        )}
        <form
          role="search"
          onSubmit={(event) => { event.preventDefault(); void run(); }}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-1.5 pl-3.5 transition-colors focus-within:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-600"
        >
          <Search className="shrink-0 text-zinc-400" size={18} />
          <input
            aria-label="검색어"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.nativeEvent.isComposing && event.key === "Enter") event.preventDefault(); }}
            placeholder="관리비 납부, 주차 등록, 누수"
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus-visible:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <Button type="submit" size="sm" disabled={loading || query.trim().length < 2}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : "검색"}
          </Button>
        </form>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
      </div>

      <div className={`mt-5 space-y-2.5 pb-6 ${embedded ? "" : "min-h-0 flex-1 overflow-y-auto"}`}>
        {results.length > 0 && <p className="text-xs text-zinc-500 dark:text-zinc-400">검색 결과 {results.length}건</p>}
        {results.map((result) => (
          <article key={result.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-xs">
              <FileText size={14} className="shrink-0 text-primary dark:text-emerald-400" />
              <span className="min-w-0 truncate font-medium text-zinc-700 dark:text-zinc-200">
                {result.documentName}{result.pageNumber ? ` · ${result.pageNumber}쪽` : ""}
              </span>
              {typeof result.score === "number" && (
                <span className="ml-auto shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  관련도 {Math.round(result.score * 100)}%
                </span>
              )}
            </div>
            <p className="mt-2.5 whitespace-pre-wrap text-sm leading-7 text-zinc-600 dark:text-zinc-300">{result.excerpt}</p>
          </article>
        ))}
        {!loading && hasSearched && results.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-zinc-300 py-14 text-center dark:border-zinc-700">
            <SearchX className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" size={28} />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">검색 결과가 없습니다. 다른 표현으로 검색해 보세요.</p>
          </div>
        )}
      </div>
    </section>
  );
}
