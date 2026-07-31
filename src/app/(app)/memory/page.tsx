"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  GitBranch,
  Loader2,
  RefreshCw,
  Search,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import { api } from "@/lib/api"
import {
  MemoryEntry,
  MemoryEntryAttribution,
  MemoryEntryDetail,
  MemoryFeedback,
  MemorySearchItem,
} from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const PAGE_SIZE = 20

type AsyncEntry<T> = { data?: T; loading: boolean; error?: string }

const MEMORY_TYPES = ["semantic", "episodic", "procedural"] as const
const MEMORY_STATUSES = ["active", "pending", "superseded", "invalidated", "archived", "expired"] as const

const typeBadgeClass: Record<string, string> = {
  semantic: "bg-cyan-500/10 text-cyan-300",
  episodic: "bg-violet-500/10 text-violet-300",
  procedural: "bg-amber-500/10 text-amber-200",
}

const statusBadgeClass: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-300",
  pending: "bg-slate-500/10 text-slate-300",
  superseded: "bg-orange-500/10 text-orange-300",
  invalidated: "bg-red-500/10 text-red-300",
  archived: "bg-slate-500/10 text-slate-400",
  expired: "bg-slate-500/10 text-slate-500",
}

export default function MemoryPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [scopeFilter, setScopeFilter] = useState("")

  const [searchDraft, setSearchDraft] = useState("")
  const [searchResults, setSearchResults] = useState<MemorySearchItem[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [selectedID, setSelectedID] = useState<string | null>(null)
  const [detail, setDetail] = useState<AsyncEntry<MemoryEntryDetail>>({ loading: false })
  const [feedback, setFeedback] = useState<AsyncEntry<MemoryFeedback[]>>({ loading: false })
  const [attribution, setAttribution] = useState<AsyncEntry<MemoryEntryAttribution>>({ loading: false })

  const listRequestID = useRef(0)
  const detailRequestID = useRef(0)
  const searchAbort = useRef<AbortController | null>(null)

  const loadEntries = useCallback(async (offset: number, append: boolean) => {
    const requestID = ++listRequestID.current
    if (append) setLoadingMore(true)
    else setLoading(true)
    setListError(null)
    try {
      const response = await api.listMemoryEntries({
        memory_type: typeFilter || undefined,
        status: statusFilter || undefined,
        scope_type: scopeFilter || undefined,
        limit: PAGE_SIZE,
        offset,
      })
      if (requestID !== listRequestID.current) return
      setEntries((current) => (append ? [...current, ...(response.items ?? [])] : response.items ?? []))
      setTotal(response.total ?? 0)
    } catch (error) {
      if (requestID !== listRequestID.current) return
      setListError(error instanceof Error ? error.message : String(error))
    } finally {
      if (requestID === listRequestID.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [typeFilter, statusFilter, scopeFilter])

  useEffect(() => {
    // Deferred one tick: loadEntries flips the loading flag synchronously, and doing
    // that inside the effect body itself triggers a cascading render (react lint
    // set-state-in-effect). The request identity guard makes the deferral safe.
    queueMicrotask(() => void loadEntries(0, false))
  }, [loadEntries])

  const loadDetail = useCallback(async (id: string) => {
    const requestID = ++detailRequestID.current
    setSelectedID(id)
    setDetail({ loading: true })
    setFeedback({ loading: true })
    setAttribution({ loading: false })
    try {
      const data = await api.getMemoryEntry(id)
      if (requestID !== detailRequestID.current) return
      setDetail({ data, loading: false })
    } catch (error) {
      if (requestID !== detailRequestID.current) return
      setDetail({ loading: false, error: error instanceof Error ? error.message : String(error) })
    }
    try {
      const data = await api.listMemoryFeedback(id, 20)
      if (requestID !== detailRequestID.current) return
      setFeedback({ data: data.items ?? [], loading: false })
    } catch (error) {
      if (requestID !== detailRequestID.current) return
      setFeedback({ loading: false, error: error instanceof Error ? error.message : String(error) })
    }
  }, [])

  const loadAttribution = useCallback(async (id: string) => {
    const requestID = detailRequestID.current
    setAttribution({ loading: true })
    try {
      const data = await api.getMemoryAttribution(id)
      if (requestID !== detailRequestID.current) return
      setAttribution({ data, loading: false })
    } catch (error) {
      if (requestID !== detailRequestID.current) return
      setAttribution({ loading: false, error: error instanceof Error ? error.message : String(error) })
    }
  }, [])

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchDraft.trim()
    if (!query) {
      setSearchResults(null)
      setSearchError(null)
      return
    }
    searchAbort.current?.abort()
    const controller = new AbortController()
    searchAbort.current = controller
    setSearchLoading(true)
    setSearchError(null)
    try {
      const response = await api.searchMemory({ query, top_k: 8 }, controller.signal)
      setSearchResults(response.items ?? [])
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setSearchError(error instanceof Error ? error.message : String(error))
    } finally {
      setSearchLoading(false)
    }
  }

  const hasMore = entries.length < total

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-2xl border border-violet-400/15 bg-[radial-gradient(circle_at_top_right,rgba(167,139,250,0.12),transparent_38%),linear-gradient(135deg,#11111b,#0b0b12)] p-5 shadow-2xl shadow-black/20 md:p-7">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">
          <Brain className="size-4" /> Memory Plane
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">观察 Agent 记下了什么</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          持久记忆是有证据支撑的知识层：每条记忆可以追溯到它的来源事件、证据摘录和产生它的技能执行。这里是只读观察面板，写入由 Agent 通过 API/MCP 完成。
        </p>
      </header>

      <section className="rounded-xl border border-[#1e1e2e] bg-[#101018] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
          <Search className="size-4 text-violet-300" /> 语义检索
        </div>
        <form onSubmit={handleSearch} className="flex flex-col gap-2 md:flex-row">
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="描述你想回忆的内容，例如：部署 agentmate 时踩过的坑"
            className="h-10 border-[#27273a] bg-[#0b0b12] text-sm text-slate-100 placeholder:text-slate-600"
          />
          <Button type="submit" disabled={searchLoading} className="h-10 bg-violet-600 text-white hover:bg-violet-500">
            {searchLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            搜索记忆
          </Button>
          {searchResults !== null ? (
            <Button type="button" variant="ghost" onClick={() => { setSearchResults(null); setSearchDraft("") }} className="h-10 text-slate-400">
              清除结果
            </Button>
          ) : null}
        </form>
        {searchError ? (
          <div role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{searchError}</div>
        ) : null}
        {searchResults !== null && !searchError ? (
          searchResults.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-[#303044] p-6 text-center text-sm text-slate-500">没有命中的记忆。</div>
          ) : (
            <div className="mt-4 grid gap-2 xl:grid-cols-2">
              {searchResults.map((item) =>
                item.entry ? (
                  <button
                    key={item.entry.id}
                    type="button"
                    onClick={() => void loadDetail(item.entry!.id)}
                    className="rounded-lg border border-[#242436] bg-[#0b0b12] p-3 text-left transition-colors hover:border-violet-500/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-100">{item.entry.title || "(无标题)"}</div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.entry.summary || item.entry.content}</p>
                      </div>
                      <Badge className="shrink-0 bg-violet-500/10 text-violet-300">#{item.rank}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>score {item.score.toFixed(3)}</span>
                      <span>retrieval {item.retrieval_score.toFixed(3)}</span>
                      {item.feedback_adjustment !== 0 ? (
                        <span className={item.feedback_adjustment > 0 ? "text-emerald-300" : "text-orange-300"}>
                          feedback {item.feedback_adjustment > 0 ? "+" : ""}{item.feedback_adjustment.toFixed(3)}
                        </span>
                      ) : null}
                      {(item.channels ?? []).map((channel) => <Badge key={channel} className="bg-slate-500/10 text-slate-400">{channel}</Badge>)}
                    </div>
                  </button>
                ) : null
              )}
            </div>
          )
        ) : null}
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <section aria-labelledby="memory-list-heading" className="rounded-xl border border-[#1e1e2e] bg-[#101018]">
          <div className="space-y-3 border-b border-[#1e1e2e] p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="memory-list-heading" className="font-semibold text-slate-100">持久记忆</h2>
                <p className="mt-1 text-xs text-slate-500">{total} 条记忆</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="刷新记忆列表"
                disabled={loading}
                onClick={() => void loadEntries(0, false)}
                className="text-slate-400 hover:text-slate-100"
              >
                <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="memory-type-filter" className="sr-only">类型</Label>
                <select
                  id="memory-type-filter"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="h-9 w-full rounded-md border border-[#2a2a3a] bg-[#0b0b12] px-2 text-sm text-slate-200"
                >
                  <option value="">全部类型</option>
                  {MEMORY_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="memory-status-filter" className="sr-only">状态</Label>
                <select
                  id="memory-status-filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-9 w-full rounded-md border border-[#2a2a3a] bg-[#0b0b12] px-2 text-sm text-slate-200"
                >
                  <option value="">全部状态</option>
                  {MEMORY_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="memory-scope-filter" className="sr-only">Scope 类型</Label>
                <Input
                  id="memory-scope-filter"
                  value={scopeFilter}
                  onChange={(event) => setScopeFilter(event.target.value)}
                  placeholder="按 scope_type 过滤，如 repository / project / global"
                  className="h-9 border-[#2a2a3a] bg-[#0b0b12] text-sm text-slate-200 placeholder:text-slate-600"
                />
              </div>
            </div>
          </div>

          <div className="p-3">
            {loading ? (
              <div role="status" aria-live="polite" className="flex min-h-40 items-center justify-center text-sm text-slate-500">
                <Loader2 className="mr-2 size-4 animate-spin" /> 加载中…
              </div>
            ) : listError ? (
              <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{listError}</div>
            ) : entries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#303044] p-8 text-center text-sm text-slate-500">
                还没有持久记忆。让接入的 Agent 通过 memory_store 记录第一条。
              </div>
            ) : (
              <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={selectedID === entry.id}
                    onClick={() => void loadDetail(entry.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedID === entry.id ? "border-violet-400/60 bg-violet-400/10" : "border-[#252536] bg-[#0b0b12] hover:border-violet-500/35"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate font-medium text-slate-100">{entry.title || "(无标题)"}</div>
                      <Badge className={`shrink-0 ${typeBadgeClass[entry.memory_type] ?? "bg-slate-500/10 text-slate-300"}`}>{entry.memory_type}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{entry.summary || entry.content}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <Badge className={statusBadgeClass[entry.status] ?? "bg-slate-500/10 text-slate-300"}>{entry.status}</Badge>
                      <span>{entry.scope_type}{entry.scope_key ? `:${entry.scope_key}` : ""}</span>
                      <span>{formatDate(entry.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {hasMore && !loading ? (
              <div className="mt-3 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loadingMore}
                  onClick={() => void loadEntries(entries.length, true)}
                  className="border-[#2a2a3a] bg-[#12121a] text-slate-200"
                >
                  {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
                  加载更多（{entries.length}/{total}）
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="memory-detail-heading" className="min-w-0 rounded-xl border border-[#1e1e2e] bg-[#101018]">
          {!selectedID ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
              <Brain className="size-9 text-slate-700" />
              <div>
                <h2 id="memory-detail-heading" className="font-medium text-slate-300">选择一条记忆</h2>
                <p className="mt-1 text-sm">查看内容、证据、反馈信号和产生它的技能执行。</p>
              </div>
            </div>
          ) : detail.loading ? (
            <div role="status" aria-live="polite" className="flex min-h-64 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 size-4 animate-spin" /> 加载记忆详情…
            </div>
          ) : detail.error ? (
            <div role="alert" className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{detail.error}</div>
          ) : detail.data ? (
            <MemoryDetailPanel
              entry={detail.data}
              feedback={feedback}
              attribution={attribution}
              onLoadAttribution={() => void loadAttribution(detail.data!.id)}
              onSelectEntry={(id) => void loadDetail(id)}
            />
          ) : null}
        </section>
      </div>
    </div>
  )
}

function MemoryDetailPanel({
  entry,
  feedback,
  attribution,
  onLoadAttribution,
  onSelectEntry,
}: {
  entry: MemoryEntryDetail
  feedback: AsyncEntry<MemoryFeedback[]>
  attribution: AsyncEntry<MemoryEntryAttribution>
  onLoadAttribution: () => void
  onSelectEntry: (id: string) => void
}) {
  return (
    <div>
      <div className="border-b border-[#1e1e2e] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="memory-detail-heading" className="break-all text-xl font-semibold text-white">{entry.title || "(无标题)"}</h2>
          <Badge className={typeBadgeClass[entry.memory_type] ?? "bg-slate-500/10 text-slate-300"}>{entry.memory_type}</Badge>
          <Badge className={statusBadgeClass[entry.status] ?? "bg-slate-500/10 text-slate-300"}>{entry.status}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>scope {entry.scope_type}{entry.scope_key ? `:${entry.scope_key}` : ""}</span>
          <span>confidence {entry.confidence.toFixed(2)}</span>
          <span>importance {entry.importance.toFixed(2)}</span>
          <span className="inline-flex items-center gap-1"><ThumbsUp className="size-3 text-emerald-400" /> {entry.useful_count}</span>
          <span className="inline-flex items-center gap-1"><ThumbsDown className="size-3 text-orange-400" /> {entry.harmful_count}</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> {formatDate(entry.created_at)}</span>
        </div>
        {entry.superseded_by ? (
          <button
            type="button"
            onClick={() => onSelectEntry(entry.superseded_by!)}
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs text-orange-200 hover:bg-orange-500/15"
          >
            <AlertTriangle className="size-3" /> 已被替代 · 查看当前版本
          </button>
        ) : null}
      </div>

      <div className="space-y-5 p-4 md:p-5">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200"><FileText className="size-4 text-violet-300" /> 内容</h3>
          <div className="whitespace-pre-wrap rounded-lg border border-[#242436] bg-[#0b0b12] p-4 text-sm leading-6 text-slate-300">{entry.content}</div>
          {entry.summary ? <p className="mt-2 text-xs text-slate-500">摘要：{entry.summary}</p> : null}
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
            <CheckCircle2 className="size-4 text-emerald-300" /> 证据（{entry.evidence.length}）
          </h3>
          {entry.evidence.length === 0 ? (
            <p className="text-sm text-slate-500">该记忆来自来源事件（source_event_id: <span className="font-mono text-xs">{entry.source_event_id ?? "-"}</span>），没有单独的证据条目。</p>
          ) : (
            <div className="space-y-2">
              {entry.evidence.map((item) => (
                <div key={item.id} className="rounded-lg border border-[#242436] bg-[#0b0b12] p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Badge className="bg-slate-500/10 text-slate-300">{item.source_type}</Badge>
                    <span className="truncate font-mono">{item.source_id}</span>
                  </div>
                  {item.excerpt ? <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-400">{item.excerpt}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <GitBranch className="size-4 text-cyan-300" /> 归因：哪次执行产生了它
            </h3>
            {!attribution.data && !attribution.loading ? (
              <Button type="button" variant="outline" size="sm" onClick={onLoadAttribution} className="border-[#2a2a3a] bg-[#12121a] text-slate-300">
                解析归因链
              </Button>
            ) : null}
          </div>
          {attribution.loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> 解析中…</div>
          ) : attribution.error ? (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{attribution.error}</div>
          ) : attribution.data ? (
            <AttributionPanel attribution={attribution.data} />
          ) : (
            <p className="text-sm text-slate-500">按需解析：记忆 → 来源事件 → 技能版本。</p>
          )}
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
            <Activity className="size-4 text-amber-300" /> 反馈信号
          </h3>
          {feedback.loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> 加载中…</div>
          ) : feedback.error ? (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{feedback.error}</div>
          ) : (feedback.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">还没有 Agent 报告过这条记忆是否有用。</p>
          ) : (
            <div className="space-y-2">
              {(feedback.data ?? []).map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-lg border border-[#242436] bg-[#0b0b12] p-3">
                  {item.signal === "useful" ? (
                    <ThumbsUp className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <ThumbsDown className="mt-0.5 size-4 shrink-0 text-orange-400" />
                  )}
                  <div className="min-w-0 text-sm">
                    <div className="text-slate-300">{item.reason || (item.signal === "useful" ? "有用" : "有害")}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
                      <span>{formatDate(item.created_at)}</span>
                      {item.session_id ? <span className="font-mono">session {shortID(item.session_id)}</span> : null}
                      {item.skill_version_id ? <span className="font-mono">skill {shortID(item.skill_version_id)}</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function AttributionPanel({ attribution }: { attribution: MemoryEntryAttribution }) {
  const resolutionText: Record<string, string> = {
    skill_version: "已解析到具体技能版本",
    session_only: "只解析到会话，事件未标注技能版本",
    event_only: "只解析到来源事件，事件没有会话",
    none: "该记忆没有来源事件，链条中断",
  }
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#242436] bg-[#0b0b12] p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={attribution.resolution === "skill_version" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}>
            {attribution.resolution}
          </Badge>
          <span className="text-slate-400">{resolutionText[attribution.resolution] ?? attribution.resolution}</span>
        </div>
        <div className="mt-2 grid gap-1 text-xs text-slate-500">
          {attribution.skill_name ? <span>技能：{attribution.skill_name} {attribution.skill_version}</span> : null}
          {attribution.session_id ? <span className="font-mono">session {attribution.session_id}</span> : null}
          {attribution.source_event_id ? <span className="font-mono">event {attribution.source_event_id}</span> : null}
        </div>
      </div>
      {(attribution.session_timeline ?? []).length > 0 ? (
        <div>
          <div className="mb-1.5 text-xs font-medium text-slate-400">会话时间线（{attribution.session_timeline!.length}）</div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {attribution.session_timeline!.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="flex items-center gap-2 rounded-md border border-[#1e1e2e] bg-[#0b0b12] px-3 py-2 text-xs">
                <Badge className={item.kind === "skill_log" ? "bg-cyan-500/10 text-cyan-300" : "bg-violet-500/10 text-violet-300"}>
                  {item.kind === "skill_log" ? "执行" : "事件"}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-slate-300">
                  {item.kind === "skill_log"
                    ? `${item.skill_name || "?"} · ${item.outcome || "-"}${item.failure_reason ? ` · ${item.failure_reason}` : ""}`
                    : item.event_type}
                </span>
                {!item.attributed ? <span className="text-amber-300">未归因</span> : null}
                <span className="shrink-0 text-slate-600">{formatTime(item.occurred_at)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" })
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function shortID(value: string): string {
  return value.length > 8 ? value.slice(0, 8) : value
}
