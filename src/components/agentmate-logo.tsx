import Image from "next/image"

type AgentMateLogoProps = {
  className?: string
  compact?: boolean
}

export function AgentMateLogo({ className = "", compact = false }: AgentMateLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image src="/agentmate-mark.svg" alt="" width={36} height={36} className="size-9 shrink-0" priority />
      {!compact && <span className="font-bold tracking-tight text-white">AgentMate</span>}
    </span>
  )
}
