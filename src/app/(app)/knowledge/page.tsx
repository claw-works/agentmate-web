"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  BookMarked,
  Boxes,
  CheckCircle2,
  ChevronDown,
  Library,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react"
import { api } from "@/lib/api"
import type { KnowledgeCatalogItem } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KnowledgeSearchPanel } from "./knowledge-search-panel"
import { KnowledgeSourcesPanel } from "./knowledge-sources-panel"
import { KnowledgeDocumentsPanel } from "./knowledge-documents-panel"
import { errorMessage, isAbortError, Notice, noticeClassName, shortHash } from "./helpers"

const CATALOG_PAGE_SIZE = 18

export default function KnowledgePage() {
  const [catalogItems, setCatalogItems] = useState<KnowledgeCatalogItem[]>([])
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [searchDraft, setSearchDraft] = useState("")
  const [catalogQuery, setCatalogQuery] = useState("")
  const [selectedItem, setSelectedItem] = useState<KnowledgeCatalogItem | null>(null)
  const [showSources, setShowSources] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const catalogRequestID = useRef(0)
  const catalogAbort = useRef<AbortController | null>(null)
  const queryRef = useRef("")

  const loadCatalog = useCallback(async (query: string, offset: number, append: boolean) => {
    const requestID = ++catalogRequestID.current
    catalogAbort.current?.abort()
    const controller = new AbortController()
    catalogAbort.current = controller
    if (append) {
      setCatalogLoadingMore(true)
    } else {
      setCatalogLoading(true)
    }
    setCatalogError(null)
    try {
      const response = await api.listKnowledgeCatalog(
        { query: query || undefined, limit: CATALOG_PAGE_SIZE, offset },
        controller.signal
      )
      if (requestID !== catalogRequestID.current) return
      const nextItems = response.items ?? []
      setCatalogItems((current) => (append ? mergeCatalogItems(current, nextItems) : nextItems))
      setCatalogTotal(response.total ?? 0)
      setSelectedItem((current) => {
        if (append) return current
        if (!current) return null
        return nextItems.find((item) => item.source_id === current.source_id) ?? null
      })
    } catch (error) {
      if (isAbortError(error) || requestID !== catalogRequestID.current) return
      setCatalogError(errorMessage(error))
    } finally {
      if (requestID === catalogRequestID.current) {
        setCatalogLoading(false)
        setCatalogLoadingMore(false)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    // 延迟到微任务，避免在 effect 体内同步 setState（react-hooks/set-state-in-effect）
    queueMicrotask(() => {
      if (!cancelled) void loadCatalog("", 0, false)
    })
    return () => {
      cancelled = true
      catalogAbort.current?.abort()
    }
  }, [loadCatalog])

  const refreshCatalog = useCallback(async () => {
    await loadCatalog(queryRef.current, 0, false)
  }, [loadCatalog])

  const handleCatalogSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchDraft.trim()
    queryRef.current = query
    setCatalogQuery(query)
    void loadCatalog(query, 0, false)
  }

  const hasMoreCatalog = catalogItems.length < catalogTotal

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-2xl border border-emerald-400/15 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.12),transparent_38%),linear-gradient(135deg,#11111b,#0b0b12)] p-5 shadow-2xl shadow-black/20 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
              <Library className="size-4" /> Knowledge Registry
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">知识库目录、检索与来源管理</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              K0 目录卡片只展示 manifest 元数据与索引状态。文档正文和 chunk 内容都在点击时才加载，检索命中附带 1-hop 链接邻居。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            aria-pressed={showSources}
            onClick={() => setShowSources((value) => !value)}
            className="border-emerald-400/25 bg-emerald-400/5 text-emerald-100 hover:bg-emerald-400/10"
          >
            <Settings2 className="size-4" /> 来源管理
          </Button>
        </div>
      </header>

      {notice ? (
        <div role={notice.tone === "success" ? "status" : "alert"} aria-live="polite" className={noticeClassName(notice.tone)}>
          {notice.tone === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      {showSources ? (
        <KnowledgeSourcesPanel onNotice={setNotice} onCatalogMutation={refreshCatalog} />
      ) : null}

      <KnowledgeSearchPanel catalogItems={catalogItems} />

      <section aria-labelledby="knowledge-catalog-heading" className="rounded-xl border border-[#1e1e2e] bg-[#101018]">
        <div className="flex flex-col gap-3 border-b border-[#1e1e2e] p-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="knowledge-catalog-heading" className="font-semibold text-slate-100">知识库目录</h2>
            <p className="mt-1 text-xs text-slate-500">
              {catalogTotal} 个有 active revision 的来源{catalogQuery ? ` · 搜索“${catalogQuery}”` : ""}
            </p>
          </div>
          <form onSubmit={handleCatalogSearch} role="search" className="flex w-full gap-2 lg:max-w-xl">
            <Label htmlFor="knowledge-catalog-query" className="sr-only">搜索知识库目录</Label>
            <Input
              id="knowledge-catalog-query"
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="按名称或描述过滤"
              className="border-[#2a2a3a] bg-[#0b0b12] text-slate-100 placeholder:text-slate-600"
            />
            <Button type="submit" disabled={catalogLoading} className="bg-emerald-600 text-white hover:bg-emerald-500">
              <Search className="size-4" /> 搜索
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="刷新知识库目录"
              disabled={catalogLoading}
              onClick={() => void refreshCatalog()}
              className="border-[#2a2a3a] bg-[#12121a] text-slate-300"
            >
              <RefreshCw className={catalogLoading ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </form>
        </div>

        <div className="p-4">
          {catalogLoading ? (
            <div role="status" aria-live="polite" className="flex min-h-48 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 size-4 animate-spin" /> 正在加载 K0 目录…
            </div>
          ) : catalogError ? (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{catalogError}</div>
          ) : catalogItems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[#303044] p-10 text-center text-sm text-slate-500">
              <span>{catalogQuery ? "没有匹配的知识库。" : "还没有带 active revision 的知识库。"}</span>
              <Button type="button" variant="outline" onClick={() => setShowSources(true)} className="border-[#2a2a3a] bg-[#12121a] text-slate-200">
                <Settings2 className="size-4" /> 去注册或同步来源
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {catalogItems.map((item) => (
                <CatalogCard
                  key={item.source_id}
                  item={item}
                  selected={selectedItem?.source_id === item.source_id}
                  onSelect={() => setSelectedItem(item)}
                />
              ))}
            </div>
          )}

          {hasMoreCatalog ? (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                disabled={catalogLoadingMore}
                onClick={() => void loadCatalog(catalogQuery, catalogItems.length, true)}
                className="border-[#2a2a3a] bg-[#12121a] text-slate-200"
              >
                {catalogLoadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
                加载更多（{catalogItems.length}/{catalogTotal}）
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="knowledge-documents-heading" className="min-w-0 rounded-xl border border-[#1e1e2e] bg-[#101018]">
        {!selectedItem ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
            <Boxes className="size-9 text-slate-700" />
            <div>
              <h2 id="knowledge-documents-heading" className="font-medium text-slate-300">选择一个知识库</h2>
              <p className="mt-1 text-sm">选中后浏览其 active revision 的文档列表，正文按点击加载。</p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-col gap-3 border-b border-[#1e1e2e] p-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <BookMarked className="size-5 shrink-0 text-emerald-300" />
                  <h2 id="knowledge-documents-heading" className="break-all text-xl font-semibold text-white">{selectedItem.name}</h2>
                  <Badge className="bg-slate-500/10 text-slate-300">{selectedItem.type}</Badge>
                  <IndexStatusBadge status={selectedItem.index_status} />
                </div>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{selectedItem.description || "该知识库没有描述。"}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>{selectedItem.document_count} 个文档</span>
                  <span className="font-mono">pkg {shortHash(selectedItem.package_hash)}</span>
                  <span className="font-mono">rev {shortHash(selectedItem.active_revision_id)}</span>
                </div>
              </div>
              <Button type="button" variant="ghost" onClick={() => setSelectedItem(null)} className="shrink-0 text-slate-400">
                关闭
              </Button>
            </div>
            <div className="p-4 md:p-5">
              <KnowledgeDocumentsPanel revisionID={selectedItem.active_revision_id} />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function CatalogCard({
  item,
  selected,
  onSelect,
}: {
  item: KnowledgeCatalogItem
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`group min-h-44 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
        selected
          ? "border-emerald-400/60 bg-emerald-400/10 shadow-lg shadow-emerald-950/20"
          : "border-[#252536] bg-[#0b0b12] hover:-translate-y-0.5 hover:border-emerald-500/35"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-100">{item.name}</div>
          <div className="mt-1 text-xs text-slate-600">{item.type} · {item.document_count} 个文档</div>
        </div>
        <IndexStatusBadge status={item.index_status} />
      </div>
      <p className="mt-3 line-clamp-3 min-h-15 text-sm leading-5 text-slate-400">{item.description || "无描述"}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.profile ? <Badge className="bg-indigo-500/8 text-indigo-300/80">{item.profile}</Badge> : null}
        {item.language ? <Badge className="bg-cyan-500/8 text-cyan-300/80">{item.language}</Badge> : null}
        {item.citation_policy ? <Badge className="bg-amber-500/8 text-amber-200/80">citation: {item.citation_policy}</Badge> : null}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#20202e] pt-3 text-[11px] text-slate-600">
        <span>
          {item.indexed_chunks} indexed
          {item.failed_chunks > 0 ? ` · ${item.failed_chunks} failed` : ""}
          {item.pending_chunks > 0 ? ` · ${item.pending_chunks} pending` : ""}
        </span>
        <span className="font-mono">{shortHash(item.package_hash)}</span>
      </div>
    </button>
  )
}

function IndexStatusBadge({ status }: { status: KnowledgeCatalogItem["index_status"] }) {
  const classes: Record<string, string> = {
    indexed: "bg-emerald-500/10 text-emerald-300",
    partial: "bg-amber-500/10 text-amber-300",
    failed: "bg-red-500/10 text-red-300",
    not_indexed: "bg-slate-500/10 text-slate-400",
  }
  return <Badge className={`shrink-0 ${classes[status] ?? classes.not_indexed}`}>{status}</Badge>
}

function mergeCatalogItems(current: KnowledgeCatalogItem[], incoming: KnowledgeCatalogItem[]) {
  const items = new Map(current.map((item) => [item.source_id, item]))
  for (const item of incoming) items.set(item.source_id, item)
  return [...items.values()]
}
