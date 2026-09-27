"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react"
import { api } from "@/lib/api"
import type { ActionRun, ActionRunHealth, ActionRunStatus } from "@/lib/types"

const emptyHealth: ActionRunHealth = {
  status: "healthy",
  stats: { total: 0, by_status: {}, average_latency_millis: 0, average_attempts: 0, stale_running: 0, awaiting_confirmation: 0, verification_attention: 0 },
  alerts: [],
}

const statusLabel: Record<string, string> = {
  proposed: "已入队", awaiting_confirmation: "待审批", running: "运行中",
  succeeded: "成功", failed: "失败", partial: "部分成功", cancelled: "已取消",
}

const hasData = (value: Record<string, unknown> | undefined) => Boolean(value && Object.keys(value).length)

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-xs text-slate-400">{JSON.stringify(value, null, 2)}</pre>
}

export default function OntologyPage() {
  const [runs, setRuns] = useState<ActionRun[]>([])
  const [health, setHealth] = useState<ActionRunHealth>(emptyHealth)
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [list, currentHealth] = await Promise.all([
        api.listActionRuns({ status: status || undefined, limit: 100 }),
        api.getActionRunHealth(),
      ])
      setRuns(list.items)
      setHealth(currentHealth)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载 ActionRun 失败")
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    const task = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(task)
  }, [load])

  async function operate(id: string, action: () => Promise<ActionRun>) {
    setBusy(id)
    setError("")
    try {
      await action()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败")
    } finally {
      setBusy(null)
    }
  }

  async function toggleDetail(run: ActionRun) {
    if (expanded === run.id) {
      setExpanded(null)
      return
    }
    setBusy(run.id)
    try {
      const detail = await api.getActionRun(run.id)
      setRuns(items => items.map(item => item.id === detail.id ? detail : item))
      setExpanded(run.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载详情失败")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold text-white">Action Runs</h1><p className="mt-1 text-sm text-slate-400">查看本账户的执行、审批、失败重试与 verification 结果。</p></div>
        <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-lg border border-[#28283a] px-3 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />刷新</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["总运行", health.stats.total, "text-white"],
          ["待审批", health.stats.awaiting_confirmation, "text-amber-300"],
          ["失败", health.stats.by_status.failed || 0, "text-red-300"],
          ["需验证关注", health.stats.verification_attention, "text-purple-300"],
          ["健康状态", health.status, health.status === "healthy" ? "text-emerald-300" : health.status === "critical" ? "text-red-300" : "text-amber-300"],
        ].map(([label, value, color]) => <div key={label} className="rounded-xl border border-[#1e1e2e] bg-[#0d0d16] p-4"><div className={`text-2xl font-semibold ${color}`}>{value}</div><div className="mt-1 text-xs text-slate-500">{label}</div></div>)}
      </div>

      {health.alerts.map(alert => <div key={alert.code} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${alert.severity === "critical" ? "border-red-900 bg-red-950/30 text-red-200" : "border-amber-900 bg-amber-950/30 text-amber-200"}`}><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div>{alert.message} <span className="font-mono opacity-70">({String(alert.value)})</span></div></div>)}
      {error && <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d16]">
        <div className="flex items-center justify-between border-b border-[#1e1e2e] p-4">
          <h2 className="font-medium text-white">运行记录</h2>
          <select value={status} onChange={event => setStatus(event.target.value)} className="rounded-lg border border-[#28283a] bg-[#11111c] px-3 py-2 text-sm text-slate-300 outline-none">
            <option value="">全部状态</option>
            {(["awaiting_confirmation", "running", "failed", "partial", "succeeded", "cancelled"] as ActionRunStatus[]).map(item => <option key={item} value={item}>{statusLabel[item]}</option>)}
          </select>
        </div>
        {!loading && runs.length === 0 && <div className="p-12 text-center text-sm text-slate-500">暂无 ActionRun</div>}
        <div className="divide-y divide-[#1e1e2e]">
          {runs.map(run => {
            const retryable = run.status === "failed" && run.execution_mode === "async" && !hasData(run.output)
            const reverifyable = ["failed", "partial", "succeeded"].includes(run.status) && hasData(run.output)
            return <div key={run.id}>
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.5fr)_160px_100px_minmax(220px,1fr)_auto] lg:items-center">
                <div className="min-w-0"><div className="truncate font-mono text-sm text-slate-200">{run.id}</div><div className="mt-1 truncate text-xs text-slate-500">target {run.target_object_id}</div></div>
                <div><span className={`rounded-full px-2 py-1 text-xs ${run.status === "succeeded" ? "bg-emerald-500/10 text-emerald-300" : run.status === "failed" ? "bg-red-500/10 text-red-300" : run.status === "awaiting_confirmation" ? "bg-amber-500/10 text-amber-300" : "bg-slate-500/10 text-slate-300"}`}>{statusLabel[run.status] || run.status}</span><div className="mt-1 text-xs text-slate-600">{run.confirmation_state}</div></div>
                <div className="text-sm text-slate-400">{run.attempt}/{run.max_attempts} 次</div>
                <div className="min-w-0 text-xs">{run.error ? <div className="truncate text-red-300" title={run.error}>{run.error}</div> : hasData(run.verification_result) ? <div className="flex items-center gap-1 text-purple-300"><ShieldCheck className="size-3.5" />已有 verification</div> : <span className="text-slate-600">—</span>}<div className="mt-1 text-slate-600">{new Date(run.updated_at).toLocaleString()}</div></div>
                <div className="flex flex-wrap justify-end gap-2">
                  {run.status === "awaiting_confirmation" && <><button disabled={busy === run.id} onClick={() => void operate(run.id, () => api.confirmActionRun(run.id, true))} className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"><CheckCircle2 className="mr-1 inline size-3.5" />批准</button><button disabled={busy === run.id} onClick={() => void operate(run.id, () => api.confirmActionRun(run.id, false, "rejected from dashboard"))} className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-50">拒绝</button></>}
                  {retryable && <button disabled={busy === run.id} onClick={() => void operate(run.id, () => api.retryActionRun(run.id))} className="rounded-lg bg-blue-500/10 px-2.5 py-1.5 text-xs text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"><RotateCcw className="mr-1 inline size-3.5" />重试</button>}
                  {reverifyable && <button disabled={busy === run.id} onClick={() => void operate(run.id, () => api.reverifyActionRun(run.id))} className="rounded-lg bg-purple-500/10 px-2.5 py-1.5 text-xs text-purple-300 hover:bg-purple-500/20 disabled:opacity-50"><ShieldCheck className="mr-1 inline size-3.5" />重验</button>}
                  <button disabled={busy === run.id} onClick={() => void toggleDetail(run)} className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-white/5">{expanded === run.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</button>
                </div>
              </div>
              {expanded === run.id && <div className="grid gap-4 border-t border-[#1e1e2e] bg-black/10 p-4 lg:grid-cols-3">
                <section><h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Input</h3><JsonBlock value={run.input} /></section>
                <section><h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Output</h3><JsonBlock value={run.output} /></section>
                <section><h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Verification</h3><JsonBlock value={run.verification_result} /></section>
                <section className="lg:col-span-3"><h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Steps</h3><div className="space-y-2">{(run.steps || []).map(step => <div key={step.id} className="flex gap-3 rounded-lg border border-[#242435] p-3 text-xs"><span className="font-mono text-slate-600">{step.sequence}</span><span className="text-slate-300">{step.step_kind}</span><span className={step.status === "failed" ? "text-red-300" : "text-emerald-300"}>{step.status}</span><span className="text-slate-500">{step.public_summary}</span></div>)}</div></section>
              </div>}
            </div>
          })}
        </div>
      </div>
    </div>
  )
}
