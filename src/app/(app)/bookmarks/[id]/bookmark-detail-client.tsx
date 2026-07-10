"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Bookmark } from "@/lib/types"
import { Markdown } from "@/components/markdown"
import { ClickableTag } from "@/components/clickable-tag"
import { Button } from "@/components/ui/button"
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
import { Download, Copy, ChevronDown, ExternalLink } from "lucide-react"

export default function BookmarkDetailClient() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [bookmark, setBookmark] = useState<Bookmark | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.getBookmark(id).then((b) => {
      setBookmark(b)
      if (!b.is_read) {
        api.updateBookmark(id, { is_read: true }).catch(() => {})
      }
    }).finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    await api.deleteBookmark(id)
    router.push("/bookmarks")
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
    downloadFile(bookmark!.content ?? "", `${bookmark!.title}.md`, "text/markdown")
  }

  const downloadTxt = () => {
    downloadFile(bookmark!.content ?? "", `${bookmark!.title}.txt`, "text/plain")
  }

  const copyContent = async () => {
    await navigator.clipboard.writeText(bookmark!.content ?? "")
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

  if (!bookmark) {
    return <p className="text-center text-muted-foreground py-20">书签不存在</p>
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push("/bookmarks")}>
            ← 返回
          </Button>
          <h1 className="text-xl font-bold truncate">{bookmark.title}</h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="gap-1 text-slate-300 hover:text-white">
              <ExternalLink className="h-4 w-4" /> 原网页
            </Button>
          </a>
          {bookmark.content && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center gap-1 rounded-md border border-[#3d3d5c] bg-[#1e1e2e] px-3 py-1.5 text-sm text-slate-300 hover:text-white">
                <Download className="h-4 w-4" />
                导出
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#1e1e2e] border-[#3d3d5c]">
                <DropdownMenuItem onClick={downloadMd} className="text-slate-300 hover:text-white cursor-pointer">
                  <Download className="h-4 w-4 mr-2" /> 下载 .md
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadTxt} className="text-slate-300 hover:text-white cursor-pointer">
                  <Download className="h-4 w-4 mr-2" /> 下载 .txt
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyContent} className="text-slate-300 hover:text-white cursor-pointer">
                  <Copy className="h-4 w-4 mr-2" /> {copied ? "已复制 ✓" : "复制内容"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>删除</Button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {bookmark.source && <span>来源: {bookmark.source}</span>}
        <span>创建: {new Date(bookmark.created_at).toLocaleString()}</span>
        {bookmark.tags?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {bookmark.tags.map((t) => <ClickableTag key={t} tag={t} module="bookmarks" />)}
          </div>
        )}
      </div>

      {/* Summary */}
      {bookmark.summary && (
        <div className="rounded-lg bg-[#111118] border border-[#1e1e2e] p-4">
          <p className="text-sm text-slate-400">{bookmark.summary}</p>
        </div>
      )}

      {/* Content */}
      {bookmark.content ? (
        <div className="prose prose-invert max-w-none">
          <Markdown>{bookmark.content}</Markdown>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <p className="text-sm mb-4">暂无内容</p>
          <a href={bookmark.url} target="_blank" rel="noopener noreferrer"
             className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2">
            在浏览器中打开 <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除书签？</AlertDialogTitle>
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
