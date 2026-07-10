"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Markdown } from "@/components/markdown"
import { ClickableTag } from "@/components/clickable-tag"
import { api } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Note } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

async function fetchNotes(search: string, tagFilter: string[]) {
  if (search) {
    const data = await api.searchNotes(search)
    return data ?? []
  }
  const data = await api.listNotes(tagFilter.length > 0 ? { tags: tagFilter } : undefined)
  return data ?? []
}

export default function NotesPage() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tagFilter = useMemo(
    () => [...searchParams.getAll("tags"), ...(searchParams.get("tag") ? [searchParams.get("tag")!] : [])],
    [searchParams]
  )
  const [notes, setNotes] = useState<Note[]>([])
  const [search, setSearch] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [mode, setMode] = useState<"edit" | "preview">("edit")

  const load = useCallback(async () => {
    setNotes(await fetchNotes(search, tagFilter))
  }, [search, tagFilter])

  useEffect(() => {
    let cancelled = false
    void fetchNotes(search, tagFilter).then((data) => {
      if (!cancelled) setNotes(data)
    })
    return () => { cancelled = true }
  }, [search, tagFilter])

  const filteredNotes = notes

  const handleDelete = async () => {
    if (!deleteId) return
    await api.deleteNote(deleteId)
    setDeleteId(null)
    load()
  }

  const openNote = (note: Note) => {
    setEditingNote(note)
    setMode("preview")
    setSheetOpen(true)
  }

  const openNew = () => {
    setEditingNote(null)
    setMode("edit")
    setSheetOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.notes.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.notes.subtitle}</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) setEditingNote(null) }}>
          <SheetTrigger className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors" onClick={openNew}>
            {t.notes.newNote}
          </SheetTrigger>
          <SheetContent side="right" style={{ width: "720px", maxWidth: "90vw" }} className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editingNote ? editingNote.title : t.notes.newNote}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              {editingNote && mode === "preview" ? (
                <div className="space-y-4">
                  <div className="prose prose-invert max-w-none">
                    <Markdown>{editingNote.content}</Markdown>
                  </div>
                  {editingNote.tags?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {editingNote.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                    {t.common.edit}
                  </Button>
                </div>
              ) : (
                <NoteForm
                  note={editingNote}
                  onDone={() => { setSheetOpen(false); setEditingNote(null); load() }}
                  onCancel={editingNote ? () => setMode("preview") : undefined}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Input
        placeholder={`${t.common.search}...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm bg-[#111118] border-[#1e1e2e] placeholder:text-slate-600"
      />

      {tagFilter.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span>🏷️ 当前过滤：{tagFilter.map(t => `#${t}`).join(" ")}</span>
          <Button variant="ghost" size="sm" onClick={() => router.push("/notes")}>× 清除</Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredNotes.map((note) => (
          <Card
            key={note.id}
            className="group cursor-pointer bg-[#111118] border-[#1e1e2e] rounded-xl hover:border-[#3d3d5c] hover:shadow-lg transition-all duration-200"
            onClick={() => openNote(note)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">{note.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground line-clamp-3">{note.content}</p>
              <div className="flex gap-1 flex-wrap">
                {note.tags?.map((tag) => (
                  <ClickableTag key={tag} tag={tag} module="notes" />
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(note.updated_at).toLocaleDateString()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); setDeleteId(note.id) }}
                >
                  {t.common.delete}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredNotes.length === 0 && (
          <p className="text-muted-foreground text-sm col-span-full text-center py-8">No notes found.</p>
        )}
      </div>

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

function NoteForm({ note, onDone, onCancel }: { note: Note | null; onDone: () => void; onCancel?: () => void }) {
  const { t } = useI18n()
  const [title, setTitle] = useState(note?.title ?? "")
  const [content, setContent] = useState(note?.content ?? "")
  const [tags, setTags] = useState(note?.tags?.join(", ") ?? "")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const data = {
      title,
      content,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    }
    if (note) {
      await api.updateNote(note.id, data)
    } else {
      await api.createNote(data)
    }
    setLoading(false)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Content</Label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[400px]" />
      </div>
      <div className="space-y-2">
        <Label>Tags (comma separated)</Label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="personal, ideas" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? `${t.common.save}...` : note ? t.common.save : t.common.create}
      </Button>
      {onCancel && (
        <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      )}
    </form>
  )
}
