const BASE_URL = "http://localhost:26001"

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
}
