/**
 * Admin Dashboard Page
 * Sprint 12 - ATELIER FORGE
 */

import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  UsersIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  ClockIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { adminApi, AdminUser, SystemSettings } from '../lib/adminApi'
import { useAuthStore } from '../stores/auth'

type TabId = 'overview' | 'users' | 'content' | 'settings' | 'logs'

const ROLE_LABELS: Record<string, string> = {
  USER: 'Utilisateur',
  MANAGER: 'Manager',
  ADMIN: 'Administrateur'
}

const ROLE_COLORS: Record<string, string> = {
  USER: 'bg-gray-100 text-gray-700',
  MANAGER: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-red-100 text-red-700'
}

export default function AdminDashboard() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Role verification - only ADMIN can access
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />
  }
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('')
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'USER',
    sector: ''
  })

  // Fetch dashboard data
  const { data: dashboardData, isLoading: loadingDashboard } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminApi.getDashboard(),
    enabled: activeTab === 'overview'
  })

  const stats = dashboardData?.data?.data?.stats
  const usersByRole = dashboardData?.data?.data?.usersByRole || []
  const recentActivity = dashboardData?.data?.data?.recentActivity || []

  // Fetch users
  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users', userSearch, userRoleFilter],
    queryFn: () => adminApi.getUsers({
      search: userSearch || undefined,
      role: userRoleFilter || undefined,
      limit: 50
    }),
    enabled: activeTab === 'users'
  })

  const users = usersData?.data?.data?.users || []

  // Fetch settings
  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.getSettings(),
    enabled: activeTab === 'settings'
  })

  const settings = settingsData?.data?.data?.settings

  // Fetch audit logs
  const { data: logsData, isLoading: loadingLogs } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => adminApi.getAuditLogs({ limit: 100 }),
    enabled: activeTab === 'logs'
  })

  const logs = logsData?.data?.data?.logs || []

  // Fetch growth stats
  const { data: growthData } = useQuery({
    queryKey: ['admin-growth'],
    queryFn: () => adminApi.getGrowthStats(30),
    enabled: activeTab === 'overview'
  })

  const growthStats = growthData?.data?.data?.stats || []

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (data: typeof newUserForm) => adminApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Utilisateur cree avec succes')
      setShowUserModal(false)
      setNewUserForm({ email: '', password: '', firstName: '', lastName: '', role: 'USER', sector: '' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la creation')
    }
  })

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Utilisateur mis a jour')
      setEditingUser(null)
    },
    onError: () => {
      toast.error('Erreur lors de la mise a jour')
    }
  })

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Utilisateur desactive')
    },
    onError: () => {
      toast.error('Erreur lors de la suppression')
    }
  })

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<SystemSettings>) => adminApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      toast.success('Parametres mis a jour')
    },
    onError: () => {
      toast.error('Erreur lors de la mise a jour')
    }
  })

  const handleCreateUser = () => {
    if (!newUserForm.email || !newUserForm.password || !newUserForm.firstName || !newUserForm.lastName) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    createUserMutation.mutate(newUserForm)
  }

  const handleToggleUserActive = (user: AdminUser) => {
    if (confirm(`${user.isActive ? 'Desactiver' : 'Activer'} cet utilisateur?`)) {
      updateUserMutation.mutate({ id: user.id, data: { isActive: !user.isActive } })
    }
  }

  const handleDeleteUser = (user: AdminUser) => {
    if (confirm(`Desactiver l'utilisateur ${user.firstName} ${user.lastName}?`)) {
      deleteUserMutation.mutate(user.id)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateStr))
  }

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: ChartBarIcon },
    { id: 'users', label: 'Utilisateurs', icon: UsersIcon },
    { id: 'content', label: 'Contenu', icon: DocumentTextIcon },
    { id: 'settings', label: 'Parametres', icon: Cog6ToothIcon },
    { id: 'logs', label: 'Journaux', icon: ShieldCheckIcon }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
          <p className="text-gray-500">Gestion du systeme ATELIER FORGE</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg">
          <ShieldCheckIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Mode Admin</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex -mb-px gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {loadingDashboard ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <UsersIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
                      <p className="text-sm text-gray-500">Utilisateurs</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-green-600">
                    +{stats?.newUsersThisMonth || 0} ce mois
                  </p>
                </div>

                <div className="card">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DocumentTextIcon className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats?.totalSheets || 0}</p>
                      <p className="text-sm text-gray-500">Fiches</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-green-600">
                    +{stats?.sheetsThisMonth || 0} ce mois
                  </p>
                </div>

                <div className="card">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <ClockIcon className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats?.pendingValidations || 0}</p>
                      <p className="text-sm text-gray-500">En attente</p>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <DocumentDuplicateIcon className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats?.totalTemplates || 0}</p>
                      <p className="text-sm text-gray-500">Templates</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Users by Role */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Repartition par role</h3>
                <div className="flex gap-4">
                  {usersByRole.map(r => (
                    <div key={r.role} className="flex items-center gap-2">
                      <span className={clsx('px-2 py-1 text-xs font-medium rounded', ROLE_COLORS[r.role])}>
                        {ROLE_LABELS[r.role]}
                      </span>
                      <span className="font-bold text-gray-900">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Activite recente</h3>
                <div className="space-y-3">
                  {recentActivity.slice(0, 5).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <p className="text-sm text-gray-500">
                          {item.user.firstName} {item.user.lastName}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={clsx(
                          'px-2 py-1 text-xs font-medium rounded',
                          item.status === 'VALIDATED' ? 'bg-green-100 text-green-700' :
                          item.status === 'IN_REVIEW' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        )}>
                          {item.status}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(item.updatedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search and Actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Rechercher un utilisateur..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Tous les roles</option>
                <option value="USER">Utilisateur</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <button
              onClick={() => setShowUserModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Nouvel utilisateur
            </button>
          </div>

          {/* Users List */}
          {loadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="card !p-0 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Secteur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fiches</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user: AdminUser) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('px-2 py-1 text-xs font-medium rounded', ROLE_COLORS[user.role])}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.sector || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.sheetsCount || 0}</td>
                      <td className="px-4 py-3">
                        {user.isActive ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircleIcon className="w-4 h-4" /> Actif
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 text-sm">
                            <XCircleIcon className="w-4 h-4" /> Inactif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="p-1 text-gray-500 hover:text-gray-700"
                            title="Modifier"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleUserActive(user)}
                            className="p-1 text-gray-500 hover:text-gray-700"
                            title={user.isActive ? 'Desactiver' : 'Activer'}
                          >
                            {user.isActive ? <XCircleIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-1 text-red-500 hover:text-red-700"
                            title="Supprimer"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {loadingSettings ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : settings && (
            <>
              {/* General Settings */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Parametres generaux</h3>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Nom du site</label>
                      <input
                        type="text"
                        defaultValue={settings.siteName}
                        onBlur={(e) => updateSettingsMutation.mutate({ siteName: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Modele IA</label>
                      <select
                        defaultValue={settings.aiModelVersion}
                        onChange={(e) => updateSettingsMutation.mutate({ aiModelVersion: e.target.value })}
                        className="input"
                      >
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        <option value="claude-3">Claude 3</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Limits */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Limites</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Fiches max par utilisateur</label>
                    <input
                      type="number"
                      defaultValue={settings.maxSheetsPerUser}
                      onBlur={(e) => updateSettingsMutation.mutate({ maxSheetsPerUser: parseInt(e.target.value) })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Templates max par utilisateur</label>
                    <input
                      type="number"
                      defaultValue={settings.maxTemplatesPerUser}
                      onBlur={(e) => updateSettingsMutation.mutate({ maxTemplatesPerUser: parseInt(e.target.value) })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Timeout session (secondes)</label>
                    <input
                      type="number"
                      defaultValue={settings.sessionTimeout}
                      onBlur={(e) => updateSettingsMutation.mutate({ sessionTimeout: parseInt(e.target.value) })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Taille max upload (octets)</label>
                    <input
                      type="number"
                      defaultValue={settings.maxFileUploadSize}
                      onBlur={(e) => updateSettingsMutation.mutate({ maxFileUploadSize: parseInt(e.target.value) })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Fonctionnalites</h3>
                <div className="space-y-4">
                  {[
                    { key: 'enablePublicSharing', label: 'Partage public' },
                    { key: 'enableScormExport', label: 'Export SCORM' },
                    { key: 'allowRegistration', label: 'Inscription ouverte' },
                    { key: 'requireEmailVerification', label: 'Verification email requise' }
                  ].map(setting => (
                    <label key={setting.key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(settings as any)[setting.key]}
                        onChange={(e) => updateSettingsMutation.mutate({ [setting.key]: e.target.checked })}
                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                      />
                      <span className="text-gray-700">{setting.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Maintenance */}
              <div className="card border-amber-200 bg-amber-50">
                <h3 className="font-semibold text-amber-800 mb-4 flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-5 h-5" />
                  Mode maintenance
                </h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.maintenanceMode}
                      onChange={(e) => updateSettingsMutation.mutate({ maintenanceMode: e.target.checked })}
                      className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                    />
                    <span className="text-amber-800 font-medium">Activer le mode maintenance</span>
                  </label>
                  {settings.maintenanceMode && (
                    <div>
                      <label className="label text-amber-800">Message de maintenance</label>
                      <textarea
                        defaultValue={settings.maintenanceMessage}
                        onBlur={(e) => updateSettingsMutation.mutate({ maintenanceMessage: e.target.value })}
                        className="input"
                        rows={2}
                        placeholder="Le site est en maintenance..."
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="card !p-0 overflow-hidden">
          {loadingLogs ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {log.userEmail || log.userId}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {JSON.stringify(log.details).substring(0, 50)}...
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Nouvel utilisateur</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Prenom *</label>
                  <input
                    type="text"
                    value={newUserForm.firstName}
                    onChange={(e) => setNewUserForm({ ...newUserForm, firstName: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Nom *</label>
                  <input
                    type="text"
                    value={newUserForm.lastName}
                    onChange={(e) => setNewUserForm({ ...newUserForm, lastName: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Mot de passe *</label>
                <input
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="input"
                  placeholder="Min. 8 caracteres"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Role</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    className="input"
                  >
                    <option value="USER">Utilisateur</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="label">Secteur</label>
                  <input
                    type="text"
                    value={newUserForm.sector}
                    onChange={(e) => setNewUserForm({ ...newUserForm, sector: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowUserModal(false)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending}
                className="btn-primary flex-1"
              >
                {createUserMutation.isPending ? 'Creation...' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Modifier {editingUser.firstName} {editingUser.lastName}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Prenom</label>
                  <input
                    type="text"
                    defaultValue={editingUser.firstName}
                    onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Nom</label>
                  <input
                    type="text"
                    defaultValue={editingUser.lastName}
                    onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Role</label>
                  <select
                    defaultValue={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    className="input"
                  >
                    <option value="USER">Utilisateur</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="label">Secteur</label>
                  <input
                    type="text"
                    defaultValue={editingUser.sector || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, sector: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingUser(null)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={() => updateUserMutation.mutate({
                  id: editingUser.id,
                  data: {
                    firstName: editingUser.firstName,
                    lastName: editingUser.lastName,
                    role: editingUser.role,
                    sector: editingUser.sector
                  }
                })}
                disabled={updateUserMutation.isPending}
                className="btn-primary flex-1"
              >
                {updateUserMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
