// 前端由 Go 服务同源托管（见 infra/agentmate），REST API 统一挂在 /api 前缀下，
// 与前端页面路径（/todos, /reports/:id 等）区分，避免同源部署时路由冲突。
const BASE_URL = "/api"

function getToken() {
  if (typeof window === "undefined") return null
  return localStorage.getItem("token")
}

function buildParams(obj: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) {
      v.forEach((item) => params.append(k, String(item)))
    } else {
      params.append(k, String(v))
    }
  }
  return params.toString()
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  config: { unwrapItems?: boolean } = {}
): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.error || err.message || res.statusText)
  }
  if (res.status === 204) return undefined as T
  const body = await res.json()
  // 列表包装格式：{ items, total?, limit?, offset? }
  if (config.unwrapItems !== false && body && typeof body === "object" && Array.isArray(body.items)) {
    return body.items as T
  }
  // AgentMate 旧格式：{ code, data, message }
  if (body?.data !== undefined) return body.data as T
  return body as T
}

// Auth
export const api = {
  register: (email: string, password: string) =>
    request<{ id: string; email: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ id: string; email: string }>("/auth/me"),
  createApiKey: (name: string) =>
    request<{ id: string; key: string }>("/auth/apikeys", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  listApiKeys: () => request<{ id: string; name: string; created_at: string }[]>("/auth/apikeys"),
  deleteApiKey: (id: string) =>
    request<void>(`/auth/apikeys/${id}`, { method: "DELETE" }),

  // Todos
  listTodos: (params?: { status?: string; priority?: string; tags?: string[]; limit?: number; offset?: number }) => {
    const qs = params ? "?" + buildParams(params) : ""
    return request<import("./types").Todo[]>(`/todos${qs}`)
  },
  createTodo: (data: Partial<import("./types").Todo>) =>
    request<import("./types").Todo>("/todos", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getTodo: (id: string) => request<import("./types").Todo>(`/todos/${id}`),
  updateTodo: (id: string, data: Partial<import("./types").Todo>) =>
    request<import("./types").Todo>(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteTodo: (id: string) =>
    request<void>(`/todos/${id}`, { method: "DELETE" }),
  searchTodos: (q: string) =>
    request<import("./types").Todo[]>(`/todos/search?q=${encodeURIComponent(q)}`),

  // Notes
  listNotes: (params?: { tags?: string[]; limit?: number; offset?: number }) => {
    const qs = params ? "?" + buildParams(params) : ""
    return request<import("./types").Note[]>(`/notes${qs}`)
  },
  createNote: (data: Partial<import("./types").Note>) =>
    request<import("./types").Note>("/notes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getNote: (id: string) => request<import("./types").Note>(`/notes/${id}`),
  updateNote: (id: string, data: Partial<import("./types").Note>) =>
    request<import("./types").Note>(`/notes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteNote: (id: string) =>
    request<void>(`/notes/${id}`, { method: "DELETE" }),
  searchNotes: (q: string) =>
    request<import("./types").Note[]>(`/notes/search?q=${encodeURIComponent(q)}`),

  // Reports
  listReports: (params?: { tag?: string; source?: string; q?: string; limit?: number; offset?: number }) => {
    const qs = params ? "?" + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
    ).toString() : ""
    return request<import("./types").Report[]>(`/reports${qs}`)
  },
  createReport: (data: { title: string; content: string; format: "md" | "html"; tags: string[]; source: string }) =>
    request<import("./types").Report>("/reports", { method: "POST", body: JSON.stringify(data) }),
  getReport: (id: string) => request<import("./types").Report>(`/reports/${id}`),
  updateReport: (id: string, data: { title?: string; tags?: string[]; source?: string }) =>
    request<import("./types").Report>(`/reports/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteReport: (id: string) => request<void>(`/reports/${id}`, { method: "DELETE" }),
  listReportSources: () => request<{ source: string; count: number }[]>("/reports/sources"),
  searchReports: (q: string) => request<import("./types").Report[]>(`/reports/search?q=${encodeURIComponent(q)}`),
  listPublicReports: (params?: { tag?: string; source?: string; q?: string; limit?: number; offset?: number }) => {
    const qs = params ? "?" + buildParams(params) : ""
    return request<{ items: import("./types").PublicReport[]; total: number; limit: number; offset: number }>(
      `/public/reports${qs}`,
      {},
      { unwrapItems: false }
    )
  },
  listPublicReportSources: () =>
    request<import("./types").PublicReportSource[]>("/public/reports/sources"),
  getPublicReport: (id: string) =>
    request<import("./types").PublicReport>(`/public/reports/${id}`),

  // Bookmarks
  listBookmarks: (params?: { is_read?: boolean; tags?: string[]; source?: string; limit?: number; offset?: number }) => {
    const qs = params ? "?" + buildParams(params) : ""
    return request<import("./types").Bookmark[]>(`/bookmarks${qs}`)
  },
  createBookmark: (data: { url: string; title?: string; summary?: string; content?: string; tags?: string[]; source?: string }) =>
    request<import("./types").Bookmark>("/bookmarks", { method: "POST", body: JSON.stringify(data) }),
  getBookmark: (id: string) => request<import("./types").Bookmark>(`/bookmarks/${id}`),
  updateBookmark: (id: string, data: { title?: string; summary?: string; tags?: string[]; is_read?: boolean }) =>
    request<import("./types").Bookmark>(`/bookmarks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteBookmark: (id: string) => request<void>(`/bookmarks/${id}`, { method: "DELETE" }),
  searchBookmarks: (q: string) => request<import("./types").Bookmark[]>(`/bookmarks/search?q=${encodeURIComponent(q)}`),

  // Expenses
  listExpenses: (params?: { tags?: string[]; from?: string; to?: string; q?: string; limit?: number; offset?: number }) => {
    const qs = params ? "?" + buildParams(params) : ""
    return request<import("./types").Expense[]>(`/expenses${qs}`)
  },
  getExpenseSummary: (params?: { from?: string; to?: string }) => {
    const qs = params ? "?" + buildParams(params) : ""
    return request<import("./types").ExpenseSummary>(`/expenses/summary${qs}`)
  },
  createExpense: (data: { amount: number; currency?: string; description?: string; tags?: string[]; happened_at?: string }) =>
    request<import("./types").Expense>("/expenses", { method: "POST", body: JSON.stringify(data) }),
  updateExpense: (id: string, data: { amount?: number; currency?: string; description?: string; tags?: string[]; happened_at?: string }) =>
    request<import("./types").Expense>(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteExpense: (id: string) => request<void>(`/expenses/${id}`, { method: "DELETE" }),
  searchExpenses: (q: string) => request<import("./types").Expense[]>(`/expenses/search?q=${encodeURIComponent(q)}`),

  // Skills
  listSkillLogs: (params?: { skill_name?: string; limit?: number; offset?: number }) => {
    const qs = params ? "?" + buildParams(params) : ""
    return request<import("./types").SkillLog[]>(`/skills/logs${qs}`)
  },
  getSkillStats: (skill_name: string) =>
    request<import("./types").SkillStats>(`/skills/stats?skill_name=${encodeURIComponent(skill_name)}`),
  listSkillSignals: (skill_name: string, limit?: number) => {
    const qs = `?skill_name=${encodeURIComponent(skill_name)}${limit ? `&limit=${limit}` : ""}`
    return request<import("./types").SkillSignal[]>(`/skills/signals${qs}`)
  },
  listSkillVersions: (params?: { skill_name?: string; limit?: number; offset?: number }) => {
    const qs = params ? "?" + buildParams(params) : ""
    return request<import("./types").SkillVersion[]>(`/skills/versions${qs}`)
  },
  listSkillSources: (params?: { type?: string; status?: string; limit?: number; offset?: number }) => {
    const qs = params ? "?" + buildParams(params) : ""
    return request<import("./types").SkillSource[]>(`/skills/sources${qs}`)
  },
  createSkillSource: (data: import("./types").CreateSkillSourceRequest) =>
    request<import("./types").SkillSource>("/skills/sources", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  syncSkillSource: (id: string, data: import("./types").SyncGitSourceRequest = {}) =>
    request<import("./types").SyncGitSourceResponse>(`/skills/sources/${id}/sync`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listSkillSourceRevisions: (id: string, params?: { limit?: number; offset?: number }) => {
    const qs = params ? "?" + buildParams(params) : ""
    return request<import("./types").SkillSourceRevision[]>(`/skills/sources/${id}/revisions${qs}`)
  },
  listSkillVersionFiles: (id: string) =>
    request<import("./types").SkillVersionFile[]>(`/skills/versions/${id}/files`),
  createSkillVersion: (data: import("./types").CreateSkillVersionRequest) =>
    request<import("./types").SkillVersion>("/skills/versions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  activateSkillVersion: (id: string) =>
    request<import("./types").SkillVersion>(`/skills/versions/${id}/activate`, {
      method: "POST",
    }),
  getActiveSkillVersion: (skill_name: string) =>
    request<import("./types").SkillVersion>(`/skills/versions/active?skill_name=${encodeURIComponent(skill_name)}`),
  indexActiveSkills: (skill_name?: string) =>
    request<import("./types").IndexSkillsResponse>("/skills/index", {
      method: "POST",
      body: JSON.stringify(skill_name ? { skill_name } : {}),
    }),
  searchSkills: (data: { query: string; top_k?: number; include_content?: boolean }) =>
    request<import("./types").SearchSkillsResponse>("/skills/search", {
      method: "POST",
      body: JSON.stringify(data),
    }, { unwrapItems: false }),
  listSkillCatalog: (
    params: { query?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal
  ) => {
    const qs = "?" + buildParams(params)
    return request<import("./types").SkillCatalogResponseDTO>(
      `/skills/catalog${qs}`,
      { signal },
      { unwrapItems: false }
    )
  },
  compileSkills: (data: import("./types").CompileSkillsRequestDTO = {}) =>
    request<import("./types").CompileSkillsResponseDTO>("/skills/compile", {
      method: "POST",
      body: JSON.stringify(data),
    }, { unwrapItems: false }),
  getSkillInstructions: (versionID: string) =>
    request<import("./types").SkillInstructionsDTO>(
      `/skills/versions/${encodeURIComponent(versionID)}/instructions`
    ),
  listSkillResources: (
    versionID: string,
    params: { limit?: number; offset?: number } = {}
  ) => {
    const qs = "?" + buildParams(params)
    return request<import("./types").SkillResourcesResponseDTO>(
      `/skills/versions/${encodeURIComponent(versionID)}/resources${qs}`,
      {},
      { unwrapItems: false }
    )
  },
  getSkillResource: (versionID: string, fileID: string) =>
    request<import("./types").SkillResourceDTO>(
      `/skills/versions/${encodeURIComponent(versionID)}/resources/${encodeURIComponent(fileID)}`
    ),
  listSkillQualityRuns: (
    versionID: string,
    params: { limit?: number; offset?: number } = {},
    signal?: AbortSignal
  ) => {
    const qs = "?" + buildParams(params)
    return request<import("./types").SkillQualityRunsResponseDTO>(
      `/skills/versions/${encodeURIComponent(versionID)}/quality-runs${qs}`,
      { signal },
      { unwrapItems: false }
    )
  },
  createSkillQualityRun: (
    versionID: string,
    data: import("./types").CreateSkillQualityRunRequestDTO = {},
    signal?: AbortSignal
  ) =>
    request<import("./types").SkillQualityRunDTO>(
      `/skills/versions/${encodeURIComponent(versionID)}/quality-runs`,
      {
        method: "POST",
        body: JSON.stringify(data),
        signal,
      }
    ),
  getSkillQualityRun: (runID: string, signal?: AbortSignal) =>
    request<import("./types").SkillQualityRunDTO>(
      `/skills/quality-runs/${encodeURIComponent(runID)}`,
      { signal }
    ),

  // Knowledge Registry (K1/K2)
  listKnowledgeSources: (params?: { type?: string; status?: string; limit?: number; offset?: number }) => {
    const qs = params ? "?" + buildParams(params) : ""
    return request<import("./types").KnowledgeSource[]>(`/knowledge/sources${qs}`)
  },
  createKnowledgeSource: (data: import("./types").CreateKnowledgeSourceRequest) =>
    request<import("./types").KnowledgeSource>("/knowledge/sources", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listKnowledgeSourceRevisions: (id: string, params?: { limit?: number; offset?: number }) => {
    const qs = params ? "?" + buildParams(params) : ""
    return request<import("./types").KnowledgeSourceRevision[]>(
      `/knowledge/sources/${encodeURIComponent(id)}/revisions${qs}`
    )
  },
  syncKnowledgeSource: (id: string, data: import("./types").SyncKnowledgeSourceRequest = {}) =>
    request<import("./types").SyncKnowledgeSourceResponse>(
      `/knowledge/sources/${encodeURIComponent(id)}/sync`,
      { method: "POST", body: JSON.stringify(data) }
    ),
  listKnowledgeCatalog: (
    params: { query?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal
  ) => {
    const qs = "?" + buildParams(params)
    return request<import("./types").KnowledgeCatalogResponse>(
      `/knowledge/catalog${qs}`,
      { signal },
      { unwrapItems: false }
    )
  },
  indexKnowledge: (sourceID?: string) =>
    request<import("./types").IndexKnowledgeResponse>("/knowledge/index", {
      method: "POST",
      body: JSON.stringify(sourceID ? { source_id: sourceID } : {}),
    }),
  searchKnowledge: (data: import("./types").SearchKnowledgeRequest, signal?: AbortSignal) =>
    request<import("./types").SearchKnowledgeResponse>(
      "/knowledge/search",
      { method: "POST", body: JSON.stringify(data), signal },
      { unwrapItems: false }
    ),
  listKnowledgeRevisionDocuments: (
    revisionID: string,
    params: { limit?: number; offset?: number } = {},
    signal?: AbortSignal
  ) => {
    const qs = "?" + buildParams(params)
    return request<import("./types").KnowledgeDocumentListResponse>(
      `/knowledge/revisions/${encodeURIComponent(revisionID)}/documents${qs}`,
      { signal },
      { unwrapItems: false }
    )
  },
  getKnowledgeDocument: (revisionID: string, docID: string) =>
    request<import("./types").KnowledgeDocument>(
      `/knowledge/revisions/${encodeURIComponent(revisionID)}/documents/${encodeURIComponent(docID)}`
    ),
  listKnowledgeDocumentLinks: (docID: string, params: { limit?: number; offset?: number } = {}) => {
    const qs = "?" + buildParams(params)
    return request<import("./types").KnowledgeDocumentLinksResponse>(
      `/knowledge/documents/${encodeURIComponent(docID)}/links${qs}`,
      {},
      { unwrapItems: false }
    )
  },

  // Memory Plane（只读观察）
  listMemoryEntries: (
    params: { scope_type?: string; scope_key?: string; memory_type?: string; status?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal
  ) => {
    const qs = "?" + buildParams(params)
    return request<import("./types").MemoryEntryListResponse>(`/memory/entries${qs}`, { signal }, { unwrapItems: false })
  },
  getMemoryEntry: (id: string) =>
    request<import("./types").MemoryEntryDetail>(`/memory/entries/${encodeURIComponent(id)}`),
  searchMemory: (data: import("./types").MemorySearchRequest, signal?: AbortSignal) =>
    request<{ items: import("./types").MemorySearchItem[]; total: number }>(
      "/memory/search",
      { method: "POST", body: JSON.stringify(data), signal },
      { unwrapItems: false }
    ),
  listMemoryFeedback: (id: string, limit?: number) => {
    const qs = limit ? `?limit=${limit}` : ""
    return request<{ items: import("./types").MemoryFeedback[]; total: number }>(
      `/memory/entries/${encodeURIComponent(id)}/feedback${qs}`,
      {},
      { unwrapItems: false }
    )
  },
  getMemoryAttribution: (id: string) =>
    request<import("./types").MemoryEntryAttribution>(`/memory/entries/${encodeURIComponent(id)}/attribution`),
  getMemoryTimeline: (params: { session_id?: string; skill_version_id?: string; limit?: number }, signal?: AbortSignal) => {
    const qs = "?" + buildParams(params)
    return request<import("./types").MemoryTimelineResponse>(`/memory/timeline${qs}`, { signal }, { unwrapItems: false })
  },

  // Working memory（会话原始记录：审计查看 / 编辑会话 / 删除）
  //
  // 全部传 unwrapItems: false —— 会话列表要 total 做分页，回放要 has_more 和
  // last_seq，被默认拆包成 items 数组就都丢了。
  listWorkingSessions: (
    params: { status?: string; agent?: string; engine?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal
  ) => {
    const qs = "?" + buildParams(params)
    return request<import("./types").WorkingSessionListResponse>(
      `/memory/working/sessions${qs}`,
      { signal },
      { unwrapItems: false }
    )
  },
  // 已在用的 engine 值。engine 是自由文本，列表页据此提供下拉而不是让人手打——
  // claude-code 和 claudecode 会把同一个引擎的审计数据裂成两份。
  listWorkingEngines: (signal?: AbortSignal) =>
    request<{ items: import("./types").WorkingEngineUsage[]; total: number; note: string }>(
      "/memory/working/engines",
      { signal },
      { unwrapItems: false }
    ),
  getWorkingSession: (id: string, signal?: AbortSignal) =>
    request<import("./types").WorkingSession>(`/memory/working/sessions/${encodeURIComponent(id)}`, { signal }),
  replayWorkingItems: (
    id: string,
    params: { after_seq?: number; limit?: number } = {},
    signal?: AbortSignal
  ) => {
    const qs = "?" + buildParams(params)
    return request<import("./types").WorkingReplayResponse>(
      `/memory/working/sessions/${encodeURIComponent(id)}/items${qs}`,
      { signal },
      { unwrapItems: false }
    )
  },
  updateWorkingSession: (id: string, data: import("./types").UpdateWorkingSessionRequest) =>
    request<import("./types").WorkingSession>(`/memory/working/sessions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteWorkingSession: (id: string) =>
    request<import("./types").DeleteWorkingSessionResponse>(
      `/memory/working/sessions/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      { unwrapItems: false }
    ),
  deleteWorkingItem: (id: string, seq: number) =>
    request<{ deleted: boolean; seq: number }>(
      `/memory/working/sessions/${encodeURIComponent(id)}/items/${seq}`,
      { method: "DELETE" },
      { unwrapItems: false }
    ),

  // 蒸馏与候选审核
  distillSession: (sessionID: string) =>
    request<import("./types").DistillRunDetail>(
      "/memory/distill",
      { method: "POST", body: JSON.stringify({ session_id: sessionID }) },
      { unwrapItems: false }
    ),
  listDistillRuns: (
    params: { session_id?: string; status?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal
  ) => {
    const qs = "?" + buildParams(params)
    return request<import("./types").DistillRunListResponse>(
      `/memory/distill/runs${qs}`,
      { signal },
      { unwrapItems: false }
    )
  },
  getDistillRun: (runID: string, signal?: AbortSignal) =>
    request<import("./types").DistillRunDetail>(
      `/memory/distill/runs/${encodeURIComponent(runID)}`,
      { signal },
      { unwrapItems: false }
    ),
  promoteMemoryEntry: (id: string, reason?: string) =>
    request<import("./types").PromoteEntryResponse>(
      `/memory/entries/${encodeURIComponent(id)}/promote`,
      { method: "POST", body: JSON.stringify(reason ? { reason } : {}) },
      { unwrapItems: false }
    ),
  rejectMemoryEntry: (id: string, reason?: string) =>
    request<import("./types").MemoryEntry>(
      `/memory/entries/${encodeURIComponent(id)}/reject`,
      { method: "POST", body: JSON.stringify(reason ? { reason } : {}) },
      { unwrapItems: false }
    ),
}
