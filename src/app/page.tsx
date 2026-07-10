export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <div className="text-5xl mb-6">✦</div>

        <h1 className="text-4xl font-bold text-white mb-3">AgentMate</h1>
        <p className="text-lg text-slate-400 mb-8">
          AI-native 个人工具服务平台<br/>
          <span className="text-sm text-slate-600">Todos · Notes · Reports · Bookmarks · Expenses</span>
        </p>

        <div className="flex gap-3 justify-center">
          <a href="/login" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
            登录
          </a>
          <a href="/dashboard" className="px-6 py-2.5 bg-[#1e1e2e] hover:bg-[#2a2a3e] text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-colors border border-[#3d3d5c]">
            进入 Dashboard
          </a>
        </div>

        <p className="mt-12 text-xs text-slate-700">
          Powered by AgentMate · localhost:26001
        </p>
      </div>
    </div>
  )
}
