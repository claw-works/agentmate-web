"use client"

import Link from "next/link"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { AgentMateLogo } from "@/components/agentmate-logo"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading && !user) router.replace("/login")
  }, [loading, user, router])
  if (loading || !user) return <div className="flex min-h-screen items-center justify-center bg-[#080810] text-slate-500">加载管理控制台…</div>
  if (user.role !== "admin") return <div className="flex min-h-screen items-center justify-center bg-[#080810] text-red-300">需要平台管理员权限</div>
  return <div className="min-h-screen bg-[#080810] text-slate-100">
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#202031] bg-[#0d0d17]/95 px-6 backdrop-blur">
      <Link href="/admin" className="flex items-center gap-3 font-semibold">
        <AgentMateLogo compact />
        <span>AgentMate Admin</span>
      </Link>
      <div className="flex items-center gap-4 text-sm text-slate-400"><span>{user.email}</span><button onClick={logout} className="flex items-center gap-1 hover:text-white"><LogOut className="size-4" />退出</button></div>
    </header>
    <main className="p-6">{children}</main>
  </div>
}
