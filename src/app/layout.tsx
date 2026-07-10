import type { Metadata } from "next"
import { Geist, Geist_Mono, Noto_Sans_SC } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/lib/auth-context"
import { I18nProvider } from "@/lib/i18n"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
})

export const metadata: Metadata = {
  title: "AgentMate",
  description: "Personal productivity tools",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} ${notoSansSC.variable} dark`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AuthProvider><I18nProvider>{children}</I18nProvider></AuthProvider>
      </body>
    </html>
  )
}
