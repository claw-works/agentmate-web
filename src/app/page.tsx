"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, CalendarDays, FileText } from "lucide-react"
import { Markdown } from "@/components/markdown"
import { api } from "@/lib/api"
import { PublicReport } from "@/lib/types"

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function summary(content?: string) {
  if (!content) return "暂无摘要"
  return content
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
}

function HtmlPreview({ report }: { report: PublicReport }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-700/70 bg-white">
      <iframe
        srcDoc={report.content ?? ""}
        className="h-[72vh] min-h-[520px] w-full border-0"
        title={report.title}
      />
    </div>
  )
}

export default function HomePage() {
  const [reports, setReports] = useState<PublicReport[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    void api.listPublicReports({ limit: 12 }).then((data) => {
      if (cancelled) return
      const items = data.items ?? []
      setReports(items)
      setSelectedId(items[0]?.id ?? "")
      setError("")
    }).catch((err) => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : "加载失败")
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedId) ?? reports[0] ?? null,
    [reports, selectedId]
  )

  return (
    <main className="min-h-screen bg-[#08090d] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-slate-800/90 pb-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
              <FileText className="size-4" />
            </span>
            <span>
              <span className="block text-base font-semibold tracking-wide text-white">AgentMate</span>
              <span className="block text-xs text-slate-500">Public Reports</span>
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-emerald-400/60 hover:text-white"
          >
            进入后台
            <ArrowRight className="size-4" />
          </Link>
        </header>

        <section className="grid flex-1 gap-6 py-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:border-r lg:border-slate-800/90 lg:pr-6">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-emerald-300/80">Reports</p>
              <h1 className="text-3xl font-semibold text-white">公开报告</h1>
              <p className="text-sm leading-6 text-slate-500">
                最近发布的报告会在这里公开展示。
              </p>
            </div>

            {loading && (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-28 animate-pulse rounded-lg border border-slate-800 bg-slate-900/70" />
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            {!loading && !error && reports.length === 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 text-sm text-slate-400">
                暂无公开报告。
              </div>
            )}

            {!loading && !error && reports.length > 0 && (
              <div className="space-y-2">
                {reports.map((report) => {
                  const active = selectedReport?.id === report.id
                  return (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => setSelectedId(report.id)}
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${
                        active
                          ? "border-emerald-400/60 bg-emerald-400/10"
                          : "border-slate-800 bg-slate-900/70 hover:border-slate-600"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        <CalendarDays className="size-3.5" />
                        {formatDate(report.created_at)}
                        {report.source && <span className="text-amber-300/80">{report.source}</span>}
                      </span>
                      <span className="mt-2 block line-clamp-2 text-sm font-medium text-slate-100">
                        {report.title}
                      </span>
                      <span className="mt-2 block line-clamp-2 text-xs leading-5 text-slate-500">
                        {summary(report.content)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </aside>

          <article className="min-w-0">
            {selectedReport ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 border-b border-slate-800/90 pb-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{formatDate(selectedReport.created_at)}</span>
                    <span className="rounded border border-slate-700 px-2 py-0.5 text-slate-400">
                      {selectedReport.format.toUpperCase()}
                    </span>
                    {selectedReport.tags?.map((tag) => (
                      <span key={tag} className="rounded border border-emerald-400/30 px-2 py-0.5 text-emerald-200/90">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <h2 className="max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
                    {selectedReport.title}
                  </h2>
                </div>

                {selectedReport.content ? (
                  selectedReport.format === "html" ? (
                    <HtmlPreview report={selectedReport} />
                  ) : (
                    <div className="prose prose-invert max-w-none rounded-lg border border-slate-800 bg-slate-950/70 p-5 prose-headings:text-white prose-a:text-emerald-300 prose-strong:text-slate-100">
                      <Markdown>{selectedReport.content}</Markdown>
                    </div>
                  )
                ) : (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-10 text-center text-sm text-slate-500">
                    暂无正文。
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-[60vh] items-center justify-center rounded-lg border border-slate-800 bg-slate-950/70 text-sm text-slate-500">
                {loading ? "加载中..." : "没有可展示的报告"}
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  )
}
