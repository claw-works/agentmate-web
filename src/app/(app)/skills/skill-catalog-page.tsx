"use client"

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  AlertTriangle,
  BookOpenText,
  Boxes,
  CheckCircle2,
  ChevronDown,
  Code2,
  FileQuestion,
  FileText,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Tags,
} from "lucide-react"
import { api } from "@/lib/api"
import type {
  SkillCatalogItemDTO,
  SkillInstructionsDTO,
  SkillResourceDTO,
  SkillResourceManifestItemDTO,
} from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const CATALOG_PAGE_SIZE = 18
const RESOURCE_PAGE_SIZE = 20

type DetailTab = "overview" | "instructions" | "resources" | "manage"
type Notice = { tone: "success" | "warning" | "error"; text: string }
type AsyncEntry<T> = { data?: T; loading: boolean; error?: string }
type ResourceListEntry = {
  items: SkillResourceManifestItemDTO[]
  total: number
  loading: boolean
  error?: string
}

interface SkillCatalogPageProps {
  renderManagement: (
    onCatalogMutation: () => Promise<void>,
    selectedSkillName: string | null
  ) => ReactNode
}

export function SkillCatalogPage({ renderManagement }: SkillCatalogPageProps) {
  const [catalogItems, setCatalogItems] = useState<SkillCatalogItemDTO[]>([])
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [searchDraft, setSearchDraft] = useState("")
  const [catalogQuery, setCatalogQuery] = useState("")
  const [selectedItem, setSelectedItem] = useState<SkillCatalogItemDTO | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>("overview")
  const [instructions, setInstructions] = useState<Record<string, AsyncEntry<SkillInstructionsDTO>>>({})
  const [resources, setResources] = useState<Record<string, ResourceListEntry>>({})
  const [resourceContents, setResourceContents] = useState<Record<string, AsyncEntry<SkillResourceDTO>>>({})
  const [openResourceID, setOpenResourceID] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [compilingVersionID, setCompilingVersionID] = useState<string | null>(null)

  const catalogRequestID = useRef(0)
  const catalogAbort = useRef<AbortController | null>(null)
  const cacheEpoch = useRef(0)
  const instructionRequests = useRef(new Map<string, number>())
  const resourceRequests = useRef(new Map<string, number>())
  const contentRequests = useRef(new Map<string, number>())
  const queryRef = useRef("")

  const loadCatalog = useCallback(async (query: string, offset: number, append: boolean) => {
    const requestID = ++catalogRequestID.current
    catalogAbort.current?.abort()
    const controller = new AbortController()
    catalogAbort.current = controller
    if (append) {
      setCatalogLoadingMore(true)
    } else {
      setCatalogLoading(true)
    }
    setCatalogError(null)

    try {
      const response = await api.listSkillCatalog(
        { query: query || undefined, limit: CATALOG_PAGE_SIZE, offset },
        controller.signal
      )
      if (requestID !== catalogRequestID.current) return
      const nextItems = response.items ?? []
      setCatalogItems((current) => append ? mergeCatalogItems(current, nextItems) : nextItems)
      setCatalogTotal(response.total ?? 0)
      setSelectedItem((current) => {
        if (append) return current
        if (!current) return null
        return nextItems.find((item) => item.skill_name === current.skill_name) ?? null
      })
    } catch (error) {
      if (isAbortError(error) || requestID !== catalogRequestID.current) return
      setCatalogError(errorMessage(error))
    } finally {
      if (requestID === catalogRequestID.current) {
        setCatalogLoading(false)
        setCatalogLoadingMore(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadCatalog("", 0, false)
    return () => catalogAbort.current?.abort()
  }, [loadCatalog])

  const clearProgressiveCaches = useCallback(() => {
    cacheEpoch.current += 1
    instructionRequests.current.clear()
    resourceRequests.current.clear()
    contentRequests.current.clear()
    setInstructions({})
    setResources({})
    setResourceContents({})
    setOpenResourceID(null)
  }, [])

  const refreshCatalogAndClearCaches = useCallback(async () => {
    clearProgressiveCaches()
    await loadCatalog(queryRef.current, 0, false)
  }, [clearProgressiveCaches, loadCatalog])

  const loadInstructions = useCallback(async (item: SkillCatalogItemDTO) => {
    const current = instructions[item.version_id]
    if (current?.loading || current?.data) return
    const epoch = cacheEpoch.current
    const requestID = (instructionRequests.current.get(item.version_id) ?? 0) + 1
    instructionRequests.current.set(item.version_id, requestID)
    setInstructions((entries) => ({
      ...entries,
      [item.version_id]: { loading: true },
    }))
    try {
      const data = await api.getSkillInstructions(item.version_id)
      if (cacheEpoch.current !== epoch || instructionRequests.current.get(item.version_id) !== requestID) return
      setInstructions((entries) => ({
        ...entries,
        [item.version_id]: { data, loading: false },
      }))
    } catch (error) {
      if (cacheEpoch.current !== epoch || instructionRequests.current.get(item.version_id) !== requestID) return
      setInstructions((entries) => ({
        ...entries,
        [item.version_id]: { loading: false, error: errorMessage(error) },
      }))
    }
  }, [instructions])

  const loadResources = useCallback(async (item: SkillCatalogItemDTO, append = false) => {
    const current = resources[item.version_id]
    if (current?.loading || (!append && current?.items.length)) return
    const offset = append ? current?.items.length ?? 0 : 0
    const epoch = cacheEpoch.current
    const requestID = (resourceRequests.current.get(item.version_id) ?? 0) + 1
    resourceRequests.current.set(item.version_id, requestID)
    setResources((entries) => ({
      ...entries,
      [item.version_id]: {
        items: append ? entries[item.version_id]?.items ?? [] : [],
        total: entries[item.version_id]?.total ?? item.resource_count,
        loading: true,
      },
    }))
    try {
      const response = await api.listSkillResources(item.version_id, {
        limit: RESOURCE_PAGE_SIZE,
        offset,
      })
      if (cacheEpoch.current !== epoch || resourceRequests.current.get(item.version_id) !== requestID) return
      setResources((entries) => {
        const priorItems = append ? entries[item.version_id]?.items ?? [] : []
        return {
          ...entries,
          [item.version_id]: {
            items: mergeResourceItems(priorItems, response.items ?? []),
            total: response.total ?? item.resource_count,
            loading: false,
          },
        }
      })
    } catch (error) {
      if (cacheEpoch.current !== epoch || resourceRequests.current.get(item.version_id) !== requestID) return
      setResources((entries) => ({
        ...entries,
        [item.version_id]: {
          items: entries[item.version_id]?.items ?? [],
          total: entries[item.version_id]?.total ?? item.resource_count,
          loading: false,
          error: errorMessage(error),
        },
      }))
    }
  }, [resources])

  const loadResourceContent = useCallback(async (
    item: SkillCatalogItemDTO,
    resource: SkillResourceManifestItemDTO
  ) => {
    if (!resource.text_available) return
    setOpenResourceID(resource.file_id)
    const cacheKey = resourceCacheKey(item.version_id, resource.file_id)
    const current = resourceContents[cacheKey]
    if (current?.loading || current?.data) return
    const epoch = cacheEpoch.current
    const requestID = (contentRequests.current.get(cacheKey) ?? 0) + 1
    contentRequests.current.set(cacheKey, requestID)
    setResourceContents((entries) => ({ ...entries, [cacheKey]: { loading: true } }))
    try {
      const data = await api.getSkillResource(item.version_id, resource.file_id)
      if (cacheEpoch.current !== epoch || contentRequests.current.get(cacheKey) !== requestID) return
      setResourceContents((entries) => ({
        ...entries,
        [cacheKey]: { data, loading: false },
      }))
    } catch (error) {
      if (cacheEpoch.current !== epoch || contentRequests.current.get(cacheKey) !== requestID) return
      setResourceContents((entries) => ({
        ...entries,
        [cacheKey]: { loading: false, error: errorMessage(error) },
      }))
    }
  }, [resourceContents])

  const handleTabChange = (value: string) => {
    const nextTab = value as DetailTab
    setActiveTab(nextTab)
    if (!selectedItem) return
    if (nextTab === "instructions") void loadInstructions(selectedItem)
    if (nextTab === "resources") void loadResources(selectedItem)
  }

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchDraft.trim()
    queryRef.current = query
    setCatalogQuery(query)
    setSelectedItem(null)
    setActiveTab("overview")
    void loadCatalog(query, 0, false)
  }

  const handleCompile = async (versionID?: string) => {
    setCompilingVersionID(versionID ?? "__all__")
    setNotice(null)
    try {
      const response = await api.compileSkills(versionID ? { version_id: versionID } : {})
      await refreshCatalogAndClearCaches()
      const errors = response.errors ?? []
      if (errors.length > 0 && (response.items ?? []).length === 0) {
        setNotice({ tone: "error", text: errors.map((item) => item.error).join("；") })
      } else if (errors.length > 0) {
        setNotice({ tone: "warning", text: `已编译 ${(response.items ?? []).length} 个技能，${errors.length} 个失败。` })
      } else {
        setNotice({ tone: "success", text: `已编译 ${(response.items ?? []).length} 个技能并刷新目录。` })
      }
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) })
    } finally {
      setCompilingVersionID(null)
    }
  }

  const instructionEntry = selectedItem ? instructions[selectedItem.version_id] : undefined
  const resourceEntry = selectedItem ? resources[selectedItem.version_id] : undefined
  const hasMoreCatalog = catalogItems.length < catalogTotal

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-2xl border border-cyan-400/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_38%),linear-gradient(135deg,#11111b,#0b0b12)] p-5 shadow-2xl shadow-black/20 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              <Sparkles className="size-4" /> Progressive Skill Catalog
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">先发现能力，再按需读取上下文</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">目录卡片只加载 L0 元数据。说明、资源清单和文本正文分别在首次访问时加载，避免把无关内容塞进 agent 上下文。</p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={compilingVersionID !== null}
            onClick={() => void handleCompile()}
            className="border-cyan-400/25 bg-cyan-400/5 text-cyan-100 hover:bg-cyan-400/10"
          >
            {compilingVersionID === "__all__" ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
            编译全部 active
          </Button>
        </div>
      </header>

      {notice ? (
        <div role={notice.tone === "success" ? "status" : "alert"} aria-live="polite" className={noticeClassName(notice.tone)}>
          {notice.tone === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      <section aria-labelledby="skill-catalog-heading" className="rounded-xl border border-[#1e1e2e] bg-[#101018]">
        <div className="flex flex-col gap-3 border-b border-[#1e1e2e] p-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="skill-catalog-heading" className="font-semibold text-slate-100">技能目录</h2>
            <p className="mt-1 text-xs text-slate-500">{catalogTotal} 个 active 技能{catalogQuery ? ` · 搜索“${catalogQuery}”` : ""}</p>
          </div>
          <form onSubmit={handleSearch} role="search" className="flex w-full gap-2 lg:max-w-xl">
            <Label htmlFor="skill-catalog-query" className="sr-only">搜索技能目录</Label>
            <Input
              id="skill-catalog-query"
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="按名称、描述或触发条件搜索"
              className="border-[#2a2a3a] bg-[#0b0b12] text-slate-100 placeholder:text-slate-600"
            />
            <Button type="submit" disabled={catalogLoading} className="bg-cyan-600 text-white hover:bg-cyan-500">
              <Search className="size-4" /> 搜索
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="刷新技能目录"
              disabled={catalogLoading}
              onClick={() => void refreshCatalogAndClearCaches()}
              className="border-[#2a2a3a] bg-[#12121a] text-slate-300"
            >
              <RefreshCw className={catalogLoading ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </form>
        </div>

        <div className="p-4">
          {catalogLoading ? (
            <div role="status" aria-live="polite" className="flex min-h-48 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 size-4 animate-spin" /> 正在加载 L0 目录…
            </div>
          ) : catalogError ? (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{catalogError}</div>
          ) : catalogItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#303044] p-10 text-center text-sm text-slate-500">没有匹配的 active 技能。</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {catalogItems.map((item) => (
                <CatalogCard
                  key={item.version_id}
                  item={item}
                  selected={selectedItem?.version_id === item.version_id}
                  onSelect={() => {
                    setSelectedItem(item)
                    setActiveTab("overview")
                    setOpenResourceID(null)
                  }}
                />
              ))}
            </div>
          )}

          {hasMoreCatalog ? (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                disabled={catalogLoadingMore}
                onClick={() => void loadCatalog(catalogQuery, catalogItems.length, true)}
                className="border-[#2a2a3a] bg-[#12121a] text-slate-200"
              >
                {catalogLoadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
                加载更多（{catalogItems.length}/{catalogTotal}）
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="skill-detail-heading" className="min-w-0 rounded-xl border border-[#1e1e2e] bg-[#101018]">
        {!selectedItem ? (
          activeTab === "manage" ? (
            <div>
              <div className="flex items-center justify-between border-b border-[#1e1e2e] p-4">
                <h2 id="skill-detail-heading" className="font-medium text-slate-200">技能管理</h2>
                <Button type="button" variant="ghost" onClick={() => setActiveTab("overview")} className="text-slate-400">返回目录</Button>
              </div>
              <div className="p-4 md:p-5">{renderManagement(refreshCatalogAndClearCaches, null)}</div>
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
              <Boxes className="size-9 text-slate-700" />
              <div>
                <h2 id="skill-detail-heading" className="font-medium text-slate-300">选择一个技能</h2>
                <p className="mt-1 text-sm">选中只展示 L0 元数据，不会自动请求说明或资源正文。</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setActiveTab("manage")} className="border-[#2a2a3a] bg-[#12121a] text-slate-200">
                <Settings2 className="size-4" /> 注册来源或发布版本
              </Button>
            </div>
          )
        ) : (
          <div>
            <div className="flex flex-col gap-3 border-b border-[#1e1e2e] p-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="skill-detail-heading" className="break-all text-xl font-semibold text-white">{selectedItem.skill_name}</h2>
                  <Badge className="bg-emerald-500/10 text-emerald-300">v{selectedItem.version}</Badge>
                  <Badge className="bg-cyan-500/10 text-cyan-300">{selectedItem.resource_count} resources</Badge>
                </div>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{selectedItem.description || "该技能没有目录描述。"}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={compilingVersionID !== null}
                onClick={() => void handleCompile(selectedItem.version_id)}
                className="border-cyan-500/25 bg-cyan-500/5 text-cyan-200"
              >
                {compilingVersionID === selectedItem.version_id ? <Loader2 className="size-4 animate-spin" /> : <Code2 className="size-4" />}
                重新编译当前版本
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-0">
              <TabsList variant="line" aria-label="技能详情" className="w-full justify-start overflow-x-auto border-b border-[#1e1e2e] px-4 py-2">
                <TabsTrigger value="overview" className="flex-none px-3 text-slate-400 data-active:text-cyan-200"><Tags />概览</TabsTrigger>
                <TabsTrigger value="instructions" className="flex-none px-3 text-slate-400 data-active:text-cyan-200"><BookOpenText />说明</TabsTrigger>
                <TabsTrigger value="resources" className="flex-none px-3 text-slate-400 data-active:text-cyan-200"><FileText />资源</TabsTrigger>
                <TabsTrigger value="manage" className="flex-none px-3 text-slate-400 data-active:text-cyan-200"><Settings2 />管理</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="p-4 md:p-5">
                <OverviewPanel item={selectedItem} />
              </TabsContent>
              <TabsContent value="instructions" className="p-4 md:p-5">
                <InstructionsPanel entry={instructionEntry} onRetry={() => void loadInstructions(selectedItem)} />
              </TabsContent>
              <TabsContent value="resources" className="p-4 md:p-5">
                <ResourcesPanel
                  item={selectedItem}
                  entry={resourceEntry}
                  openResourceID={openResourceID}
                  contents={resourceContents}
                  onOpen={(resource) => void loadResourceContent(selectedItem, resource)}
                  onLoadMore={() => void loadResources(selectedItem, true)}
                  onRetry={() => void loadResources(selectedItem)}
                />
              </TabsContent>
              <TabsContent value="manage" className="p-4 md:p-5">
                {activeTab === "manage" ? renderManagement(refreshCatalogAndClearCaches, selectedItem.skill_name) : null}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </section>
    </div>
  )
}

function CatalogCard({ item, selected, onSelect }: { item: SkillCatalogItemDTO; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`group min-h-52 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${selected ? "border-cyan-400/60 bg-cyan-400/10 shadow-lg shadow-cyan-950/20" : "border-[#252536] bg-[#0b0b12] hover:-translate-y-0.5 hover:border-cyan-500/35"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-100">{item.skill_name}</div>
          <div className="mt-1 text-xs text-slate-600">v{item.version} · {formatDate(item.published_at)}</div>
        </div>
        <Badge className="shrink-0 bg-slate-500/10 text-slate-300">{item.resource_count} files</Badge>
      </div>
      <p className="mt-3 line-clamp-3 min-h-15 text-sm leading-5 text-slate-400">{item.description || "无描述"}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(item.resource_kinds ?? []).slice(0, 3).map((kind) => <Badge key={kind} className="bg-cyan-500/8 text-cyan-300/80">{kind}</Badge>)}
        {(item.triggers ?? []).slice(0, 2).map((trigger) => <Badge key={trigger} className="max-w-40 truncate bg-amber-500/8 text-amber-200/80">{trigger}</Badge>)}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#20202e] pt-3 text-[11px] text-slate-600">
        <span className={item.artifact_available ? "" : "text-amber-300"}>
          {item.artifact_available ? `${item.compiler_name} ${item.compiler_version}` : "basic fallback · 待编译"}
        </span>
        <span className="font-mono">{shortHash(item.package_hash)}</span>
      </div>
    </button>
  )
}

function OverviewPanel({ item }: { item: SkillCatalogItemDTO }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <div className="grid gap-4 md:grid-cols-2">
        <MetadataList title="触发条件" values={item.triggers} empty="未声明 triggers" />
        <MetadataList title="能力" values={item.capabilities} empty="未声明 capabilities" />
        <MetadataList title="约束" values={item.constraints} empty="未声明 constraints" />
        <MetadataList title="依赖" values={item.dependencies} empty="无外部 dependencies" />
      </div>
      <dl className="grid content-start gap-3 rounded-lg border border-[#242436] bg-[#0b0b12] p-4 text-xs">
        <MetadataRow label="Version ID" value={item.version_id} mono />
        <MetadataRow label="Package hash" value={item.package_hash} mono />
        <MetadataRow label="Source ID" value={item.source_id || "-"} mono />
        <MetadataRow label="Catalog artifact" value={item.artifact_available ? "compiled" : "basic fallback · 请重新编译"} />
        <MetadataRow label="Compiler" value={item.artifact_available ? `${item.compiler_name} ${item.compiler_version}` : "-"} />
        <MetadataRow label="Compiled" value={item.artifact_available ? formatDateTime(item.compiled_at) : "-"} />
        <MetadataRow label="Published" value={formatDateTime(item.published_at)} />
      </dl>
    </div>
  )
}

function MetadataList({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return (
    <div className="rounded-lg border border-[#242436] bg-[#0b0b12] p-4">
      <h3 className="text-sm font-medium text-slate-200">{title}</h3>
      {(values ?? []).length ? (
        <ul className="mt-3 space-y-2 text-sm text-slate-400">
          {values.map((value) => <li key={value} className="flex gap-2"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-400/70" /><span className="break-words">{value}</span></li>)}
        </ul>
      ) : <p className="mt-3 text-sm text-slate-600">{empty}</p>}
    </div>
  )
}

function MetadataRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="text-slate-600">{label}</dt><dd className={`mt-1 break-all text-slate-300 ${mono ? "font-mono" : ""}`}>{value}</dd></div>
}

function InstructionsPanel({ entry, onRetry }: { entry?: AsyncEntry<SkillInstructionsDTO>; onRetry: () => void }) {
  if (!entry || entry.loading) return <LoadingState text="首次加载 L1 说明…" />
  if (entry.error) return <ErrorState message={entry.error} onRetry={onRetry} />
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>content hash <span className="font-mono text-slate-400">{shortHash(entry.data?.content_hash)}</span></span>
        <span>{formatDateTime(entry.data?.published_at)}</span>
      </div>
      <pre tabIndex={0} aria-label="技能说明正文" className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[#29293a] bg-[#08080d] p-4 font-mono text-sm leading-6 text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50">{entry.data?.instructions ?? ""}</pre>
    </div>
  )
}

function ResourcesPanel({
  item,
  entry,
  openResourceID,
  contents,
  onOpen,
  onLoadMore,
  onRetry,
}: {
  item: SkillCatalogItemDTO
  entry?: ResourceListEntry
  openResourceID: string | null
  contents: Record<string, AsyncEntry<SkillResourceDTO>>
  onOpen: (resource: SkillResourceManifestItemDTO) => void
  onLoadMore: () => void
  onRetry: () => void
}) {
  if (!entry || (entry.loading && entry.items.length === 0)) return <LoadingState text="首次加载 L2 资源 manifest…" />
  if (entry.error && entry.items.length === 0) return <ErrorState message={entry.error} onRetry={onRetry} />
  if (entry.items.length === 0) return <div className="rounded-lg border border-dashed border-[#303044] p-8 text-center text-sm text-slate-500">该版本没有资源文件。</div>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>仅 manifest · 正文按点击加载并缓存</span>
        <span>{entry.items.length}/{entry.total}</span>
      </div>
      {entry.items.map((resource) => {
        const cacheKey = resourceCacheKey(item.version_id, resource.file_id)
        const contentEntry = contents[cacheKey]
        const open = openResourceID === resource.file_id && resource.text_available
        const metadata = (
          <>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {resource.text_available ? <FileText className="size-4 shrink-0 text-cyan-300" /> : <FileQuestion className="size-4 shrink-0 text-slate-500" />}
                <span className="break-all font-mono text-sm text-slate-200">{resource.path}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                <span>{resource.kind}</span><span>{resource.mime_type || "unknown mime"}</span><span>{formatBytes(resource.size_bytes)}</span><span className="font-mono">{shortHash(resource.sha256)}</span>
              </div>
            </div>
            <Badge className={resource.text_available ? "shrink-0 bg-emerald-500/10 text-emerald-300" : "shrink-0 bg-slate-500/10 text-slate-400"}>{resource.text_available ? "可预览" : "仅 metadata"}</Badge>
          </>
        )
        return (
          <article key={resource.file_id} className="overflow-hidden rounded-lg border border-[#242436] bg-[#0b0b12]">
            {resource.text_available ? (
              <button type="button" aria-expanded={open} onClick={() => onOpen(resource)} className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-[#13131e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500">{metadata}</button>
            ) : (
              <div className="flex items-start justify-between gap-3 p-4">{metadata}</div>
            )}
            {open ? (
              <div className="border-t border-[#242436] p-3">
                {contentEntry?.loading ? <LoadingState text="加载资源正文…" compact /> : contentEntry?.error ? <div role="alert" className="text-sm text-red-300">{contentEntry.error}</div> : (
                  <pre tabIndex={0} aria-label={`${resource.path} 正文`} className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-[#07070b] p-4 font-mono text-xs leading-6 text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50">{contentEntry?.data?.content ?? ""}</pre>
                )}
              </div>
            ) : null}
          </article>
        )
      })}
      {entry.error ? <div role="alert" className="text-sm text-red-300">加载更多失败：{entry.error}</div> : null}
      {entry.items.length < entry.total ? (
        <Button type="button" variant="outline" disabled={entry.loading} onClick={onLoadMore} className="w-full border-[#2a2a3a] bg-[#12121a] text-slate-200">
          {entry.loading ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}加载更多资源
        </Button>
      ) : null}
    </div>
  )
}

function LoadingState({ text, compact = false }: { text: string; compact?: boolean }) {
  return <div role="status" aria-live="polite" className={`flex items-center justify-center text-sm text-slate-500 ${compact ? "py-4" : "min-h-48"}`}><Loader2 className="mr-2 size-4 animate-spin" />{text}</div>
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"><span>{message}</span><Button type="button" size="sm" variant="outline" onClick={onRetry} className="border-red-400/30 bg-transparent text-red-100">重试</Button></div>
}

function mergeCatalogItems(current: SkillCatalogItemDTO[], incoming: SkillCatalogItemDTO[]) {
  const items = new Map(current.map((item) => [item.version_id, item]))
  for (const item of incoming) items.set(item.version_id, item)
  return [...items.values()]
}

function mergeResourceItems(current: SkillResourceManifestItemDTO[], incoming: SkillResourceManifestItemDTO[]) {
  const items = new Map(current.map((item) => [item.file_id, item]))
  for (const item of incoming) items.set(item.file_id, item)
  return [...items.values()]
}

function resourceCacheKey(versionID: string, fileID: string) {
  return `${versionID}:${fileID}`
}

function noticeClassName(tone: Notice["tone"]) {
  const classes = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    error: "border-red-500/30 bg-red-500/10 text-red-200",
  }
  return `flex items-start gap-2 rounded-lg border p-3 text-sm ${classes[tone]}`
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败"
}

function shortHash(value?: string | null) {
  if (!value) return "-"
  return value.length > 12 ? value.slice(0, 12) : value
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString()
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString()
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
