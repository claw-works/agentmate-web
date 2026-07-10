"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Expense, ExpenseSummary } from "@/lib/types"
import { ClickableTag } from "@/components/clickable-tag"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Trash2, Pencil } from "lucide-react"

function groupByDate(expenses: Expense[]): Record<string, Expense[]> {
  const groups: Record<string, Expense[]> = {}
  for (const e of expenses) {
    const day = e.happened_at?.slice(0, 10) ?? e.created_at.slice(0, 10)
    ;(groups[day] ??= []).push(e)
  }
  return groups
}

function buildDateParams(from: string, to: string) {
  const params: { from?: string; to?: string } = {}
  if (from) params.from = from
  if (to) params.to = to
  return params
}

async function fetchExpenses(search: string, from: string, to: string) {
  if (search) {
    const data = await api.searchExpenses(search)
    return data ?? []
  }
  const data = await api.listExpenses(buildDateParams(from, to))
  return data ?? []
}

async function fetchExpenseSummary(from: string, to: string) {
  return api.getExpenseSummary(buildDateParams(from, to))
}

export default function ExpensesPage() {
  const { t } = useI18n()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [search, setSearch] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setExpenses(await fetchExpenses(search, from, to))
  }, [search, from, to])

  const loadSummary = useCallback(async () => {
    setSummary(await fetchExpenseSummary(from, to))
  }, [from, to])

  useEffect(() => {
    let cancelled = false
    void fetchExpenses(search, from, to).then((data) => {
      if (!cancelled) setExpenses(data)
    })
    return () => { cancelled = true }
  }, [search, from, to])

  useEffect(() => {
    let cancelled = false
    void fetchExpenseSummary(from, to).then((data) => {
      if (!cancelled) setSummary(data)
    })
    return () => { cancelled = true }
  }, [from, to])

  const handleDelete = async () => {
    if (!deleteId) return
    await api.deleteExpense(deleteId)
    setDeleteId(null)
    load()
    loadSummary()
  }

  const grouped = groupByDate(expenses)
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="flex gap-6">
      {/* Left panel */}
      <aside className="w-64 shrink-0 space-y-4">
        {/* Summary card */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">{t.expenses.totalExpense}</p>
          <p className="text-2xl font-bold text-emerald-400">
            ¥ {summary?.total?.toFixed(2) ?? "0.00"}
          </p>
          <p className="text-xs text-slate-600 mt-1">{summary?.count ?? 0} 笔记录</p>
        </div>

        {/* By tag breakdown */}
        {summary?.by_tag && Object.keys(summary.by_tag).length > 0 && (
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4 space-y-2">
            <p className="text-xs text-slate-500 mb-2">按标签</p>
            {Object.entries(summary.by_tag)
              .sort(([, a], [, b]) => b - a)
              .map(([tag, amount]) => {
                const pct = summary.total > 0 ? (amount / summary.total) * 100 : 0
                return (
                  <div key={tag} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">{tag}</span>
                      <span className="text-slate-500">¥{amount.toFixed(0)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        <button
          onClick={() => { setEditing(null); setDialogOpen(true) }}
          className="w-full px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
        >
          {t.expenses.newExpense}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 space-y-6 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{t.expenses.title}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t.expenses.subtitle}</p>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={`${t.common.search}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 bg-[#111118] border-[#1e1e2e] placeholder:text-slate-600"
            />
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-36 bg-[#111118] border-[#1e1e2e] text-slate-300"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-36 bg-[#111118] border-[#1e1e2e] text-slate-300"
            />
          </div>
        </div>

        {/* Expense list grouped by date */}
        <div className="space-y-6">
          {sortedDays.map((day) => (
            <div key={day}>
              <p className="text-xs text-slate-500 mb-2 font-medium">{day}</p>
              <div className="space-y-2">
                {grouped[day].map((e) => (
                  <div
                    key={e.id}
                    className="group flex items-center gap-4 p-3 rounded-xl bg-[#111118] border border-[#1e1e2e] hover:border-[#3d3d5c] transition-all"
                  >
                    <span className="text-lg font-bold text-emerald-400 w-24 text-right shrink-0">
                      ¥{e.amount.toFixed(2)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{e.description || "—"}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {e.tags?.map((tag) => (
                          <ClickableTag key={tag} tag={tag} module="expenses" />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-slate-600 shrink-0">
                      {e.happened_at ? new Date(e.happened_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => { setEditing(e); setDialogOpen(true) }}
                        className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-slate-200"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(e.id)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-12">暂无记录</p>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t.common.edit : t.expenses.newExpense}</DialogTitle>
          </DialogHeader>
          <ExpenseForm
            expense={editing}
            onDone={() => { setDialogOpen(false); setEditing(null); load(); loadSummary() }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.common.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>{t.common.deleteWarning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t.common.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const QUICK_TAGS = [
  { label: "🍜 餐饮", value: "餐饮" },
  { label: "🚌 交通", value: "交通" },
  { label: "🛍️ 购物", value: "购物" },
  { label: "🏨 住宿", value: "住宿" },
  { label: "🎮 娱乐", value: "娱乐" },
  { label: "✈️ 出差", value: "出差" },
]

function ExpenseForm({ expense, onDone }: { expense: Expense | null; onDone: () => void }) {
  const { t } = useI18n()
  const [amount, setAmount] = useState(expense?.amount?.toString() ?? "")
  const [currency, setCurrency] = useState(expense?.currency ?? "CNY")
  const [description, setDescription] = useState(expense?.description ?? "")
  const [tags, setTags] = useState(expense?.tags?.join(", ") ?? "")
  const [happenedAt, setHappenedAt] = useState(
    expense?.happened_at?.slice(0, 16) ?? new Date().toISOString().slice(0, 16)
  )
  const [loading, setLoading] = useState(false)

  const addQuickTag = (tag: string) => {
    const current = tags.split(",").map((t) => t.trim()).filter(Boolean)
    if (!current.includes(tag)) {
      setTags(current.length > 0 ? `${tags}, ${tag}` : tag)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const data = {
      amount: parseFloat(amount),
      currency,
      description: description || undefined,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      happened_at: happenedAt ? new Date(happenedAt).toISOString() : undefined,
    }
    if (expense) await api.updateExpense(expense.id, data)
    else await api.createExpense(data)
    setLoading(false)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label>金额 *</Label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label>货币</Label>
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>描述</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="今天花了什么？" />
      </div>
      <div className="space-y-2">
        <Label>Tags</Label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="餐饮, 交通" />
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_TAGS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => addQuickTag(t.value)}
              className="px-2 py-1 text-xs rounded-md bg-[#1e1e2e] text-slate-400 hover:text-slate-200 hover:bg-[#2a2a3e] transition-colors"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>时间</Label>
        <Input type="datetime-local" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? `${t.common.save}...` : expense ? t.common.save : t.common.create}
      </Button>
    </form>
  )
}
