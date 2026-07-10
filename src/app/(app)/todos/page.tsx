"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Todo } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ClickableTag } from "@/components/clickable-tag"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const priorityColors: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  low: "bg-green-500/20 text-green-400 border border-green-500/30",
}

const statusBarColors: Record<string, string> = {
  pending: "bg-amber-500",
  in_progress: "bg-blue-500",
  done: "bg-emerald-500",
}

async function fetchTodos(search: string, tagFilter: string[]) {
  if (search) {
    const data = await api.searchTodos(search)
    return data ?? []
  }
  const data = await api.listTodos(tagFilter.length > 0 ? { tags: tagFilter } : undefined)
  return data ?? []
}

export default function TodosPage() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tagFilter = useMemo(
    () => [...searchParams.getAll("tags"), ...(searchParams.get("tag") ? [searchParams.get("tag")!] : [])],
    [searchParams]
  )
  const [todos, setTodos] = useState<Todo[]>([])
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setTodos(await fetchTodos(search, tagFilter))
  }, [search, tagFilter])

  useEffect(() => {
    let cancelled = false
    void fetchTodos(search, tagFilter).then((data) => {
      if (!cancelled) setTodos(data)
    })
    return () => { cancelled = true }
  }, [search, tagFilter])

  const filteredTodos = todos
  const grouped = {
    pending: filteredTodos.filter((t) => t.status === "pending"),
    in_progress: filteredTodos.filter((t) => t.status === "in_progress"),
    done: filteredTodos.filter((t) => t.status === "done"),
  }
  const visibleTodos = activeTab === "all" ? filteredTodos : grouped[activeTab as keyof typeof grouped]

  const handleDelete = async () => {
    if (!deleteId) return
    await api.deleteTodo(deleteId)
    setDeleteId(null)
    load()
  }

  const handleStatusChange = async (todo: Todo, status: string) => {
    await api.updateTodo(todo.id, { status: status as Todo["status"] })
    load()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t.todos.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.todos.subtitle}</p>
        </div>
        <button
          onClick={() => { setEditingTodo(null); setDialogOpen(true) }}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
        >
          {t.todos.newTodo}
        </button>
      </div>

      {/* Search */}
      <Input
        placeholder={`${t.common.search}...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm bg-[#111118] border-[#1e1e2e] placeholder:text-slate-600"
      />

      {tagFilter.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>🏷️ 当前过滤：<span className="text-slate-200">{tagFilter.map(t => `#${t}`).join(" ")}</span></span>
          <button onClick={() => router.push("/todos")} className="text-slate-500 hover:text-slate-300">× 清除</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1e1e2e]">
        {([
          { key: "all", label: t.common.all },
          { key: "pending", label: t.todos.pending },
          { key: "in_progress", label: t.todos.inProgress },
          { key: "done", label: t.todos.done },
        ] as const).map((tab) => {
          const count = tab.key === "all" ? filteredTodos.length : grouped[tab.key as keyof typeof grouped].length
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleTodos.map((todo) => (
          <div
            key={todo.id}
            className="group relative bg-[#111118] border border-[#1e1e2e] rounded-xl p-4 pl-5 hover:border-[#3d3d5c] transition-all duration-200 cursor-pointer"
          >
            {/* Status bar */}
            <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${statusBarColors[todo.status]}`} />

            {/* Top: title + priority */}
            <div className="flex items-start justify-between gap-2 pr-0">
              <p className={`font-semibold text-sm ${todo.status === "done" ? "line-through text-slate-500" : "text-slate-100"}`}>
                {todo.title}
              </p>
              <Badge variant="outline" className={`absolute top-3 right-3 text-xs shrink-0 ${priorityColors[todo.priority]}`}>
                {todo.priority}
              </Badge>
            </div>

            {todo.description && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{todo.description}</p>
            )}

            {/* Bottom: tags + due_date | actions */}
            <div className="flex items-center justify-between gap-2 mt-3 border-t border-[#1e1e2e] pt-3">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {todo.tags?.map((tag) => (
                  <ClickableTag key={tag} tag={tag} module="todos" />
                ))}
                {todo.due_date && (
                  <span className="text-xs text-slate-500">
                    📅 {new Date(todo.due_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Select value={todo.status} onValueChange={(v) => v && handleStatusChange(todo, v)}>
                  <SelectTrigger className="h-6 w-[90px] text-xs bg-transparent border-[#1e1e2e]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => { setEditingTodo(todo); setDialogOpen(true) }}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/5"
                >
                  {t.common.edit}
                </button>
                <button
                  onClick={() => setDeleteId(todo.id)}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10"
                >
                  {t.common.delete}
                </button>
              </div>
            </div>
          </div>
        ))}
        {visibleTodos.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-12 col-span-full">{t.todos.noTodos}</p>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingTodo(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTodo ? t.common.edit : t.todos.newTodo}</DialogTitle>
          </DialogHeader>
          <TodoForm
            todo={editingTodo}
            onDone={() => { setDialogOpen(false); setEditingTodo(null); load() }}
          />
        </DialogContent>
      </Dialog>

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

function TodoForm({ todo, onDone }: { todo: Todo | null; onDone: () => void }) {
  const { t } = useI18n()
  const [title, setTitle] = useState(todo?.title ?? "")
  const [description, setDescription] = useState(todo?.description ?? "")
  const [priority, setPriority] = useState(todo?.priority ?? "medium")
  const [status, setStatus] = useState(todo?.status ?? "pending")
  const [dueDate, setDueDate] = useState(todo?.due_date?.slice(0, 10) ?? "")
  const [tags, setTags] = useState(todo?.tags?.join(", ") ?? "")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const data = {
      title, description, priority, status,
      due_date: dueDate || undefined,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    }
    if (todo) await api.updateTodo(todo.id, data)
    else await api.createTodo(data)
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
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => v && setStatus(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Due Date</Label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Tags (comma separated)</Label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="work, urgent" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? `${t.common.save}...` : todo ? t.common.save : t.common.create}
      </Button>
    </form>
  )
}
