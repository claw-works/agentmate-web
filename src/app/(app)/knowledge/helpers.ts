// 知识库页面共享的小工具函数（与 skills 页面保持一致的行为）。

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败"
}

export function shortHash(value?: string | null) {
  if (!value) return "-"
  return value.length > 12 ? value.slice(0, 12) : value
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString()
}

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

export type AsyncEntry<T> = { data?: T; loading: boolean; error?: string }

export type Notice = { tone: "success" | "warning" | "error"; text: string }

export function noticeClassName(tone: Notice["tone"]) {
  const classes = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    error: "border-red-500/30 bg-red-500/10 text-red-200",
  }
  return `flex items-start gap-2 rounded-lg border p-3 text-sm ${classes[tone]}`
}
