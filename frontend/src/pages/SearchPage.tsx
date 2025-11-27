import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  DocumentTextIcon,
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  CheckIcon,
  ClockIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { searchApi, SearchFilters, SearchResult } from '../lib/searchApi'
import { debounce } from '../lib/utils'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  IN_REVIEW: 'En revision',
  VALIDATED: 'Validee',
  ARCHIVED: 'Archivee'
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_REVIEW: 'bg-amber-100 text-amber-700',
  VALIDATED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-slate-100 text-slate-700'
}

const FORMAT_LABELS: Record<string, string> = {
  PRESENTIEL: 'Presentiel',
  DISTANCIEL: 'Distanciel',
  HYBRIDE: 'Hybride',
  ELEARNING: 'E-learning'
}

const SORT_OPTIONS = [
  { value: 'date', label: 'Date de modification' },
  { value: 'title', label: 'Titre' },
  { value: 'confidence', label: 'Score de confiance' },
  { value: 'relevance', label: 'Pertinence' }
]

export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')

  // Filters from URL
  const filters: SearchFilters = {
    q: searchParams.get('q') || undefined,
    status: searchParams.get('status') || undefined,
    format: searchParams.get('format') || undefined,
    sector: searchParams.get('sector') || undefined,
    competencyAxis: searchParams.get('competencyAxis') || undefined,
    hasQuiz: searchParams.get('hasQuiz') === 'true' ? true : searchParams.get('hasQuiz') === 'false' ? false : undefined,
    sortBy: (searchParams.get('sortBy') as SearchFilters['sortBy']) || 'date',
    sortOrder: (searchParams.get('sortOrder') as SearchFilters['sortOrder']) || 'desc',
    limit: 20,
    offset: parseInt(searchParams.get('offset') || '0')
  }

  // Search query
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', filters],
    queryFn: () => searchApi.search(filters),
    keepPreviousData: true
  })

  const results = data?.data?.data?.results || []
  const pagination = data?.data?.data?.pagination
  const aggregations = data?.data?.data?.aggregations

  // Suggestions query
  const [showSuggestions, setShowSuggestions] = useState(false)
  const { data: suggestionsData } = useQuery({
    queryKey: ['search-suggestions', searchInput],
    queryFn: () => searchApi.suggestions(searchInput),
    enabled: searchInput.length >= 2 && showSuggestions
  })

  const suggestions = suggestionsData?.data?.data?.suggestions || []

  // Recent sheets
  const { data: recentData } = useQuery({
    queryKey: ['recent-sheets'],
    queryFn: () => searchApi.recent()
  })

  const recentSheets = recentData?.data?.data?.recentSheets || []

  // Update URL params
  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    const params = new URLSearchParams(searchParams)
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        params.set(key, String(value))
      } else {
        params.delete(key)
      }
    })
    // Reset offset when filters change (except when paginating)
    if (!('offset' in newFilters)) {
      params.delete('offset')
    }
    setSearchParams(params)
  }, [searchParams, setSearchParams])

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      updateFilters({ q: value || undefined })
    }, 300),
    [updateFilters]
  )

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    setShowSuggestions(value.length >= 2)
    debouncedSearch(value)
  }

  const handleSuggestionClick = (suggestion: { type: string; id: string }) => {
    setShowSuggestions(false)
    if (suggestion.type === 'sheet') {
      navigate(`/sheet/${suggestion.id}`)
    } else {
      updateFilters({ competencyCode: suggestion.id, q: undefined })
      setSearchInput('')
    }
  }

  const clearFilters = () => {
    setSearchParams(new URLSearchParams())
    setSearchInput('')
  }

  const activeFilterCount = [
    filters.status,
    filters.format,
    filters.sector,
    filters.competencyAxis,
    filters.hasQuiz !== undefined
  ].filter(Boolean).length

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(dateStr))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Recherche avancee</h1>
          <p className="text-gray-500 mt-1">
            Recherchez parmi vos fiches pedagogiques
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setShowSuggestions(searchInput.length >= 2)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Rechercher par titre, secteur, competence..."
              className="w-full pl-12 pr-12 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {(searchInput || isFetching) && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                {isFetching ? (
                  <ArrowPathIcon className="w-5 h-5 text-gray-400 animate-spin" />
                ) : (
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                )}
              </button>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-lg border overflow-hidden">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.type}-${suggestion.id}-${index}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-0"
                >
                  {suggestion.type === 'sheet' ? (
                    <DocumentTextIcon className="w-5 h-5 text-primary-500" />
                  ) : (
                    <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-amber-600 bg-amber-100 rounded">
                      C
                    </span>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{suggestion.title}</p>
                    <p className="text-sm text-gray-500">{suggestion.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters Toggle & Sort */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
              showFilters || activeFilterCount > 0
                ? 'bg-primary-50 border-primary-200 text-primary-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            <FunnelIcon className="w-5 h-5" />
            <span>Filtres</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-primary-600 text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-4">
            {/* Sort */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Trier par:</label>
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilters({ sortBy: e.target.value as SearchFilters['sortBy'] })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => updateFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <AdjustmentsHorizontalIcon className={clsx(
                  'w-5 h-5 text-gray-500 transition-transform',
                  filters.sortOrder === 'asc' && 'rotate-180'
                )} />
              </button>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Effacer tout
              </button>
            )}
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && aggregations && (
          <div className="bg-white rounded-xl border p-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
              <div className="space-y-2">
                {aggregations.statuses.map(status => (
                  <label
                    key={status.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="status"
                      checked={filters.status === status.value}
                      onChange={() => updateFilters({
                        status: filters.status === status.value ? undefined : status.value
                      })}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600">
                      {STATUS_LABELS[status.value] || status.value}
                    </span>
                    <span className="text-xs text-gray-400">({status.count})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Format Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
              <div className="space-y-2">
                {aggregations.formats.map(format => (
                  <label
                    key={format.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="format"
                      checked={filters.format === format.value}
                      onChange={() => updateFilters({
                        format: filters.format === format.value ? undefined : format.value
                      })}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600">
                      {FORMAT_LABELS[format.value] || format.value}
                    </span>
                    <span className="text-xs text-gray-400">({format.count})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Axis Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Axe de competence</label>
              <div className="space-y-2">
                {aggregations.axes.map(axis => (
                  <label
                    key={axis.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="axis"
                      checked={filters.competencyAxis === axis.value}
                      onChange={() => updateFilters({
                        competencyAxis: filters.competencyAxis === axis.value ? undefined : axis.value
                      })}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600 truncate" title={axis.name}>
                      {axis.name}
                    </span>
                    <span className="text-xs text-gray-400">({axis.count})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Other Filters */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasQuiz === true}
                    onChange={() => updateFilters({
                      hasQuiz: filters.hasQuiz === true ? undefined : true
                    })}
                    className="text-primary-600 focus:ring-primary-500 rounded"
                  />
                  <span className="text-sm text-gray-600">Avec quiz</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasQuiz === false}
                    onChange={() => updateFilters({
                      hasQuiz: filters.hasQuiz === false ? undefined : false
                    })}
                    className="text-primary-600 focus:ring-primary-500 rounded"
                  />
                  <span className="text-sm text-gray-600">Sans quiz</span>
                </label>
              </div>

              {/* Sector Select */}
              {aggregations.sectors.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Secteur</label>
                  <select
                    value={filters.sector || ''}
                    onChange={(e) => updateFilters({ sector: e.target.value || undefined })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Tous les secteurs</option>
                    {aggregations.sectors.map(sector => (
                      <option key={sector} value={sector}>{sector}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex gap-8">
          {/* Main Results */}
          <div className="flex-1">
            {isLoading ? (
              <div className="bg-white rounded-xl border p-12 flex items-center justify-center">
                <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : results.length === 0 ? (
              <div className="bg-white rounded-xl border p-12 text-center">
                <MagnifyingGlassIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun resultat</h3>
                <p className="text-gray-500">
                  {filters.q
                    ? `Aucune fiche ne correspond a "${filters.q}"`
                    : 'Aucune fiche ne correspond aux filtres selectionnes'}
                </p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Effacer les filtres
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  {pagination?.total} resultat{pagination && pagination.total > 1 ? 's' : ''} trouve{pagination && pagination.total > 1 ? 's' : ''}
                </p>

                <div className="space-y-4">
                  {results.map((result: SearchResult) => (
                    <div
                      key={result.id}
                      onClick={() => navigate(`/sheet/${result.id}`)}
                      className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">{result.title}</h3>
                          <p className="text-sm text-gray-500">
                            {result.competency.code} - {result.competency.title}
                          </p>
                        </div>
                        <span className={clsx(
                          'px-2 py-1 text-xs font-medium rounded',
                          STATUS_COLORS[result.status]
                        )}>
                          {STATUS_LABELS[result.status]}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <DocumentTextIcon className="w-4 h-4" />
                          {FORMAT_LABELS[result.format] || result.format}
                        </span>
                        <span>{result.sector}</span>
                        {result.hasQuiz && (
                          <span className="flex items-center gap-1 text-primary-600">
                            <QuestionMarkCircleIcon className="w-4 h-4" />
                            Quiz
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          {formatDate(result.updatedAt)}
                        </span>
                        {result.confidenceScore > 0 && (
                          <span className="ml-auto text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                            {result.confidenceScore}% confiance
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.hasMore && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => updateFilters({ offset: (filters.offset || 0) + (filters.limit || 20) })}
                      disabled={isFetching}
                      className="btn-secondary"
                    >
                      {isFetching ? (
                        <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" />
                      ) : null}
                      Charger plus de resultats
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar - Recent Sheets */}
          {!filters.q && recentSheets.length > 0 && (
            <div className="hidden lg:block w-64">
              <div className="bg-white rounded-xl border p-4 sticky top-4">
                <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <ClockIcon className="w-5 h-5 text-gray-400" />
                  Fiches recentes
                </h3>
                <div className="space-y-3">
                  {recentSheets.map((sheet) => (
                    <button
                      key={sheet.id}
                      onClick={() => navigate(`/sheet/${sheet.id}`)}
                      className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{sheet.title}</p>
                      <p className="text-xs text-gray-500">
                        {sheet.competency.code} - {formatDate(sheet.updatedAt)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
