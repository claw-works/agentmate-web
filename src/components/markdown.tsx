"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: (props) => (
          <div className="overflow-x-auto my-4">
            <table className="w-full border-collapse text-sm" {...props} />
          </div>
        ),
        thead: (props) => <thead className="border-b border-slate-600" {...props} />,
        th: (props) => <th className="px-4 py-2 text-left font-semibold text-slate-300" {...props} />,
        tr: (props) => <tr className="border-b border-slate-700/50 hover:bg-slate-800/50" {...props} />,
        td: (props) => <td className="px-4 py-2 text-slate-300" {...props} />,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
