import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { sheetsApi, dashboardApi } from '../lib/api'
import {
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ArchiveBoxIcon,
  FunnelIcon,
  PlusIcon,
  DocumentDuplicateIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const statusFilters = [
  { id: '', label: 'Tous les statuts', icon: DocumentTextIcon },
  { id: 'DRAFT', label: 'Brouillons', icon: ClockIcon },
  { id: 'PENDING_VALIDATION', label: 'En validation', icon: ClockIcon },
  { id: 'VALIDATED', label: 'Validées', icon: CheckCircleIcon },
  { id: 'ARCHIVED', label: 'Archivées', icon: ArchiveBoxIcon }
]

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const statusFilter = searchParams.get('status') || ''
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch sheets
  const { data: sheetsData, isLoading } = useQuery({
    queryKey: ['sheets', statusFilter],
    queryFn: () => sheetsApi.list({ status: statusFilter || undefined, limit: 50 })
  })

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.stats()
  })

  const sheets = sheetsData?.data?.data?.sheets || []
  const stats = statsData?.data?.data

  // Duplicate sheet
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => sheetsApi.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets'] })
      toast.success('Fiche dupliquée !')
    }
  })

  // Delete sheet
  const deleteMutation = useMutation({
    mutationFn: (id: string) => sheetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets'] })
      toast.success('Fiche supprimée')
    }
  })

  const filteredSheets = sheets.filter((sheet: any) =>
    sheet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sheet.competency?.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; class: string; icon: any }> = {
      DRAFT: {
        label: 'Brouillon',
        class: 'text-yellow-600 bg-yellow-50',
        icon: ClockIcon
      },
      PENDING_VALIDATION: {
        label: 'En validation',
        class: 'text-blue-600 bg-blue-50',
        icon: ClockIcon
      },
      VALIDATED: {
        label: 'Validée',
        class: 'text-green-600 bg-green-50',
        icon: CheckCircleIcon
      },
      ARCHIVED: {
        label: 'Archivée',
        class: 'text-gray-600 bg-gray-100',
        icon: ArchiveBoxIcon
      }
    }
    return configs[status] || configs.DRAFT
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes fiches</h1>
          <p className="text-gray-600">
            {stats?.overview?.totalSheets || 0} fiche(s) au total
          </p>
        </div>
        <Link to="/create" className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          Nouvelle fiche
        </Link>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card !p-4">
            <p className="text-2xl font-bold text-primary-600">
              {stats.overview.sheetsThisMonth}
            </p>
            <p className="text-sm text-gray-500">Fiches ce mois</p>
          </div>
          <div className="card !p-4">
            <p className="text-2xl font-bold text-green-600">
              {stats.overview.timeSavedFormatted}
            </p>
            <p className="text-sm text-gray-500">Temps économisé</p>
          </div>
          <div className="card !p-4">
            <p className="text-2xl font-bold text-purple-600">
              {stats.overview.avgConfidenceScore}%
            </p>
            <p className="text-sm text-gray-500">Score moyen</p>
          </div>
          <div className="card !p-4">
            <p className="text-2xl font-bold text-orange-600">
              {stats.overview.avgFeedbackRating || '—'}
            </p>
            <p className="text-sm text-gray-500">Note moyenne</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card !p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Status filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <div className="flex gap-1">
              {statusFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => {
                    if (filter.id) {
                      setSearchParams({ status: filter.id })
                    } else {
                      setSearchParams({})
                    }
                  }}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-lg transition-colors',
                    statusFilter === filter.id
                      ? 'bg-primary-100 text-primary-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Rechercher..."
            className="input !py-1.5 w-64 ml-auto"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Sheets list */}
      <div className="card !p-0 divide-y">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : filteredSheets.length === 0 ? (
          <div className="p-8 text-center">
            <DocumentTextIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Aucune fiche trouvée</p>
            {statusFilter && (
              <button
                onClick={() => setSearchParams({})}
                className="text-primary-600 hover:underline text-sm mt-2"
              >
                Voir toutes les fiches
              </button>
            )}
          </div>
        ) : (
          filteredSheets.map((sheet: any) => {
            const status = getStatusConfig(sheet.status)
            const StatusIcon = status.icon

            return (
              <div
                key={sheet.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <Link to={`/sheet/${sheet.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className={clsx('p-2 rounded-lg', status.class)}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {sheet.competency?.code} — {sheet.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {status.label} • Modifié{' '}
                        {new Date(sheet.updatedAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </p>
                    </div>
                  </div>
                </Link>

                {/* Confidence score */}
                {sheet.confidenceScore > 0 && (
                  <div className="flex items-center gap-2 mx-4">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full',
                          sheet.confidenceScore >= 85
                            ? 'bg-green-500'
                            : sheet.confidenceScore >= 70
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        )}
                        style={{ width: `${sheet.confidenceScore}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-10">
                      {sheet.confidenceScore}%
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      duplicateMutation.mutate(sheet.id)
                    }}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Dupliquer"
                    disabled={duplicateMutation.isPending}
                  >
                    <DocumentDuplicateIcon className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      if (confirm('Supprimer cette fiche ?')) {
                        deleteMutation.mutate(sheet.id)
                      }
                    }}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Supprimer"
                    disabled={deleteMutation.isPending}
                  >
                    <TrashIcon className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
