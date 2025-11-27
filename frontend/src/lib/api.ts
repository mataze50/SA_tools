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
    api.get(`/export/quiz/${sheetId}`, { responseType: 'blob' })
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

export default api
