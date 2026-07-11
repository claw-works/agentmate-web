"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import { marked } from "marked"
import { Markdown } from "@/components/markdown"
import { api } from "@/lib/api"
import { Report } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ClickableTag } from "@/components/clickable-tag"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, Copy, ChevronDown } from "lucide-react"

const REPORT_TAGS = ["weekly", "monthly", "customer", "project", "other"] as const
type ReportTag = (typeof REPORT_TAGS)[number]

const tagLabels: Record<ReportTag, string> = {
  weekly: "周报", monthly: "月报", customer: "客户报告", project: "项目报告", other: "其他",
}
const tagBadgeColors: Record<ReportTag, string> = {
  weekly: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  monthly: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  customer: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  project: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  other: "bg-slate-500/20 text-slate-300 border-slate-500/40",
}

function getPrimaryTag(tags: string[]): ReportTag {
  for (const t of REPORT_TAGS) if (tags.includes(t)) return t
  return "other"
}

function getReportId(pathname: string, fallback: string) {
  const parts = pathname.split("/").filter(Boolean)
  const reportsIndex = parts.indexOf("reports")
  return reportsIndex >= 0 ? parts[reportsIndex + 1] ?? fallback : fallback
}

export default function ReportDetailClient() {
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const id = getReportId(pathname, params.id)
  const router = useRouter()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.getReport(id).then(setReport).finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    await api.deleteReport(id)
    router.push("/reports")
  }

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadMd = () => {
    downloadFile(report!.content ?? "", `${report!.title}.md`, "text/markdown")
  }

  const downloadHtml = async () => {
    if (!report) return
    let htmlContent: string

    if (report.format === "html") {
      htmlContent = report.content ?? ""
    } else {
      const body = await marked(report.content ?? "")
      htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${report.title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 860px; margin: 40px auto; padding: 0 24px; color: #24292e; line-height: 1.6; }
  h1,h2,h3,h4 { border-bottom: 1px solid #eee; padding-bottom: .3em; }
  code { background: #f6f8fa; padding: 2px 6px; border-radius: 3px; font-size: 85%; }
  pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow: auto; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #dfe2e5; padding: 8px 16px; }
  th { background: #f6f8fa; }
  blockquote { margin: 0; padding: 0 1em; color: #6a737d; border-left: .25em solid #dfe2e5; }
  img { max-width: 100%; }
</style>
</head>
<body>
${body}
</body>
</html>`
    }

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${report.title}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyContent = async () => {
    await navigator.clipboard.writeText(report!.content ?? "")
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    )
  }

  if (!report) {
    return <p className="text-center text-muted-foreground py-20">报告不存在</p>
  }

  const primaryTag = getPrimaryTag(report.tags)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push("/reports")}>
            ← 返回
          </Button>
          <h1 className="text-xl font-bold truncate">{report.title}</h1>
          <Badge variant="outline" className="shrink-0">{report.format.toUpperCase()}</Badge>
          <Badge variant="outline" className={`shrink-0 ${tagBadgeColors[primaryTag]}`}>
            {tagLabels[primaryTag]}
          </Badge>
        </div>
        <div className="flex gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center gap-1 rounded-md border border-[#3d3d5c] bg-[#1e1e2e] px-3 py-1.5 text-sm text-slate-300 hover:text-white">
              <Download className="h-4 w-4" />
              导出
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#1e1e2e] border-[#3d3d5c]">
              {report.format === "md" && (
                <DropdownMenuItem onClick={downloadMd} className="text-slate-300 hover:text-white cursor-pointer">
                  <Download className="h-4 w-4 mr-2" /> 下载 .md
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={downloadHtml} className="text-slate-300 hover:text-white cursor-pointer">
                <Download className="h-4 w-4 mr-2" /> 下载 .html
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyContent} className="text-slate-300 hover:text-white cursor-pointer">
                <Copy className="h-4 w-4 mr-2" /> {copied ? "已复制 ✓" : "复制内容"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>编辑</Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>删除</Button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span>来源: {report.source}</span>
        <span>·</span>
        <span>创建: {new Date(report.created_at).toLocaleString()}</span>
      </div>
      {report.tags?.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {report.tags.map((t) => (
            <ClickableTag key={t} tag={t} module="reports" />
          ))}
        </div>
      )}

      {/* Content */}
      {report.content && (
        report.format === "html" ? (
          <HtmlIframe content={report.content} title={report.title} />
        ) : (
          <div className="prose prose-invert max-w-none">
            <Markdown>{report.content}</Markdown>
          </div>
        )
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑报告</DialogTitle>
          </DialogHeader>
          <EditForm
            report={report}
            onDone={(updated) => { setEditOpen(false); setReport(updated) }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除报告？</AlertDialogTitle>
            <AlertDialogDescription>此操作不可撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EditForm({ report, onDone }: { report: Report; onDone: (r: Report) => void }) {
  const [title, setTitle] = useState(report.title)
  const [tags, setTags] = useState(report.tags?.join(", ") ?? "")
  const [source, setSource] = useState(report.source)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const updated = await api.updateReport(report.id, {
      title,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      source,
    })
    setSaving(false)
    onDone({ ...report, ...updated })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>标题</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Tags (逗号分隔)</Label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Source</Label>
        <Input value={source} onChange={(e) => setSource(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">注：报告内容和格式创建后不可修改</p>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "保存中..." : "保存"}
      </Button>
    </form>
  )
}

const vendorMap: Record<string, string> = {
  "/vendor/highcharts/highcharts.js":
    "https://cdn.jsdelivr.net/npm/highcharts@12.1.2/highcharts.js",
  "/vendor/highcharts/modules/accessibility.js":
    "https://cdn.jsdelivr.net/npm/highcharts@12.1.2/modules/accessibility.js",
  "/vendor/highcharts/modules/exporting.js":
    "https://cdn.jsdelivr.net/npm/highcharts@12.1.2/modules/exporting.js",
  "/vendor/highcharts/modules/export-data.js":
    "https://cdn.jsdelivr.net/npm/highcharts@12.1.2/modules/export-data.js",
  "/vendor/highcharts/modules/drilldown.js":
    "https://cdn.jsdelivr.net/npm/highcharts@12.1.2/modules/drilldown.js",
  "/vendor/highcharts/modules/heatmap.js":
    "https://cdn.jsdelivr.net/npm/highcharts@12.1.2/modules/heatmap.js",
  "/vendor/highcharts/modules/treemap.js":
    "https://cdn.jsdelivr.net/npm/highcharts@12.1.2/modules/treemap.js",
}

function patchVendorUrls(html: string): string {
  let result = html
  for (const [local, cdn] of Object.entries(vendorMap)) {
    result = result.split(`src="${local}"`).join(`src="${cdn}"`)
    result = result.split(`src='${local}'`).join(`src='${cdn}'`)
  }
  return result
}

function HtmlIframe({ content, title }: { content: string; title: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeHeight, setIframeHeight] = useState(600)

  const handleIframeLoad = () => {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      const height = iframe.contentDocument?.documentElement?.scrollHeight
      if (height && height > 0) {
        setIframeHeight(height + 32)
      }
    } catch {
      setIframeHeight(2000)
    }
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700 shadow-lg">
      <iframe
        ref={iframeRef}
        srcDoc={patchVendorUrls(content)}
        onLoad={handleIframeLoad}
        className="w-full border-0"
        style={{ height: `${iframeHeight}px` }}
        title={title}
      />
    </div>
  )
}
