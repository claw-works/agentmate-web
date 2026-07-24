'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Lang = 'zh' | 'en'

interface Translations {
  nav: { dashboard: string; todos: string; notes: string; reports: string; bookmarks: string; expenses: string; skills: string; knowledge: string; apikeys: string; logout: string }
  common: { save: string; cancel: string; delete: string; edit: string; search: string; create: string; back: string; loading: string; noContent: string; copyContent: string; copied: string; export: string; all: string; confirm: string; confirmDelete: string; deleteWarning: string }
  dashboard: { title: string; pendingTodos: string; overdueTodos: string; unreadBookmarks: string; monthlyExpense: string; recentReports: string; viewAll: string }
  todos: { title: string; subtitle: string; newTodo: string; pending: string; inProgress: string; done: string; high: string; medium: string; low: string; noTodos: string }
  notes: { title: string; subtitle: string; newNote: string }
  reports: { title: string; subtitle: string; newReport: string; source: string; format: string; downloadMd: string; downloadHtml: string; downloadTxt: string }
  bookmarks: { title: string; subtitle: string; newBookmark: string; unread: string; read: string; openInBrowser: string }
  expenses: { title: string; subtitle: string; newExpense: string; totalExpense: string; amount: string; description: string }
  skills: { title: string; subtitle: string; totalRuns: string; successRate: string; failureRate: string; correctionRate: string; signals: string; versions: string; logs: string; activeVersion: string }
  login: { title: string; email: string; password: string; signIn: string; signingIn: string; checking: string; noAccount: string; haveAccount: string; register: string; registering: string; confirmPassword: string; passwordMismatch: string }
}

const translations: Record<Lang, Translations> = {
  zh: {
    nav: { dashboard: '首页', todos: '待办', notes: '随手记', reports: '报告', bookmarks: '书签', expenses: '记账', skills: '技能', knowledge: '知识库', apikeys: 'API Keys', logout: '退出' },
    common: { save: '保存', cancel: '取消', delete: '删除', edit: '编辑', search: '搜索', create: '新建', back: '← 返回', loading: '加载中...', noContent: '暂无内容', copyContent: '复制内容', copied: '已复制 ✓', export: '导出', all: '全部', confirm: '确认', confirmDelete: '确认删除？', deleteWarning: '此操作不可撤销。' },
    dashboard: { title: '首页', pendingTodos: '待完成', overdueTodos: '已逾期', unreadBookmarks: '未读书签', monthlyExpense: '本月支出', recentReports: '最近报告', viewAll: '查看全部' },
    todos: { title: '待办事项', subtitle: '管理你的任务', newTodo: '新建待办', pending: '待开始', inProgress: '进行中', done: '已完成', high: '高', medium: '中', low: '低', noTodos: '暂无待办' },
    notes: { title: '随手记', subtitle: '记录你的想法', newNote: '新建笔记' },
    reports: { title: '报告', subtitle: '报告收集与管理', newReport: '新建报告', source: '来源', format: '格式', downloadMd: '下载 .md', downloadHtml: '下载 .html', downloadTxt: '下载 .txt' },
    bookmarks: { title: '书签', subtitle: '收藏的链接和文章', newBookmark: '添加书签', unread: '未读', read: '已读', openInBrowser: '在浏览器中打开' },
    expenses: { title: '记账', subtitle: '追踪你的支出', newExpense: '记一笔', totalExpense: '总支出', amount: '金额', description: '描述' },
    skills: { title: '技能注册', subtitle: '管理 Agent 技能', totalRuns: '总运行', successRate: '成功率', failureRate: '失败率', correctionRate: '纠正率', signals: '信号', versions: '版本', logs: '日志', activeVersion: '当前版本' },
    login: { title: '登录', email: '邮箱', password: '密码', signIn: '登录', signingIn: '登录中...', checking: '正在检查登录状态...', noAccount: '还没有账号？', haveAccount: '已有账号？', register: '注册', registering: '注册中...', confirmPassword: '确认密码', passwordMismatch: '两次输入的密码不一致' },
  },
  en: {
    nav: { dashboard: 'Dashboard', todos: 'Todos', notes: 'Notes', reports: 'Reports', bookmarks: 'Bookmarks', expenses: 'Expenses', skills: 'Skills', knowledge: 'Knowledge', apikeys: 'API Keys', logout: 'Logout' },
    common: { save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', search: 'Search', create: 'Create', back: '← Back', loading: 'Loading...', noContent: 'No content', copyContent: 'Copy content', copied: 'Copied ✓', export: 'Export', all: 'All', confirm: 'Confirm', confirmDelete: 'Delete?', deleteWarning: 'This action cannot be undone.' },
    dashboard: { title: 'Dashboard', pendingTodos: 'Pending', overdueTodos: 'Overdue', unreadBookmarks: 'Unread Bookmarks', monthlyExpense: 'Monthly Expense', recentReports: 'Recent Reports', viewAll: 'View All' },
    todos: { title: 'Todos', subtitle: 'Manage your tasks', newTodo: 'New Todo', pending: 'Pending', inProgress: 'In Progress', done: 'Done', high: 'High', medium: 'Medium', low: 'Low', noTodos: 'No todos found.' },
    notes: { title: 'Notes', subtitle: 'Capture your thoughts', newNote: 'New Note' },
    reports: { title: 'Reports', subtitle: 'Collect and manage reports', newReport: 'New Report', source: 'Source', format: 'Format', downloadMd: 'Download .md', downloadHtml: 'Download .html', downloadTxt: 'Download .txt' },
    bookmarks: { title: 'Bookmarks', subtitle: 'Saved links and articles', newBookmark: 'Add Bookmark', unread: 'Unread', read: 'Read', openInBrowser: 'Open in browser' },
    expenses: { title: 'Expenses', subtitle: 'Track your spending', newExpense: 'New Expense', totalExpense: 'Total', amount: 'Amount', description: 'Description' },
    skills: { title: 'Skill Registry', subtitle: 'Manage agent skills', totalRuns: 'Total Runs', successRate: 'Success Rate', failureRate: 'Failure Rate', correctionRate: 'Correction Rate', signals: 'Signals', versions: 'Versions', logs: 'Logs', activeVersion: 'Active Version' },
    login: { title: 'Sign In', email: 'Email', password: 'Password', signIn: 'Sign In', signingIn: 'Signing in...', checking: 'Checking login status...', noAccount: "Don't have an account?", haveAccount: 'Already have an account?', register: 'Register', registering: 'Registering...', confirmPassword: 'Confirm Password', passwordMismatch: 'Passwords do not match' },
  },
}

interface I18nContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translations
}

const I18nContext = createContext<I18nContextType>(null!)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('zh')

  useEffect(() => {
    let cancelled = false
    const stored = localStorage.getItem('lang') as Lang | null
    if (stored && (stored === 'zh' || stored === 'en')) {
      queueMicrotask(() => {
        if (!cancelled) setLangState(stored)
      })
    }
    return () => { cancelled = true }
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('lang', l)
  }

  return (
    <I18nContext.Provider value={{ lang, t: translations[lang], setLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = () => useContext(I18nContext)
