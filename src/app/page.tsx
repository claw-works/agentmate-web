"use client"

import { useEffect, useRef, useState } from "react"
import type { SyntheticEvent } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  X,
} from "lucide-react"
import { Markdown } from "@/components/markdown"
import { api } from "@/lib/api"
import { PublicReport, PublicReportSource } from "@/lib/types"

const PAGE_SIZES = [5, 10, 20] as const

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function contentStartsWithTitle(report: PublicReport) {
  const firstLine = report.content?.split("\n").find((line) => line.trim()) ?? ""
  return firstLine.replace(/^#+\s*/, "").trim() === report.title
}

function HtmlReport({ report }: { report: PublicReport }) {
  const [height, setHeight] = useState(480)
  const resizeObserver = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    return () => resizeObserver.current?.disconnect()
  }, [])

  const handleLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
    resizeObserver.current?.disconnect()
    const document = event.currentTarget.contentDocument
    if (!document) return

    const updateHeight = () => {
      setHeight(Math.max(document.body?.scrollHeight ?? 0, document.documentElement.scrollHeight, 320))
    }

    updateHeight()
    resizeObserver.current = new ResizeObserver(updateHeight)
    resizeObserver.current.observe(document.documentElement)
  }

  return (
    <iframe
      srcDoc={report.content ?? ""}
      className="w-full border-0 bg-white"
      style={{ height }}
      title={report.title}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      onLoad={handleLoad}
    />
  )
}

export default function HomePage() {
  const [reports, setReports] = useState<PublicReport[]>([])
  const [sources, setSources] = useState<PublicReportSource[]>([])
  const [activeSource, setActiveSource] = useState("")
  const [activeTag, setActiveTag] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(5)
  const [total, setTotal] = useState(0)
  const [allTotal, setAllTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      api.listPublicReports({
        source: activeSource || undefined,
        tag: activeTag || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      api.listPublicReportSources(),
    ]).then(([reportData, sourceData]) => {
      if (cancelled) return
      setReports(reportData.items ?? [])
      setTotal(reportData.total ?? 0)
      setSources(sourceData ?? [])
      if (!activeSource && !activeTag) {
        setAllTotal(reportData.total ?? 0)
      }
      setError("")
    }).catch((err) => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : "加载失败")
    }).finally(() => {
      if (!cancelled) {
        setLoading(false)
        setLoaded(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [activeSource, activeTag, page, pageSize])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const visibleStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const visibleEnd = Math.min(page * pageSize, total)
  const fallbackTotal = sources.reduce((sum, source) => sum + source.count, 0)
  const publicTotal = allTotal ?? fallbackTotal

  const selectSource = (source: string) => {
    if (source === activeSource) return
    setLoading(true)
    setActiveSource(source)
    setPage(1)
  }

  const selectTag = (tag: string) => {
    setLoading(true)
    setActiveTag((current) => current === tag ? "" : tag)
    setPage(1)
  }

  const changePageSize = (value: string) => {
    const nextSize = Number(value)
    if (!PAGE_SIZES.includes(nextSize as (typeof PAGE_SIZES)[number])) return
    setLoading(true)
    setPageSize(nextSize as (typeof PAGE_SIZES)[number])
    setPage(1)
  }

  const changePage = (nextPage: number) => {
    if (nextPage === page) return
    setLoading(true)
    setPage(nextPage)
  }

  return (
    <main className="min-h-screen bg-white text-[#17201c]">
      <header className="border-b border-[#dfe5e1] bg-white">
        <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-[#176a43] text-white">
              <FileText className="size-4" />
            </span>
            <span>
              <span className="block text-base font-semibold text-[#14231c]">AgentMate</span>
              <span className="block text-xs text-[#718078]">Public Reports</span>
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md border border-[#cbd4cf] px-3 py-2 text-sm font-medium text-[#30443a] transition-colors hover:border-[#176a43] hover:text-[#176a43]"
          >
            进入后台
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[1480px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-[#dfe5e1] bg-[#f5f7f6] px-5 py-7 sm:px-8 lg:border-r lg:border-b-0 lg:px-6 lg:py-10">
          <div className="lg:sticky lg:top-8">
            <p className="mb-3 text-xs font-semibold uppercase text-[#6d7c74]">来源</p>
            <nav aria-label="报告来源" className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              <button
                type="button"
                onClick={() => selectSource("")}
                className={`flex min-h-10 items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm transition-colors ${
                  activeSource === ""
                    ? "bg-[#deebe4] font-semibold text-[#115f3a]"
                    : "text-[#42524a] hover:bg-[#e9eeeb] hover:text-[#18251e]"
                }`}
              >
                <span>全部</span>
                <span className="shrink-0 text-xs tabular-nums text-[#718078]">{publicTotal}</span>
              </button>
              {sources.map((source) => (
                <button
                  key={source.source}
                  type="button"
                  onClick={() => selectSource(source.source)}
                  className={`flex min-h-10 items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm transition-colors ${
                    activeSource === source.source
                      ? "bg-[#deebe4] font-semibold text-[#115f3a]"
                      : "text-[#42524a] hover:bg-[#e9eeeb] hover:text-[#18251e]"
                  }`}
                >
                  <span className="min-w-0 break-words">{source.source}</span>
                  <span className="shrink-0 text-xs tabular-nums text-[#718078]">{source.count}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-8 sm:px-8 lg:px-10 lg:py-10 xl:px-14">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-col gap-5 border-b border-[#dfe5e1] pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-[#176a43]">
                  {activeSource || "全部来源"}
                </p>
                <h1 className="text-3xl font-semibold text-[#14231c]">公开报告</h1>
                <p className="mt-2 text-sm text-[#718078]">
                  共 {total} 篇，当前显示 {visibleStart}-{visibleEnd}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-[#64736b]">
                每页
                <select
                  value={pageSize}
                  onChange={(event) => changePageSize(event.target.value)}
                  className="h-9 rounded border border-[#cbd4cf] bg-white px-3 text-sm font-medium text-[#26382f] outline-none transition-colors focus:border-[#176a43] focus:ring-2 focus:ring-[#176a43]/15"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                篇
              </label>
            </div>

            {activeTag ? (
              <div className="flex items-center justify-between gap-4 border-b border-[#dfe5e1] bg-[#f3f8f5] px-4 py-3 text-sm text-[#28573f]">
                <span>标签：#{activeTag}</span>
                <button
                  type="button"
                  onClick={() => selectTag(activeTag)}
                  className="flex size-7 items-center justify-center rounded text-[#527061] transition-colors hover:bg-[#deebe4] hover:text-[#124e32]"
                  aria-label="清除标签筛选"
                  title="清除标签筛选"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : null}

            {!loaded && loading ? (
              <div className="space-y-10 py-10" aria-label="正在加载报告">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="animate-pulse border-b border-[#e5e9e7] pb-10">
                    <div className="h-4 w-44 rounded bg-[#e7ebe9]" />
                    <div className="mt-5 h-9 w-3/4 rounded bg-[#e2e7e4]" />
                    <div className="mt-8 h-40 rounded bg-[#eef1ef]" />
                  </div>
                ))}
              </div>
            ) : null}

            {loaded && error ? (
              <div className="my-8 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {loaded && !error && reports.length === 0 ? (
              <div className="py-20 text-center text-sm text-[#718078]">
                当前筛选条件下没有报告。
              </div>
            ) : null}

            {loaded && !error && reports.length > 0 ? (
              <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"} aria-busy={loading}>
                {reports.map((report) => (
                  <article
                    key={report.id}
                    className="border-b border-[#dfe5e1] py-10 first:pt-8 last:border-b-0 sm:py-14"
                  >
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[#718078]">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-3.5" />
                          {formatDate(report.created_at)}
                        </span>
                        {report.source ? (
                          <button
                            type="button"
                            onClick={() => selectSource(report.source)}
                            className="font-medium text-[#176a43] hover:underline"
                          >
                            {report.source}
                          </button>
                        ) : null}
                        <span className="uppercase">{report.format}</span>
                      </div>
                      <Link
                        href={`/reports/${report.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5d6c64] transition-colors hover:text-[#176a43]"
                      >
                        独立页面
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </div>

                    {!contentStartsWithTitle(report) ? (
                      <h2 className="mb-7 text-2xl font-semibold leading-snug text-[#14231c] sm:text-3xl">
                        {report.title}
                      </h2>
                    ) : null}

                    {report.tags?.length ? (
                      <div className="mb-7 flex flex-wrap gap-2">
                        {report.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => selectTag(tag)}
                            className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                              activeTag === tag
                                ? "border-[#176a43] bg-[#176a43] text-white"
                                : "border-[#cfd8d3] text-[#527061] hover:border-[#176a43] hover:text-[#176a43]"
                            }`}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {report.content ? (
                      report.format === "html" ? (
                        <div className="overflow-hidden border border-[#dfe5e1]">
                          <HtmlReport report={report} />
                        </div>
                      ) : (
                        <div className="prose prose-slate max-w-none prose-headings:text-[#14231c] prose-a:text-[#176a43] prose-strong:text-[#20342a] prose-pre:bg-[#17201c]">
                          <Markdown variant="light">{report.content}</Markdown>
                        </div>
                      )
                    ) : (
                      <div className="border-l-2 border-[#cbd4cf] py-3 pl-4 text-sm text-[#718078]">
                        暂无正文。
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : null}

            {loaded && !error && totalPages > 1 ? (
              <nav className="flex items-center justify-between border-t border-[#dfe5e1] py-7" aria-label="报告分页">
                <p className="text-sm tabular-nums text-[#718078]">
                  第 {page} / {totalPages} 页
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changePage(Math.max(1, page - 1))}
                    disabled={page <= 1 || loading}
                    className="flex size-9 items-center justify-center rounded border border-[#cbd4cf] text-[#42524a] transition-colors hover:border-[#176a43] hover:text-[#176a43] disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="上一页"
                    title="上一页"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => changePage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages || loading}
                    className="flex size-9 items-center justify-center rounded border border-[#cbd4cf] text-[#42524a] transition-colors hover:border-[#176a43] hover:text-[#176a43] disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="下一页"
                    title="下一页"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </nav>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
