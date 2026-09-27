"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { LayoutDashboard, CheckSquare2, FileText, BarChart2, KeyRound, LogOut, Bookmark, Wallet, Zap, Library, Brain, MessagesSquare, Network } from "lucide-react"
import { AgentMateLogo } from "@/components/agentmate-logo"

// 一等公民：AI 能力维度，平铺在侧边栏顶部。
const primaryNav = [
  { href: "/dashboard", key: "dashboard" as const, icon: LayoutDashboard },
  { href: "/sessions", key: "sessions" as const, icon: MessagesSquare },
  { href: "/memory", key: "memory" as const, icon: Brain },
  { href: "/skills", key: "skills" as const, icon: Zap },
  { href: "/knowledge", key: "knowledge" as const, icon: Library },
  { href: "/ontology", key: "ontology" as const, icon: Network },
]

// 产出：用户/agent 产生的数据类工具，收进一个分组。
const outputNav = [
  { href: "/reports", key: "reports" as const, icon: BarChart2 },
  { href: "/notes", key: "notes" as const, icon: FileText },
  { href: "/bookmarks", key: "bookmarks" as const, icon: Bookmark },
  { href: "/todos", key: "todos" as const, icon: CheckSquare2 },
  { href: "/expenses", key: "expenses" as const, icon: Wallet },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const { lang, setLang, t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) router.replace("/login")
  }, [loading, user, router])

  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-400">{t.common.loading}</div>
  if (!user) return null

  const renderNavItem = (item: { href: string; key: keyof typeof t.nav; icon: typeof LayoutDashboard }) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/")
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
          active
            ? "bg-indigo-500/10 text-indigo-400"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-indigo-500" />
        )}
        <Icon className="size-4 shrink-0" />
        {t.nav[item.key]}
      </Link>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a12]">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 h-full overflow-y-auto border-r border-[#1e1e2e] bg-[#0d0d16] flex flex-col">
        <Link href="/" className="px-4 py-4 text-lg transition-opacity hover:opacity-85">
          <AgentMateLogo />
        </Link>
        <nav className="flex-1 px-3 space-y-1">
          {primaryNav.map((item) => renderNavItem(item))}

          {/* 产出：数据类工具分组 */}
          <div className="pt-4">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              {t.nav.groupOutput}
            </p>
            {outputNav.map((item) => renderNavItem(item))}
          </div>

          {/* 设置区 */}
          <div className="pt-4">
            {renderNavItem({ href: "/apikeys", key: "apikeys" as const, icon: KeyRound })}
          </div>
        </nav>
        <div className="px-4 py-4 border-t border-[#1e1e2e] space-y-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLang('zh')}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${lang === 'zh' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              中文
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${lang === 'en' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              EN
            </button>
          </div>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <LogOut className="size-3.5" /> {t.nav.logout}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  )
}
