"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, Loader2, MessagesSquare, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"
import { WorkingEngineUsage, WorkingItem, WorkingSession } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { WorkingSessionPanel, engineBadgeClass, formatTime, statusBadgeClass } from "./working-session-panel"

const PAGE_SIZE = 20
const REPLAY_PAGE_SIZE = 50

const STATUSES = ["active", "archived"] as const

/**
 * Working memory 审计面板。
 *
 * 选中的会话放在 URL 的 ?id= 上而不是组件 state 里：审计的常见动作是"把这个会话发给
 * 同事看"，而 state 里的选中项刷新一下就没了、也分享不出去。查询参数在静态导出下不
 * 需要动态路由，也就不用改后端的路径兜底白名单。
 */
export default function WorkingSessionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedID = searchParams.get("id")

  const [sessions, setSessions] = useState<WorkingSession[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("")
  const [agentDraft, setAgentDraft] = useState("")
  const [agentFilter, setAgentFilter] = useState("")
  const [engineFilter, setEngineFilter] = useState("")
  const [engines, setEngines] = useState<WorkingEngineUsage[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const [session, setSession] = useState<WorkingSession | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const [items, setItems] = useState<WorkingItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsLoadingMore, setItemsLoadingMore] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const listRequestID = useRef(0)
  const detailRequestID = useRef(0)

  const loadSessions = useCallback(async (offset: number, append: boolean) => {
    const requestID = ++listRequestID.current
    if (append) setLoadingMore(true)
    else setLoading(true)
    setListError(null)
    try {
      const response = await api.listWorkingSessions({
        status: statusFilter || undefined,
        agent: agentFilter || undefined,
        engine: engineFilter || undefined,
        limit: PAGE_SIZE,
        offset,
      })
      if (requestID !== listRequestID.current) return
      setSessions((current) => (append ? [...current, ...(response.items ?? [])] : response.items ?? []))
      setTotal(response.total ?? 0)
    } catch (error) {
      if (requestID !== listRequestID.current) return
      setListError(error instanceof Error ? error.message : String(error))
    } finally {
      if (requestID === listRequestID.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [statusFilter, agentFilter, engineFilter])

  useEffect(() => {
    // 延迟一拍：loadSessions 会同步翻 loading 标记，直接在 effect 体里调用会触发
    // 级联渲染（react 的 set-state-in-effect 规则）。请求序号守卫让延迟是安全的。
    queueMicrotask(() => void loadSessions(0, false))
  }, [loadSessions])

  // engine 下拉的选项来自服务端"已在用的值"，而不是前端硬编码一份引擎清单：
  // 引擎集合是开放的，硬编码的那份会在下一个引擎出现时过期。
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      void api
        .listWorkingEngines()
        .then((response) => {
          if (!cancelled) setEngines(response.items ?? [])
        })
        .catch(() => {
          // 取不到就退化成"只有全部"的下拉，不打断主列表——筛选器坏了不该让页面不可用。
        })
    })
    return () => { cancelled = true }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    const requestID = ++detailRequestID.current
    setSessionLoading(true)
    setSessionError(null)
    setItemsLoading(true)
    setItemsError(null)
    setItems([])
    setHasMore(false)
    try {
      const data = await api.getWorkingSession(id)
      if (requestID !== detailRequestID.current) return
      setSession(data)
    } catch (error) {
      if (requestID !== detailRequestID.current) return
      setSession(null)
      setSessionError(error instanceof Error ? error.message : String(error))
      setItemsLoading(false)
      return
    } finally {
      if (requestID === detailRequestID.current) setSessionLoading(false)
    }
    try {
      const response = await api.replayWorkingItems(id, { after_seq: 0, limit: REPLAY_PAGE_SIZE })
      if (requestID !== detailRequestID.current) return
      setItems(response.items ?? [])
      setHasMore(response.has_more)
    } catch (error) {
      if (requestID !== detailRequestID.current) return
      setItemsError(error instanceof Error ? error.message : String(error))
    } finally {
      if (requestID === detailRequestID.current) setItemsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedID) {
      // 同样延迟一拍并递增请求序号：清空发生在会话被删除之后，此时可能还有一个
      // 在飞的详情请求，序号一变它回来就会被丢弃，不会把刚清掉的会话又写回来。
      queueMicrotask(() => {
        detailRequestID.current += 1
        setSession(null)
        setItems([])
        setSessionError(null)
        setItemsError(null)
        setHasMore(false)
      })
      return
    }
    queueMicrotask(() => void loadDetail(selectedID))
  }, [selectedID, loadDetail])

  // 增量回放：游标是已加载的最后一条 seq，而不是 offset。删条目会留下序号空洞，
  // 按 offset 翻页会在空洞处漏掉或重复条目。
  const loadMoreItems = useCallback(async () => {
    if (!selectedID || items.length === 0) return
    const requestID = detailRequestID.current
    setItemsLoadingMore(true)
    setItemsError(null)
    try {
      const response = await api.replayWorkingItems(selectedID, {
        after_seq: items[items.length - 1].seq,
        limit: REPLAY_PAGE_SIZE,
      })
      if (requestID !== detailRequestID.current) return
      setItems((current) => [...current, ...(response.items ?? [])])
      setHasMore(response.has_more)
    } catch (error) {
      if (requestID !== detailRequestID.current) return
      setItemsError(error instanceof Error ? error.message : String(error))
    } finally {
      if (requestID === detailRequestID.current) setItemsLoadingMore(false)
    }
  }, [selectedID, items])

  const select = (id: string) => {
    setNotice(null)
    router.replace(`/sessions?id=${encodeURIComponent(id)}`, { scroll: false })
  }

  const handleAgentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAgentFilter(agentDraft.trim())
  }

  const handleSessionUpdated = (updated: WorkingSession) => {
    setSession(updated)
    setSessions((current) => current.map((item) => (item.id === updated.id ? updated : item)))
  }

  const handleSessionDeleted = (itemsDeleted: number) => {
    setNotice(`会话已删除，同时级联删除了 ${itemsDeleted} 条条目。`)
    router.replace("/sessions", { scroll: false })
    void loadSessions(0, false)
  }

  const handleItemDeleted = (seq: number) => {
    setItems((current) => current.filter((item) => item.seq !== seq))
  }

  const hasMoreSessions = sessions.length < total

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-2xl border border-indigo-400/15 bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.12),transparent_38%),linear-gradient(135deg,#11111b,#0b0b12)] p-5 shadow-2xl shadow-black/20 md:p-7">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-300">
          <MessagesSquare className="size-4" /> Working Memory
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">审计会话的原始对话历史</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          即时记忆保存的是会话原文：对话消息、工具结果和草稿，按服务端分配的序号追加、按序号回放。它不进检索索引，
          所以这里没有搜索——审计靠的是按会话读原文。记录永久保存，删除只发生在这个页面上的显式操作。
        </p>
      </header>

      {notice ? (
        <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <section aria-labelledby="session-list-heading" className="rounded-xl border border-[#1e1e2e] bg-[#101018]">
          <div className="space-y-3 border-b border-[#1e1e2e] p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="session-list-heading" className="font-semibold text-slate-100">会话</h2>
                <p className="mt-1 text-xs text-slate-500">{total} 个会话</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="刷新会话列表"
                disabled={loading}
                onClick={() => void loadSessions(0, false)}
                className="text-slate-400 hover:text-slate-100"
              >
                <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="session-status-filter" className="sr-only">状态</Label>
                <select
                  id="session-status-filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-9 w-full rounded-md border border-[#2a2a3a] bg-[#0b0b12] px-2 text-sm text-slate-200"
                >
                  <option value="">全部状态</option>
                  {STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="session-engine-filter" className="sr-only">引擎</Label>
                <select
                  id="session-engine-filter"
                  value={engineFilter}
                  onChange={(event) => setEngineFilter(event.target.value)}
                  className="h-9 w-full rounded-md border border-[#2a2a3a] bg-[#0b0b12] px-2 text-sm text-slate-200"
                >
                  <option value="">全部引擎</option>
                  {engines.map((item) => (
                    <option key={item.engine} value={item.engine}>
                      {item.engine}（{item.session_count}）
                    </option>
                  ))}
                </select>
              </div>
              {/* agent 在服务端是精确匹配，所以按回车提交而不是每敲一个字就查一次——
                  边打边查会在打完之前一直显示"没有结果"，看起来像坏了。 */}
              <form onSubmit={handleAgentSubmit} className="col-span-2">
                <Label htmlFor="session-agent-filter" className="sr-only">来源 agent</Label>
                <Input
                  id="session-agent-filter"
                  value={agentDraft}
                  onChange={(event) => setAgentDraft(event.target.value)}
                  placeholder="按 agent 精确匹配，回车生效"
                  className="h-9 border-[#2a2a3a] bg-[#0b0b12] text-sm text-slate-200 placeholder:text-slate-600"
                />
              </form>
              {agentFilter ? (
                <button
                  type="button"
                  onClick={() => { setAgentDraft(""); setAgentFilter("") }}
                  className="col-span-2 text-left text-xs text-slate-500 hover:text-slate-300"
                >
                  清除 agent 过滤（{agentFilter}）
                </button>
              ) : null}
            </div>
          </div>

          <div className="p-3">
            {loading ? (
              <div role="status" aria-live="polite" className="flex min-h-40 items-center justify-center text-sm text-slate-500">
                <Loader2 className="mr-2 size-4 animate-spin" /> 加载中…
              </div>
            ) : listError ? (
              <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {listError}
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#303044] p-8 text-center text-sm text-slate-500">
                还没有会话。接入的 Agent 通过 memory_working_session_create 创建第一个。
              </div>
            ) : (
              <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                {sessions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selectedID === item.id}
                    onClick={() => select(item.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedID === item.id
                        ? "border-indigo-400/60 bg-indigo-400/10"
                        : "border-[#252536] bg-[#0b0b12] hover:border-indigo-500/35"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate font-medium text-slate-100">{item.title || "(未命名会话)"}</div>
                      <Badge className={`shrink-0 ${statusBadgeClass[item.status] ?? "bg-slate-500/10 text-slate-300"}`}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      {item.agent ? <Badge className="bg-violet-500/10 text-violet-300">{item.agent}</Badge> : null}
                      {item.engine ? <Badge className={engineBadgeClass(item.engine)}>{item.engine}</Badge> : null}
                      <span>{item.last_seq} 条序号</span>
                      <span>{formatTime(item.updated_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {hasMoreSessions && !loading ? (
              <div className="mt-3 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loadingMore}
                  onClick={() => void loadSessions(sessions.length, true)}
                  className="border-[#2a2a3a] bg-[#12121a] text-slate-200"
                >
                  {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
                  加载更多（{sessions.length}/{total}）
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="session-detail-heading" className="min-w-0 rounded-xl border border-[#1e1e2e] bg-[#101018]">
          {!selectedID ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
              <MessagesSquare className="size-9 text-slate-700" />
              <div>
                <h2 id="session-detail-heading" className="font-medium text-slate-300">选择一个会话</h2>
                <p className="mt-1 text-sm">按序号回放对话消息、工具结果和草稿。</p>
              </div>
            </div>
          ) : sessionLoading ? (
            <div role="status" aria-live="polite" className="flex min-h-64 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 size-4 animate-spin" /> 加载会话…
            </div>
          ) : sessionError ? (
            <div role="alert" className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {sessionError}
            </div>
          ) : session ? (
            <WorkingSessionPanel
              session={session}
              items={items}
              itemsLoading={itemsLoading}
              itemsLoadingMore={itemsLoadingMore}
              itemsError={itemsError}
              hasMore={hasMore}
              onLoadMore={() => void loadMoreItems()}
              onItemDeleted={handleItemDeleted}
              onSessionUpdated={handleSessionUpdated}
              onSessionDeleted={handleSessionDeleted}
            />
          ) : null}
        </section>
      </div>
    </div>
  )
}
