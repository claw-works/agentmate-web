"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function Markdown({ children, variant = "dark" }: { children: string; variant?: "dark" | "light" }) {
  const light = variant === "light"

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: (props) => (
          <div className="overflow-x-auto my-4">
            <table className="w-full border-collapse text-sm" {...props} />
          </div>
        ),
        thead: (props) => <thead className={light ? "border-b border-slate-300" : "border-b border-slate-600"} {...props} />,
        th: (props) => <th className={`px-4 py-2 text-left font-semibold ${light ? "text-slate-800" : "text-slate-300"}`} {...props} />,
        tr: (props) => <tr className={`border-b ${light ? "border-slate-200 hover:bg-slate-50" : "border-slate-700/50 hover:bg-slate-800/50"}`} {...props} />,
        td: (props) => <td className={`px-4 py-2 ${light ? "text-slate-700" : "text-slate-300"}`} {...props} />,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
