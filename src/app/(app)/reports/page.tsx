"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Report } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ClickableTag } from "@/components/clickable-tag"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(dateStr).toLocaleDateString("zh-CN")
}

async function fetchReports(search: string, activeTags: string[], activeSource: string) {
  if (search) {
    const data = await api.searchReports(search)
    return data ?? []
  }
  const params: { tag?: string; source?: string } = {}
  if (activeTags.length > 0) params.tag = activeTags[0]
  if (activeSource) params.source = activeSource
  const data = await api.listReports(params)
  return data ?? []
}

export default function ReportsPage() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTags = useMemo(
    () => [...searchParams.getAll("tags"), ...(searchParams.get("tag") ? [searchParams.get("tag")!] : [])],
    [searchParams]
  )

  const [reports, setReports] = useState<Report[]>([])
  const [sources, setSources] = useState<{ source: string; count: number }[]>([])
  const [search, setSearch] = useState("")
  const [activeSource, setActiveSource] = useState("")
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    api.listReportSources().then(setSources).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setReports(await fetchReports(search, activeTags, activeSource))
  }, [search, activeTags, activeSource])

  useEffect(() => {
    let cancelled = false
    void fetchReports(search, activeTags, activeSource).then((data) => {
      if (!cancelled) setReports(data)
    })
    return () => { cancelled = true }
  }, [search, activeTags, activeSource])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.reports.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.reports.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={`${t.common.search}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-60 bg-[#111118] border-[#1e1e2e] placeholder:text-slate-600"
          />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors">
              {t.reports.newReport}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t.reports.newReport}</DialogTitle></DialogHeader>
              <CreateReportForm onDone={() => { setCreateOpen(false); load() }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {activeTags.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>🏷️ 当前过滤：<span className="text-slate-200">{activeTags.map(t => `#${t}`).join(" ")}</span></span>
          <button onClick={() => router.replace("/reports")} className="text-slate-500 hover:text-slate-300">× 清除</button>
        </div>
      )}

      {/* Source filter */}
      {sources.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-slate-500 shrink-0">来源：</span>
          <button
            onClick={() => setActiveSource("")}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors shrink-0 ${
              !activeSource
                ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/50"
                : "bg-[#1e1e2e] text-slate-400 hover:text-slate-200 border-transparent cursor-pointer"
            }`}
          >
            全部
          </button>
          {sources.map((s) => (
            <button
              key={s.source}
              onClick={() => setActiveSource(s.source === activeSource ? "" : s.source)}
              className={`px-2.5 py-1 rounded-md text-xs border transition-colors shrink-0 ${
                activeSource === s.source
                  ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/50"
                  : "bg-[#1e1e2e] text-slate-400 hover:text-slate-200 border-transparent cursor-pointer"
              }`}
            >
              {s.source} ({s.count})
            </button>
          ))}
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {reports.map((r) => (
          <div
            key={r.id}
            className={`group relative cursor-pointer rounded-xl p-4 transition-all duration-200 hover:border-[#3d3d5c] hover:shadow-lg ${
              r.format === "html"
                ? "bg-[#0d1025] border border-[#1e2545]"
                : "bg-[#111118] border border-[#1e1e2e]"
            }`}
            onClick={() => router.push(`/reports/${r.id}`)}
          >
            {/* Format badge top-right */}
            <span className={`absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-medium border ${
              r.format === "html"
                ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
                : "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
            }`}>
              {r.format.toUpperCase()}
            </span>

            <p className="text-base font-semibold line-clamp-2 text-slate-100 pr-12">{r.title}</p>
            <p className="text-xs text-slate-500 mt-1">{r.source}</p>
            {r.tags?.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {r.tags.slice(0, 3).map((tag) => (
                  <ClickableTag key={tag} tag={tag} module="reports" />
                ))}
                {r.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">+{r.tags.length - 3}</Badge>
                )}
              </div>
            )}
            <p className="text-xs text-slate-600 mt-2">{timeAgo(r.created_at)}</p>
          </div>
        ))}
      </div>
      {reports.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-12">暂无报告</p>
      )}
    </div>
  )
}

function CreateReportForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("")
  const [format, setFormat] = useState<"md" | "html">("md")
  const [content, setContent] = useState("")
  const [source, setSource] = useState("web")
  const [tags, setTags] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await api.createReport({
      title, content, format, source,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    })
    setLoading(false)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>标题</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>格式</Label>
          <Select value={format} onValueChange={(v) => v && setFormat(v as "md" | "html")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="md">Markdown</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>来源</Label>
          <Input value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>标签（逗号分隔）</Label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="分析, aws, 季度" />
      </div>
      <div className="space-y-2">
        <Label>内容</Label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[300px]" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "提交中..." : "创建"}
      </Button>
    </form>
  )
}
