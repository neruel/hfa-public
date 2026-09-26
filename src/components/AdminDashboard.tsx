"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, CloudUpload, FileText, Loader2, Lock, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { SearchBar } from "./SearchBar";

type UploadPhase = "idle" | "uploading" | "refreshing" | "done";
type DocumentItem = { id: string; filename: string; file_type: string | null; status: string; ocr_used: number | boolean; chunk_count: number; created_at: string; updated_at: string; error_message: string | null };
type Overview = { totalDocuments: number; readyDocuments: number; errorDocuments: number };
const labels: Record<string, string> = { UPLOADED: "업로드 완료 · 대기 중", PROCESSING: "문서 처리 중", PARSING: "문서 분석 중", CHUNKING: "문서 분할 중", EMBEDDING: "임베딩 생성 중", INDEXING: "검색 색인 중", READY: "처리 완료", ERROR: "처리 실패" };
const progress: Record<string, number> = { UPLOADED: 10, PROCESSING: 50, PARSING: 25, CHUNKING: 45, EMBEDDING: 65, INDEXING: 85, READY: 100, ERROR: 100 };
const activeStatuses = new Set(["UPLOADED", "PROCESSING", "PARSING", "CHUNKING", "EMBEDDING", "INDEXING"]);

export function AdminDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<"upload" | "search">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [token, setToken] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const refreshDocuments = useCallback(async (showErrors?: boolean) => {
    const hasExistingAuth = authenticated || Boolean(showErrors);
    setLoading(true);
    try {
      const [docsResponse, overviewResponse] = await Promise.all([
        fetch("/api/admin/documents", { credentials: "include" }),
        fetch("/api/admin/overview", { credentials: "include" }),
      ]);
      if (docsResponse.status === 401) { setAuthenticated(false); throw new Error("관리자 세션이 만료되었습니다."); }
      if (!docsResponse.ok) throw new Error("문서 목록을 불러오지 못했습니다.");
      const docs = await docsResponse.json() as { documents?: DocumentItem[] };
      setDocuments(docs.documents ?? []);
      if (overviewResponse.ok) setOverview((await overviewResponse.json() as { overview?: Overview }).overview ?? null);
      setAuthenticated(true);
    } catch (error) { if (hasExistingAuth) setMessage(error instanceof Error ? error.message : "문서 목록 오류"); }
    finally { setLoading(false); }
  }, [authenticated]);

  useEffect(() => { void refreshDocuments(); }, [refreshDocuments]);
  useEffect(() => {
    if (!authenticated || !documents.some((document) => activeStatuses.has(document.status))) return;
    const timer = window.setInterval(() => void refreshDocuments(), 4000);
    return () => window.clearInterval(timer);
  }, [authenticated, documents, refreshDocuments]);

  const login = async () => {
    setLoginError(null);
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ token }) });
      if (!response.ok) throw new Error("관리자 인증에 실패했습니다.");
      setToken(""); setAuthenticated(true);
      await refreshDocuments(true);
    } catch (error) { setLoginError(error instanceof Error ? error.message : "관리자 인증에 실패했습니다."); }
  };

  const upload = async () => {
    if (!file || !authenticated) return;
    setMessage(null); setPhase("uploading"); setPercent(0);
    const form = new FormData(); form.append("file", file);
    try {
      const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const request = new XMLHttpRequest(); xhrRef.current = request;
        request.open("POST", "/api/admin/upload"); request.withCredentials = true;
        request.upload.onprogress = (event) => { if (event.lengthComputable) setPercent(Math.round(event.loaded / event.total * 100)); };
        request.onload = () => resolve({ status: request.status, body: request.responseText });
        request.onerror = () => reject(new Error("업로드 네트워크 오류가 발생했습니다."));
        request.onabort = () => reject(new Error("업로드를 취소했습니다."));
        request.send(form);
      });
      xhrRef.current = null;
      if (result.status < 200 || result.status >= 300) { let error = "업로드에 실패했습니다."; try { error = (JSON.parse(result.body) as { error?: string }).error ?? error; } catch { /* non-json */ } throw new Error(error); }
      setPhase("refreshing"); setPercent(100); await refreshDocuments(); setFile(null); setPhase("done"); setMessage("업로드와 문서 처리가 완료되었습니다.");
    } catch (error) { xhrRef.current = null; setPhase("idle"); setMessage(error instanceof Error ? error.message : "업로드에 실패했습니다."); await refreshDocuments(); }
  };
  const cancelUpload = () => xhrRef.current?.abort();
  const chooseFile = (candidate: File | null) => {
    if (!candidate) return;
    const extension = candidate.name.split(".").pop()?.toLowerCase();
    const allowed = new Set(["pdf", "docx", "xlsx", "pptx", "txt", "hwpx"]);
    if (!extension || !allowed.has(extension)) { setFile(null); setMessage("지원하지 않는 파일 형식입니다."); return; }
    if (candidate.size <= 0 || candidate.size > 25 * 1024 * 1024) { setFile(null); setMessage("파일은 25MB 이하만 업로드할 수 있습니다."); return; }
    setMessage(null); setFile(candidate);
  };
  const resetUpload = () => { setFile(null); setPhase("idle"); setPercent(0); setMessage(null); };
  const documentAction = async (id: string, action: "reprocess" | "delete") => {
    if (action === "delete" && !window.confirm("이 문서와 색인 데이터를 삭제할까요?")) return;
    try {
      const response = await fetch(`/api/admin/documents/${id}${action === "reprocess" ? "/reprocess" : ""}`, { method: action === "delete" ? "DELETE" : "POST", credentials: "include" });
      if (!response.ok) { setMessage(action === "delete" ? "삭제에 실패했습니다." : "재처리에 실패했습니다."); return; }
      await refreshDocuments();
    } catch { setMessage(action === "delete" ? "삭제 중 네트워크 오류가 발생했습니다." : "재처리 중 네트워크 오류가 발생했습니다."); }
  };

  const tabs = [
    { id: "upload" as const, label: "문서 관리", icon: FileText },
    { id: "search" as const, label: "색인 검색", icon: Search },
  ];

  return (
    <section className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden">
      <div className="mb-5 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">관리자 센터</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">문서 업로드, 처리 상태 확인, 색인 검색을 관리합니다.</p>
        </div>
        <div role="tablist" aria-label="관리자 메뉴" className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeSubTab === id}
              onClick={() => setActiveSubTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeSubTab === id
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {activeSubTab === "search" ? (
          <SearchBar embedded />
        ) : (
          <div className="space-y-6">
            {!authenticated && (
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <Lock size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">관리자 인증</h3>
                    <p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">토큰은 저장하지 않고 세션으로만 교환합니다. 유효한 세션이면 새로고침 후에도 자동으로 복원됩니다.</p>
                  </div>
                </div>
                <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); if (token) void login(); }}>
                  <input
                    type="password"
                    aria-label="관리자 토큰"
                    autoComplete="current-password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus-visible:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
                    placeholder="관리자 토큰"
                  />
                  <Button type="submit" disabled={!token}>인증</Button>
                </form>
                {loginError && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{loginError}</p>}
              </Card>
            )}

            <div>
              <label
                htmlFor="admin-file"
                onDragOver={(event) => { event.preventDefault(); if (authenticated && phase === "idle") setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => { event.preventDefault(); setDragActive(false); if (authenticated && phase === "idle") chooseFile(event.dataTransfer.files?.[0] ?? null); }}
                className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-5 py-9 text-center transition-colors ${
                  !authenticated || phase !== "idle"
                    ? "cursor-not-allowed border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/50"
                    : dragActive
                      ? "cursor-pointer border-primary bg-emerald-50 dark:bg-emerald-500/10"
                      : "cursor-pointer border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60"
                }`}
              >
                <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <CloudUpload size={19} />
                </span>
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{file ? file.name : "파일을 선택하거나 여기에 끌어놓으세요"}</span>
                <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">최대 25MB · PDF, DOCX, HWPX, XLSX, PPTX, TXT</span>
                <input id="admin-file" type="file" className="sr-only" accept=".pdf,.docx,.xlsx,.pptx,.txt,.hwpx" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} disabled={!authenticated || phase !== "idle"} />
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => void upload()} disabled={!authenticated || !file || phase !== "idle"}><CloudUpload size={16} /> 업로드 시작</Button>
                {phase === "uploading" && <Button onClick={cancelUpload} variant="secondary">취소</Button>}
              </div>

              <div className="mt-3 text-sm" aria-live="polite">
                {phase === "uploading" && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300"><Loader2 className="animate-spin text-primary" size={15} /> 파일 전송 중… <span className="tabular-nums">{percent}%</span></p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} /></div>
                  </div>
                )}
                {phase === "refreshing" && <p className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300"><Loader2 className="animate-spin text-primary" size={15} /> 처리 결과 확인 중…</p>}
                {phase === "done" && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <p className="flex items-center gap-2"><CheckCircle size={16} /> {message}</p>
                    <button type="button" className="rounded-md px-2 py-1 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/20" onClick={resetUpload}>다른 문서 업로드</button>
                  </div>
                )}
                {phase === "idle" && message && <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-red-700 dark:bg-red-500/10 dark:text-red-400">{message}</p>}
              </div>
            </div>

            {authenticated && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">업로드한 문서</h3>
                  <button type="button" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white" onClick={() => void refreshDocuments()}>
                    <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> 새로고침
                  </button>
                </div>

                {overview && (
                  <dl className="mb-4 grid grid-cols-3 divide-x divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                    {[
                      { label: "전체", value: overview.totalDocuments, tone: "text-zinc-900 dark:text-white" },
                      { label: "완료", value: overview.readyDocuments, tone: "text-emerald-600 dark:text-emerald-400" },
                      { label: "실패", value: overview.errorDocuments, tone: "text-red-600 dark:text-red-400" },
                    ].map((stat) => (
                      <div key={stat.label} className="px-4 py-3">
                        <dt className="text-xs text-zinc-500 dark:text-zinc-400">{stat.label}</dt>
                        <dd className={`mt-0.5 text-2xl font-bold tabular-nums tracking-tight ${stat.tone}`}>{stat.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {documents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">아직 업로드한 문서가 없습니다.</div>
                ) : (
                  <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                    {documents.map((document) => {
                      const failed = document.status === "ERROR";
                      const ready = document.status === "READY";
                      const value = progress[document.status] ?? 0;
                      return (
                        <li key={document.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{document.filename}</p>
                              <p className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                <span>{document.file_type ?? "-"}</span>
                                <span>청크 {document.chunk_count ?? 0}</span>
                                <span>OCR {document.ocr_used ? "사용" : "미사용"}</span>
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              failed ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                : ready ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                            }`}>
                              {labels[document.status] ?? document.status}
                            </span>
                          </div>
                          {!ready && (
                            <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                              <div className={`h-full rounded-full transition-all ${failed ? "bg-red-500" : "bg-primary"}`} style={{ width: `${value}%` }} />
                            </div>
                          )}
                          {failed && document.error_message && <p className="mt-3 break-words rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">{document.error_message}</p>}
                          <div className="mt-2 flex gap-1 text-xs">
                            <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white" onClick={() => void documentAction(document.id, "reprocess")}><RotateCcw size={13} /> 재처리</button>
                            <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400" onClick={() => void documentAction(document.id, "delete")}><Trash2 size={13} /> 삭제</button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
