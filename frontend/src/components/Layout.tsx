import { useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import {
  HomeIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  ClipboardDocumentCheckIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  MagnifyingGlassIcon
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

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🏭</span>
              <span className="font-bold text-xl text-gray-900">ATELIER FORGE</span>
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
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
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
                  <div className="w-px h-6 bg-gray-200 mx-2" />
                  {managerNav.map((item) => {
                    const isActive = location.pathname === item.href
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={clsx(
                          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-purple-50 text-purple-700'
                            : 'text-purple-600 hover:bg-purple-50'
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
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Recherche rapide (Ctrl+K)"
              >
                <MagnifyingGlassIcon className="w-4 h-4" />
                <span className="hidden lg:inline">Recherche</span>
                <kbd className="hidden lg:inline px-1.5 py-0.5 text-xs bg-white border border-gray-300 rounded">
                  K
                </kbd>
              </button>

              {/* Notifications */}
              <NotificationsDropdown />

              {/* User info */}
              <div className="flex items-center gap-2 text-sm text-gray-600 ml-2">
                <UserCircleIcon className="w-6 h-6" />
                <span className="hidden sm:inline">
                  {user?.firstName} {user?.lastName}
                </span>
                {(user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                    {user?.role === 'ADMIN' ? 'Admin' : 'Manager'}
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Déconnexion"
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
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            ATELIER FORGE v3.0 — HARMONIA GROUP © 2025
          </p>
        </div>
      </footer>
    </div>
  )
}
