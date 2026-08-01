"use client"

import { useEffect, useRef, useState } from "react"
import type { SyntheticEvent } from "react"
import type { PublicReport } from "@/lib/types"

// HTML 报告在沙箱 iframe 中渲染，高度跟随内容自适应。
// 首页博客流与报告独立页共用。
export function HtmlReport({ report }: { report: PublicReport }) {
  const [height, setHeight] = useState(480)
  const resizeObserver = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    return () => resizeObserver.current?.disconnect()
  }, [])

  const handleLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
    resizeObserver.current?.disconnect()
    const document = event.currentTarget.contentDocument
    if (!document) return

    const updateHeight = () => {
      setHeight(Math.max(document.body?.scrollHeight ?? 0, document.documentElement.scrollHeight, 320))
    }

    updateHeight()
    resizeObserver.current = new ResizeObserver(updateHeight)
    resizeObserver.current.observe(document.documentElement)
  }

  return (
    <iframe
      srcDoc={report.content ?? ""}
      className="w-full border-0 bg-white"
      style={{ height }}
      title={report.title}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      onLoad={handleLoad}
    />
  )
}
