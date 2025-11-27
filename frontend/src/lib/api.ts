import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (data: {
    email: string
    password: string
    firstName: string
    lastName: string
    sector?: string
  }) => api.post('/auth/register', data),

  me: () => api.get('/auth/me'),

  updateProfile: (data: any) => api.patch('/auth/profile', data)
}

// Competencies
export const competenciesApi = {
  list: (params?: { search?: string; axis?: string }) =>
    api.get('/competencies', { params }),

  get: (id: string) => api.get(`/competencies/${id}`),

  getByCode: (code: string) => api.get(`/competencies/code/${code}`)
}

// Sheets
export const sheetsApi = {
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get('/sheets', { params }),

  recent: () => api.get('/sheets/recent'),

  get: (id: string) => api.get(`/sheets/${id}`),

  create: (data: any) => api.post('/sheets', data),

  update: (id: string, data: any) => api.patch(`/sheets/${id}`, data),

  delete: (id: string) => api.delete(`/sheets/${id}`),

  duplicate: (id: string) => api.post(`/sheets/${id}/duplicate`),

  submitValidation: (id: string) => api.post(`/sheets/${id}/submit-validation`),

  versions: (id: string) => api.get(`/sheets/${id}/versions`)
}

// Generation
export const generationApi = {
  start: (data: {
    competencyId: string
    sector: string
    audienceType: string
    format: string
    constraints?: string[]
    priorities?: string[]
    duration?: number
  }) => api.post('/generation/start', data),

  status: (sessionId: string) => api.get(`/generation/${sessionId}/status`),

  createSheet: (sessionId: string, title?: string) =>
    api.post(`/generation/${sessionId}/create-sheet`, { title }),

  regenerateSection: (sheetId: string, section: string, instructions?: string) =>
    api.post('/generation/regenerate-section', { sheetId, section, instructions })
}

// Quiz
export const quizApi = {
  get: (sheetId: string) => api.get(`/quiz/${sheetId}`),

  generate: (sheetId: string) => api.post(`/quiz/generate/${sheetId}`),

  update: (sheetId: string, questions: any[]) =>
    api.patch(`/quiz/${sheetId}`, { questions }),

  delete: (sheetId: string) => api.delete(`/quiz/${sheetId}`)
}

// Export
export const exportApi = {
  docx: (sheetId: string) =>
    api.get(`/export/docx/${sheetId}`, { responseType: 'blob' }),

  json: (sheetId: string) => api.get(`/export/json/${sheetId}`),

  quiz: (sheetId: string) =>
    api.get(`/export/quiz/${sheetId}`, { responseType: 'blob' }),

  html: (sheetId: string) => api.get(`/export/html/${sheetId}`),

  createShare: (sheetId: string) => api.post(`/export/share/${sheetId}`),

  revokeShare: (sheetId: string) => api.delete(`/export/share/${sheetId}`),

  shareStatus: (sheetId: string) => api.get(`/export/share-status/${sheetId}`)
}

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),

  activity: (limit?: number) => api.get('/dashboard/activity', { params: { limit } }),

  competencyDistribution: () => api.get('/dashboard/competency-distribution'),

  submitFeedback: (data: any) => api.post('/dashboard/feedback', data),

  pendingValidations: () => api.get('/dashboard/pending-validations'),

  validate: (sheetId: string, data: { status: string; comments?: string }) =>
    api.post(`/dashboard/validate/${sheetId}`, data)
}

// Validation
export const validationApi = {
  get: (sheetId: string) => api.get(`/validation/${sheetId}`),

  apply: (sheetId: string, data: { suggestionId: string; action: 'accept' | 'modify' | 'ignore'; customValue?: string }) =>
    api.post(`/validation/${sheetId}/apply`, data),

  applyAll: (sheetId: string) => api.post(`/validation/${sheetId}/apply-all`),

  revalidate: (sheetId: string) => api.post(`/validation/${sheetId}/revalidate`)
}

// Conversation (Mode Conversationnel)
export const conversationApi = {
  start: () => api.post('/conversation/start'),

  get: (sessionId: string) => api.get(`/conversation/${sessionId}`),

  answer: (sessionId: string, answer: string) =>
    api.post(`/conversation/${sessionId}/answer`, { answer }),

  generate: (sessionId: string) =>
    api.post(`/conversation/${sessionId}/generate`),

  assist: (sessionId: string, userMessage: string) =>
    api.post(`/conversation/${sessionId}/ai-assist`, { userMessage })
}

// Remix (Mode Remix)
export const remixApi = {
  preview: (sourceSheetId: string, changes: any) =>
    api.post('/remix/preview', { sourceSheetId, changes }),

  create: (sourceSheetId: string, changes: any) =>
    api.post('/remix/create', { sourceSheetId, changes }),

  status: (sessionId: string) => api.get(`/remix/${sessionId}/status`)
}

// Notifications
export const notificationsApi = {
  list: (params?: { unreadOnly?: boolean; limit?: number }) =>
    api.get('/notifications', { params }),

  count: () => api.get('/notifications/count'),

  markRead: (id: string) => api.post(`/notifications/${id}/read`),

  markAllRead: () => api.post('/notifications/read-all')
}

// Manager Dashboard
export const managerApi = {
  pendingValidations: () => dashboardApi.pendingValidations(),

  validate: (sheetId: string, data: { status: 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES'; comments?: string }) =>
    dashboardApi.validate(sheetId, data),

  stats: () => api.get('/dashboard/manager-stats')
}

// Feedback
export const feedbackApi = {
  list: (sheetId: string) => api.get(`/feedback/${sheetId}`),

  summary: (sheetId: string) => api.get(`/feedback/${sheetId}/summary`),

  aiSuggestions: (sheetId: string) => api.post(`/feedback/${sheetId}/ai-suggestions`),

  delete: (feedbackId: string) => api.delete(`/feedback/${feedbackId}`)
}

// Templates
export const templatesApi = {
  list: (params?: { type?: string; isPublic?: boolean }) =>
    api.get('/templates', { params }),

  my: () => api.get('/templates/my'),

  get: (id: string) => api.get(`/templates/${id}`),

  create: (data: any) => api.post('/templates', data),

  createFromSheet: (sheetId: string, data: any) =>
    api.post(`/templates/from-sheet/${sheetId}`, data),

  use: (templateId: string, data: any) =>
    api.post(`/templates/${templateId}/use`, data),

  update: (id: string, data: any) => api.patch(`/templates/${id}`, data),

  delete: (id: string) => api.delete(`/templates/${id}`)
}

// Analytics
export const analyticsApi = {
  overview: () => api.get('/analytics/overview'),

  activity: (period?: string) => api.get('/analytics/activity', { params: { period } }),

  competencies: () => api.get('/analytics/competencies'),

  formats: () => api.get('/analytics/formats'),

  quality: () => api.get('/analytics/quality'),

  team: () => api.get('/analytics/team'),

  export: () => api.get('/analytics/export')
}

export default api
