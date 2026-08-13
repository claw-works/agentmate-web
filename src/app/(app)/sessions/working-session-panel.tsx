"use client"

import { FormEvent, useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronDown,
  Hash,
  Loader2,
  MessagesSquare,
  Pencil,
  Trash2,
} from "lucide-react"
import { api } from "@/lib/api"
import { UpdateWorkingSessionRequest, WorkingItem, WorkingSession } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

const itemTypeBadgeClass: Record<string, string> = {
  message: "bg-indigo-500/10 text-indigo-300",
  tool_result: "bg-amber-500/10 text-amber-200",
  draft: "bg-slate-500/10 text-slate-300",
}

const roleBadgeClass: Record<string, string> = {
  user: "bg-sky-500/10 text-sky-300",
  assistant: "bg-emerald-500/10 text-emerald-300",
  system: "bg-slate-500/10 text-slate-400",
  tool: "bg-cyan-500/10 text-cyan-300",
}

export const statusBadgeClass: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-300",
  archived: "bg-slate-500/10 text-slate-400",
}

/**
 * 引擎徽章配色。
 *
 * 引擎集合是开放的，所以不能像 item_type 那样写死一张表——下一个引擎出现时会掉进
 * 默认色。已知的几个给固定色，其余按名字哈希到一组备选色：同一个引擎在整页里颜色
 * 稳定，扫一眼就能看出"这段是哪个引擎产出的"，而这正是逐条归因要支持的动作。
 */
const knownEngineBadgeClass: Record<string, string> = {
  "kiro-cli": "bg-emerald-500/10 text-emerald-300",
  "claude-code": "bg-orange-500/10 text-orange-300",
  codex: "bg-sky-500/10 text-sky-300",
  pi: "bg-pink-500/10 text-pink-300",
}

const fallbackEngineBadgeClasses = [
  "bg-teal-500/10 text-teal-300",
  "bg-fuchsia-500/10 text-fuchsia-300",
  "bg-lime-500/10 text-lime-300",
  "bg-rose-500/10 text-rose-300",
]

export function engineBadgeClass(engine: string): string {
  const known = knownEngineBadgeClass[engine]
  if (known) return known
  let hash = 0
  for (let index = 0; index < engine.length; index += 1) {
    hash = (hash * 31 + engine.charCodeAt(index)) % 997
  }
  return fallbackEngineBadgeClasses[hash % fallbackEngineBadgeClasses.length]
}

export function WorkingSessionPanel({
  session,
  items,
  itemsLoading,
  itemsLoadingMore,
  itemsError,
  hasMore,
  onLoadMore,
  onItemDeleted,
  onSessionUpdated,
  onSessionDeleted,
}: {
  session: WorkingSession
  items: WorkingItem[]
  itemsLoading: boolean
  itemsLoadingMore: boolean
  itemsError: string | null
  hasMore: boolean
  onLoadMore: () => void
  onItemDeleted: (seq: number) => void
  onSessionUpdated: (session: WorkingSession) => void
  onSessionDeleted: (itemsDeleted: number) => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteSessionOpen, setDeleteSessionOpen] = useState(false)
  const [deleteSeq, setDeleteSeq] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 已加载条目按引擎归类，用于提示"这段历史跨了几个引擎"。只统计已加载的部分，
  // 所以文案说的是"已加载的条目"而不是整个会话——没读到的那些不能替它们下结论。
  const loadedEngines = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      if (!item.engine) continue
      counts.set(item.engine, (counts.get(item.engine) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([engine, count]) => ({ engine, count }))
      .sort((left, right) => right.count - left.count || left.engine.localeCompare(right.engine))
  }, [items])

  const handleDeleteSession = async () => {
    setDeleting(true)
    setActionError(null)
    try {
      const response = await api.deleteWorkingSession(session.id)
      setDeleteSessionOpen(false)
      onSessionDeleted(response.items_deleted)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteItem = async () => {
    if (deleteSeq === null) return
    setDeleting(true)
    setActionError(null)
    try {
      await api.deleteWorkingItem(session.id, deleteSeq)
      onItemDeleted(deleteSeq)
      setDeleteSeq(null)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-w-0">
      <div className="border-b border-[#1e1e2e] p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="session-detail-heading" className="break-all text-xl font-semibold text-white">
                {session.title || "(未命名会话)"}
              </h2>
              <Badge className={statusBadgeClass[session.status] ?? "bg-slate-500/10 text-slate-300"}>
                {session.status}
              </Badge>
              {session.agent ? <Badge className="bg-violet-500/10 text-violet-300">{session.agent}</Badge> : null}
              {session.engine ? <Badge className={engineBadgeClass(session.engine)}>{session.engine}</Badge> : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="font-mono">{session.id}</span>
              <span className="inline-flex items-center gap-1">
                <Hash className="size-3" /> last_seq {session.last_seq}
              </span>
              <span>创建 {formatTime(session.created_at)}</span>
              <span>更新 {formatTime(session.updated_at)}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="border-[#2a2a3a] bg-[#12121a] text-slate-300"
            >
              <Pencil className="size-3.5" /> 编辑会话
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteSessionOpen(true)}
              className="border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/15"
            >
              <Trash2 className="size-3.5" /> 删除会话
            </Button>
          </div>
        </div>

        {hasMetadata(session.metadata) ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">会话 metadata</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-[#242436] bg-[#0b0b12] p-3 text-[11px] leading-5 text-slate-400">
              {JSON.stringify(session.metadata, null, 2)}
            </pre>
          </details>
        ) : null}

        {actionError ? (
          <div role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {actionError}
          </div>
        ) : null}
      </div>

      <div className="p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <MessagesSquare className="size-4 text-indigo-300" /> 对话历史
          </h3>
          <p className="text-xs text-slate-500">
            已加载 {items.length} 条{hasMore ? "，还有更多" : ""} · 序号最高 {session.last_seq}
          </p>
        </div>

        {/* 已加载条目里涉及了哪些引擎——会话中途切过引擎时，这一眼就能看出来，
            而不用自己往下滚着比对每条的徽章。 */}
        {loadedEngines.length > 1 ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-slate-400">
            <span className="text-amber-200">本会话已加载的条目跨越 {loadedEngines.length} 个引擎：</span>
            {loadedEngines.map(({ engine, count }) => (
              <Badge key={engine} className={engineBadgeClass(engine)}>
                {engine} · {count} 条
              </Badge>
            ))}
          </div>
        ) : null}

        {/* 原始记录不可编辑，这是设计而非缺失：改过的记录不再是"当时发生了什么"的记录。
            把这句话摆在删除按钮旁边，省得有人去翻文档找编辑功能。 */}
        <p className="mb-3 rounded-lg border border-[#242436] bg-[#0b0b12] px-3 py-2 text-xs leading-5 text-slate-500">
          条目是原始记录，只能删除、不能编辑：改过的对话不再是当时发生过什么的记录。删除后序号不会被复用，回放方看到的是一个空洞而不是同一个序号下换了内容。每条上的引擎徽章是写入时固化的，之后切换会话引擎不会改动它们。
        </p>

        {itemsLoading ? (
          <div role="status" aria-live="polite" className="flex min-h-40 items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 size-4 animate-spin" /> 加载对话历史…
          </div>
        ) : itemsError ? (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {itemsError}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#303044] p-8 text-center text-sm text-slate-500">
            {session.last_seq > 0
              ? "这个会话的条目已全部被删除（last_seq 仍保留，序号不会复用）。"
              : "会话还没有任何条目。"}
          </div>
        ) : (
          <ol className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="group rounded-lg border border-[#242436] bg-[#0b0b12] p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-slate-600">#{item.seq}</span>
                  <Badge className={itemTypeBadgeClass[item.item_type] ?? "bg-slate-500/10 text-slate-300"}>
                    {item.item_type}
                  </Badge>
                  {item.role ? (
                    <Badge className={roleBadgeClass[item.role] ?? "bg-slate-500/10 text-slate-300"}>{item.role}</Badge>
                  ) : null}
                  {item.engine ? <Badge className={engineBadgeClass(item.engine)}>{item.engine}</Badge> : null}
                  <span className="text-slate-600">{formatTime(item.created_at)}</span>
                  <button
                    type="button"
                    aria-label={`删除第 ${item.seq} 条`}
                    onClick={() => setDeleteSeq(item.seq)}
                    className="ml-auto rounded p-1 text-slate-600 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {item.content ? (
                  <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
                    {item.content}
                  </div>
                ) : (
                  // 正文允许为空：只带 tool call 的 assistant 轮次就是没有正文，
                  // 内容在 metadata 里。说明这件事，而不是显示一片空白让人以为丢了数据。
                  <div className="mt-2 text-xs text-slate-600">（无正文，内容在 metadata 中）</div>
                )}

                {hasMetadata(item.metadata) ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">metadata</summary>
                    <pre className="mt-1.5 overflow-x-auto rounded border border-[#1e1e2e] bg-[#08080e] p-2 text-[11px] leading-5 text-slate-400">
                      {JSON.stringify(item.metadata, null, 2)}
                    </pre>
                  </details>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-3 border-t border-[#1a1a26] pt-2 text-[11px] text-slate-600">
                  <span className="font-mono">key {item.idempotency_key}</span>
                  <span className="font-mono">hash {item.content_hash.slice(0, 12)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}

        {hasMore && !itemsLoading ? (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={itemsLoadingMore}
              onClick={onLoadMore}
              className="border-[#2a2a3a] bg-[#12121a] text-slate-200"
            >
              {itemsLoadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
              加载更多（已加载 {items.length} 条）
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑会话</DialogTitle>
          </DialogHeader>
          <EditSessionForm
            session={session}
            onDone={(updated) => {
              setEditOpen(false)
              onSessionUpdated(updated)
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteSessionOpen} onOpenChange={(open) => !open && setDeleteSessionOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除整个会话？</AlertDialogTitle>
            <AlertDialogDescription>
              会话及其全部条目都会被删除（级联），此操作不可撤销。working memory 没有 TTL
              也没有自动清理，删除是它唯一的退场方式。如果只是想结束这个会话但保留审计记录，请改用「编辑会话」把状态设为
              archived。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteSession()
              }}
            >
              {deleting ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteSeq !== null} onOpenChange={(open) => !open && setDeleteSeq(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除第 {deleteSeq} 条？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销。序号 {deleteSeq} 不会被复用，回放这个会话的调用方会看到一个空洞。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteItem()
              }}
            >
              {deleting ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EditSessionForm({
  session,
  onDone,
}: {
  session: WorkingSession
  onDone: (session: WorkingSession) => void
}) {
  const [title, setTitle] = useState(session.title)
  const [status, setStatus] = useState(session.status)
  const [engine, setEngine] = useState(session.engine)
  const [metadataDraft, setMetadataDraft] = useState(
    hasMetadata(session.metadata) ? JSON.stringify(session.metadata, null, 2) : ""
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    // 只提交改过的字段：服务端拒绝空更新，而全量提交会把没动过的 metadata
    // 又写一遍，把 updated_at 变成"谁都在改"的噪音。
    const payload: UpdateWorkingSessionRequest = {}
    if (title !== session.title) payload.title = title
    if (status !== session.status) payload.status = status
    if (engine.trim().toLowerCase() !== session.engine) payload.engine = engine

    const originalMetadata = hasMetadata(session.metadata) ? JSON.stringify(session.metadata, null, 2) : ""
    if (metadataDraft.trim() !== originalMetadata.trim()) {
      if (metadataDraft.trim() === "") {
        payload.metadata = {}
      } else {
        try {
          const parsed: unknown = JSON.parse(metadataDraft)
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            setError("metadata 必须是一个 JSON 对象")
            return
          }
          payload.metadata = parsed as Record<string, unknown>
        } catch {
          setError("metadata 不是合法的 JSON")
          return
        }
      }
    }

    if (Object.keys(payload).length === 0) {
      setError("没有任何改动")
      return
    }

    setSaving(true)
    try {
      const updated = await api.updateWorkingSession(session.id, payload)
      onDone(updated)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="session-title">标题</Label>
        <Input
          id="session-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="会话标题"
          className="border-[#2a2a3a] bg-[#0b0b12] text-slate-100 placeholder:text-slate-600"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="session-engine">引擎</Label>
        <Input
          id="session-engine"
          value={engine}
          onChange={(event) => setEngine(event.target.value)}
          placeholder="kiro-cli / claude-code / codex / pi"
          maxLength={100}
          className="border-[#2a2a3a] bg-[#0b0b12] text-slate-100 placeholder:text-slate-600"
        />
        <p className="text-xs text-slate-500">
          改这里是「从现在起切到这个引擎」：已写入的条目保持它们各自的引擎不变，之后追加的条目继承新值。服务端会转成小写，最长 100 字符。
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="session-status">状态</Label>
        <select
          id="session-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-9 w-full rounded-md border border-[#2a2a3a] bg-[#0b0b12] px-2 text-sm text-slate-200"
        >
          <option value="active">active</option>
          <option value="archived">archived</option>
        </select>
        <p className="text-xs text-slate-500">归档只是标记，条目照常保留，也照常可以回放。</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="session-metadata">metadata（JSON 对象）</Label>
        <Textarea
          id="session-metadata"
          value={metadataDraft}
          onChange={(event) => setMetadataDraft(event.target.value)}
          rows={6}
          placeholder='{"engine_version": "0.4.2", "model": "..."}'
          className="border-[#2a2a3a] bg-[#0b0b12] font-mono text-xs text-slate-200 placeholder:text-slate-600"
        />
        <p className="text-xs text-slate-500">
          引擎的细节（版本、模型、配置）放这里；引擎标识本身用上面的字段，那样才能筛选和聚合。提交会整体替换原有 metadata，不是合并。
        </p>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <AlertTriangle className="size-3.5 text-amber-300" /> 会话元数据可改；条目本身不可改
        </p>
        <Button type="submit" disabled={saving} className="bg-indigo-600 text-white hover:bg-indigo-500">
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          保存
        </Button>
      </div>
    </form>
  )
}

export function hasMetadata(value: unknown): boolean {
  return typeof value === "object" && value !== null && Object.keys(value as Record<string, unknown>).length > 0
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}
