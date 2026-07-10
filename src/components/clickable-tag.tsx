"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"

interface ClickableTagProps {
  tag: string
  module: "reports" | "notes" | "todos" | "bookmarks" | "expenses"
  className?: string
}

export function ClickableTag({ tag, module, className }: ClickableTagProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTags = searchParams.getAll("tags")
  const isActive = currentTags.includes(tag)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextTags = isActive
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag]
    const query = nextTags.map((t) => `tags=${encodeURIComponent(t)}`).join("&")
    router.push(`/${module}${query ? "?" + query : ""}`)
  }

  return (
    <Badge
      variant="secondary"
      className={`cursor-pointer transition-all text-xs ${
        isActive
          ? "bg-indigo-500/30 text-indigo-300 border-indigo-500/50"
          : "hover:opacity-80"
      } ${className ?? ""}`}
      onClick={handleClick}
    >
      {tag}
    </Badge>
  )
}
