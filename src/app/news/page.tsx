"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Newspaper } from "lucide-react"
import { api } from "@/lib/api"
import type { PublicReport } from "@/lib/types"

const PAGE_SIZES = [20, 50, 100] as const
type PageSize = (typeof PAGE_SIZES)[number]

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function NewsPage() {
  const [items, setItems] = useState<PublicReport[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    api.listPublicReports({ limit: pageSize, offset: (page - 1) * pageSize })
      .then(result => {
        if (cancelled) return
        setItems(result.items || [])
        setTotal(result.total || 0)
        setError("")
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载最新信息失败")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [page, pageSize])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-[#17201c]">
      <header className="sticky top-0 z-20 border-b border-[#dfe5e1] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="AgentMate 首页">
            <Image src="/agentmate-mark.svg" alt="" width={36} height={36} priority />
            <span className="font-bold tracking-tight text-[#14231c]">AgentMate</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#456055] hover:text-[#176a43]">
            <ArrowLeft className="size-4" /> <span className="hidden sm:inline">公开报告</span>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 border-b border-[#d7dfda] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#176a43]">
              <Newspaper className="size-4" /> News
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">最新信息</h1>
            <p className="mt-2 text-sm text-[#718078]">按发布时间倒序 · {start}–{end} / 共 {total} 条</p>
          </div>
          <label className="flex w-fit items-center gap-2 text-sm text-[#64736b]">
            每页
            <select
              value={pageSize}
              onChange={event => {
                setLoading(true)
                setPageSize(Number(event.target.value) as PageSize)
                setPage(1)
              }}
              className="h-9 rounded-lg border border-[#cbd4cf] bg-white px-3 font-medium text-[#26382f] outline-none focus:border-[#176a43]"
            >
              {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
            条
          </label>
        </div>

        {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="mt-4 overflow-hidden rounded-xl border border-[#dfe5e1] bg-white shadow-sm">
          {loading ? (
            <div className="divide-y divide-[#edf0ee]">
              {Array.from({ length: 8 }).map((_, index) => <div key={index} className="animate-pulse px-4 py-5 sm:px-6"><div className="h-4 w-4/5 rounded bg-[#e7ebe9]" /><div className="mt-3 h-3 w-36 rounded bg-[#eef1ef]" /></div>)}
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-20 text-center text-sm text-[#718078]">暂无公开信息</div>
          ) : (
            <ol className="divide-y divide-[#edf0ee]">
              {items.map((item, index) => (
                <li key={item.id}>
                  <Link href={`/reports/${item.id}`} className="group flex min-h-20 items-start gap-3 px-4 py-4 transition-colors active:bg-[#f2f7f4] sm:gap-4 sm:px-6 sm:hover:bg-[#f7faf8]">
                    <span className="mt-0.5 w-7 shrink-0 text-right text-xs tabular-nums text-[#9aa59f]">{(page - 1) * pageSize + index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium leading-6 text-[#1d3026] group-hover:text-[#176a43] sm:text-base">{item.title}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#7a8881]">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(item.created_at)}</span>
                        {item.source && <span className="max-w-48 truncate">{item.source}</span>}
                      </span>
                    </span>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-[#a7b0ab] transition-transform group-hover:translate-x-0.5 group-hover:text-[#176a43]" />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>

        <nav aria-label="News 分页" className="mt-5 flex items-center justify-between gap-3">
          <button disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage(value => Math.max(1, value - 1)) }} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#cbd4cf] bg-white px-4 text-sm font-medium text-[#40564b] disabled:opacity-40">
            <ChevronLeft className="size-4" />上一页
          </button>
          <span className="text-sm tabular-nums text-[#718078]">{total === 0 ? 0 : page} / {total === 0 ? 0 : totalPages}</span>
          <button disabled={page >= totalPages || loading || total === 0} onClick={() => { setLoading(true); setPage(value => value + 1) }} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#cbd4cf] bg-white px-4 text-sm font-medium text-[#40564b] disabled:opacity-40">
            下一页<ChevronRight className="size-4" />
          </button>
        </nav>
      </section>
    </main>
  )
}
