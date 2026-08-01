import PublicReportClient from "./public-report-client"

// 静态导出（output: 'export'）需要构建时确定的路径集合；真实 id 由客户端
// 从路径中读取并请求公开 API，这里只生成一个占位路径。
export function generateStaticParams() {
  return [{ id: "placeholder" }]
}

export default function PublicReportPage() {
  return <PublicReportClient />
}
