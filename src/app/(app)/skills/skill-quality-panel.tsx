"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  CircleSlash2,
  FileDiff,
  FlaskConical,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"
import { api } from "@/lib/api"
import type {
  SkillQualityCheckDTO,
  SkillQualityFileChangeDTO,
  SkillQualityRunDTO,
  SkillQualitySuggestionDTO,
  SkillQualityTelemetryDTO,
} from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const TELEMETRY_EVIDENCE_TARGET = 20

type QualityEntry = {
  loaded: boolean
  dirty: boolean
  run: SkillQualityRunDTO | null
  baselineRun: SkillQualityRunDTO | null
  total: number
  baselineError?: string
  error?: string
}

type PendingOperation = {
  versionID: string
  kind: "loading" | "running"
}

type ActiveRequest = {
  versionID: string
  generation: number
  kind: PendingOperation["kind"]
  controller: AbortController
}

type QualityBundle = {
  run: SkillQualityRunDTO | null
  baselineRun: SkillQualityRunDTO | null
  total: number
  baselineError?: string
}

type SkillQualityPanelProps = {
  active: boolean
  versionID: string
  skillName: string
  version: string
  packageHash: string
}

export function SkillQualityPanel({ active, versionID, skillName, version, packageHash }: SkillQualityPanelProps) {
  const [entries, setEntries] = useState<Record<string, QualityEntry>>({})
  const [pending, setPending] = useState<PendingOperation | null>(null)
  const entriesRef = useRef(entries)
  const mountedRef = useRef(true)
  const requestGeneration = useRef(0)
  const activeRequest = useRef<ActiveRequest | null>(null)

  const updateEntry = useCallback((key: string, update: (current?: QualityEntry) => QualityEntry) => {
    if (!mountedRef.current) return
    setEntries((current) => {
      const next = { ...current, [key]: update(current[key]) }
      entriesRef.current = next
      return next
    })
  }, [])

  const markRunningRequestDirty = useCallback((request: ActiveRequest) => {
    if (request.kind !== "running") return
    const prior = entriesRef.current[request.versionID]
    entriesRef.current = {
      ...entriesRef.current,
      [request.versionID]: {
        loaded: false,
        dirty: true,
        run: prior?.run ?? null,
        baselineRun: prior?.baselineRun ?? null,
        total: prior?.total ?? 0,
        baselineError: prior?.baselineError,
        error: prior?.error,
      },
    }
  }, [])

  const cancelActiveRequest = useCallback(() => {
    const request = activeRequest.current
    if (!request) return
    markRunningRequestDirty(request)
    request.controller.abort()
    activeRequest.current = null
    requestGeneration.current += 1
  }, [markRunningRequestDirty])

  const beginRequest = useCallback((key: string, kind: PendingOperation["kind"]) => {
    cancelActiveRequest()
    const generation = ++requestGeneration.current
    const controller = new AbortController()
    activeRequest.current = { versionID: key, generation, kind, controller }
    setPending({ versionID: key, kind })
    return { generation, controller }
  }, [cancelActiveRequest])

  const isCurrentRequest = useCallback((generation: number) => generation === requestGeneration.current, [])

  const finishRequest = useCallback((generation: number) => {
    if (!isCurrentRequest(generation)) return
    activeRequest.current = null
    setPending(null)
  }, [isCurrentRequest])

  const loadLatest = useCallback(async (key: string, force = false) => {
    const current = entriesRef.current[key]
    if (!force && current?.loaded && !current.dirty) return

    const { generation, controller } = beginRequest(key, "loading")
    updateEntry(key, (prior) => ({
      loaded: false,
      dirty: false,
      run: prior?.run ?? null,
      baselineRun: prior?.baselineRun ?? null,
      total: prior?.total ?? 0,
    }))

    try {
      const bundle = await fetchLatestBundle(key, controller.signal)
      if (!isCurrentRequest(generation)) return
      updateEntry(key, () => ({ loaded: true, dirty: false, ...bundle }))
    } catch (error) {
      if (isAbortError(error) || !isCurrentRequest(generation)) return
      updateEntry(key, (prior) => ({
        loaded: true,
        dirty: false,
        run: prior?.run ?? null,
        baselineRun: prior?.baselineRun ?? null,
        total: prior?.total ?? 0,
        baselineError: prior?.baselineError,
        error: errorMessage(error),
      }))
    } finally {
      finishRequest(generation)
    }
  }, [beginRequest, finishRequest, isCurrentRequest, updateEntry])

  useEffect(() => {
    if (!active) return
    void loadLatest(versionID)
    return () => {
      const request = activeRequest.current
      if (request?.versionID !== versionID) return
      cancelActiveRequest()
    }
  }, [active, cancelActiveRequest, loadLatest, versionID])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      activeRequest.current?.controller.abort()
      activeRequest.current = null
      requestGeneration.current += 1
    }
  }, [])

  const runQualityChecks = async () => {
    const { generation, controller } = beginRequest(versionID, "running")
    let createdRun: SkillQualityRunDTO | null = null
    try {
      createdRun = await api.createSkillQualityRun(versionID, {}, controller.signal)
      if (!isCurrentRequest(generation)) return
      try {
        const bundle = await fetchLatestBundle(versionID, controller.signal)
        if (!isCurrentRequest(generation)) return
        updateEntry(versionID, () => ({ loaded: true, dirty: false, ...bundle }))
      } catch (refreshError) {
        if (isAbortError(refreshError) || !isCurrentRequest(generation)) return
        updateEntry(versionID, (prior) => ({
          loaded: true,
          dirty: false,
          run: createdRun,
          baselineRun: null,
          total: (prior?.total ?? 0) + 1,
          baselineError: "最新列表刷新失败，未加载基线版本的独立样本。",
          error: `报告已生成，但刷新最新列表失败：${errorMessage(refreshError)}`,
        }))
      }
    } catch (error) {
      if (isAbortError(error) || !isCurrentRequest(generation)) return
      updateEntry(versionID, (prior) => ({
        loaded: true,
        dirty: false,
        run: prior?.run ?? null,
        baselineRun: prior?.baselineRun ?? null,
        total: prior?.total ?? 0,
        baselineError: prior?.baselineError,
        error: errorMessage(error),
      }))
    } finally {
      finishRequest(generation)
    }
  }

  const entry = entries[versionID]
  const loading = pending?.versionID === versionID && pending.kind === "loading"
  const running = pending?.versionID === versionID && pending.kind === "running"

  if (!entry || (loading && !entry.run)) return <LoadingState />

  if (entry.error && !entry.run) {
    return (
      <StateCard tone="error" icon={<AlertTriangle className="size-5" />} title="Quality 报告加载失败" text={entry.error}>
        <Button type="button" size="sm" variant="outline" onClick={() => void loadLatest(versionID, true)} className="border-red-400/30 bg-transparent text-red-100">
          <RefreshCw className="size-4" />重试
        </Button>
      </StateCard>
    )
  }

  if (!entry.run) {
    return (
      <StateCard tone="empty" icon={<CircleSlash2 className="size-6" />} title="尚无 Quality 报告" text={`v${version} 还没有确定性检查证据。运行只创建审计报告，不会发布版本、创建 PR 或修改技能内容。`}>
        <RunButton running={running} onRun={() => void runQualityChecks()} />
      </StateCard>
    )
  }

  const run = entry.run
  const lint = summarizeChecks(run.report.lint)
  const deterministic = summarizeChecks(run.report.eval)
  const comparison = run.report.comparison
  const baselineVersionID = comparison.baseline_version_id ?? run.baseline_version_id
  const hashCurrent = run.input_package_hash === packageHash && run.report.input.package_hash === packageHash

  return (
    <div className="space-y-4" aria-busy={loading || running}>
      <div className="flex flex-col gap-3 rounded-xl border border-[#29293a] bg-[#0b0b12] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-100">{skillName} · v{version}</h3>
            <Badge className={hashCurrent ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}>
              包证据 {hashCurrent ? "current" : "stale"}
            </Badge>
            <Badge className="bg-slate-500/10 text-slate-300">run {run.status}</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            最新报告 {run.id} · {formatDateTime(run.completed_at ?? run.created_at)} · 共 {entry.total} 次运行
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={loading || running} onClick={() => void loadLatest(versionID, true)} className="border-[#303044] bg-transparent text-slate-200">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}刷新最新
          </Button>
          <RunButton running={running} disabled={loading} onRun={() => void runQualityChecks()} rerun />
        </div>
      </div>

      {loading || running ? <div role="status" aria-live="polite" className="text-sm text-cyan-200">{running ? "正在运行并刷新最新报告…" : "正在刷新最新报告…"}</div> : null}
      {entry.error ? <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{entry.error}</div> : null}
      {run.failure_message ? <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{run.failure_message}</div> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <EvidenceMetric
          label="Lint findings (blocker / error / warning)"
          value={`${lint.findings.blocker} / ${lint.findings.error} / ${lint.findings.warning}`}
          tone={lint.findings.blocker + lint.findings.error > 0 ? "red" : lint.findings.warning > 0 ? "amber" : "green"}
        />
        <EvidenceMetric label="Lint passed / applicable" value={`${lint.passed}/${lint.applicable}`} tone={lint.failed > 0 ? "red" : "green"} />
        <EvidenceMetric label="平台契约断言 passed / applicable" value={`${deterministic.passed}/${deterministic.applicable}`} tone={deterministic.failed > 0 ? "amber" : "green"} />
        <EvidenceMetric label="Target telemetry n / 20" value={sampleCount(run.report.telemetry.triggered)} tone={run.report.telemetry.status === "insufficient" ? "amber" : "slate"} />
      </div>

      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs leading-5 text-cyan-100/80">
        <strong>deterministic eval：</strong>这里只汇总后端 <code>report.eval</code> 的平台契约断言 passed / applicable，不代表技能内容质量，也不聚合为单一分值。
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ComparisonSection comparison={comparison} baselineVersionID={baselineVersionID} />
        <section className="rounded-xl border border-[#252536] bg-[#0b0b12] p-4" aria-labelledby="quality-telemetry-heading">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-cyan-300" />
            <h4 id="quality-telemetry-heading" className="font-medium text-slate-200">Telemetry evidence</h4>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <TelemetryCard label="Target" telemetry={run.report.telemetry} />
            <TelemetryCard
              label="Baseline"
              telemetry={entry.baselineRun?.report.telemetry ?? null}
              unavailableReason={entry.baselineError ?? (baselineVersionID ? "基线版本尚无独立 Quality 报告。" : "本次报告未使用基线版本。")}
            />
          </div>
          {baselineVersionID ? <p className="mt-3 text-xs leading-5 text-slate-600">Baseline 来自版本 {baselineVersionID} 的最新独立报告；其 cutoff 可能与 Target 不同。</p> : null}
        </section>
      </div>

      <SuggestionsSection suggestions={run.report.telemetry.suggestions} />

      <div className="grid gap-4 xl:grid-cols-2">
        <FreshnessSection run={run} catalogPackageHash={packageHash} current={hashCurrent} />
        <LimitationsSection baselineVersionID={baselineVersionID} />
      </div>

      <details className="rounded-xl border border-[#252536] bg-[#0b0b12]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500">查看检查明细</summary>
        <div className="grid gap-4 border-t border-[#252536] p-4 xl:grid-cols-2">
          <CheckList title="Lint checks" checks={run.report.lint} />
          <CheckList title="Deterministic platform contract checks" checks={run.report.eval} />
        </div>
      </details>
    </div>
  )
}

async function fetchLatestBundle(versionID: string, signal: AbortSignal): Promise<QualityBundle> {
  const response = await api.listSkillQualityRuns(versionID, { limit: 1, offset: 0 }, signal)
  const latest = response.items[0]
  if (!latest) return { run: null, baselineRun: null, total: response.total }

  const run = await api.getSkillQualityRun(latest.id, signal)
  const baselineVersionID = run.report.comparison.baseline_version_id ?? run.baseline_version_id
  if (!baselineVersionID) return { run, baselineRun: null, total: response.total }

  try {
    const baselineResponse = await api.listSkillQualityRuns(baselineVersionID, { limit: 1, offset: 0 }, signal)
    const baselineLatest = baselineResponse.items[0]
    if (!baselineLatest) {
      return { run, baselineRun: null, total: response.total, baselineError: "基线版本尚无独立 Quality 报告。" }
    }
    const baselineRun = await api.getSkillQualityRun(baselineLatest.id, signal)
    return { run, baselineRun, total: response.total }
  } catch (error) {
    if (isAbortError(error)) throw error
    return { run, baselineRun: null, total: response.total, baselineError: `无法加载基线版本最新报告：${errorMessage(error)}` }
  }
}

function RunButton({ running, disabled = false, onRun, rerun = false }: { running: boolean; disabled?: boolean; onRun: () => void; rerun?: boolean }) {
  return (
    <Button type="button" disabled={running || disabled} onClick={onRun} className="bg-cyan-600 text-white hover:bg-cyan-500">
      {running ? <Loader2 className="size-4 animate-spin" /> : rerun ? <RefreshCw className="size-4" /> : <Play className="size-4" />}
      {running ? "正在运行…" : rerun ? "重新运行" : "运行检查"}
    </Button>
  )
}

function LoadingState() {
  return <div role="status" aria-live="polite" className="flex min-h-48 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 size-4 animate-spin" />正在加载最新 Quality 报告…</div>
}

function StateCard({ tone, icon, title, text, children }: { tone: "empty" | "error"; icon: ReactNode; title: string; text: string; children: ReactNode }) {
  const classes = tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-[#303044] bg-[#0b0b12] text-slate-400"
  return <div className={`flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center ${classes}`}>{icon}<div><h3 className="font-medium text-slate-200">{title}</h3><p className="mt-1 max-w-xl text-sm leading-6">{text}</p></div>{children}</div>
}

function EvidenceMetric({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "amber" | "slate" }) {
  const classes = { green: "text-emerald-300", red: "text-red-300", amber: "text-amber-300", slate: "text-slate-200" }
  return <div className="rounded-xl border border-[#252536] bg-[#0b0b12] p-4"><div className="text-xs text-slate-600">{label}</div><div className={`mt-2 break-words text-xl font-semibold ${classes[tone]}`}>{value}</div></div>
}

function ComparisonSection({ comparison, baselineVersionID }: { comparison: SkillQualityRunDTO["report"]["comparison"]; baselineVersionID?: string }) {
  const changes: { kind: string; change: SkillQualityFileChangeDTO }[] = [
    ...comparison.files_added.map((change) => ({ kind: "added", change })),
    ...comparison.files_removed.map((change) => ({ kind: "removed", change })),
    ...comparison.files_modified.map((change) => ({ kind: "modified", change })),
  ]
  return (
    <section className="rounded-xl border border-[#252536] bg-[#0b0b12] p-4" aria-labelledby="quality-comparison-heading">
      <div className="flex items-center gap-2"><FileDiff className="size-4 text-cyan-300" /><h4 id="quality-comparison-heading" className="font-medium text-slate-200">Comparison</h4></div>
      <dl className="mt-4 grid gap-3 text-sm">
        <EvidenceRow label="status" value={comparison.status} />
        <EvidenceRow label="baseline_version_id" value={baselineVersionID ?? "—"} mono />
        <EvidenceRow label="package_hash_changed" value={String(comparison.package_hash_changed)} />
        <EvidenceRow label="resource_manifest_changed" value={String(comparison.resource_manifest_changed)} />
        <EvidenceRow label="file changes" value={`${comparison.files_added.length} added · ${comparison.files_removed.length} removed · ${comparison.files_modified.length} modified`} />
        <EvidenceRow label="routing diffs" value={String(comparison.routing_diffs.length)} />
        <EvidenceRow label="lint / eval regressions" value={`${comparison.lint_regressions.length} / ${comparison.eval_regressions.length}`} />
      </dl>
      {changes.length > 0 ? <ul className="mt-4 space-y-2" aria-label="文件变化">{changes.map(({ kind, change }) => <li key={`${kind}:${change.path}`} className="rounded-lg border border-[#252536] bg-[#111119] p-3 text-xs"><div className="flex flex-wrap items-center gap-2"><Badge className="bg-slate-500/10 text-slate-300">{kind}</Badge><span className="break-all font-mono text-slate-200">{change.path}</span></div>{change.before_hash ? <p className="mt-2 break-all font-mono text-slate-600">before {change.before_hash}</p> : null}{change.after_hash ? <p className="mt-1 break-all font-mono text-slate-600">after {change.after_hash}</p> : null}</li>)}</ul> : <p className="mt-4 text-sm text-slate-600">无文件变化记录。</p>}
      {comparison.routing_diffs.length > 0 ? <div className="mt-4"><h5 className="text-xs font-medium text-slate-500">Routing diffs</h5><ul className="mt-2 space-y-2 text-xs text-slate-500">{comparison.routing_diffs.map((diff) => <li key={diff.field} className="rounded-lg bg-[#111119] p-3"><span className="font-medium text-slate-300">{diff.field}</span><div className="mt-1 break-words">before: {diff.before.join(", ") || "—"}</div><div className="break-words">after: {diff.after.join(", ") || "—"}</div></li>)}</ul></div> : null}
      {comparison.lint_regressions.length + comparison.eval_regressions.length > 0 ? <div className="mt-4 text-xs text-red-300">regressions: {[...comparison.lint_regressions, ...comparison.eval_regressions].join(", ")}</div> : null}
    </section>
  )
}

function TelemetryCard({ label, telemetry, unavailableReason }: { label: string; telemetry: SkillQualityTelemetryDTO | null; unavailableReason?: string }) {
  if (!telemetry) {
    return <div className="rounded-lg border border-[#252536] bg-[#111119] p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{label}</span><Badge className="bg-slate-500/10 text-slate-400">not_available</Badge></div><div className="mt-2 text-xl font-semibold text-slate-100">—</div><p className="mt-2 text-xs leading-5 text-slate-600">{unavailableReason}</p></div>
  }
  const insufficient = telemetry.status === "insufficient"
  return (
    <div className="rounded-lg border border-[#252536] bg-[#111119] p-3">
      <div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{label}</span><Badge className={insufficient ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/10 text-emerald-300"}>{telemetry.status}{insufficient ? " · 证据不足" : ""}</Badge></div>
      <div className="mt-2 text-xl font-semibold text-slate-100">{sampleCount(telemetry.triggered)}</div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <EvidenceRow label="considered" value={displayZeroAsDash(telemetry.considered)} />
        <EvidenceRow label="bypass" value={displayZeroAsDash(telemetry.bypass)} />
        <EvidenceRow label="outcome denominator" value={displayZeroAsDash(telemetry.outcome_denominator)} />
        <EvidenceRow label="cutoff" value={formatDateTime(telemetry.cutoff)} />
      </dl>
      {telemetry.triggered > 0 ? <div className="mt-3 text-xs leading-5 text-slate-500">success {telemetry.outcomes.success} · failure {telemetry.outcomes.failure} · partial {telemetry.outcomes.partial} · corrected {telemetry.outcomes.user_corrected} · other {telemetry.outcomes.other}</div> : null}
    </div>
  )
}

function SuggestionsSection({ suggestions }: { suggestions: SkillQualitySuggestionDTO[] }) {
  return (
    <section className="rounded-xl border border-[#252536] bg-[#0b0b12] p-4" aria-labelledby="quality-suggestions-heading">
      <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-cyan-300" /><h4 id="quality-suggestions-heading" className="font-medium text-slate-200">Suggestions</h4></div>
      {suggestions.length > 0 ? <ul className="mt-3 grid gap-3 md:grid-cols-2">{suggestions.map((suggestion) => <li key={suggestion.fingerprint} className="rounded-lg border border-[#252536] bg-[#111119] p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-200">{suggestion.category}</span><Badge className="bg-cyan-500/10 text-cyan-300">{suggestion.count}/{suggestion.denominator} · {formatRate(suggestion.rate)}</Badge></div><p className="mt-2 break-all font-mono text-xs text-slate-600">fingerprint {suggestion.fingerprint}</p><p className="mt-1 text-xs text-slate-600">log ids: {suggestion.log_ids.length}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-600">当前报告没有达到规则阈值的建议信号。</p>}
    </section>
  )
}

function FreshnessSection({ run, catalogPackageHash, current }: { run: SkillQualityRunDTO; catalogPackageHash: string; current: boolean }) {
  return (
    <section className="rounded-xl border border-[#252536] bg-[#0b0b12] p-4" aria-labelledby="quality-freshness-heading">
      <h4 id="quality-freshness-heading" className="font-medium text-slate-200">Freshness</h4>
      <p className="mt-2 text-xs leading-5 text-slate-500">后端不返回 freshness 字段；状态由报告输入哈希与当前目录包哈希的严格相等比较得出。</p>
      <dl className="mt-3 grid gap-3 text-sm">
        <EvidenceRow label="hash comparison" value={current ? "current" : "stale"} />
        <EvidenceRow label="run.input_package_hash" value={run.input_package_hash} mono />
        <EvidenceRow label="report.input.package_hash" value={run.report.input.package_hash} mono />
        <EvidenceRow label="catalog package_hash" value={catalogPackageHash} mono />
        <EvidenceRow label="telemetry_cutoff" value={formatDateTime(run.telemetry_cutoff)} />
        <EvidenceRow label="created / completed" value={`${formatDateTime(run.created_at)} / ${formatDateTime(run.completed_at)}`} />
      </dl>
    </section>
  )
}

function LimitationsSection({ baselineVersionID }: { baselineVersionID?: string }) {
  const limitations = [
    "检查同步、离线且只产生审计报告；不会改动版本、active 状态、索引、日志或技能内容。",
    "deterministic eval 只断言平台编译、L0/L2 隔离和资源边界契约。",
    "Telemetry 只纳入 cutoff 之前绑定到对应 version_id 的最新 200 条日志；少于 20 条 triggered 样本时明确标记 insufficient。",
    "每个检查的 severity 由后端 checkset 确定；界面仅展示并按 blocker、error、warning 汇总失败项。",
    baselineVersionID ? "Target 报告不内嵌 baseline telemetry；Baseline 卡片来自基线版本的最新独立报告。" : "本次报告没有基线比较，因此 baseline telemetry 不可用。",
  ]
  return <section className="rounded-xl border border-[#252536] bg-[#0b0b12] p-4" aria-labelledby="quality-limitations-heading"><h4 id="quality-limitations-heading" className="font-medium text-slate-200">Limitations</h4><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">{limitations.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-cyan-400/70" /><span>{item}</span></li>)}</ul></section>
}

function CheckList({ title, checks }: { title: string; checks: SkillQualityCheckDTO[] }) {
  return <section><h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h4><ul className="mt-2 space-y-2">{checks.map((check) => { const status = checkStatus(check); return <li key={check.id} className="rounded-lg border border-[#252536] bg-[#111119] p-3 text-xs"><div className="flex flex-wrap items-center gap-2"><span className="break-all font-medium text-slate-200">{check.id}</span><Badge className={status === "failed" ? "bg-red-500/10 text-red-300" : status === "passed" ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/10 text-slate-400"}>{status}</Badge><Badge className={severityClassName(check.severity)}>{check.severity}</Badge></div><EvidenceDetails evidence={check.evidence} /></li> })}</ul></section>
}

function EvidenceDetails({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence)
  if (entries.length === 0) return <p className="mt-2 text-slate-600">无 evidence。</p>
  return <dl className="mt-2 grid gap-1 text-slate-500">{entries.map(([key, value]) => <div key={key} className="grid gap-1 sm:grid-cols-[minmax(9rem,0.4fr)_minmax(0,1fr)]"><dt>{key}</dt><dd className="break-all font-mono text-slate-400">{formatEvidence(value)}</dd></div>)}</dl>
}

function EvidenceRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="text-xs text-slate-600">{label}</dt><dd className={`mt-1 break-all text-slate-300 ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</dd></div>
}

function summarizeChecks(checks: SkillQualityCheckDTO[]) {
  const applicable = checks.filter((check) => check.applicable)
  const passed = applicable.filter((check) => check.passed).length
  const failedChecks = applicable.filter((check) => !check.passed)
  const findings = { blocker: 0, error: 0, warning: 0 }
  for (const check of failedChecks) findings[check.severity] += 1
  return { applicable: applicable.length, passed, failed: failedChecks.length, findings }
}

function severityClassName(severity: SkillQualityCheckDTO["severity"]) {
  if (severity === "blocker") return "bg-red-500/10 text-red-300"
  if (severity === "error") return "bg-orange-500/10 text-orange-300"
  return "bg-amber-500/10 text-amber-300"
}

function checkStatus(check: SkillQualityCheckDTO) {
  if (!check.applicable) return "not_applicable"
  return check.passed ? "passed" : "failed"
}

function sampleCount(triggered: number) {
  return triggered === 0 ? "—" : `${triggered}/${TELEMETRY_EVIDENCE_TARGET}`
}

function displayZeroAsDash(value: number) {
  return value === 0 ? "—" : String(value)
}

function formatEvidence(value: unknown) {
  if (value === null) return "null"
  if (typeof value === "string") return value || "—"
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return "[unserializable]"
  }
}

function formatRate(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatDateTime(value?: string) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败"
}
