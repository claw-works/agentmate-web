"use client"

import { useEffect, useState } from "react"
import { useParams, usePathname } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CalendarDays, FileText } from "lucide-react"
import { api } from "@/lib/api"
import type { PublicReport } from "@/lib/types"
import { HtmlReport } from "@/components/html-report"
import { Markdown } from "@/components/markdown"

// 报告的公开独立页：与首页博客同一主题，不需要登录。
// 首页的「独立页面」链接落到这里；管理操作（编辑/删除）在 /reports/manage/<id>。

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

function getReportId(pathname: string, fallback: string) {
  const parts = pathname.split("/").filter(Boolean)
  const reportsIndex = parts.indexOf("reports")
  return reportsIndex >= 0 ? parts[reportsIndex + 1] ?? fallback : fallback
}

export default function PublicReportClient() {
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const id = getReportId(pathname, params.id)
  const [report, setReport] = useState<PublicReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    api.getPublicReport(id)
      .then((data) => {
        if (!cancelled) setReport(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

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
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-[#cbd4cf] px-3 py-2 text-sm font-medium text-[#30443a] transition-colors hover:border-[#176a43] hover:text-[#176a43]"
          >
            <ArrowLeft className="size-4" />
            全部报告
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 lg:py-14">
        {loading ? (
          <div className="animate-pulse" aria-label="正在加载报告">
            <div className="h-4 w-44 rounded bg-[#e7ebe9]" />
            <div className="mt-5 h-9 w-3/4 rounded bg-[#e2e7e4]" />
            <div className="mt-8 h-64 rounded bg-[#eef1ef]" />
          </div>
        ) : error || !report ? (
          <div className="py-20 text-center">
            <p className="text-sm text-[#718078]">{error || "报告不存在或已被删除。"}</p>
            <Link href="/" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#176a43] hover:underline">
              <ArrowLeft className="size-4" /> 返回全部报告
            </Link>
          </div>
        ) : (
          <article>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[#718078]">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                {formatDate(report.created_at)}
              </span>
              {report.source ? <span className="font-medium text-[#176a43]">{report.source}</span> : null}
              <span className="uppercase">{report.format}</span>
            </div>

            {!contentStartsWithTitle(report) ? (
              <h1 className="mt-5 text-3xl font-semibold leading-snug text-[#14231c] sm:text-4xl">
                {report.title}
              </h1>
            ) : null}

            {report.tags?.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {report.tags.map((tag) => (
                  <span key={tag} className="rounded border border-[#cfd8d3] px-2.5 py-1 text-xs text-[#527061]">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-8">
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
                <div className="border-l-2 border-[#cbd4cf] py-3 pl-4 text-sm text-[#718078]">暂无正文。</div>
              )}
            </div>
          </article>
        )}
      </div>
    </main>
  )
}
