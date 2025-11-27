import { useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { useThemeStore, applyTheme } from '../stores/theme'
import {
  HomeIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  ClipboardDocumentCheckIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline'
import NotificationsDropdown from './NotificationsDropdown'
import clsx from 'clsx'

const navigation = [
  { name: 'Accueil', href: '/', icon: HomeIcon },
  { name: 'Mes fiches', href: '/dashboard', icon: DocumentTextIcon },
  { name: 'Templates', href: '/templates', icon: DocumentDuplicateIcon },
  { name: 'Analytique', href: '/analytics', icon: ChartBarIcon },
  { name: 'Recherche', href: '/search', icon: MagnifyingGlassIcon }
]

const managerNav = [
  { name: 'Validations', href: '/manager', icon: ClipboardDocumentCheckIcon }
]

const adminNav = [
  { name: 'Admin', href: '/admin', icon: ShieldCheckIcon }
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { theme, setTheme } = useThemeStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Apply theme changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Cycle through themes: light -> dark -> system
  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
  }

  const ThemeIcon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : ComputerDesktopIcon
  const themeLabel = theme === 'light' ? 'Clair' : theme === 'dark' ? 'Sombre' : 'Systeme'

  // Keyboard shortcut for search (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        navigate('/search')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🏭</span>
              <span className="font-bold text-xl text-gray-900 dark:text-white">ATELIER FORGE</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={clsx(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                )
              })}
              {/* Manager navigation */}
              {(user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
                <>
                  <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-2" />
                  {managerNav.map((item) => {
                    const isActive = location.pathname === item.href
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={clsx(
                          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                            : 'text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/30'
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.name}
                      </Link>
                    )
                  })}
                </>
              )}
              {/* Admin navigation */}
              {user?.role === 'ADMIN' && (
                <>
                  {adminNav.map((item) => {
                    const isActive = location.pathname === item.href
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={clsx(
                          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                            : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30'
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.name}
                      </Link>
                    )
                  })}
                </>
              )}
            </nav>

            {/* User menu */}
            <div className="flex items-center gap-2">
              {/* Quick Search Button */}
              <button
                onClick={() => navigate('/search')}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                title="Recherche rapide (Ctrl+K)"
              >
                <MagnifyingGlassIcon className="w-4 h-4" />
                <span className="hidden lg:inline">Recherche</span>
                <kbd className="hidden lg:inline px-1.5 py-0.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                  K
                </kbd>
              </button>

              {/* Theme Toggle */}
              <button
                onClick={cycleTheme}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={`Theme: ${themeLabel}`}
              >
                <ThemeIcon className="w-5 h-5" />
              </button>

              {/* Notifications */}
              <NotificationsDropdown />

              {/* User info */}
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 ml-2">
                <UserCircleIcon className="w-6 h-6" />
                <span className="hidden sm:inline">
                  {user?.firstName} {user?.lastName}
                </span>
                {(user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full">
                    {user?.role === 'ADMIN' ? 'Admin' : 'Manager'}
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Deconnexion"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            ATELIER FORGE v3.0 — HARMONIA GROUP © 2025
          </p>
        </div>
      </footer>
    </div>
  )
}
