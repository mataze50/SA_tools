import api from './api'

export interface SearchFilters {
  q?: string
  status?: string
  format?: string
  sector?: string
  competencyCode?: string
  competencyAxis?: string
  minConfidence?: number
  maxConfidence?: number
  dateFrom?: string
  dateTo?: string
  hasQuiz?: boolean
  sortBy?: 'relevance' | 'date' | 'title' | 'confidence'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface SearchResult {
  id: string
  title: string
  status: string
  format: string
  sector: string
  audienceType: string
  confidenceScore: number
  createdAt: string
  updatedAt: string
  hasQuiz: boolean
  feedbackCount: number
  versionCount: number
  competency: {
    code: string
    title: string
    axis: string
    axisName: string
  }
  user: {
    firstName: string
    lastName: string
  }
}

export interface SearchAggregations {
  statuses: { value: string; count: number }[]
  formats: { value: string; count: number }[]
  axes: { value: string; name: string; count: number }[]
  sectors: string[]
}

export interface SearchResponse {
  results: SearchResult[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  aggregations: SearchAggregations
}

export interface SearchSuggestion {
  type: 'sheet' | 'competency'
  id: string
  title: string
  subtitle: string
}

export const searchApi = {
  search: (filters: SearchFilters) =>
    api.get<{ success: boolean; data: SearchResponse }>('/search', { params: filters }),

  suggestions: (query: string) =>
    api.get<{ success: boolean; data: { suggestions: SearchSuggestion[] } }>('/search/suggestions', {
      params: { q: query }
    }),

  recent: () =>
    api.get<{
      success: boolean
      data: {
        recentSheets: {
          id: string
          title: string
          updatedAt: string
          competency: { code: string }
        }[]
      }
    }>('/search/recent')
}
