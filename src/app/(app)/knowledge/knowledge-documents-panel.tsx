"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  FileQuestion,
  FileText,
  Loader2,
} from "lucide-react"
import { api } from "@/lib/api"
import type {
  KnowledgeDocument,
  KnowledgeDocumentLinksResponse,
  KnowledgeDocumentSummary,
} from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AsyncEntry, errorMessage, formatBytes, isAbortError, shortHash } from "./helpers"

const DOC_PAGE_SIZE = 20
const LINK_PAGE_SIZE = 50

// 选中来源 active revision 的文档浏览：列表分页只拉 metadata，
// 点开单个文档才 GET 正文与双向 links。
export function KnowledgeDocumentsPanel({ revisionID }: { revisionID: string }) {
  const [items, setItems] = useState<KnowledgeDocumentSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openDocID, setOpenDocID] = useState<string | null>(null)
  const [contents, setContents] = useState<Record<string, AsyncEntry<KnowledgeDocument>>>({})
  const [links, setLinks] = useState<Record<string, AsyncEntry<KnowledgeDocumentLinksResponse>>>({})

  const requestID = useRef(0)
  const abortRef = useRef(new AbortController())
  const detailRequests = useRef(new Map<string, number>())

  const loadDocuments = useCallback(async (offset: number, append: boolean) => {
    const id = ++requestID.current
    abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setError(null)
    }
    try {
      const response = await api.listKnowledgeRevisionDocuments(
        revisionID,
        { limit: DOC_PAGE_SIZE, offset },
        controller.signal
      )
      if (id !== requestID.current) return
      const nextItems = response.items ?? []
      setItems((current) => (append ? mergeByID(current, nextItems) : nextItems))
      setTotal(response.total ?? 0)
    } catch (err) {
      if (isAbortError(err) || id !== requestID.current) return
      setError(errorMessage(err))
    } finally {
      if (id === requestID.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [revisionID])

  useEffect(() => {
    // revision 切换：重置全部状态再加载
    setItems([])
    setTotal(0)
    setOpenDocID(null)
    setContents({})
    setLinks({})
    detailRequests.current.clear()
    void loadDocuments(0, false)
    const controllerRef = abortRef.current
    return () => controllerRef.abort()
  }, [loadDocuments])

  const openDocument = async (doc: KnowledgeDocumentSummary) => {
    if (openDocID === doc.id) {
      setOpenDocID(null)
      return
    }
    setOpenDocID(doc.id)
    const detailID = (detailRequests.current.get(doc.id) ?? 0) + 1
    detailRequests.current.set(doc.id, detailID)

    if (!contents[doc.id]?.data && !contents[doc.id]?.loading) {
      setContents((current) => ({ ...current, [doc.id]: { loading: true } }))
      try {
        const data = await api.getKnowledgeDocument(revisionID, doc.id)
        if (detailRequests.current.get(doc.id) !== detailID) return
        setContents((current) => ({ ...current, [doc.id]: { data, loading: false } }))
      } catch (err) {
        if (detailRequests.current.get(doc.id) !== detailID) return
        setContents((current) => ({ ...current, [doc.id]: { loading: false, error: errorMessage(err) } }))
      }
    }

    if (!links[doc.id]?.data && !links[doc.id]?.loading) {
      setLinks((current) => ({ ...current, [doc.id]: { loading: true } }))
      try {
        const data = await api.listKnowledgeDocumentLinks(doc.id, { limit: LINK_PAGE_SIZE })
        if (detailRequests.current.get(doc.id) !== detailID) return
        setLinks((current) => ({ ...current, [doc.id]: { data, loading: false } }))
      } catch (err) {
        if (detailRequests.current.get(doc.id) !== detailID) return
        setLinks((current) => ({ ...current, [doc.id]: { loading: false, error: errorMessage(err) } }))
      }
    }
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-32 items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 size-4 animate-spin" /> 加载文档列表…
      </div>
    )
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        <span>{error}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => void loadDocuments(0, false)} className="border-red-400/30 bg-transparent text-red-100">重试</Button>
      </div>
    )
  }
  if (items.length === 0) {
    return <div className="rounded-lg border border-dashed border-[#303044] p-8 text-center text-sm text-slate-500">该 revision 没有文档。</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>仅 metadata 列表 · 正文与 links 按点击加载</span>
        <span>{items.length}/{total}</span>
      </div>
      {items.map((doc) => {
        const open = openDocID === doc.id
        const contentEntry = contents[doc.id]
        const linkEntry = links[doc.id]
        return (
          <article key={doc.id} className="overflow-hidden rounded-lg border border-[#242436] bg-[#0b0b12]">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => void openDocument(doc)}
              className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-[#13131e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {doc.indexable ? <FileText className="size-4 shrink-0 text-emerald-300" /> : <FileQuestion className="size-4 shrink-0 text-slate-500" />}
                  <span className="break-all font-mono text-sm text-slate-200">{doc.path}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span>{doc.mime_type || "unknown mime"}</span>
                  <span>{formatBytes(doc.size_bytes)}</span>
                  <span className="font-mono">{shortHash(doc.sha256)}</span>
                </div>
              </div>
              <Badge className={doc.indexable ? "shrink-0 bg-emerald-500/10 text-emerald-300" : "shrink-0 bg-slate-500/10 text-slate-400"}>
                {doc.indexable ? "indexable" : "metadata only"}
              </Badge>
            </button>

            {open ? (
              <div className="space-y-3 border-t border-[#242436] p-3">
                {contentEntry?.loading ? (
                  <div role="status" aria-live="polite" className="flex items-center justify-center py-4 text-sm text-slate-500">
                    <Loader2 className="mr-2 size-4 animate-spin" /> 加载文档正文…
                  </div>
                ) : contentEntry?.error ? (
                  <div role="alert" className="text-sm text-red-300">{contentEntry.error}</div>
                ) : contentEntry?.data?.content_snapshot ? (
                  <pre tabIndex={0} aria-label={`${doc.path} 正文`} className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-[#07070b] p-4 font-mono text-xs leading-6 text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50">{contentEntry.data.content_snapshot}</pre>
                ) : (
                  <p className="text-sm text-slate-600">该文档没有文本内容快照。</p>
                )}

                <div className="rounded-md border border-[#1d1d2b] bg-[#101018] p-3">
                  <h4 className="text-xs font-medium text-slate-300">文档链接（双向）</h4>
                  {linkEntry?.loading ? (
                    <div role="status" aria-live="polite" className="flex items-center gap-2 py-2 text-xs text-slate-500">
                      <Loader2 className="size-3.5 animate-spin" /> 加载 links…
                    </div>
                  ) : linkEntry?.error ? (
                    <div role="alert" className="py-2 text-xs text-red-300">{linkEntry.error}</div>
                  ) : (linkEntry?.data?.items ?? []).length === 0 ? (
                    <p className="mt-2 text-xs text-slate-600">该文档没有包内链接。</p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${doc.path} 的链接`}>
                      {(linkEntry?.data?.items ?? []).map((link, index) => {
                        const dangling = link.direction === "out" && !link.document_id
                        return (
                          <li
                            key={`${link.direction}-${link.path}-${index}`}
                            className={`inline-flex max-w-64 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                              dangling
                                ? "border-dashed border-[#2a2a3a] text-slate-600"
                                : link.direction === "out"
                                  ? "border-cyan-500/25 bg-cyan-500/5 text-cyan-300"
                                  : "border-amber-500/25 bg-amber-500/5 text-amber-200"
                            }`}
                            title={dangling ? `${link.path}（目标不存在）` : link.path}
                          >
                            {link.direction === "out" ? <ArrowUpRight className="size-3 shrink-0" /> : <ArrowDownLeft className="size-3 shrink-0" />}
                            <span className="truncate font-mono">{link.path}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {linkEntry?.data && linkEntry.data.total > (linkEntry.data.items ?? []).length ? (
                    <p className="mt-2 text-[11px] text-slate-600">共 {linkEntry.data.total} 条链接，仅显示前 {(linkEntry.data.items ?? []).length} 条。</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </article>
        )
      })}

      {items.length < total ? (
        <Button
          type="button"
          variant="outline"
          disabled={loadingMore}
          onClick={() => void loadDocuments(items.length, true)}
          className="w-full border-[#2a2a3a] bg-[#12121a] text-slate-200"
        >
          {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
          加载更多文档
        </Button>
      ) : null}
    </div>
  )
}

function mergeByID(current: KnowledgeDocumentSummary[], incoming: KnowledgeDocumentSummary[]) {
  const map = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) map.set(item.id, item)
  return [...map.values()]
}
