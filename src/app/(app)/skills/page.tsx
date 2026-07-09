"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileCode2,
  Files,
  GitBranch,
  HardDrive,
  Link2,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Server,
  Target,
  UploadCloud,
  Zap,
} from "lucide-react"
import { api } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import {
  CreateSkillVersionRequest,
  CreateSkillSourceRequest,
  IndexSkillsResponse,
  SkillLog,
  SkillSearchItem,
  SkillSignal,
  SkillSource,
  SkillSourceRevision,
  SkillStats,
  SkillVersion,
  SkillVersionFile,
} from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

interface SkillItem {
  name: string
  description: string
  activeVersion: string | null
  activePublishedAt: string | null
  sourceCount: number
  repositories: string[]
  versionCount: number
  total: number
  success: number
  failure: number
  partial: number
  corrected: number
  lastRun: string
}

interface SourceBundle {
  source: SkillSource
  revisions: SkillSourceRevision[]
}

type Notice = {
  tone: "success" | "warning" | "error"
  text: string
}

const ALL_INDEX_TARGET = "__all__"

export default function SkillsPage() {
  const { t } = useI18n()
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [sourceBundles, setSourceBundles] = useState<SourceBundle[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [stats, setStats] = useState<SkillStats | null>(null)
  const [signals, setSignals] = useState<SkillSignal[]>([])
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [versionFiles, setVersionFiles] = useState<Record<string, SkillVersionFile[]>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SkillSearchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [indexingTarget, setIndexingTarget] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.name === selected) ?? null,
    [skills, selected]
  )
  const selectedSourceBundles = useMemo(
    () => (selected ? sourceBundlesForSkill(selected, versions, sourceBundles) : []),
    [selected, sourceBundles, versions]
  )
  const selectedFiles = useMemo(() => {
    const active = versions.find((version) => version.is_active) ?? versions[0]
    return active ? versionFiles[active.id] ?? [] : []
  }, [versionFiles, versions])

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [versionsData, logsData, sourcesData] = await Promise.all([
        api.listSkillVersions({ limit: 100 }),
        api.listSkillLogs({ limit: 200 }),
        api.listSkillSources({ limit: 100 }),
      ])
      const bundles = await loadSourceBundles(sourcesData ?? [])
      setSourceBundles(bundles)
      setSkills(buildSkillItems(versionsData ?? [], logsData ?? [], bundles))
    } catch (err) {
      setNotice({ tone: "error", text: errorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (name: string) => {
    setSelected(name)
    setDetailLoading(true)
    try {
      const [nextStats, nextSignals, nextVersions] = await Promise.all([
        api.getSkillStats(name),
        api.listSkillSignals(name, 20),
        api.listSkillVersions({ skill_name: name, limit: 50 }),
      ])
      const sortedVersions = sortVersions(nextVersions ?? [])
      const filePairs = await Promise.all(
        sortedVersions.map(async (version) => {
          try {
            return [version.id, await api.listSkillVersionFiles(version.id)] as const
          } catch {
            return [version.id, []] as const
          }
        })
      )
      setStats(nextStats)
      setSignals(nextSignals ?? [])
      setVersions(sortedVersions)
      setVersionFiles(Object.fromEntries(filePairs))
    } catch (err) {
      setNotice({ tone: "error", text: errorMessage(err) })
      setStats(null)
      setSignals([])
      setVersions([])
      setVersionFiles({})
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    if (!selected && skills.length > 0) {
      queueMicrotask(() => {
        void loadDetail(skills[0].name)
      })
    }
  }, [loadDetail, selected, skills])

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    const query = searchQuery.trim()
    if (!query) return
    setSearchLoading(true)
    setNotice(null)
    try {
      const result = await api.searchSkills({ query, top_k: 8 })
      setSearchResults(result.items ?? [])
      if ((result.items ?? []).length === 0) {
        setNotice({ tone: "warning", text: "未找到匹配的已索引技能。先发布并索引 active skill 后再试。" })
      }
    } catch (err) {
      setSearchResults([])
      setNotice({ tone: "error", text: errorMessage(err) })
    } finally {
      setSearchLoading(false)
    }
  }

  const handleIndex = async (skillName?: string) => {
    const target = skillName ?? ALL_INDEX_TARGET
    setIndexingTarget(target)
    setNotice(null)
    try {
      const result = await api.indexActiveSkills(skillName)
      setNotice(indexNotice(result, skillName))
    } catch (err) {
      setNotice({ tone: "error", text: errorMessage(err) })
    } finally {
      setIndexingTarget(null)
    }
  }

  const handleActivate = async (version: SkillVersion) => {
    setNotice(null)
    setIndexingTarget(version.skill_name)
    try {
      await api.activateSkillVersion(version.id)
      const result = await api.indexActiveSkills(version.skill_name)
      setNotice(indexNotice(result, version.skill_name))
      await Promise.all([load(), loadDetail(version.skill_name)])
    } catch (err) {
      setNotice({ tone: "error", text: errorMessage(err) })
    } finally {
      setIndexingTarget(null)
    }
  }

  const handlePublished = async (skillName: string, indexResult?: IndexSkillsResponse) => {
    setSheetOpen(false)
    setNotice(indexResult ? indexNotice(indexResult, skillName) : { tone: "success", text: "技能版本已发布。" })
    await load()
    await loadDetail(skillName)
  }

  const handleSourceCreated = async (source: SkillSource) => {
    setSourceSheetOpen(false)
    setNotice({ tone: "success", text: `来源「${source.name}」已注册。` })
    await load()
    const nextSkill = selected ?? source.name
    if (nextSkill) {
      await loadDetail(nextSkill)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
              <Zap className="size-4" />
            </span>
            <h1 className="text-2xl font-bold text-white">{t.skills.title}</h1>
          </div>
          <p className="text-sm text-slate-500">{t.skills.subtitle}，发布、激活、索引并验证 agent 可检索的技能。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSourceSheetOpen(true)}
            className="border-[#2a2a3a] bg-[#12121a] text-slate-200 hover:bg-[#1a1a24]"
          >
            <UploadCloud className="size-4" />
            注册来源
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleIndex()}
            disabled={indexingTarget !== null}
            className="border-[#2a2a3a] bg-[#12121a] text-slate-200 hover:bg-[#1a1a24]"
          >
            {indexingTarget === ALL_INDEX_TARGET ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
            索引全部 active
          </Button>
          <Button type="button" onClick={() => setSheetOpen(true)} className="bg-cyan-600 text-white hover:bg-cyan-500">
            <Plus className="size-4" />
            发布版本
          </Button>
        </div>
      </div>

      {notice && (
        <div className={noticeClassName(notice.tone)}>
          {notice.tone === "success" ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
          <span>{notice.text}</span>
        </div>
      )}

      <section className="rounded-xl border border-[#1e1e2e] bg-[#101018] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
          <Target className="size-4 text-cyan-300" />
          语义检索
        </div>
        <form onSubmit={handleSearch} className="flex flex-col gap-2 md:flex-row">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="描述当前任务，例如：需要调试 Go API 鉴权和 Docker 部署问题"
            className="h-10 border-[#27273a] bg-[#0b0b12] text-sm text-slate-100 placeholder:text-slate-600"
          />
          <Button type="submit" disabled={searchLoading || !searchQuery.trim()} className="h-10 bg-slate-100 text-slate-950 hover:bg-white">
            {searchLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            搜索技能
          </Button>
        </form>

        {searchResults.length > 0 && (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {searchResults.map((item) => (
              <button
                key={item.document_id}
                type="button"
                onClick={() => loadDetail(item.skill_name)}
                className="min-h-[104px] rounded-lg border border-[#242436] bg-[#0b0b12] p-3 text-left transition-colors hover:border-cyan-500/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-100">{item.skill_name}</div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.description || item.change_summary || "无描述"}</p>
                  </div>
                  <Badge className="bg-cyan-500/10 text-cyan-300">#{item.rank}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <span>v{item.version}</span>
                  <span>score {item.score.toFixed(3)}</span>
                  {item.published_at && <span>{formatDate(item.published_at)}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,360px)_1fr]">
        <section className="rounded-xl border border-[#1e1e2e] bg-[#101018]">
          <div className="flex items-center justify-between border-b border-[#1e1e2e] px-4 py-3">
            <div>
              <h2 className="text-sm font-medium text-slate-200">技能目录</h2>
              <p className="text-xs text-slate-600">{skills.length} 个技能 · {sourceBundles.length} 个来源</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={load}
              aria-label="刷新技能列表"
              className="text-slate-400 hover:text-slate-100"
            >
              <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </div>

          <div className="max-h-[720px] space-y-2 overflow-y-auto p-3">
            {loading ? (
              <div className="flex h-32 items-center justify-center text-sm text-slate-500">
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t.common.loading}
              </div>
            ) : skills.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#2a2a3a] p-6 text-center text-sm text-slate-500">
                {t.common.noContent}
              </div>
            ) : (
              skills.map((skill) => (
                <button
                  key={skill.name}
                  type="button"
                  onClick={() => loadDetail(skill.name)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selected === skill.name
                      ? "border-cyan-500/60 bg-cyan-500/10"
                      : "border-[#1d1d2b] bg-[#0b0b12] hover:border-[#35354a]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-100">{skill.name}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{skill.description || "无描述"}</p>
                    </div>
                    {skill.activeVersion && <Badge className="bg-emerald-500/10 text-emerald-300">v{skill.activeVersion}</Badge>}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{skill.versionCount} versions</span>
                    <span>{skill.sourceCount} sources</span>
                    <span>{skill.total} runs</span>
                  </div>
                  {skill.repositories.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-slate-600">
                      <Link2 className="size-3.5 shrink-0" />
                      <span className="truncate">{skill.repositories[0]}</span>
                    </div>
                  )}
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1b1b28]">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${successPercent(skill)}%` }} />
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-[#1e1e2e] bg-[#101018]">
          {!selected ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-slate-500">选择一个技能查看详情</div>
          ) : (
            <div className="space-y-5 p-4">
              <div className="flex flex-col gap-3 border-b border-[#1e1e2e] pb-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-all text-xl font-semibold text-white">{selected}</h2>
                    {selectedSkill?.activeVersion && <Badge className="bg-emerald-500/10 text-emerald-300">active v{selectedSkill.activeVersion}</Badge>}
                  </div>
                  <p className="mt-1 max-w-3xl text-sm text-slate-500">{selectedSkill?.description || "该技能还没有 front matter description。"}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={indexingTarget !== null}
                  onClick={() => handleIndex(selected)}
                  className="border-[#2a2a3a] bg-[#12121a] text-slate-200 hover:bg-[#1a1a24]"
                >
                  {indexingTarget === selected ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
                  索引当前 active
                </Button>
              </div>

              {detailLoading ? (
                <div className="flex h-80 items-center justify-center text-sm text-slate-500">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t.common.loading}
                </div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Metric label={t.skills.totalRuns} value={String(stats?.total_runs ?? 0)} icon={<Activity className="size-4" />} tone="slate" />
                    <Metric label={t.skills.successRate} value={formatPercent(stats?.success_rate ?? 0)} icon={<CheckCircle2 className="size-4" />} tone="green" />
                    <Metric label={t.skills.failureRate} value={formatPercent(stats?.failure_rate ?? 0)} icon={<AlertTriangle className="size-4" />} tone="red" />
                    <Metric label={t.skills.correctionRate} value={formatPercent(stats?.correction_rate ?? 0)} icon={<RefreshCw className="size-4" />} tone="amber" />
                  </div>

                  <SourcePanel bundles={selectedSourceBundles} files={selectedFiles} />

                  <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                        <GitBranch className="size-4 text-cyan-300" />
                        {t.skills.versions}
                      </div>
                      <div className="overflow-hidden rounded-lg border border-[#1e1e2e]">
                        {versions.length === 0 ? (
                          <div className="p-6 text-center text-sm text-slate-500">{t.common.noContent}</div>
                        ) : (
                          versions.map((version) => (
                            <VersionRow
                              key={version.id}
                              version={version}
                              busy={indexingTarget === version.skill_name}
                              onActivate={() => handleActivate(version)}
                            />
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                        <Clock3 className="size-4 text-amber-300" />
                        {t.skills.signals}
                      </div>
                      <div className="rounded-lg border border-[#1e1e2e]">
                        {signals.length === 0 ? (
                          <div className="p-6 text-center text-sm text-slate-500">{t.common.noContent}</div>
                        ) : (
                          signals.map((signal) => <SignalRow key={signal.id} signal={signal} />)
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" style={{ width: "760px", maxWidth: "95vw" }} className="overflow-y-auto border-[#242436] bg-[#101018]">
          <SheetHeader>
            <SheetTitle>发布技能版本</SheetTitle>
            <SheetDescription>发布后可激活并立即写入向量索引。</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <SkillVersionForm
              key={selected ?? "new-skill"}
              defaultSkillName={selected ?? ""}
              onDone={handlePublished}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={sourceSheetOpen} onOpenChange={setSourceSheetOpen}>
        <SheetContent side="right" style={{ width: "640px", maxWidth: "95vw" }} className="overflow-y-auto border-[#242436] bg-[#101018]">
          <SheetHeader>
            <SheetTitle>注册技能来源</SheetTitle>
            <SheetDescription>登记 git repo 或本地目录，让 AgentMate 负责后续检索和同步记录。</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <SkillSourceForm
              defaultName={selected ?? ""}
              onDone={handleSourceCreated}
              onCancel={() => setSourceSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function SourcePanel({ bundles, files }: { bundles: SourceBundle[]; files: SkillVersionFile[] }) {
  return (
    <section className="rounded-lg border border-[#1e1e2e] bg-[#0b0b12]">
      <div className="flex flex-col gap-2 border-b border-[#1e1e2e] p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <HardDrive className="size-4 text-cyan-300" />
          来源与包
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{bundles.length} sources</span>
          <span>{files.length} files</span>
        </div>
      </div>

      {bundles.length === 0 && files.length === 0 ? (
        <div className="p-5 text-sm text-slate-500">还没有关联 repo/source。可以先注册 git 或 local 来源。</div>
      ) : (
        <div className="grid gap-4 p-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
          <div className="space-y-3">
            {bundles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#2a2a3a] p-4 text-sm text-slate-500">当前版本没有 source revision 记录。</div>
            ) : (
              bundles.map((bundle) => {
                const revision = latestRevision(bundle.revisions)
                return (
                  <div key={bundle.source.id} className="rounded-lg border border-[#242436] bg-[#101018] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {bundle.source.type === "git" ? <GitBranch className="size-4 text-cyan-300" /> : <HardDrive className="size-4 text-amber-300" />}
                          <span className="truncate text-sm font-medium text-slate-100">{bundle.source.name}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          <Link2 className="size-3.5 shrink-0" />
                          <span className="break-all font-mono">{bundle.source.repository_url}</span>
                        </div>
                      </div>
                      <Badge className={bundle.source.type === "git" ? "bg-cyan-500/10 text-cyan-300" : "bg-amber-500/10 text-amber-300"}>
                        {bundle.source.type}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                      <FieldPill label="path" value={bundle.source.package_path || "."} />
                      <FieldPill label="sync" value={bundle.source.sync_mode} />
                      <FieldPill label="ref" value={bundle.source.default_ref || "-"} />
                      <FieldPill label="status" value={bundle.source.status} />
                    </div>
                    {revision && (
                      <div className="mt-3 rounded-md border border-[#1d1d2b] bg-[#0b0b12] p-2 text-xs text-slate-500">
                        <div className="mb-1 flex items-center gap-2 text-slate-300">
                          <Server className="size-3.5" />
                          revision {formatDateTime(revision.created_at)}
                        </div>
                        <div className="grid gap-1 md:grid-cols-2">
                          <span className="truncate font-mono">pkg {shortText(revision.package_hash || revision.tree_hash)}</span>
                          <span className="truncate font-mono">{revision.commit_sha ? `commit ${shortText(revision.commit_sha)}` : `snapshot ${shortText(revision.local_snapshot_id)}`}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className="rounded-lg border border-[#242436] bg-[#101018]">
            <div className="flex items-center gap-2 border-b border-[#242436] px-3 py-2 text-sm font-medium text-slate-200">
              <Files className="size-4 text-slate-300" />
              Active package files
            </div>
            {files.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">当前 active 版本没有文件快照。</div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto p-2">
                {files.slice(0, 12).map((file) => (
                  <div key={file.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-xs hover:bg-[#151522]">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-slate-300">{file.path}</div>
                      <div className="mt-1 text-slate-600">{file.kind} · {formatBytes(file.size_bytes)}</div>
                    </div>
                    {file.indexable && <Badge className="bg-emerald-500/10 text-emerald-300">indexable</Badge>}
                  </div>
                ))}
                {files.length > 12 && <div className="px-2 py-2 text-xs text-slate-600">还有 {files.length - 12} 个文件未显示</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function FieldPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[#1d1d2b] bg-[#0b0b12] px-2 py-1.5">
      <span className="mr-2 text-slate-600">{label}</span>
      <span className="break-all text-slate-300">{value}</span>
    </div>
  )
}

function SkillSourceForm({
  defaultName,
  onDone,
  onCancel,
}: {
  defaultName: string
  onDone: (source: SkillSource) => Promise<void>
  onCancel: () => void
}) {
  const [type, setType] = useState<"local" | "git">("local")
  const [name, setName] = useState(defaultName)
  const [repositoryURL, setRepositoryURL] = useState("file:///Users/wellxie/.agents/skills")
  const [packagePath, setPackagePath] = useState(defaultName)
  const [defaultRef, setDefaultRef] = useState("main")
  const [visibility, setVisibility] = useState<"private" | "shared" | "public">("private")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const switchType = (nextType: "local" | "git") => {
    setType(nextType)
    setRepositoryURL(nextType === "local" ? "file:///Users/wellxie/.agents/skills" : "git@github.com:org/skills.git")
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!repositoryURL.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const payload: CreateSkillSourceRequest = {
        name: name.trim() || undefined,
        type,
        repository_url: repositoryURL.trim(),
        package_path: packagePath.trim(),
        visibility,
      }
      if (type === "git") {
        payload.default_ref = defaultRef.trim() || "main"
      }
      const source = await api.createSkillSource(payload)
      await onDone(source)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#242436] bg-[#0b0b12] p-1">
        <Button type="button" variant={type === "local" ? "default" : "ghost"} onClick={() => switchType("local")} className={type === "local" ? "bg-amber-600 text-white hover:bg-amber-500" : "text-slate-400 hover:text-slate-100"}>
          <HardDrive className="size-4" />
          Local
        </Button>
        <Button type="button" variant={type === "git" ? "default" : "ghost"} onClick={() => switchType("git")} className={type === "git" ? "bg-cyan-600 text-white hover:bg-cyan-500" : "text-slate-400 hover:text-slate-100"}>
          <GitBranch className="size-4" />
          Git
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="source-name">Name</Label>
        <Input id="source-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="domain-web" className="border-[#27273a] bg-[#0b0b12]" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="source-repo">Repository URL</Label>
        <Input
          id="source-repo"
          value={repositoryURL}
          onChange={(event) => setRepositoryURL(event.target.value)}
          required
          className="border-[#27273a] bg-[#0b0b12] font-mono text-sm"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="source-path">Package path</Label>
          <Input id="source-path" value={packagePath} onChange={(event) => setPackagePath(event.target.value)} placeholder="domain-web" className="border-[#27273a] bg-[#0b0b12]" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source-ref">Default ref</Label>
          <Input
            id="source-ref"
            value={defaultRef}
            onChange={(event) => setDefaultRef(event.target.value)}
            disabled={type === "local"}
            className="border-[#27273a] bg-[#0b0b12] disabled:text-slate-600"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="source-visibility">Visibility</Label>
        <select
          id="source-visibility"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as "private" | "shared" | "public")}
          className="h-10 w-full rounded-md border border-[#27273a] bg-[#0b0b12] px-3 text-sm text-slate-100 outline-none focus:border-cyan-500"
        >
          <option value="private">private</option>
          <option value="shared">shared</option>
          <option value="public">public</option>
        </select>
      </div>

      <div className="rounded-lg border border-[#242436] bg-[#0b0b12] p-3 text-sm text-slate-500">
        <div className="flex items-center gap-2 text-slate-300">
          <Package className="size-4" />
          {type === "git" ? "server_pull" : "client_push"}
        </div>
        <div className="mt-1 text-xs leading-5">
          {type === "git" ? "Git 来源会先登记仓库信息，后续由服务端拉取同步。" : "Local 来源只登记本地目录，后续由客户端推送文件快照。"}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting} className="flex-1 bg-cyan-600 text-white hover:bg-cyan-500">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
          注册来源
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="border-[#2a2a3a] bg-[#12121a]">
          取消
        </Button>
      </div>
    </form>
  )
}

function SkillVersionForm({
  defaultSkillName,
  onDone,
  onCancel,
}: {
  defaultSkillName: string
  onDone: (skillName: string, indexResult?: IndexSkillsResponse) => Promise<void>
  onCancel: () => void
}) {
  const [skillName, setSkillName] = useState(defaultSkillName)
  const [version, setVersion] = useState("0.1.0")
  const [agentID, setAgentID] = useState("agentmate-web")
  const [changeSummary, setChangeSummary] = useState("")
  const [evalPassRate, setEvalPassRate] = useState("")
  const [activate, setActivate] = useState(true)
  const [indexAfterPublish, setIndexAfterPublish] = useState(true)
  const [content, setContent] = useState(defaultSkillContent(defaultSkillName))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!skillName.trim() || !version.trim() || !content.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const payload: CreateSkillVersionRequest = {
        skill_name: skillName.trim(),
        version: version.trim(),
        content,
        agent_id: agentID.trim(),
        change_summary: changeSummary.trim(),
        activate,
      }
      const parsedPassRate = Number(evalPassRate)
      if (evalPassRate.trim() && !Number.isNaN(parsedPassRate)) {
        payload.eval_pass_rate = parsedPassRate > 1 ? parsedPassRate / 100 : parsedPassRate
      }
      const created = await api.createSkillVersion(payload)
      const indexResult = activate && indexAfterPublish ? await api.indexActiveSkills(created.skill_name) : undefined
      await onDone(created.skill_name, indexResult)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="skill-name">Skill name</Label>
          <Input
            id="skill-name"
            value={skillName}
            onChange={(event) => setSkillName(event.target.value)}
            required
            className="border-[#27273a] bg-[#0b0b12]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="skill-version">Version</Label>
          <Input
            id="skill-version"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            required
            className="border-[#27273a] bg-[#0b0b12]"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="skill-agent">Agent ID</Label>
          <Input
            id="skill-agent"
            value={agentID}
            onChange={(event) => setAgentID(event.target.value)}
            className="border-[#27273a] bg-[#0b0b12]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="skill-pass-rate">Eval pass rate</Label>
          <Input
            id="skill-pass-rate"
            inputMode="decimal"
            value={evalPassRate}
            onChange={(event) => setEvalPassRate(event.target.value)}
            placeholder="0.95 或 95"
            className="border-[#27273a] bg-[#0b0b12]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill-summary">Change summary</Label>
        <Input
          id="skill-summary"
          value={changeSummary}
          onChange={(event) => setChangeSummary(event.target.value)}
          placeholder="说明这次版本解决了什么问题"
          className="border-[#27273a] bg-[#0b0b12]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill-content">Skill content</Label>
        <Textarea
          id="skill-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
          className="min-h-[360px] border-[#27273a] bg-[#0b0b12] font-mono text-sm leading-6"
        />
      </div>

      <div className="grid gap-2 rounded-lg border border-[#242436] bg-[#0b0b12] p-3 text-sm text-slate-300 md:grid-cols-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={activate}
            onChange={(event) => setActivate(event.target.checked)}
            className="size-4 rounded border-[#34344a] bg-transparent"
          />
          发布后设为 active
        </label>
        <label className={`flex items-center gap-2 ${activate ? "" : "text-slate-600"}`}>
          <input
            type="checkbox"
            checked={indexAfterPublish}
            onChange={(event) => setIndexAfterPublish(event.target.checked)}
            disabled={!activate}
            className="size-4 rounded border-[#34344a] bg-transparent"
          />
          active 后立即索引
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting} className="flex-1 bg-cyan-600 text-white hover:bg-cyan-500">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <FileCode2 className="size-4" />}
          发布
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="border-[#2a2a3a] bg-[#12121a]">
          取消
        </Button>
      </div>
    </form>
  )
}

function Metric({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "slate" | "green" | "red" | "amber" }) {
  const tones = {
    slate: "border-slate-500/20 bg-slate-500/10 text-slate-300",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  }
  return (
    <div className="rounded-lg border border-[#1e1e2e] bg-[#0b0b12] p-4">
      <div className={`mb-3 flex size-8 items-center justify-center rounded-lg border ${tones[tone]}`}>{icon}</div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  )
}

function VersionRow({ version, busy, onActivate }: { version: SkillVersion; busy: boolean; onActivate: () => void }) {
  return (
    <div className="grid gap-3 border-b border-[#1e1e2e] bg-[#0b0b12] p-3 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-100">v{version.version}</span>
          {version.is_active && <Badge className="bg-emerald-500/10 text-emerald-300">active</Badge>}
          {version.eval_pass_rate != null && <Badge className="bg-cyan-500/10 text-cyan-300">{formatPercent(version.eval_pass_rate)} pass</Badge>}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{version.change_summary || descriptionFromContent(version.content) || "无变更说明"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span>{formatDate(version.published_at)}</span>
          <span>{version.agent_id || "unknown agent"}</span>
          <span className="font-mono">{version.content_hash.slice(0, 10)}</span>
        </div>
      </div>
      <Button
        type="button"
        variant={version.is_active ? "ghost" : "outline"}
        disabled={version.is_active || busy}
        onClick={onActivate}
        className={version.is_active ? "text-emerald-300" : "border-[#2a2a3a] bg-[#12121a] text-slate-200 hover:bg-[#1a1a24]"}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        {version.is_active ? "当前 active" : "激活并索引"}
      </Button>
    </div>
  )
}

function SignalRow({ signal }: { signal: SkillSignal }) {
  return (
    <div className="border-b border-[#1e1e2e] bg-[#0b0b12] p-3 last:border-b-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {outcomeBadge(signal.outcome)}
        <span className="text-xs text-slate-600">{formatDateTime(signal.created_at)}</span>
        {signal.duration_ms != null && <span className="text-xs text-slate-600">{signal.duration_ms}ms</span>}
      </div>
      <p className="line-clamp-2 text-sm text-slate-400">{signal.trigger_text || "无触发文本"}</p>
      {signal.failure_reason && <p className="mt-2 text-xs leading-5 text-red-300">{signal.failure_reason}</p>}
      {signal.user_correction && <p className="mt-2 text-xs leading-5 text-amber-300">{signal.user_correction}</p>}
    </div>
  )
}

async function loadSourceBundles(sources: SkillSource[]): Promise<SourceBundle[]> {
  return Promise.all(
    sources.map(async (source) => {
      try {
        const revisions = await api.listSkillSourceRevisions(source.id, { limit: 20 })
        return { source, revisions: sortRevisions(revisions ?? []) }
      } catch {
        return { source, revisions: [] }
      }
    })
  )
}

function buildSkillItems(versions: SkillVersion[], logs: SkillLog[], bundles: SourceBundle[]): SkillItem[] {
  const versionsBySkill = new Map<string, SkillVersion[]>()
  const logsBySkill = new Map<string, SkillLog[]>()
  const versionByID = new Map<string, SkillVersion>()
  const sourcesBySkill = new Map<string, SourceBundle[]>()

  for (const version of versions) {
    const list = versionsBySkill.get(version.skill_name) ?? []
    list.push(version)
    versionsBySkill.set(version.skill_name, list)
    versionByID.set(version.id, version)
  }
  for (const log of logs) {
    const list = logsBySkill.get(log.skill_name) ?? []
    list.push(log)
    logsBySkill.set(log.skill_name, list)
  }
  for (const bundle of bundles) {
    const names = skillNamesForSource(bundle, versionByID)
    for (const name of names) {
      const list = sourcesBySkill.get(name) ?? []
      list.push(bundle)
      sourcesBySkill.set(name, list)
    }
  }

  const names = new Set([...versionsBySkill.keys(), ...logsBySkill.keys(), ...sourcesBySkill.keys()])
  return [...names].sort().map((name) => {
    const skillVersions = sortVersions(versionsBySkill.get(name) ?? [])
    const skillLogs = logsBySkill.get(name) ?? []
    const skillSources = sourcesBySkill.get(name) ?? []
    const active = skillVersions.find((version) => version.is_active) ?? null
    const success = skillLogs.filter((log) => log.outcome === "success").length
    const failure = skillLogs.filter((log) => log.outcome === "failure").length
    const partial = skillLogs.filter((log) => log.outcome === "partial").length
    const corrected = skillLogs.filter((log) => log.outcome === "user_corrected").length
    const lastRun = skillLogs.reduce((latest, log) => (!latest || log.created_at > latest ? log.created_at : latest), "")

    return {
      name,
      description: descriptionFromContent(active?.content ?? skillVersions[0]?.content ?? ""),
      activeVersion: active?.version ?? null,
      activePublishedAt: active?.published_at ?? null,
      sourceCount: skillSources.length,
      repositories: uniqueStrings(skillSources.map((bundle) => bundle.source.repository_url)),
      versionCount: skillVersions.length,
      total: skillLogs.length,
      success,
      failure,
      partial,
      corrected,
      lastRun,
    }
  })
}

function sourceBundlesForSkill(skillName: string, versions: SkillVersion[], bundles: SourceBundle[]) {
  const versionByID = new Map(versions.map((version) => [version.id, version]))
  return bundles.filter((bundle) => skillNamesForSource(bundle, versionByID).has(skillName))
}

function skillNamesForSource(bundle: SourceBundle, versionByID: Map<string, SkillVersion>) {
  const names = new Set<string>()
  for (const revision of bundle.revisions) {
    const skillName = revision.skill_version_id ? versionByID.get(revision.skill_version_id)?.skill_name : ""
    if (skillName) names.add(skillName)
  }
  if (names.size === 0) {
    const fallback = sourceFallbackSkillName(bundle.source)
    if (fallback) names.add(fallback)
  }
  return names
}

function sourceFallbackSkillName(source: SkillSource) {
  return source.name || pathBase(source.package_path) || pathBase(source.repository_url.replace(/\.git$/, "")) || source.id
}

function pathBase(value: string) {
  const cleaned = value.trim().replace(/\/+$/, "")
  if (!cleaned) return ""
  return cleaned.split("/").filter(Boolean).at(-1) ?? ""
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function sortVersions(versions: SkillVersion[]) {
  return [...versions].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    return Date.parse(b.published_at) - Date.parse(a.published_at)
  })
}

function sortRevisions(revisions: SkillSourceRevision[]) {
  return [...revisions].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}

function latestRevision(revisions: SkillSourceRevision[]) {
  return sortRevisions(revisions)[0] ?? null
}

function outcomeBadge(outcome: string) {
  const classes: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-300",
    failure: "bg-red-500/10 text-red-300",
    partial: "bg-amber-500/10 text-amber-300",
    user_corrected: "bg-cyan-500/10 text-cyan-300",
  }
  return <Badge className={classes[outcome] ?? "bg-slate-500/10 text-slate-300"}>{outcome}</Badge>
}

function noticeClassName(tone: Notice["tone"]) {
  const tones = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    error: "border-red-500/30 bg-red-500/10 text-red-200",
  }
  return `flex items-start gap-2 rounded-lg border p-3 text-sm ${tones[tone]}`
}

function indexNotice(result: IndexSkillsResponse, skillName?: string): Notice {
  const target = skillName ? `「${skillName}」` : "全部 active skills"
  if (result.errors.length > 0 && result.indexed.length === 0) {
    return { tone: "error", text: `${target} 索引失败：${result.errors.map((item) => item.error).join("; ")}` }
  }
  if (result.errors.length > 0) {
    return { tone: "warning", text: `${target} 已索引 ${result.indexed.length} 条，失败 ${result.errors.length} 条。` }
  }
  return { tone: "success", text: `${target} 已索引 ${result.indexed.length} 条。` }
}

function descriptionFromContent(content: string) {
  const lines = content.split("\n")
  if (lines[0]?.trim() !== "---") return ""
  for (const line of lines.slice(1)) {
    const trimmed = line.trim()
    if (trimmed === "---") break
    if (trimmed.startsWith("description:")) {
      return trimmed.replace("description:", "").trim().replace(/^["']|["']$/g, "")
    }
  }
  return ""
}

function defaultSkillContent(skillName: string) {
  const name = skillName || "new-skill"
  return `---
name: ${name}
description: Describe when this skill should be used.
---

Use this skill when ...

## Workflow

1. Inspect the user request and repository context.
2. Choose the minimal relevant actions.
3. Verify the result before reporting back.
`
}

function successPercent(skill: SkillItem) {
  if (skill.total === 0) return 0
  return Math.round((skill.success / skill.total) * 100)
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString()
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function shortText(value?: string | null) {
  if (!value) return "-"
  return value.length > 12 ? value.slice(0, 12) : value
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "操作失败"
}
