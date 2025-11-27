import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../lib/api'
import {
  BellIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowsRightLeftIcon,
  ChatBubbleLeftIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import { BellIcon as BellIconSolid } from '@heroicons/react/24/solid'
import clsx from 'clsx'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data: any
  isRead: boolean
  createdAt: string
}

const notificationIcons: Record<string, any> = {
  VALIDATION_REQUESTED: ExclamationTriangleIcon,
  VALIDATION_APPROVED: CheckCircleIcon,
  VALIDATION_REJECTED: XCircleIcon,
  VALIDATION_NEEDS_CHANGES: ChatBubbleLeftIcon,
  SHEET_REMIXED: ArrowsRightLeftIcon,
  COMMENT_ADDED: ChatBubbleLeftIcon
}

const notificationColors: Record<string, string> = {
  VALIDATION_REQUESTED: 'text-blue-500 bg-blue-50',
  VALIDATION_APPROVED: 'text-green-500 bg-green-50',
  VALIDATION_REJECTED: 'text-red-500 bg-red-50',
  VALIDATION_NEEDS_CHANGES: 'text-orange-500 bg-orange-50',
  SHEET_REMIXED: 'text-purple-500 bg-purple-50',
  COMMENT_ADDED: 'text-gray-500 bg-gray-50'
}

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Fetch notifications
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 10 }),
    refetchInterval: 30000 // Poll every 30 seconds
  })

  const notifications: Notification[] = data?.data?.data?.notifications || []
  const unreadCount: number = data?.data?.data?.unreadCount || 0

  // Mark notification as read
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id)
    }
    setIsOpen(false)
  }

  const getNotificationLink = (notification: Notification): string => {
    const data = notification.data || {}
    if (data.sheetId) {
      return `/sheet/${data.sheetId}`
    }
    if (data.newSheetId) {
      return `/sheet/${data.newSheetId}`
    }
    return '#'
  }

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "A l'instant"
    if (diffMins < 60) return `Il y a ${diffMins}min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        {unreadCount > 0 ? (
          <BellIconSolid className="w-6 h-6 text-primary-600" />
        ) : (
          <BellIcon className="w-6 h-6 text-gray-500" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                disabled={markAllReadMutation.isPending}
              >
                <CheckIcon className="w-4 h-4" />
                Tout marquer lu
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <BellIcon className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">Aucune notification</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = notificationIcons[notification.type] || BellIcon
                const colorClass = notificationColors[notification.type] || 'text-gray-500 bg-gray-50'

                return (
                  <Link
                    key={notification.id}
                    to={getNotificationLink(notification)}
                    onClick={() => handleNotificationClick(notification)}
                    className={clsx(
                      'block px-4 py-3 hover:bg-gray-50 transition-colors border-b last:border-b-0',
                      !notification.isRead && 'bg-primary-50/50'
                    )}
                  >
                    <div className="flex gap-3">
                      <div className={clsx('p-2 rounded-lg shrink-0', colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={clsx(
                          'text-sm',
                          !notification.isRead ? 'font-medium text-gray-900' : 'text-gray-700'
                        )}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimeAgo(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <div className="w-2 h-2 rounded-full bg-primary-500 mt-2 shrink-0" />
                      )}
                    </div>
                  </Link>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t bg-gray-50">
              <button
                onClick={() => setIsOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-700 w-full text-center"
              >
                Voir toutes les notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
