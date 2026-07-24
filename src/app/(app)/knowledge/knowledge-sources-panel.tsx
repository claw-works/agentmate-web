"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  GitBranch,
  HardDrive,
  History,
  Link2,
  Loader2,
  RefreshCw,
  UploadCloud,
} from "lucide-react"
import { api } from "@/lib/api"
import type {
  CreateKnowledgeSourceRequest,
  KnowledgeSource,
  KnowledgeSourceRevision,
} from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { errorMessage, formatDateTime, Notice, shortHash } from "./helpers"

type RevisionEntry = { items: KnowledgeSourceRevision[]; loading: boolean; error?: string }

export function KnowledgeSourcesPanel({
  onNotice,
  onCatalogMutation,
}: {
  onNotice: (notice: Notice) => void
  onCatalogMutation: () => Promise<void>
}) {
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [syncingSourceID, setSyncingSourceID] = useState<string | null>(null)
  const [indexingSourceID, setIndexingSourceID] = useState<string | null>(null)
  const [openRevisionsSourceID, setOpenRevisionsSourceID] = useState<string | null>(null)
  const [revisions, setRevisions] = useState<Record<string, RevisionEntry>>({})
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const loadSources = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await api.listKnowledgeSources({ limit: 100 })
      if (!mounted.current) return
      setSources(items ?? [])
    } catch (err) {
      if (!mounted.current) return
      setError(errorMessage(err))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSources()
  }, [loadSources])

  const handleCreated = async (source: KnowledgeSource) => {
    setShowForm(false)
    onNotice({ tone: "success", text: `已注册知识来源 ${source.name}（${source.type}）。` })
    await loadSources()
    await onCatalogMutation()
  }

  const handleSync = async (source: KnowledgeSource) => {
    setSyncingSourceID(source.id)
    try {
      const response = await api.syncKnowledgeSource(source.id, {})
      onNotice({
        tone: "success",
        text: `已同步 ${source.name}：commit ${shortHash(response.commit_sha)}，${(response.documents ?? []).length} 个文档。`,
      })
      await loadSources()
      await onCatalogMutation()
      // 同步后 revisions 变化，作废展开缓存
      setRevisions((current) => {
        const next = { ...current }
        delete next[source.id]
        return next
      })
    } catch (err) {
      onNotice({ tone: "error", text: `同步 ${source.name} 失败：${errorMessage(err)}` })
      await loadSources()
    } finally {
      if (mounted.current) setSyncingSourceID(null)
    }
  }

  const handleIndex = async (sourceID?: string) => {
    setIndexingSourceID(sourceID ?? "__all__")
    try {
      const response = await api.indexKnowledge(sourceID)
      const indexed = response.indexed ?? []
      const errors = response.errors ?? []
      const chunkTotal = indexed.reduce((sum, item) => sum + item.chunks_indexed, 0)
      if (errors.length > 0 && indexed.length === 0) {
        onNotice({ tone: "error", text: errors.map((item) => item.error).join("；") })
      } else if (errors.length > 0) {
        onNotice({ tone: "warning", text: `已索引 ${indexed.length} 个来源（${chunkTotal} chunks），${errors.length} 个失败。` })
      } else {
        onNotice({ tone: "success", text: `已索引 ${indexed.length} 个来源，共 ${chunkTotal} 个 chunk，并重建链接图。` })
      }
      await onCatalogMutation()
    } catch (err) {
      onNotice({ tone: "error", text: `索引失败：${errorMessage(err)}` })
    } finally {
      if (mounted.current) setIndexingSourceID(null)
    }
  }

  const toggleRevisions = async (source: KnowledgeSource) => {
    if (openRevisionsSourceID === source.id) {
      setOpenRevisionsSourceID(null)
      return
    }
    setOpenRevisionsSourceID(source.id)
    if (revisions[source.id]?.items.length || revisions[source.id]?.loading) return
    setRevisions((current) => ({ ...current, [source.id]: { items: [], loading: true } }))
    try {
      const items = await api.listKnowledgeSourceRevisions(source.id, { limit: 10 })
      if (!mounted.current) return
      setRevisions((current) => ({ ...current, [source.id]: { items: items ?? [], loading: false } }))
    } catch (err) {
      if (!mounted.current) return
      setRevisions((current) => ({
        ...current,
        [source.id]: { items: [], loading: false, error: errorMessage(err) },
      }))
    }
  }

  return (
    <section aria-labelledby="knowledge-sources-heading" className="rounded-lg border border-[#1e1e2e] bg-[#0b0b12]">
      <div className="flex flex-col gap-2 border-b border-[#1e1e2e] p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <HardDrive className="size-4 text-emerald-300" />
          <h2 id="knowledge-sources-heading">知识来源</h2>
          <span className="text-xs font-normal text-slate-500">{sources.length} sources</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={indexingSourceID !== null}
            onClick={() => void handleIndex()}
            className="border-emerald-500/30 bg-emerald-500/5 text-emerald-200 hover:bg-emerald-500/15"
          >
            {indexingSourceID === "__all__" ? <Loader2 className="size-3.5 animate-spin" /> : <DatabaseZap className="size-3.5" />}
            索引全部 active
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowForm((value) => !value)}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <UploadCloud className="size-3.5" /> {showForm ? "收起表单" : "注册来源"}
          </Button>
        </div>
      </div>

      {showForm ? (
        <div className="border-b border-[#1e1e2e] p-4">
          <KnowledgeSourceForm onDone={handleCreated} onCancel={() => setShowForm(false)} />
        </div>
      ) : null}

      {loading ? (
        <div role="status" aria-live="polite" className="flex min-h-24 items-center justify-center p-4 text-sm text-slate-500">
          <Loader2 className="mr-2 size-4 animate-spin" /> 加载来源…
        </div>
      ) : error ? (
        <div role="alert" className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : sources.length === 0 ? (
        <div className="p-5 text-sm text-slate-500">还没有知识来源。注册一个 git 或 local 来源开始。</div>
      ) : (
        <div className="space-y-3 p-3">
          {sources.map((source) => {
            const syncState = source.metadata?.git_sync
            const isSyncing = syncingSourceID === source.id
            const revisionsOpen = openRevisionsSourceID === source.id
            const revisionEntry = revisions[source.id]
            return (
              <div key={source.id} className="rounded-lg border border-[#242436] bg-[#101018] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {source.type === "git" ? <GitBranch className="size-4 text-cyan-300" /> : <HardDrive className="size-4 text-amber-300" />}
                      <span className="truncate text-sm font-medium text-slate-100">{source.name}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <Link2 className="size-3.5 shrink-0" />
                      <span className="break-all font-mono">{source.repository_url}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge className={source.type === "git" ? "bg-cyan-500/10 text-cyan-300" : "bg-amber-500/10 text-amber-300"}>{source.type}</Badge>
                    <Badge className={sourceStatusClassName(source.status)}>{source.status}</Badge>
                    {source.type === "git" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={source.status === "disabled" || syncingSourceID !== null}
                        onClick={() => void handleSync(source)}
                        className="h-7 border-cyan-500/30 bg-cyan-500/5 px-2.5 text-xs text-cyan-200 hover:bg-cyan-500/15"
                      >
                        {isSyncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                        {isSyncing ? "同步中" : "同步"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={indexingSourceID !== null || !source.active_revision_id}
                      onClick={() => void handleIndex(source.id)}
                      className="h-7 border-emerald-500/30 bg-emerald-500/5 px-2.5 text-xs text-emerald-200 hover:bg-emerald-500/15"
                    >
                      {indexingSourceID === source.id ? <Loader2 className="size-3.5 animate-spin" /> : <DatabaseZap className="size-3.5" />}
                      索引
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-expanded={revisionsOpen}
                      onClick={() => void toggleRevisions(source)}
                      className="h-7 px-2.5 text-xs text-slate-400 hover:text-slate-200"
                    >
                      <History className="size-3.5" /> revisions
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                  <FieldPill label="path" value={source.package_path || "."} />
                  <FieldPill label="sync" value={source.sync_mode} />
                  <FieldPill label="ref" value={source.default_ref || "provider default"} />
                  <FieldPill label="active rev" value={source.active_revision_id ? shortHash(source.active_revision_id) : "无"} />
                </div>

                {syncState ? (
                  <div className={`mt-3 rounded-md border p-2.5 text-xs ${syncState.status === "succeeded" ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/25 bg-red-500/5"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className={`flex items-center gap-1.5 font-medium ${syncState.status === "succeeded" ? "text-emerald-300" : "text-red-300"}`}>
                        {syncState.status === "succeeded" ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                        Git sync {syncState.status}
                      </div>
                      <span className="text-slate-600">{formatDateTime(syncState.synced_at)}</span>
                    </div>
                    {syncState.error ? (
                      <p className="mt-2 break-words leading-5 text-red-300/80">{syncState.error}</p>
                    ) : (
                      <div className="mt-2 grid gap-1 text-slate-500 md:grid-cols-2">
                        <span>{syncState.provider || "git"} · {syncState.ref || source.default_ref || "default"}</span>
                        <span className="truncate font-mono">commit {shortHash(syncState.commit_sha)}</span>
                        <span className="truncate font-mono md:col-span-2">package {shortHash(syncState.package_hash)}</span>
                      </div>
                    )}
                  </div>
                ) : null}

                {revisionsOpen ? (
                  <div className="mt-3 rounded-md border border-[#1d1d2b] bg-[#0b0b12] p-2 text-xs">
                    {revisionEntry?.loading ? (
                      <div role="status" aria-live="polite" className="flex items-center gap-2 p-2 text-slate-500">
                        <Loader2 className="size-3.5 animate-spin" /> 加载 revisions…
                      </div>
                    ) : revisionEntry?.error ? (
                      <div role="alert" className="p-2 text-red-300">{revisionEntry.error}</div>
                    ) : (revisionEntry?.items ?? []).length === 0 ? (
                      <p className="p-2 text-slate-600">还没有 revision。</p>
                    ) : (
                      <ul className="divide-y divide-[#1d1d2b]">
                        {(revisionEntry?.items ?? []).map((revision) => (
                          <li key={revision.id} className="grid gap-1 px-2 py-2 text-slate-500 md:grid-cols-[1fr_auto]">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-slate-300">pkg {shortHash(revision.package_hash || revision.tree_hash)}</span>
                                <Badge className={revision.id === source.active_revision_id ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/10 text-slate-400"}>
                                  {revision.id === source.active_revision_id ? "active" : revision.status}
                                </Badge>
                              </div>
                              <div className="mt-1 truncate font-mono">
                                {revision.commit_sha ? `commit ${shortHash(revision.commit_sha)}` : `snapshot ${shortHash(revision.local_snapshot_id)}`}
                              </div>
                            </div>
                            <span className="text-slate-600">{formatDateTime(revision.created_at)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function sourceStatusClassName(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-500/10 text-emerald-300"
    case "error":
      return "bg-red-500/10 text-red-300"
    default:
      return "bg-slate-500/10 text-slate-400"
  }
}

function FieldPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[#1d1d2b] bg-[#0b0b12] px-2 py-1.5">
      <span className="mr-2 text-slate-600">{label}</span>
      <span className="break-all text-slate-300">{value}</span>
    </div>
  )
}

function KnowledgeSourceForm({
  onDone,
  onCancel,
}: {
  onDone: (source: KnowledgeSource) => Promise<void>
  onCancel: () => void
}) {
  const [type, setType] = useState<"git" | "local">("git")
  const [name, setName] = useState("")
  const [repositoryURL, setRepositoryURL] = useState("https://github.com/org/knowledge.git")
  const [packagePath, setPackagePath] = useState("")
  const [defaultRef, setDefaultRef] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const switchType = (nextType: "git" | "local") => {
    setType(nextType)
    setRepositoryURL(nextType === "git" ? "https://github.com/org/knowledge.git" : "file:///Users/me/.agents/knowledge")
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!repositoryURL.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const payload: CreateKnowledgeSourceRequest = {
        name: name.trim() || undefined,
        type,
        repository_url: repositoryURL.trim(),
        package_path: packagePath.trim() || undefined,
      }
      if (type === "git" && defaultRef.trim()) {
        payload.default_ref = defaultRef.trim()
      }
      const source = await api.createKnowledgeSource(payload)
      await onDone(source)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#242436] bg-[#0b0b12] p-1">
        <Button type="button" variant={type === "git" ? "default" : "ghost"} onClick={() => switchType("git")} className={type === "git" ? "bg-cyan-600 text-white hover:bg-cyan-500" : "text-slate-400 hover:text-slate-100"}>
          <GitBranch className="size-4" /> Git
        </Button>
        <Button type="button" variant={type === "local" ? "default" : "ghost"} onClick={() => switchType("local")} className={type === "local" ? "bg-amber-600 text-white hover:bg-amber-500" : "text-slate-400 hover:text-slate-100"}>
          <HardDrive className="size-4" /> Local
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="knowledge-source-name">Name</Label>
        <Input id="knowledge-source-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="product-support" className="border-[#27273a] bg-[#0b0b12]" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="knowledge-source-repo">Repository URL</Label>
        <Input
          id="knowledge-source-repo"
          value={repositoryURL}
          onChange={(event) => setRepositoryURL(event.target.value)}
          placeholder={type === "git" ? "https://github.com/org/knowledge.git" : "file:///Users/me/.agents/knowledge"}
          required
          className="border-[#27273a] bg-[#0b0b12] font-mono text-sm"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="knowledge-source-path">Package path</Label>
          <Input id="knowledge-source-path" value={packagePath} onChange={(event) => setPackagePath(event.target.value)} placeholder="product-support" className="border-[#27273a] bg-[#0b0b12]" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="knowledge-source-ref">Default ref</Label>
          <Input
            id="knowledge-source-ref"
            value={defaultRef}
            onChange={(event) => setDefaultRef(event.target.value)}
            placeholder={type === "git" ? "留空使用仓库默认分支" : "仅 Git 来源可用"}
            disabled={type === "local"}
            className="border-[#27273a] bg-[#0b0b12] disabled:text-slate-600"
          />
        </div>
      </div>

      <div className="rounded-lg border border-[#242436] bg-[#0b0b12] p-3 text-sm text-slate-500">
        <div className="text-slate-300">{type === "git" ? "server_pull" : "client_push"}</div>
        <div className="mt-1 text-xs leading-5">
          {type === "git"
            ? "仅支持公共 GitHub/GitLab HTTPS 仓库。包根目录必须包含 KNOWLEDGE.yaml，注册后在来源卡片上同步。"
            : "Local 来源只登记本地目录，文件快照由客户端通过 API 推送。"}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500">
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
