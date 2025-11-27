import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  DocumentTextIcon,
  SparklesIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
  UsersIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const periodOptions = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: '1y', label: '1 an' }
]

const formatLabels: Record<string, string> = {
  IN_PERSON: 'Presentiel',
  REMOTE_SYNC: 'Distanciel sync.',
  REMOTE_ASYNC: 'Distanciel async.',
  HYBRID: 'Hybride'
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Brouillon',
  PENDING_VALIDATION: 'En validation',
  NEEDS_CHANGES: 'Modifications',
  APPROVED: 'Approuve',
  REJECTED: 'Rejete',
  PUBLISHED: 'Publie'
}

export default function Analytics() {
  const user = useAuthStore((s) => s.user)
  const isManager = user?.role === 'MANAGER' || user?.role === 'ADMIN'

  const [activityPeriod, setActivityPeriod] = useState('30d')

  // Fetch all analytics data
  const { data: overviewData, isLoading: loadingOverview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => analyticsApi.overview()
  })

  const { data: activityData } = useQuery({
    queryKey: ['analytics-activity', activityPeriod],
    queryFn: () => analyticsApi.activity(activityPeriod)
  })

  const { data: competenciesData } = useQuery({
    queryKey: ['analytics-competencies'],
    queryFn: () => analyticsApi.competencies()
  })

  const { data: formatsData } = useQuery({
    queryKey: ['analytics-formats'],
    queryFn: () => analyticsApi.formats()
  })

  const { data: qualityData } = useQuery({
    queryKey: ['analytics-quality'],
    queryFn: () => analyticsApi.quality()
  })

  const { data: teamData } = useQuery({
    queryKey: ['analytics-team'],
    queryFn: () => analyticsApi.team(),
    enabled: isManager
  })

  const overview = overviewData?.data?.data
  const activity = activityData?.data?.data?.activity || []
  const competencies = competenciesData?.data?.data
  const formats = formatsData?.data?.data
  const quality = qualityData?.data?.data
  const team = teamData?.data?.data?.team || []

  const handleExport = async () => {
    try {
      const response = await analyticsApi.export()
      const dataStr = JSON.stringify(response.data.data, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `analytics_export_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Export error:', error)
    }
  }

  if (loadingOverview) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  // Calculate max value for activity chart
  const maxActivity = Math.max(...activity.map((a: any) => a.count), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord analytique</h1>
          <p className="text-gray-600">
            Vue d'ensemble de {isManager ? "l'activite de l'equipe" : 'votre activite'}
          </p>
        </div>
        <button onClick={handleExport} className="btn-secondary">
          <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
          Exporter les donnees
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <DocumentTextIcon className="w-8 h-8 text-primary-500" />
            {overview?.growthRate !== undefined && (
              <div className={clsx(
                'flex items-center gap-1 text-sm font-medium',
                overview.growthRate >= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {overview.growthRate >= 0 ? (
                  <ArrowTrendingUpIcon className="w-4 h-4" />
                ) : (
                  <ArrowTrendingDownIcon className="w-4 h-4" />
                )}
                {Math.abs(overview.growthRate)}%
              </div>
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900">{overview?.totalSheets || 0}</p>
          <p className="text-sm text-gray-500">Fiches totales</p>
          <p className="text-xs text-gray-400 mt-1">
            {overview?.sheetsThisMonth || 0} ce mois-ci
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <SparklesIcon className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{overview?.generationsThisMonth || 0}</p>
          <p className="text-sm text-gray-500">Generations IA ce mois</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{overview?.avgConfidenceScore || 0}%</p>
          <p className="text-sm text-gray-500">Score moyen de confiance</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <DocumentDuplicateIcon className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{overview?.templatesCreated || 0}</p>
          <p className="text-sm text-gray-500">Templates crees</p>
        </div>
      </div>

      {/* Activity Chart & Status Distribution */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-gray-400" />
              Activite de creation
            </h2>
            <select
              className="input !py-1 !w-auto text-sm"
              value={activityPeriod}
              onChange={(e) => setActivityPeriod(e.target.value)}
            >
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Simple bar chart */}
          <div className="h-48 flex items-end gap-1">
            {activity.slice(-30).map((item: any, index: number) => (
              <div
                key={index}
                className="flex-1 group relative"
              >
                <div
                  className="bg-primary-500 rounded-t hover:bg-primary-600 transition-colors"
                  style={{ height: `${(item.count / maxActivity) * 100}%`, minHeight: item.count > 0 ? '4px' : '0' }}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  {new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}: {item.count}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>{activity[0]?.date ? new Date(activity[0].date).toLocaleDateString('fr-FR') : ''}</span>
            <span>Aujourd'hui</span>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-gray-400" />
            Distribution par statut
          </h2>
          <div className="space-y-3">
            {overview?.statusDistribution?.map((item: any) => {
              const total = overview.totalSheets || 1
              const percentage = Math.round((item.count / total) * 100)
              return (
                <div key={item.status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{statusLabels[item.status] || item.status}</span>
                    <span className="font-medium text-gray-900">{item.count}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full',
                        item.status === 'APPROVED' ? 'bg-green-500' :
                        item.status === 'DRAFT' ? 'bg-gray-400' :
                        item.status === 'PENDING_VALIDATION' ? 'bg-blue-500' :
                        item.status === 'REJECTED' ? 'bg-red-500' :
                        'bg-orange-500'
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Quality & Formats */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Quality Distribution */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Qualite des fiches</h2>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Taux d'approbation</span>
              <span className="text-2xl font-bold text-green-600">{quality?.approvalRate || 0}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${quality?.approvalRate || 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {quality?.validatedCount || 0} approuvees sur {quality?.submittedCount || 0} soumises
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 mb-2">Distribution des scores de confiance</p>
            {quality?.confidenceDistribution?.map((item: any) => {
              const total = quality.confidenceDistribution.reduce((acc: number, i: any) => acc + i.count, 0) || 1
              const percentage = Math.round((item.count / total) * 100)
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-gray-600 flex-1">{item.label}</span>
                  <span className="text-sm font-medium">{item.count}</span>
                  <span className="text-xs text-gray-400 w-12 text-right">{percentage}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Formats & Sectors */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Formats et secteurs</h2>

          {/* Formats */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Par format</p>
            <div className="grid grid-cols-2 gap-2">
              {formats?.formats?.map((item: any) => (
                <div key={item.format} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-gray-900">{item.count}</p>
                  <p className="text-xs text-gray-500">{formatLabels[item.format] || item.format}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Duration stats */}
          {formats?.duration && (
            <div className="mb-6 p-4 bg-primary-50 rounded-lg">
              <p className="text-sm font-medium text-primary-700 mb-2">Duree moyenne</p>
              <p className="text-2xl font-bold text-primary-600">{formats.duration.avg} min</p>
              <p className="text-xs text-primary-500">
                Min: {formats.duration.min} min / Max: {formats.duration.max} min
              </p>
            </div>
          )}

          {/* Top Sectors */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Top secteurs</p>
            <div className="space-y-2">
              {formats?.sectors?.slice(0, 5).map((item: any, index: number) => (
                <div key={item.sector} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">{index + 1}.</span>
                  <span className="text-sm text-gray-600 flex-1 truncate">{item.sector}</span>
                  <span className="text-sm font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Competencies */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Competences les plus traitees</h2>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top Competencies */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Top 10 competences</p>
            <div className="space-y-2">
              {competencies?.topCompetencies?.map((item: any, index: number) => {
                const maxCount = competencies.topCompetencies[0]?.count || 1
                const percentage = Math.round((item.count / maxCount) * 100)
                return (
                  <div key={item.competencyId}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                        {item.code}
                      </span>
                      <span className="text-sm text-gray-600 flex-1 truncate">{item.title}</span>
                      <span className="text-sm font-medium">{item.count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* By Axis */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Par axe de competence</p>
            <div className="space-y-3">
              {competencies?.byAxis?.map((item: any) => {
                const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500']
                const colorIndex = Math.abs(item.axis.charCodeAt(0)) % colors.length
                return (
                  <div key={item.axis} className="flex items-center gap-3">
                    <div className={clsx('w-4 h-4 rounded', colors[colorIndex])} />
                    <span className="text-sm text-gray-600 flex-1">{item.axis}</span>
                    <span className="text-sm font-bold text-gray-900">{item.count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Team Performance (Managers only) */}
      {isManager && team.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-gray-400" />
            Performance de l'equipe
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3 font-medium">Consultant</th>
                  <th className="pb-3 font-medium text-center">Fiches</th>
                  <th className="pb-3 font-medium text-center">Score moyen</th>
                  <th className="pb-3 font-medium text-center">Approuvees</th>
                  <th className="pb-3 font-medium text-center">En attente</th>
                  <th className="pb-3 font-medium text-right">Derniere activite</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {team.map((member: any) => (
                  <tr key={member.id} className="text-sm">
                    <td className="py-3">
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </td>
                    <td className="py-3 text-center font-medium">{member.totalSheets}</td>
                    <td className="py-3 text-center">
                      <span className={clsx(
                        'font-medium',
                        member.avgScore >= 85 ? 'text-green-600' :
                        member.avgScore >= 70 ? 'text-yellow-600' : 'text-red-600'
                      )}>
                        {member.avgScore}%
                      </span>
                    </td>
                    <td className="py-3 text-center text-green-600 font-medium">{member.approvedSheets}</td>
                    <td className="py-3 text-center text-blue-600">{member.pendingValidation}</td>
                    <td className="py-3 text-right text-gray-500">
                      {member.lastActivity
                        ? new Date(member.lastActivity).toLocaleDateString('fr-FR')
                        : 'Aucune'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
