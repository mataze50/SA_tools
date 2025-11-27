import api from './api'

export interface AdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'USER' | 'MANAGER' | 'ADMIN'
  sector?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  sheetsCount?: number
}

export interface AdminSheet {
  id: string
  title: string
  status: string
  sector: string
  format: string
  createdAt: string
  updatedAt: string
  user: {
    firstName: string
    lastName: string
    email: string
  }
  competency: {
    code: string
    title: string
  }
}

export interface AdminTemplate {
  id: string
  name: string
  description: string
  type: string
  isPublic: boolean
  isFeatured?: boolean
  usageCount: number
  createdAt: string
  user: {
    firstName: string
    lastName: string
  }
}

export interface AuditLog {
  id: string
  userId: string
  userEmail?: string
  action: string
  details: any
  timestamp: string
}

export interface SystemSettings {
  siteName: string
  maxSheetsPerUser: number
  maxTemplatesPerUser: number
  defaultSheetFormat: string
  enablePublicSharing: boolean
  enableScormExport: boolean
  aiModelVersion: string
  maintenanceMode: boolean
  maintenanceMessage: string
  allowRegistration: boolean
  requireEmailVerification: boolean
  sessionTimeout: number
  maxFileUploadSize: number
}

export interface DashboardStats {
  totalUsers: number
  activeUsers: number
  newUsersThisMonth: number
  totalSheets: number
  sheetsThisMonth: number
  pendingValidations: number
  totalTemplates: number
}

export interface GrowthStat {
  date: string
  users: number
  sheets: number
}

export const adminApi = {
  // Dashboard
  getDashboard: () =>
    api.get<{
      success: boolean
      data: {
        stats: DashboardStats
        usersByRole: { role: string; count: number }[]
        recentActivity: any[]
      }
    }>('/admin/dashboard'),

  // Users
  getUsers: (params?: {
    search?: string
    role?: string
    status?: string
    sortBy?: string
    sortOrder?: string
    limit?: number
    offset?: number
  }) =>
    api.get<{
      success: boolean
      data: {
        users: AdminUser[]
        pagination: { total: number; limit: number; offset: number; hasMore: boolean }
      }
    }>('/admin/users', { params }),

  getUser: (id: string) =>
    api.get<{ success: boolean; data: { user: AdminUser & { sheets: any[] } } }>(`/admin/users/${id}`),

  createUser: (data: {
    email: string
    password: string
    firstName: string
    lastName: string
    role?: string
    sector?: string
  }) => api.post<{ success: boolean; data: { user: AdminUser } }>('/admin/users', data),

  updateUser: (id: string, data: Partial<{
    firstName: string
    lastName: string
    role: string
    sector: string
    isActive: boolean
  }>) => api.patch<{ success: boolean; data: { user: AdminUser } }>(`/admin/users/${id}`, data),

  resetPassword: (id: string, newPassword: string) =>
    api.post(`/admin/users/${id}/reset-password`, { newPassword }),

  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),

  // Settings
  getSettings: () =>
    api.get<{ success: boolean; data: { settings: SystemSettings } }>('/admin/settings'),

  updateSettings: (settings: Partial<SystemSettings>) =>
    api.patch<{ success: boolean; data: { settings: SystemSettings } }>('/admin/settings', settings),

  // Audit Logs
  getAuditLogs: (params?: { action?: string; userId?: string; limit?: number; offset?: number }) =>
    api.get<{
      success: boolean
      data: { logs: AuditLog[]; pagination: { total: number; limit: number; offset: number } }
    }>('/admin/audit-logs', { params }),

  // Sheets (admin view)
  getSheets: (params?: {
    search?: string
    status?: string
    userId?: string
    sortBy?: string
    sortOrder?: string
    limit?: number
    offset?: number
  }) =>
    api.get<{
      success: boolean
      data: { sheets: AdminSheet[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }
    }>('/admin/sheets', { params }),

  deleteSheet: (id: string) => api.delete(`/admin/sheets/${id}`),

  // Templates (admin view)
  getTemplates: (params?: { search?: string; isPublic?: boolean; limit?: number; offset?: number }) =>
    api.get<{
      success: boolean
      data: { templates: AdminTemplate[]; pagination: { total: number; limit: number; offset: number } }
    }>('/admin/templates', { params }),

  updateTemplate: (id: string, data: { isPublic?: boolean; isFeatured?: boolean }) =>
    api.patch(`/admin/templates/${id}`, data),

  // Competencies
  createCompetency: (data: {
    code: string
    title: string
    axis: string
    axisName: string
    description?: string
    keywords?: string[]
  }) => api.post('/admin/competencies', data),

  updateCompetency: (id: string, data: { title?: string; description?: string; keywords?: string[] }) =>
    api.patch(`/admin/competencies/${id}`, data),

  // Stats
  getGrowthStats: (period?: number) =>
    api.get<{ success: boolean; data: { stats: GrowthStat[] } }>('/admin/stats/growth', {
      params: { period }
    })
}
