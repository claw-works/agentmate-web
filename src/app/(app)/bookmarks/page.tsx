"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Bookmark } from "@/lib/types"
import { ClickableTag } from "@/components/clickable-tag"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Eye, EyeOff, Trash2 } from "lucide-react"

type ReadFilter = "all" | "unread" | "read"

function getDomain(url: string) {
  try { return new URL(url).hostname } catch { return "" }
}

async function fetchBookmarks(search: string, readFilter: ReadFilter, activeTags: string[]) {
  if (search) {
    const data = await api.searchBookmarks(search)
    return data ?? []
  }
  const params: { is_read?: boolean; tags?: string[] } = {}
  if (readFilter === "unread") params.is_read = false
  if (readFilter === "read") params.is_read = true
  if (activeTags.length > 0) params.tags = activeTags
  const data = await api.listBookmarks(params)
  return data ?? []
}

export default function BookmarksPage() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTags = useMemo(
    () => [...searchParams.getAll("tags"), ...(searchParams.get("tag") ? [searchParams.get("tag")!] : [])],
    [searchParams]
  )
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [search, setSearch] = useState("")
  const [readFilter, setReadFilter] = useState<ReadFilter>("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBookmarks(await fetchBookmarks(search, readFilter, activeTags))
  }, [search, readFilter, activeTags])

  useEffect(() => {
    let cancelled = false
    void fetchBookmarks(search, readFilter, activeTags).then((data) => {
      if (!cancelled) setBookmarks(data)
    })
    return () => { cancelled = true }
  }, [search, readFilter, activeTags])

  const openDetail = (b: Bookmark) => {
    router.push(`/bookmarks/${b.id}`)
  }

  const toggleRead = async (b: Bookmark, e: React.MouseEvent) => {
    e.stopPropagation()
    await api.updateBookmark(b.id, { is_read: !b.is_read })
    load()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await api.deleteBookmark(deleteId)
    setDeleteId(null)
    load()
  }

  const unreadCount = bookmarks.filter((b) => !b.is_read).length
  const readCount = bookmarks.filter((b) => b.is_read).length

  return (
    <div className="flex gap-6">
      {/* Left filter */}
      <aside className="w-[180px] shrink-0 space-y-1">
        {([
          { key: "all", label: t.common.all, count: bookmarks.length },
          { key: "unread", label: t.bookmarks.unread, count: unreadCount },
          { key: "read", label: t.bookmarks.read, count: readCount },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setReadFilter(f.key)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              readFilter === f.key
                ? "bg-indigo-500/10 text-indigo-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            {f.label} <span className="text-slate-600">({f.count})</span>
          </button>
        ))}
      </aside>

      {/* Main */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{t.bookmarks.title}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t.bookmarks.subtitle}</p>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={`${t.common.search}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-60 bg-[#111118] border-[#1e1e2e] placeholder:text-slate-600"
            />
            <button
              onClick={() => setCreateOpen(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
            >
              {t.bookmarks.newBookmark}
            </button>
          </div>
        </div>

        {activeTags.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>🏷️ 当前过滤：<span className="text-slate-200">{activeTags.map(t => `#${t}`).join(" ")}</span></span>
            <button onClick={() => router.replace("/bookmarks")} className="text-slate-500 hover:text-slate-300">× 清除</button>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {bookmarks.map((b) => (
            <div
              key={b.id}
              onClick={() => openDetail(b)}
              className={`group relative bg-[#111118] border border-[#1e1e2e] rounded-xl p-4 pl-5 hover:border-[#3d3d5c] transition-all duration-200 cursor-pointer ${
                b.is_read ? "opacity-60" : ""
              }`}
            >
              {/* Left bar */}
              <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${b.is_read ? "bg-slate-700" : "bg-indigo-500"}`} />

              {/* Actions top-right */}
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => toggleRead(b, e)}
                  className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-slate-200"
                  title={b.is_read ? "标为未读" : "标为已读"}
                >
                  {b.is_read ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteId(b.id) }}
                  className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {/* Header */}
              <div className="flex items-center gap-2">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${getDomain(b.url)}&sz=32`}
                  alt=""
                  className="w-4 h-4 rounded-sm shrink-0"
                />
                <p className={`font-medium text-sm truncate ${b.is_read ? "text-slate-500" : "text-slate-100"}`}>
                  {b.title}
                </p>
              </div>
              <p className="text-xs text-slate-600 truncate mt-1">{b.url}</p>
              {b.summary && (
                <p className="text-sm text-slate-400 mt-2 line-clamp-2">{b.summary}</p>
              )}

              {/* Footer */}
              <div className="flex items-center gap-2 mt-3 flex-wrap border-t border-[#1e1e2e] pt-3">
                {b.tags?.map((tag) => (
                  <ClickableTag key={tag} tag={tag} module="bookmarks" />
                ))}
                {b.source && (
                  <Badge variant="outline" className="text-xs text-slate-500 border-slate-700">{b.source}</Badge>
                )}
                <span className="text-xs text-slate-600 ml-auto">{new Date(b.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {bookmarks.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-12 col-span-full">暂无书签</p>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.bookmarks.newBookmark}</DialogTitle></DialogHeader>
          <CreateBookmarkForm onDone={() => { setCreateOpen(false); load() }} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.common.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>{t.common.deleteWarning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t.common.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CreateBookmarkForm({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [tags, setTags] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await api.createBookmark({
      url,
      title: title || undefined,
      summary: summary || undefined,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
    })
    setLoading(false)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>URL *</Label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://..." />
      </div>
      <div className="space-y-2">
        <Label>标题</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="留空自动提取" />
      </div>
      <div className="space-y-2">
        <Label>摘要</Label>
        <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-[80px]" />
      </div>
      <div className="space-y-2">
        <Label>Tags (逗号分隔)</Label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tech, article" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "添加中..." : "添加"}
      </Button>
    </form>
  )
}
