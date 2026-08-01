import ReportDetailClient from "./report-detail-client"

// 静态导出（output: 'export'）需要构建时确定的路径集合；真实 id 由客户端
// useParams() 在运行时读取并发起 API 请求，这里只需生成一个占位路径。
export function generateStaticParams() {
  return [{ id: "placeholder" }]
}

export default function ReportDetailPage() {
  return <ReportDetailClient />
}
