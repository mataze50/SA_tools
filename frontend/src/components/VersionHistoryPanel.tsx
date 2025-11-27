import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { sheetsApi } from '../lib/api'
import {
  XMarkIcon,
  ClockIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  MinusIcon,
  PencilIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface VersionHistoryPanelProps {
  sheetId: string
  currentVersion: number
  isOpen: boolean
  onClose: () => void
  onRestore?: () => void
}

interface Version {
  id: string
  versionNum: number
  content: any
  changeNote?: string
  createdAt: string
  isCurrent: boolean
}

interface DiffChange {
  section: string
  type: 'added' | 'removed' | 'modified'
  details: string
}

export default function VersionHistoryPanel({
  sheetId,
  currentVersion,
  isOpen,
  onClose,
  onRestore
}: VersionHistoryPanelProps) {
  const queryClient = useQueryClient()
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareWith, setCompareWith] = useState<number | null>(null)

  // Fetch version history
  const { data: versionsData, isLoading } = useQuery({
    queryKey: ['sheet-versions', sheetId],
    queryFn: () => sheetsApi.versions(sheetId),
    enabled: isOpen
  })

  const versions = versionsData?.data?.data?.versions || []
  const canRestore = versionsData?.data?.data?.canRestore

  // Fetch single version details
  const { data: versionDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ['sheet-version', sheetId, selectedVersion],
    queryFn: () => sheetsApi.getVersion(sheetId, selectedVersion!),
    enabled: !!selectedVersion && isOpen
  })

  // Fetch comparison
  const { data: comparisonData, isLoading: loadingComparison } = useQuery({
    queryKey: ['sheet-version-compare', sheetId, selectedVersion, compareWith],
    queryFn: () => sheetsApi.compareVersions(sheetId, compareWith!, selectedVersion!),
    enabled: compareMode && !!selectedVersion && !!compareWith && isOpen
  })

  const comparison = comparisonData?.data?.data

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: (versionNum: number) => sheetsApi.restoreVersion(sheetId, versionNum),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheet', sheetId] })
      queryClient.invalidateQueries({ queryKey: ['sheet-versions', sheetId] })
      toast.success('Version restauree avec succes')
      setSelectedVersion(null)
      onRestore?.()
    },
    onError: () => {
      toast.error('Erreur lors de la restauration')
    }
  })

  const handleRestore = (versionNum: number) => {
    if (window.confirm(`Restaurer la version ${versionNum}? La version actuelle sera sauvegardee.`)) {
      restoreMutation.mutate(versionNum)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const getChangeIcon = (type: DiffChange['type']) => {
    switch (type) {
      case 'added':
        return <PlusIcon className="w-4 h-4 text-green-500" />
      case 'removed':
        return <MinusIcon className="w-4 h-4 text-red-500" />
      case 'modified':
        return <PencilIcon className="w-4 h-4 text-amber-500" />
    }
  }

  const getSectionLabel = (section: string) => {
    const labels: Record<string, string> = {
      objectives: 'Objectifs',
      situations: 'Situations',
      flow: 'Deroule',
      evaluation: 'Evaluation'
    }
    return labels[section] || section
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <ClockIcon className="w-6 h-6 text-gray-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Historique des versions</h2>
              <p className="text-sm text-gray-500">Version actuelle: v{currentVersion}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Version List */}
          <div className="w-1/2 border-r overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700">Versions</h3>
                <button
                  onClick={() => {
                    setCompareMode(!compareMode)
                    setCompareWith(null)
                  }}
                  className={clsx(
                    'text-xs px-2 py-1 rounded',
                    compareMode
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {compareMode ? 'Annuler comparaison' : 'Comparer'}
                </button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ClockIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun historique disponible</p>
                  <p className="text-xs mt-1">Les versions seront creees lors des modifications</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Current version */}
                  <button
                    onClick={() => {
                      if (compareMode && selectedVersion) {
                        setCompareWith(currentVersion)
                      } else {
                        setSelectedVersion(currentVersion)
                      }
                    }}
                    className={clsx(
                      'w-full text-left p-3 rounded-lg border-2 transition-all',
                      selectedVersion === currentVersion
                        ? 'border-primary-500 bg-primary-50'
                        : compareWith === currentVersion
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">v{currentVersion}</span>
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                          Actuelle
                        </span>
                      </div>
                      <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>

                  {/* Historical versions */}
                  {versions.map((version: Version) => (
                    <button
                      key={version.id}
                      onClick={() => {
                        if (compareMode && selectedVersion) {
                          setCompareWith(version.versionNum)
                        } else {
                          setSelectedVersion(version.versionNum)
                        }
                      }}
                      className={clsx(
                        'w-full text-left p-3 rounded-lg border-2 transition-all',
                        selectedVersion === version.versionNum
                          ? 'border-primary-500 bg-primary-50'
                          : compareWith === version.versionNum
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">v{version.versionNum}</span>
                        <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-500">{formatDate(version.createdAt)}</p>
                      {version.changeNote && (
                        <p className="text-xs text-gray-600 mt-1 truncate">{version.changeNote}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Version Details / Diff */}
          <div className="w-1/2 overflow-y-auto bg-gray-50">
            {compareMode && comparison ? (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-4">
                  Comparaison v{compareWith} → v{selectedVersion}
                </h3>

                {loadingComparison ? (
                  <div className="flex items-center justify-center py-8">
                    <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : comparison.diff.hasChanges ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        {comparison.diff.summary}
                      </p>
                      <div className="space-y-2">
                        {comparison.diff.changes.map((change: DiffChange, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            {getChangeIcon(change.type)}
                            <span className="font-medium">{getSectionLabel(change.section)}:</span>
                            <span className="text-gray-600">{change.details}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircleIcon className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p className="text-sm text-gray-600">Versions identiques</p>
                  </div>
                )}
              </div>
            ) : selectedVersion ? (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-700">
                    Version {selectedVersion}
                    {selectedVersion === currentVersion && (
                      <span className="ml-2 text-xs text-green-600">(actuelle)</span>
                    )}
                  </h3>
                  {selectedVersion !== currentVersion && canRestore && (
                    <button
                      onClick={() => handleRestore(selectedVersion)}
                      disabled={restoreMutation.isPending}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {restoreMutation.isPending ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowUturnLeftIcon className="w-4 h-4" />
                      )}
                      Restaurer
                    </button>
                  )}
                </div>

                {loadingDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : versionDetails?.data?.data ? (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="p-3 bg-white rounded-lg border">
                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Resume</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Objectifs:</span>
                          <span className="ml-2 font-medium">
                            {versionDetails.data.data.content?.objectives?.length || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Situations:</span>
                          <span className="ml-2 font-medium">
                            {versionDetails.data.data.content?.situations?.length || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Phases:</span>
                          <span className="ml-2 font-medium">
                            {versionDetails.data.data.content?.flow?.length || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Warning for restore */}
                    {selectedVersion !== currentVersion && (
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-start gap-2">
                          <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
                          <div className="text-xs text-amber-700">
                            <p className="font-medium">Restaurer cette version?</p>
                            <p className="mt-1">
                              La version actuelle sera automatiquement sauvegardee avant la restauration.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">
                    Impossible de charger les details
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <ClockIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Selectionnez une version</p>
                  {compareMode && (
                    <p className="text-xs mt-1">puis une seconde pour comparer</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} className="btn-secondary w-full">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
