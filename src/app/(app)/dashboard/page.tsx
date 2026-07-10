"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import type { Todo, Bookmark, Report, ExpenseSummary } from "@/lib/types"

export default function DashboardPage() {
  const { t } = useI18n()
  const [todos, setTodos] = useState<Todo[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [expense, setExpense] = useState<ExpenseSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.listTodos(),
      api.listBookmarks({ is_read: false }),
      api.getExpenseSummary(),
      api.listReports({ limit: 3 }),
    ]).then(([t, b, e, r]) => {
      setTodos(t)
      setBookmarks(b)
      setExpense(e)
      setReports(r)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400">Loading...</div>

  const today = new Date().toISOString().slice(0, 10)
  const activeTodos = todos.filter(t => t.status === "pending" || t.status === "in_progress")
  const overdueTodos = activeTodos.filter(t => t.due_date && t.due_date < today)

  // Expense by tag - top 5
  const byTag = expense?.by_tag ?? {}
  const tagEntries = Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxTagAmount = tagEntries.length > 0 ? tagEntries[0][1] : 1

  return (
    <div className="bg-[#0a0a0f] p-6 min-h-full space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label={t.dashboard.pendingTodos} value={`${activeTodos.length}`} color="text-indigo-400" />
        <StatCard label={t.dashboard.overdueTodos} value={`${overdueTodos.length}`} color="text-red-400" />
        <StatCard label={t.dashboard.unreadBookmarks} value={`${bookmarks.length}`} color="text-amber-400" />
        <StatCard label={t.dashboard.monthlyExpense} value={`¥ ${(expense?.total ?? 0).toFixed(2)}`} color="text-emerald-400" />
      </div>

      {/* Middle Section */}
      <div className="grid grid-cols-3 gap-4">
        {/* Todos Quick View */}
        <div className="col-span-2 bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">{t.todos.title}</h2>
            <Link href="/todos" className="text-sm text-indigo-400 hover:underline">{t.dashboard.viewAll}</Link>
          </div>
          {activeTodos.length === 0 ? (
            <p className="text-slate-400 text-center py-8">{t.todos.noTodos}</p>
          ) : (
            <div className="space-y-2">
              {activeTodos.slice(0, 5).map(todo => (
                <div key={todo.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0a0f]">
                  <span className={`w-1 h-8 rounded-full ${todo.status === "pending" ? "bg-amber-400" : "bg-blue-400"}`} />
                  <span className="flex-1 text-sm text-slate-200 truncate">{todo.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    todo.priority === "high" ? "bg-red-500/20 text-red-400" :
                    todo.priority === "medium" ? "bg-amber-500/20 text-amber-400" :
                    "bg-slate-500/20 text-slate-400"
                  }`}>{todo.priority}</span>
                  {todo.due_date && <span className="text-xs text-slate-500">{todo.due_date}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expense Distribution */}
        <div className="col-span-1 bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">{t.dashboard.monthlyExpense}</h2>
          {tagEntries.length === 0 ? (
            <p className="text-slate-500 text-sm">暂无数据</p>
          ) : (
            <div className="space-y-3">
              {tagEntries.map(([tag, amount]) => (
                <div key={tag}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{tag}</span>
                    <span className="text-slate-400">¥{amount.toFixed(2)}</span>
                  </div>
                  <div className="h-2 bg-[#0a0a0f] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(amount / maxTagAmount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recent Reports */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">{t.dashboard.recentReports}</h2>
            <Link href="/reports" className="text-sm text-indigo-400 hover:underline">{t.dashboard.viewAll}</Link>
          </div>
          <div className="space-y-3">
            {reports.map(r => (
              <Link key={r.id} href={`/reports/${r.id}`} className="block p-3 rounded-lg bg-[#0a0a0f] hover:bg-[#14141f] transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-200 flex-1 truncate">{r.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400">{r.format}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  <span>{r.source}</span>
                  <span>·</span>
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Unread Bookmarks */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">{t.dashboard.unreadBookmarks}</h2>
            <Link href="/bookmarks" className="text-sm text-indigo-400 hover:underline">{t.dashboard.viewAll}</Link>
          </div>
          <div className="space-y-3">
            {bookmarks.slice(0, 4).map(b => (
              <a key={b.id} href={b.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0a0f] hover:bg-[#14141f] transition-colors">
                <img src={`https://www.google.com/s2/favicons?domain=${new URL(b.url).hostname}&sz=32`} alt="" className="w-4 h-4 rounded" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{b.title}</p>
                  <p className="text-xs text-slate-500 truncate">{b.url}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
      <p className="text-sm text-slate-500 mt-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
