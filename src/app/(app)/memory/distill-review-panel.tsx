"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, ChevronDown, Loader2, RefreshCw, Sparkles, X } from "lucide-react"
import { api } from "@/lib/api"
import { DistillRun, MemoryEntry, MemoryEntryDetail } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const PAGE_SIZE = 10

const typeBadgeClass: Record<string, string> = {
  semantic: "bg-cyan-500/10 text-cyan-300",
  episodic: "bg-violet-500/10 text-violet-300",
  procedural: "bg-amber-500/10 text-amber-200",
}

/**
 * 蒸馏候选的审核面板。
 *
 * 候选是模型读对话原文抽出来的，一律以 pending 落库、不参与检索——一条抽错的持久记忆
 * 会被反复召回，且带着和真实记忆一样的置信外观。所以放行必须是人的动作，而这个面板是
 * 那个动作唯一的界面：没有它，每条候选都得手敲 curl。
 *
 * 关键设计：**证据默认可展开，且放行按钮旁就写着"先看出处"**。审核一条看不到出处的候选
 * 只是橡皮图章，而模型最常见的错误恰恰是从一次用法推断出一个偏好——那种错只有对着原文
 * 才看得出来。
 */
export function DistillReviewPanel({ onReviewed }: { onReviewed?: () => void }) {
  const [candidates, setCandidates] = useState<MemoryEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runs, setRuns] = useState<DistillRun[]>([])

  const load = useCallback(async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError(null)
    try {
      const response = await api.listMemoryEntries({ status: "pending", limit: PAGE_SIZE, offset })
      setCandidates((current) => (append ? [...current, ...(response.items ?? [])] : response.items ?? []))
      setTotal(response.total ?? 0)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  const loadRuns = useCallback(async () => {
    try {
      const response = await api.listDistillRuns({ limit: 5 })
      setRuns(response.items ?? [])
    } catch {
      // 运行记录取不到不该挡住审核本身：候选列表是这个面板的主体。
    }
  }, [])

  useEffect(() => {
    // 延迟一拍：load 会同步翻 loading 标记，直接在 effect 体里调用会触发级联渲染。
    queueMicrotask(() => {
      void load(0, false)
      void loadRuns()
    })
  }, [load, loadRuns])

  const handleReviewed = (id: string) => {
    setCandidates((current) => current.filter((item) => item.id !== id))
    setTotal((current) => Math.max(current - 1, 0))
    onReviewed?.()
    void loadRuns()
  }

  const hasMore = candidates.length < total

  return (
    <section aria-labelledby="distill-review-heading" className="rounded-xl border border-[#1e1e2e] bg-[#101018]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1e1e2e] p-4">
        <div>
          <h2 id="distill-review-heading" className="flex items-center gap-2 font-semibold text-slate-100">
            <Sparkles className="size-4 text-amber-300" /> 待审核候选
            {total > 0 ? <Badge className="bg-amber-500/10 text-amber-200">{total}</Badge> : null}
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            蒸馏从对话原文里抽出的候选。它们不参与检索，放行之后才会被召回——一条抽错的记忆会带着和真实记忆一样的置信被反复取用，所以先看出处再决定。
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="刷新候选列表"
          disabled={loading}
          onClick={() => { void load(0, false); void loadRuns() }}
          className="text-slate-400 hover:text-slate-100"
        >
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>

      {runs.length > 0 ? (
        <div className="border-b border-[#1e1e2e] px-4 py-3">
          <div className="mb-2 text-xs font-medium text-slate-400">最近的蒸馏运行</div>
          <div className="grid gap-1.5">
            {runs.map((run) => <DistillRunRow key={run.id} run={run} />)}
          </div>
        </div>
      ) : null}

      <div className="p-4">
        {loading ? (
          <div role="status" aria-live="polite" className="flex min-h-32 items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 size-4 animate-spin" /> 加载候选…
          </div>
        ) : error ? (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : candidates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#303044] p-8 text-center text-sm text-slate-500">
            没有待审核的候选。蒸馏会在会话静默之后自动跑，也可以在会话页手动触发。
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} onReviewed={handleReviewed} />
            ))}
          </div>
        )}

        {hasMore && !loading ? (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="outline"
              disabled={loadingMore}
              onClick={() => void load(candidates.length, true)}
              className="border-[#2a2a3a] bg-[#12121a] text-slate-200"
            >
              {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
              加载更多（{candidates.length}/{total}）
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function DistillRunRow({ run }: { run: DistillRun }) {
  const statusClass: Record<string, string> = {
    succeeded: "bg-emerald-500/10 text-emerald-300",
    failed: "bg-red-500/10 text-red-300",
    skipped: "bg-slate-500/10 text-slate-400",
    running: "bg-cyan-500/10 text-cyan-300",
    queued: "bg-slate-500/10 text-slate-300",
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#1e1e2e] bg-[#0b0b12] px-3 py-2 text-[11px] text-slate-500">
      <Badge className={statusClass[run.status] ?? "bg-slate-500/10 text-slate-300"}>{run.status}</Badge>
      <Badge className="bg-slate-500/10 text-slate-400">{run.trigger === "sweep" ? "定时" : "按需"}</Badge>
      {/* 覆盖率如实显示：读了多少 / 一共多少。"没抽出东西"和"只看了一部分"是两件事。 */}
      <span>读 {run.items_examined}/{run.items_available} 条</span>
      <span>产出 {run.candidates_written}</span>
      {run.candidates_duplicate > 0 ? <span>重复 {run.candidates_duplicate}</span> : null}
      {run.model ? <span className="font-mono">{run.model}</span> : null}
      {run.cost_micros > 0 ? (
        <span>{(run.cost_micros / 1_000_000).toFixed(4)} 元</span>
      ) : run.input_tokens > 0 && !run.cost_priced ? (
        // 区分"真的没花钱"和"没配单价"，否则账单里的 0 无法解释。
        <span className="text-slate-600">未配单价</span>
      ) : null}
      {run.error ? <span className="text-red-300">{run.error.slice(0, 60)}</span> : null}
      {run.note ? <span className="min-w-0 flex-1 truncate text-slate-600">{run.note}</span> : null}
    </div>
  )
}

function CandidateCard({
  candidate,
  onReviewed,
}: {
  candidate: MemoryEntry
  onReviewed: (id: string) => void
}) {
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState<"promote" | "reject" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<MemoryEntryDetail | null>(null)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [evidenceLoading, setEvidenceLoading] = useState(false)

  const toggleEvidence = async () => {
    const next = !evidenceOpen
    setEvidenceOpen(next)
    if (!next || evidence) return
    setEvidenceLoading(true)
    try {
      setEvidence(await api.getMemoryEntry(candidate.id))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setEvidenceLoading(false)
    }
  }

  const review = async (action: "promote" | "reject") => {
    setBusy(action)
    setError(null)
    try {
      if (action === "promote") {
        const response = await api.promoteMemoryEntry(candidate.id, reason.trim() || undefined)
        // 放行是候选第一次进检索索引。索引失败必须说出来，否则会留下一条"已放行却
        // 搜不到"的记忆，而那种失败在界面上完全看不见。
        if (response.indexing && response.indexing.status !== "indexed") {
          setError(
            `已放行，但索引状态是 ${response.indexing.status}${response.indexing.error ? `：${response.indexing.error}` : ""}。这条记忆暂时搜不到，需要重新索引。`
          )
          setBusy(null)
          return
        }
      } else {
        await api.rejectMemoryEntry(candidate.id, reason.trim() || undefined)
      }
      onReviewed(candidate.id)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError))
      setBusy(null)
    }
  }

  const scope =
    candidate.scope_type && candidate.scope_type !== "global"
      ? `${candidate.scope_type}:${candidate.scope_key}`
      : "global"

  return (
    <div className="rounded-lg border border-[#242436] bg-[#0b0b12] p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge className={typeBadgeClass[candidate.memory_type] ?? "bg-slate-500/10 text-slate-300"}>
          {candidate.memory_type}
        </Badge>
        {/* scope 是审核时最该看清的一件事：一条项目规矩被标成 global 就会在别处误召回。 */}
        <Badge className={scope === "global" ? "bg-slate-500/10 text-slate-400" : "bg-teal-500/10 text-teal-300"}>
          {scope}
        </Badge>
        <span className="text-slate-500">置信 {candidate.confidence.toFixed(2)}</span>
        {candidate.extractor_version ? (
          <span className="font-mono text-slate-600">{candidate.extractor_version}</span>
        ) : null}
      </div>

      {candidate.title ? <div className="mt-2 font-medium text-slate-100">{candidate.title}</div> : null}
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{candidate.content}</p>

      <button
        type="button"
        onClick={() => void toggleEvidence()}
        className="mt-2 text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
      >
        {evidenceOpen ? "收起出处" : "看出处（模型最常见的错是从一次用法推断出偏好）"}
      </button>

      {evidenceOpen ? (
        evidenceLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="size-3.5 animate-spin" /> 加载出处…
          </div>
        ) : evidence ? (
          <div className="mt-2 space-y-1.5">
            {(evidence.evidence ?? []).length === 0 ? (
              <p className="text-xs text-slate-600">这条候选没有单独的证据条目。</p>
            ) : (
              (evidence.evidence ?? []).map((item) => (
                <div key={item.id} className="rounded border border-[#1e1e2e] bg-[#08080e] p-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                    <Badge className="bg-slate-500/10 text-slate-400">{item.source_type}</Badge>
                    <span className="truncate font-mono">{item.source_id}</span>
                  </div>
                  {item.excerpt ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-400">{item.excerpt}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        ) : null
      ) : null}

      {error ? (
        <div role="alert" className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#1a1a26] pt-3">
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="理由（可选，会记在这条记忆上供审计）"
          className="h-8 min-w-[200px] flex-1 border-[#2a2a3a] bg-[#08080e] text-xs text-slate-200 placeholder:text-slate-600"
        />
        <Button
          type="button"
          size="sm"
          disabled={busy !== null}
          onClick={() => void review("promote")}
          className="h-8 bg-emerald-600/90 text-white hover:bg-emerald-500"
        >
          {busy === "promote" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          放行
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => void review("reject")}
          className="h-8 border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/15"
        >
          {busy === "reject" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
          拒绝
        </Button>
      </div>
    </div>
  )
}
