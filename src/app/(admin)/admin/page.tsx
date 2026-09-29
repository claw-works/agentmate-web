"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, AlertTriangle, Building2, ChevronRight, Database, FileText, KeyRound, Network, RefreshCw, ShieldCheck, Users, Workflow, type LucideIcon } from "lucide-react"
import { api } from "@/lib/api"
import type { AdminAccount, AdminRecord, AdminStats, AdminTenant, AdminTenantSummary } from "@/lib/types"

type PlatformSection = "tenants" | "users" | "apikeys" | "usage" | "reports"
type Tab = "overview" | "sessions" | "memory" | "distill-runs" | "knowledge" | "ontology/spaces" | "actions"
const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "概览" }, { id: "sessions", label: "Sessions" },
  { id: "memory", label: "记忆" }, { id: "distill-runs", label: "蒸馏" },
  { id: "knowledge", label: "知识库" }, { id: "ontology/spaces", label: "本体" },
  { id: "actions", label: "Actions" },
]

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

const labels: Record<string, string> = {
  account_name: "账户", title: "标题", agent: "Agent", engine: "执行引擎",
  namespace: "命名空间", status: "状态", last_seq: "消息数", distilled_seq: "已蒸馏至",
  memory_type: "记忆类型", summary: "摘要", content: "内容", confidence: "置信度",
  importance: "重要性", session_title: "Session", trigger: "触发方式",
  items_examined: "检查条目", items_available: "可用条目", candidates_written: "写入候选",
  candidates_duplicate: "重复候选", attempt: "尝试次数", max_attempts: "最大尝试",
  error: "错误", note: "说明", model: "模型", prompt_version: "Prompt 版本",
  input_tokens: "输入 Token", output_tokens: "输出 Token", cost_micros: "成本（微单位）",
  enforcement_mode: "约束模式", object_count: "对象数", slug: "标识",
  action_key: "Action", confirmation_state: "审批状态", execution_mode: "执行方式",
  verification_result: "验证结果", output: "执行输出", created_at: "创建时间",
  updated_at: "更新时间", started_at: "开始时间", finished_at: "完成时间",
  from_seq: "起始序号", to_seq: "结束序号", role: "角色", item_type: "条目类型",
  seq: "序号", metadata: "附加信息", description: "描述",
  type: "类型", domain: "领域", repository_url: "仓库地址", package_path: "包路径",
  default_ref: "默认分支", sync_mode: "同步模式", revision_count: "Revision 数",
  document_count: "文档数", wiki_page_count: "Wiki 页面数",
  user_email: "用户", key_prefix: "Key 前缀", total_calls: "总调用",
  today_calls: "24 小时调用", last_used_at: "最后使用", email: "邮箱",
  format: "格式", source: "来源", tags: "标签",
}
const hiddenDetailKeys = new Set([
  "id", "account_id", "session_id", "distill_run_id", "target_object_id",
  "active_schema_version_id",
])

function ValueView({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="text-slate-600">—</span>
  if (Array.isArray(value)) return <div className="space-y-2">{value.map((item, index) => <div key={index} className="rounded-lg border border-[#29293b] p-3"><ValueView value={item} /></div>)}</div>
  if (typeof value === "object") return <dl className="space-y-2">{Object.entries(value as Record<string, unknown>).map(([key, item]) =>
    <div key={key} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3"><dt className="text-slate-600">{labels[key] || key.replaceAll("_", " ")}</dt><dd className="break-words text-slate-300"><ValueView value={item} /></dd></div>
  )}</dl>
  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>
}

function DetailFields({ record, exclude = [] }: { record: Record<string, unknown>; exclude?: string[] }) {
  const excluded = new Set([...hiddenDetailKeys, ...exclude])
  return <dl className="divide-y divide-[#202031]">{Object.entries(record).filter(([key]) => !excluded.has(key)).map(([key, value]) =>
    <div key={key} className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 py-3 text-sm"><dt className="text-slate-600">{labels[key] || key.replaceAll("_", " ")}</dt><dd className="min-w-0 text-slate-300"><ValueView value={value} /></dd></div>
  )}</dl>
}

function TenantConsole() {
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [tenantID, setTenantID] = useState("")
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [accountID, setAccountID] = useState("")
  const [summary, setSummary] = useState<AdminTenantSummary | null>(null)
  const [tab, setTab] = useState<Tab>("overview")
  const [records, setRecords] = useState<AdminRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [selected, setSelected] = useState<AdminRecord | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<Record<string, unknown> | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [alerts, setAlerts] = useState<{ code: string; severity: string; message: string; value: unknown }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void api.adminTenants().then(items => {
      setTenants(items)
      if (items[0]) setTenantID(items[0].id)
    }).catch(err => setError(err instanceof Error ? err.message : "加载租户失败"))
  }, [])

  useEffect(() => {
    if (!tenantID) return
    void api.adminTenantAccounts(tenantID).then(setAccounts).catch(() => setAccounts([]))
  }, [tenantID])

  const load = useCallback(async () => {
    if (!tenantID) return
    setLoading(true); setError(""); setSelected(null); setSelectedDetail(null)
    try {
      const nextSummary = await api.adminTenantSummary(tenantID)
      setSummary(nextSummary)
      if (tab === "overview") {
        setRecords([])
        setTotal(0)
      }
      else if (tab === "actions") {
        const [runs, health] = await Promise.all([
          api.adminActionRuns(tenantID, { accountID: accountID || undefined, limit: pageSize, offset: page * pageSize }),
          api.adminActionHealth(),
        ])
        setRecords(runs.items)
        setTotal(runs.total)
        setAlerts(health.alerts)
      }
      else {
        const result = await api.adminTenantRecords(tenantID, tab, {
          accountID: accountID || undefined, limit: pageSize, offset: page * pageSize,
        })
        setRecords(result.items)
        setTotal(result.total)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [tenantID, tab, accountID, page, pageSize])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const columns: Record<Exclude<Tab, "overview">, string[]> = {
    sessions: ["account_name", "title", "agent", "engine", "namespace", "status", "last_seq", "distilled_seq", "updated_at"],
    memory: ["account_name", "memory_type", "title", "summary", "namespace", "status", "confidence", "updated_at"],
    "distill-runs": ["account_name", "session_title", "trigger", "status", "items_examined", "candidates_written", "attempt", "error", "updated_at"],
    knowledge: ["account_name", "name", "type", "domain", "status", "revision_count", "document_count", "wiki_page_count", "updated_at"],
    "ontology/spaces": ["account_name", "name", "slug", "status", "enforcement_mode", "object_count", "updated_at"],
    actions: ["account_name", "action_key", "status", "confirmation_state", "execution_mode", "attempt", "error", "updated_at"],
  }

  const openRecord = async (record: AdminRecord) => {
    setSelected(record)
    setSelectedDetail(null)
    if (tab !== "sessions" && tab !== "distill-runs") return
    setDetailLoading(true)
    try {
      if (tab === "sessions") setSelectedDetail(await api.adminTenantSession(tenantID, record.id))
      else setSelectedDetail(await api.adminTenantDistillRun(tenantID, record.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载详情失败")
    } finally {
      setDetailLoading(false)
    }
  }

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">租户可观测控制台</h1><p className="mt-1 text-sm text-slate-500">按租户查看账户、会话、记忆、本体和执行状态。</p></div>
      <div className="flex gap-2">
        <select value={tenantID} onChange={e => { setTenantID(e.target.value); setAccountID(""); setPage(0) }} className="min-w-72 rounded-lg border border-[#29293b] bg-[#11111c] px-3 py-2 text-sm">
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name} · {t.account_count} accounts</option>)}
        </select>
        <select value={accountID} onChange={e => { setAccountID(e.target.value); setPage(0) }} className="min-w-56 rounded-lg border border-[#29293b] bg-[#11111c] px-3 py-2 text-sm">
          <option value="">全部账户</option>
          {accounts.map(account => <option key={account.id} value={account.id}>{account.name || account.external_ref || account.id}</option>)}
        </select>
        <button onClick={() => void load()} className="rounded-lg border border-[#29293b] p-2 text-slate-400 hover:text-white"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
    </div>

    {error && <div className="rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</div>}
    {tab === "actions" && alerts.map(alert => <div key={alert.code} className={`rounded-lg border p-3 text-sm ${alert.severity === "critical" ? "border-red-900 bg-red-950/30 text-red-300" : "border-amber-900 bg-amber-950/30 text-amber-300"}`}>{alert.message} ({text(alert.value)})</div>)}

    <div className="flex gap-1 overflow-x-auto rounded-xl border border-[#202031] bg-[#0d0d17] p-1">
      {tabs.map(item => <button key={item.id} onClick={() => { setTab(item.id); setPage(0) }} className={`rounded-lg px-4 py-2 text-sm ${tab === item.id ? "bg-indigo-500/15 text-indigo-300" : "text-slate-500 hover:text-slate-200"}`}>{item.label}</button>)}
    </div>

    {tab === "distill-runs" && <div className="rounded-lg border border-blue-900/60 bg-blue-950/20 p-3 text-sm text-blue-200">
      这里展示的是蒸馏任务运行记录，不是长期记忆条目；“运行错误”仅用于排障。真正写入的结果请在“记忆”中查看。
    </div>}

    {summary && <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-9">
      {([
        ["Accounts", summary.accounts, Database], ["Sessions", summary.sessions, Workflow],
        ["Memories", summary.memories, Database], ["待审核记忆", summary.pending_memories, AlertTriangle],
        ["知识库", summary.knowledge_sources, FileText], ["Ontology", summary.ontology_spaces, Network],
        ["Actions", summary.actions, ShieldCheck],
        ["待审批", summary.pending_actions, AlertTriangle], ["失败", summary.failed_actions, AlertTriangle],
      ] as [string, number, LucideIcon][]).map(([label, value, Icon]) => <div key={label} className="rounded-xl border border-[#202031] bg-[#0d0d17] p-3"><Icon className="mb-3 size-4 text-indigo-400" /><div className="text-xl font-semibold">{value}</div><div className="text-xs text-slate-500">{label}</div></div>)}
    </div>}

    {tab === "overview" && summary && <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-[#202031] bg-[#0d0d17] p-5"><h2 className="font-medium">租户信息</h2><dl className="mt-4 grid grid-cols-[120px_1fr] gap-3 text-sm"><dt className="text-slate-500">名称</dt><dd>{summary.name}</dd><dt className="text-slate-500">Tenant ID</dt><dd className="font-mono text-xs">{summary.tenant_id}</dd></dl></div>
      <div className="rounded-xl border border-[#202031] bg-[#0d0d17] p-5"><h2 className="font-medium">需要关注</h2><div className="mt-4 space-y-2 text-sm text-slate-400"><p>待审核记忆：{summary.pending_memories}</p><p>待审批 Action：{summary.pending_actions}</p><p>失败或部分成功：{summary.failed_actions}</p></div></div>
    </div>}

    {tab !== "overview" && <div className="overflow-hidden rounded-xl border border-[#202031] bg-[#0d0d17]">
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-[#202031] text-xs uppercase text-slate-600"><tr>{columns[tab].map(c => <th key={c} className="px-4 py-3">{tab === "distill-runs" && c === "error" ? "运行错误（非记忆）" : c.replaceAll("_", " ")}</th>)}<th aria-label="查看详情" /></tr></thead>
        <tbody className="divide-y divide-[#1b1b2b]">{records.map(record => <tr key={record.id} onClick={() => void openRecord(record)} className="cursor-pointer hover:bg-white/[.025]">{columns[tab].map(c => <td key={c} className="max-w-72 truncate px-4 py-3 text-slate-400" title={text(record[c])}>{text(record[c])}</td>)}<td className="w-10 pr-3 text-slate-700"><ChevronRight className="size-4" /></td></tr>)}</tbody>
      </table></div>
      {!loading && records.length === 0 && <div className="p-12 text-center text-sm text-slate-600">暂无数据</div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#202031] px-4 py-3 text-sm text-slate-500">
        <span>{total === 0 ? "0 条" : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} / 共 ${total} 条`}</span>
        <div className="flex items-center gap-2">
          <label>每页
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }} className="ml-2 rounded border border-[#29293b] bg-[#11111c] px-2 py-1 text-slate-300">
              {[20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <button disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))} className="rounded border border-[#29293b] px-3 py-1 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40">上一页</button>
          <span>第 {total === 0 ? 0 : page + 1} / {Math.ceil(total / pageSize)} 页</span>
          <button disabled={loading || (page + 1) * pageSize >= total} onClick={() => setPage(value => value + 1)} className="rounded border border-[#29293b] px-3 py-1 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40">下一页</button>
        </div>
      </div>
    </div>}

    {selected && <div className="fixed inset-0 z-30 flex justify-end bg-black/60" onClick={() => setSelected(null)}><aside onClick={e => e.stopPropagation()} className="h-full w-full max-w-3xl overflow-auto border-l border-[#29293b] bg-[#0d0d17] p-6"><div className="flex justify-between"><div><h2 className="font-medium">{tab === "sessions" ? selected.title || "Session 详情" : tab === "distill-runs" ? "蒸馏运行详情" : "记录详情"}</h2><p className="mt-1 text-xs text-slate-600">{selected.account_name}</p></div><button onClick={() => setSelected(null)} className="text-slate-500">关闭</button></div>
      {tab === "actions" && selected.status === "failed" && selected.execution_mode === "async" && Object.keys((selected.output as Record<string, unknown>) || {}).length === 0 && <button onClick={async () => { await api.adminRetryAction(selected.id, selected.account_id); setSelected(null); await load() }} className="mt-4 rounded-lg bg-blue-500/15 px-3 py-2 text-sm text-blue-300">安全重新入队</button>}
      {detailLoading && <div className="py-16 text-center text-sm text-slate-600">正在加载详情…</div>}
      {!detailLoading && tab === "sessions" && selectedDetail && <>
        <section className="mt-6 rounded-xl border border-[#202031] p-4"><h3 className="mb-3 text-sm font-medium">Session 信息</h3><DetailFields record={selectedDetail.session as Record<string, unknown>} /></section>
        <section className="mt-5"><h3 className="mb-3 text-sm font-medium">对话时间线</h3><div className="space-y-3">{((selectedDetail.items as AdminRecord[]) || []).map((item, index) =>
          <article key={index} className={`rounded-xl border p-4 ${item.role === "user" ? "border-indigo-900/70 bg-indigo-950/20" : "border-[#202031] bg-black/20"}`}>
            <div className="mb-2 flex justify-between text-xs text-slate-600"><span>#{text(item.seq)} · {text(item.role || item.item_type)} · {text(item.engine)}</span><span>{text(item.created_at)}</span></div>
            <div className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{text(item.content)}</div>
          </article>
        )}</div></section>
      </>}
      {!detailLoading && tab === "distill-runs" && selectedDetail && <>
        <section className="mt-6 rounded-xl border border-[#202031] p-4"><h3 className="mb-3 text-sm font-medium">运行信息</h3><DetailFields record={selectedDetail.run as Record<string, unknown>} /></section>
        <section className="mt-5"><h3 className="mb-3 text-sm font-medium">本次读取的对话</h3><div className="space-y-3">{((selectedDetail.source_items as AdminRecord[]) || []).length === 0 ? <p className="rounded-xl border border-[#202031] p-4 text-sm text-slate-600">本次运行没有成功读取对话内容。</p> : ((selectedDetail.source_items as AdminRecord[]) || []).map((item, index) =>
          <article key={index} className="rounded-xl border border-[#202031] bg-black/20 p-4"><div className="mb-2 text-xs text-slate-600">#{text(item.seq)} · {text(item.role || item.item_type)}</div><div className="whitespace-pre-wrap break-words text-sm text-slate-300">{text(item.content)}</div></article>
        )}</div></section>
        <section className="mt-5"><h3 className="mb-3 text-sm font-medium">产出的记忆候选</h3><div className="space-y-3">{((selectedDetail.candidates as AdminRecord[]) || []).length === 0 ? <p className="rounded-xl border border-[#202031] p-4 text-sm text-slate-600">本次运行没有写入候选。</p> : ((selectedDetail.candidates as AdminRecord[]) || []).map((candidate, index) =>
          <article key={index} className="rounded-xl border border-emerald-900/50 bg-emerald-950/10 p-4"><DetailFields record={candidate} /></article>
        )}</div></section>
      </>}
      {!detailLoading && tab !== "sessions" && tab !== "distill-runs" && <div className="mt-5"><DetailFields record={selected} /></div>}
    </aside></div>}
  </div>
}

const platformSections: { id: PlatformSection; label: string; icon: LucideIcon }[] = [
  { id: "tenants", label: "租户可观测", icon: Building2 },
  { id: "users", label: "用户管理", icon: Users },
  { id: "apikeys", label: "API Keys", icon: KeyRound },
  { id: "usage", label: "API 使用量", icon: Activity },
  { id: "reports", label: "Reports", icon: FileText },
]

const platformColumns: Record<Exclude<PlatformSection, "tenants">, string[]> = {
  users: ["email", "role", "created_at"],
  apikeys: ["name", "user_email", "key_prefix", "created_at"],
  usage: ["key_name", "key_prefix", "user_email", "total_calls", "today_calls", "last_used_at"],
  reports: ["title", "format", "tags", "source", "user_email", "created_at"],
}

function PlatformRecords({ section }: { section: Exclude<PlatformSection, "tenants"> }) {
  const [records, setRecords] = useState<AdminRecord[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<AdminRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const loaders = {
        users: api.adminUsers,
        apikeys: api.adminAPIKeys,
        usage: api.adminUsage,
        reports: api.adminReports,
      }
      const [items, currentStats] = await Promise.all([loaders[section](), api.adminStats()])
      setRecords(items)
      setStats(currentStats)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载平台数据失败")
    } finally {
      setLoading(false)
    }
  }, [section])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const columns = platformColumns[section]
  return <div className="space-y-5">
    {stats && <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {Object.entries({ 用户: stats.users, "API Keys": stats.api_keys, Todos: stats.todos, Notes: stats.notes, Reports: stats.reports }).map(([label, value]) =>
        <div key={label} className="rounded-xl border border-[#202031] bg-[#0d0d17] p-4"><div className="text-2xl font-semibold">{value}</div><div className="mt-1 text-xs text-slate-500">{label}</div></div>
      )}
    </div>}
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold">{platformSections.find(item => item.id === section)?.label}</h1><p className="mt-1 text-sm text-slate-500">平台级数据，不受单个租户筛选限制。</p></div><button onClick={() => void load()} className="rounded-lg border border-[#29293b] p-2 text-slate-400 hover:text-white"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button></div>
    {error && <div className="rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</div>}
    <div className="overflow-hidden rounded-xl border border-[#202031] bg-[#0d0d17]">
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-[#202031] text-xs uppercase text-slate-600"><tr>{columns.map(column => <th key={column} className="px-4 py-3">{labels[column] || column.replaceAll("_", " ")}</th>)}<th /></tr></thead>
        <tbody className="divide-y divide-[#1b1b2b]">{records.map(record => <tr key={record.id} onClick={() => setSelected(record)} className="cursor-pointer hover:bg-white/[.025]">{columns.map(column => <td key={column} className="max-w-96 truncate px-4 py-3 text-slate-400" title={text(record[column])}>{text(record[column])}</td>)}<td className="w-10 pr-3 text-slate-700"><ChevronRight className="size-4" /></td></tr>)}</tbody>
      </table></div>
      {!loading && records.length === 0 && <div className="p-12 text-center text-sm text-slate-600">暂无数据</div>}
    </div>
    {selected && <div className="fixed inset-0 z-30 flex justify-end bg-black/60" onClick={() => setSelected(null)}><aside onClick={event => event.stopPropagation()} className="h-full w-full max-w-2xl overflow-auto border-l border-[#29293b] bg-[#0d0d17] p-6"><div className="flex justify-between"><h2 className="font-medium">记录详情</h2><button onClick={() => setSelected(null)} className="text-slate-500">关闭</button></div><div className="mt-5"><DetailFields record={selected} /></div></aside></div>}
  </div>
}

export default function AdminPage() {
  const [section, setSection] = useState<PlatformSection>("tenants")
  return <div className="mx-auto max-w-[1600px]">
    <nav className="mb-6 flex flex-wrap gap-2 rounded-xl border border-[#202031] bg-[#0d0d17] p-2">
      {platformSections.map(item => {
        const Icon = item.icon
        return <button key={item.id} onClick={() => setSection(item.id)} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${section === item.id ? "bg-indigo-500/15 text-indigo-300" : "text-slate-500 hover:bg-white/[.03] hover:text-slate-200"}`}><Icon className="size-4" />{item.label}</button>
      })}
    </nav>
    {section === "tenants" ? <TenantConsole /> : <PlatformRecords section={section} />}
  </div>
}
