"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { LayoutDashboard, CheckSquare2, FileText, BarChart2, KeyRound, LogOut, Bookmark, Wallet, Zap } from "lucide-react"

const navKeys = [
  { href: "/dashboard", key: "dashboard" as const, icon: LayoutDashboard },
  { href: "/todos", key: "todos" as const, icon: CheckSquare2 },
  { href: "/notes", key: "notes" as const, icon: FileText },
  { href: "/reports", key: "reports" as const, icon: BarChart2 },
  { href: "/bookmarks", key: "bookmarks" as const, icon: Bookmark },
  { href: "/expenses", key: "expenses" as const, icon: Wallet },
  { href: "/skills", key: "skills" as const, icon: Zap },
  { href: "/apikeys", key: "apikeys" as const, icon: KeyRound },
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

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a12]">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 h-full overflow-y-auto border-r border-[#1e1e2e] bg-[#0d0d16] flex flex-col">
        <div className="px-5 py-5 font-bold text-lg text-white">AgentMate</div>
        <nav className="flex-1 px-3 space-y-1">
          {navKeys.map((item) => {
            const active = pathname.startsWith(item.href)
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
          })}
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
