"use client"

import { FormEvent, useRef, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, Loader2, Search } from "lucide-react"
import { api } from "@/lib/api"
import type { KnowledgeCatalogItem, KnowledgeDocumentLinkItem, KnowledgeSearchHit } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { errorMessage, isAbortError, shortHash } from "./helpers"

const SEARCH_TOP_K = 10

// 记录一次已完成检索的参数，展开 hit 时用相同参数带 include_content=true 重查。
type SearchParams = { query: string; sourceID: string }

export function KnowledgeSearchPanel({ catalogItems }: { catalogItems: KnowledgeCatalogItem[] }) {
  const [queryDraft, setQueryDraft] = useState("")
  const [sourceID, setSourceID] = useState("")
  const [hits, setHits] = useState<KnowledgeSearchHit[]>([])
  const [total, setTotal] = useState(0)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openHitKey, setOpenHitKey] = useState<string | null>(null)
  // document_id+chunk_key → 正文（同一代检索内缓存，避免重复请求）
  const [contents, setContents] = useState<Record<string, string>>({})
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState<string | null>(null)

  const requestID = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const lastParams = useRef<SearchParams | null>(null)
  // 检索代际：换一次检索后旧的正文缓存作废
  const generation = useRef(0)

  const runSearch = async (event: FormEvent) => {
    event.preventDefault()
    const query = queryDraft.trim()
    if (!query) return
    const id = ++requestID.current
    generation.current += 1
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    setOpenHitKey(null)
    setContents({})
    setContentError(null)
    try {
      const response = await api.searchKnowledge(
        {
          query,
          top_k: SEARCH_TOP_K,
          source_ids: sourceID ? [sourceID] : undefined,
          include_content: false,
        },
        controller.signal
      )
      if (id !== requestID.current) return
      setHits(response.items ?? [])
      setTotal(response.total ?? 0)
      setSearched(true)
      lastParams.current = { query, sourceID }
    } catch (err) {
      if (isAbortError(err) || id !== requestID.current) return
      setError(errorMessage(err))
    } finally {
      if (id === requestID.current) setLoading(false)
    }
  }

  // 点开 hit 才拉正文：用相同参数 include_content=true 重查一次，并按
  // document_id+chunk_key 复合键缓存（chunk_key 仅在文档内唯一）。
  const openHit = async (hit: KnowledgeSearchHit) => {
    const hitKey = compositeHitKey(hit)
    if (openHitKey === hitKey) {
      setOpenHitKey(null)
      return
    }
    setOpenHitKey(hitKey)
    setContentError(null)
    if (contents[hitKey] !== undefined || hit.content !== undefined) return
    const params = lastParams.current
    if (!params) return
    const gen = generation.current
    setContentLoading(true)
    try {
      const response = await api.searchKnowledge({
        query: params.query,
        top_k: SEARCH_TOP_K,
        source_ids: params.sourceID ? [params.sourceID] : undefined,
        include_content: true,
      })
      if (generation.current !== gen) return
      const next: Record<string, string> = {}
      for (const item of response.items ?? []) {
        if (item.content !== undefined) next[compositeHitKey(item)] = item.content
      }
      setContents((current) => ({ ...current, ...next }))
    } catch (err) {
      if (generation.current !== gen) return
      setContentError(errorMessage(err))
    } finally {
      if (generation.current === gen) setContentLoading(false)
    }
  }

  return (
    <section aria-labelledby="knowledge-search-heading" className="rounded-xl border border-[#1e1e2e] bg-[#101018]">
      <div className="flex flex-col gap-3 border-b border-[#1e1e2e] p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="knowledge-search-heading" className="font-semibold text-slate-100">知识检索</h2>
          <p className="mt-1 text-xs text-slate-500">对已索引的 chunk 做混合检索。结果先展示 snippet，点开单条命中才加载正文。</p>
        </div>
        <form onSubmit={runSearch} role="search" className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl">
          <div className="flex-1">
            <Label htmlFor="knowledge-search-query" className="sr-only">检索知识库</Label>
            <Input
              id="knowledge-search-query"
              type="search"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="输入查询语句"
              className="border-[#2a2a3a] bg-[#0b0b12] text-slate-100 placeholder:text-slate-600"
            />
          </div>
          <div>
            <Label htmlFor="knowledge-search-source" className="sr-only">限定知识库来源</Label>
            <select
              id="knowledge-search-source"
              value={sourceID}
              onChange={(event) => setSourceID(event.target.value)}
              className="h-9 w-full rounded-md border border-[#2a2a3a] bg-[#0b0b12] px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 sm:w-48"
            >
              <option value="">全部知识库</option>
              {catalogItems.map((item) => (
                <option key={item.source_id} value={item.source_id}>{item.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={loading || !queryDraft.trim()} className="bg-emerald-600 text-white hover:bg-emerald-500">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} 检索
          </Button>
        </form>
      </div>

      <div className="p-4">
        {loading ? (
          <div role="status" aria-live="polite" className="flex min-h-24 items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 size-4 animate-spin" /> 检索中…
          </div>
        ) : error ? (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        ) : !searched ? (
          <p className="text-sm text-slate-600">输入查询语句开始检索。可选择只在一个知识库内检索。</p>
        ) : hits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#303044] p-8 text-center text-sm text-slate-500">没有匹配的 chunk。确认对应来源已完成索引。</div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">{total} 条命中</p>
            {hits.map((hit) => {
              const hitKey = compositeHitKey(hit)
              const open = openHitKey === hitKey
              const content = hit.content ?? contents[hitKey]
              return (
                <article key={hitKey} className="overflow-hidden rounded-lg border border-[#242436] bg-[#0b0b12]">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => void openHit(hit)}
                    className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-[#13131e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-all font-mono text-sm text-slate-200">{hit.path}</span>
                        {hit.knowledge_base ? <Badge className="bg-indigo-500/10 text-indigo-300">{hit.knowledge_base}</Badge> : null}
                        <Badge className="bg-emerald-500/10 text-emerald-300">score {hit.score.toFixed(3)}</Badge>
                      </div>
                      {hit.heading_path ? (
                        <div className="mt-1 break-all text-xs text-slate-500">{hit.heading_path}</div>
                      ) : null}
                      <p className="mt-2 line-clamp-3 text-sm leading-5 text-slate-400">{hit.snippet}</p>
                      <NeighborChips neighbors={hit.neighbors ?? []} />
                    </div>
                    {open ? <ChevronUp className="mt-1 size-4 shrink-0 text-slate-500" /> : <ChevronDown className="mt-1 size-4 shrink-0 text-slate-500" />}
                  </button>
                  {open ? (
                    <div className="border-t border-[#242436] p-3">
                      {content !== undefined ? (
                        <pre tabIndex={0} aria-label={`${hit.path} chunk 正文`} className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-[#07070b] p-4 font-mono text-xs leading-6 text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50">{content}</pre>
                      ) : contentLoading ? (
                        <div role="status" aria-live="polite" className="flex items-center justify-center py-4 text-sm text-slate-500">
                          <Loader2 className="mr-2 size-4 animate-spin" /> 加载 chunk 正文…
                        </div>
                      ) : contentError ? (
                        <div role="alert" className="text-sm text-red-300">{contentError}</div>
                      ) : (
                        <p className="py-2 text-sm text-slate-600">该命中没有可用正文。</p>
                      )}
                      <div className="mt-2 text-[11px] text-slate-600">
                        chunk <span className="font-mono">{hit.chunk_key}</span> · revision <span className="font-mono">{shortHash(hit.revision_id)}</span>
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// 1-hop 邻居 chips：out/in 各自图标；out 且无 document_id（dangling）置灰。
function NeighborChips({ neighbors }: { neighbors: KnowledgeDocumentLinkItem[] }) {
  if (neighbors.length === 0) return null
  return (
    <ul aria-label="1-hop 链接邻居" className="mt-2 flex flex-wrap gap-1.5">
      {neighbors.map((neighbor, index) => {
        const dangling = neighbor.direction === "out" && !neighbor.document_id
        return (
          <li
            key={`${neighbor.direction}-${neighbor.path}-${index}`}
            className={`inline-flex max-w-56 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
              dangling
                ? "border-dashed border-[#2a2a3a] text-slate-600"
                : neighbor.direction === "out"
                  ? "border-cyan-500/25 bg-cyan-500/5 text-cyan-300"
                  : "border-amber-500/25 bg-amber-500/5 text-amber-200"
            }`}
            title={dangling ? `${neighbor.path}（目标不存在）` : neighbor.path}
          >
            {neighbor.direction === "out" ? <ArrowUpRight className="size-3 shrink-0" /> : <ArrowDownLeft className="size-3 shrink-0" />}
            <span className="truncate font-mono">{neighbor.path}</span>
          </li>
        )
      })}
    </ul>
  )
}

function compositeHitKey(hit: KnowledgeSearchHit) {
  return `${hit.document_id}:${hit.chunk_key}`
}
