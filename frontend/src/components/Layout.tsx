import { Outlet, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  Home,
  User,
  Archive,
  BookOpen,
  BarChart3,
  Settings,
  Menu,
  Youtube,
} from 'lucide-react'
import { getStatus } from '../services/api'
import type { UserStatus } from '../types'

const navItems = [
  { to: '/', icon: Home, label: 'ダッシュボード' },
  { to: '/mypage', icon: User, label: 'マイページ' },
  { to: '/archive', icon: Archive, label: 'アーカイブ' },
  { to: '/resources', icon: BookOpen, label: '本棚' },
  { to: '/youtube', icon: Youtube, label: 'YouTube学習' },
  { to: '/statistics', icon: BarChart3, label: '統計' },
  { to: '/admin', icon: Settings, label: '管理' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [status, setStatus] = useState<UserStatus | null>(null)

  useEffect(() => {
    getStatus().then((res) => setStatus(res.data))
  }, [])

  const progressPercent = status
    ? Math.min(
        100,
        ((status.total_xp - status.xp_start_of_current_level) /
          (status.next_xp_goal - status.xp_start_of_current_level)) *
          100
      )
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Fixed Header with Toggle Button */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-white border-b h-14">
        <div className="flex items-center px-4 h-full">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold gradient-text ml-4">Art Learning XP</h1>
        </div>
      </div>

      {/* Mini Sidebar for PC (icons only) */}
      <aside className="hidden lg:flex fixed top-14 left-0 z-40 h-[calc(100%-3.5rem)] w-[72px] bg-transparent flex-col pt-3">
        <nav className="flex-1 overflow-y-auto">
          <ul className="space-y-1 px-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
                      isActive
                        ? 'bg-blue-100 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                  title={item.label}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] mt-1 font-medium leading-tight text-center">{item.label.length > 5 ? item.label.slice(0, 4) + '..' : item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Full Sidebar (expandable) */}
      <aside
        className={`fixed top-14 left-0 z-50 h-[calc(100%-3.5rem)] w-72 bg-white shadow-xl transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* User Status */}
          {status && (
            <div className="p-4 border-b">
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow">
                    <span className="text-2xl">🎨</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{status.username}</p>
                    <p className="text-xs text-gray-600">Rank {status.rank}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-800 mb-2 truncate font-medium">{status.title}</p>
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full xp-bar-animate"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs font-semibold text-gray-700">
                    {status.total_xp.toLocaleString()} XP
                  </span>
                  <span className="text-xs font-semibold text-gray-700">
                    あと {status.xp_to_next_rank.toLocaleString()} XP
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => {
                      // モバイルの場合のみ閉じる
                      if (window.innerWidth < 1024) {
                        setSidebarOpen(false)
                      }
                    }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-300'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t">
            <p className="text-xs text-center text-gray-400">
              © 2024 Art Learning XP System
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay - Mobile only */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 top-14 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className={`pt-14 min-h-screen transition-all duration-300 ${
        sidebarOpen ? 'lg:pl-72' : 'lg:pl-[72px]'
      }`}>
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
