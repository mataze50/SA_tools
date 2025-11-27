import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { dashboardApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserIcon,
  DocumentTextIcon,
  EyeIcon,
  ChatBubbleLeftIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface PendingSheet {
  id: string
  title: string
  status: string
  confidenceScore: number
  sector: string
  audienceType: string
  duration: number
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

export default function ManagerDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  // Role verification - only MANAGER and ADMIN can access
  if (!user || (user.role !== 'MANAGER' && user.role !== 'ADMIN')) {
    return <Navigate to="/dashboard" replace />
  }

  const [selectedSheet, setSelectedSheet] = useState<PendingSheet | null>(null)
  const [validationStatus, setValidationStatus] = useState<'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES'>('APPROVED')
  const [comments, setComments] = useState('')
  const [showModal, setShowModal] = useState(false)

  // Fetch pending validations
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pending-validations'],
    queryFn: () => dashboardApi.pendingValidations()
  })

  const pendingSheets: PendingSheet[] = data?.data?.data || []

  // Validate mutation
  const validateMutation = useMutation({
    mutationFn: ({ sheetId, status, comments }: { sheetId: string; status: string; comments?: string }) =>
      dashboardApi.validate(sheetId, { status, comments }),
    onSuccess: (_, variables) => {
      const statusMessages = {
        APPROVED: 'Fiche approuvée !',
        REJECTED: 'Fiche rejetée',
        NEEDS_CHANGES: 'Modifications demandées'
      }
      toast.success(statusMessages[variables.status as keyof typeof statusMessages])
      queryClient.invalidateQueries({ queryKey: ['pending-validations'] })
      setShowModal(false)
      setSelectedSheet(null)
      setComments('')
    },
    onError: () => {
      toast.error('Erreur lors de la validation')
    }
  })

  const openValidationModal = (sheet: PendingSheet, status: 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES') => {
    setSelectedSheet(sheet)
    setValidationStatus(status)
    setComments('')
    setShowModal(true)
  }

  const handleValidate = () => {
    if (!selectedSheet) return
    validateMutation.mutate({
      sheetId: selectedSheet.id,
      status: validationStatus,
      comments: comments || undefined
    })
  }

  // Check if user is manager
  if (user?.role !== 'MANAGER' && user?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <ExclamationTriangleIcon className="w-16 h-16 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Accès restreint</h2>
        <p className="text-gray-500">Cette page est réservée aux managers.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Validation des fiches</h1>
          <p className="text-gray-600">
            {pendingSheets.length} fiche(s) en attente de validation
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary"
          disabled={isLoading}
        >
          <ArrowPathIcon className={clsx('w-5 h-5 mr-2', isLoading && 'animate-spin')} />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card !p-4 text-center">
          <ClockIcon className="w-8 h-8 mx-auto text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{pendingSheets.length}</p>
          <p className="text-sm text-gray-500">En attente</p>
        </div>
        <div className="card !p-4 text-center">
          <CheckCircleIcon className="w-8 h-8 mx-auto text-green-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">—</p>
          <p className="text-sm text-gray-500">Validées ce mois</p>
        </div>
        <div className="card !p-4 text-center">
          <XCircleIcon className="w-8 h-8 mx-auto text-red-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">—</p>
          <p className="text-sm text-gray-500">Rejetées ce mois</p>
        </div>
      </div>

      {/* Pending sheets list */}
      <div className="card !p-0">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Fiches en attente</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">Chargement...</p>
          </div>
        ) : pendingSheets.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircleIcon className="w-16 h-16 mx-auto text-green-200 mb-4" />
            <p className="text-gray-500">Aucune fiche en attente de validation</p>
          </div>
        ) : (
          <div className="divide-y">
            {pendingSheets.map((sheet) => (
              <div key={sheet.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Sheet info */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-primary-600">
                        {sheet.competency.code}
                      </span>
                      <span className="text-gray-900 font-medium">{sheet.title}</span>
                    </div>

                    {/* Author */}
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-4 h-4" />
                        {sheet.user.firstName} {sheet.user.lastName}
                      </span>
                      <span>{sheet.sector}</span>
                      <span>{sheet.duration} min</span>
                    </div>

                    {/* Confidence score */}
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
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
                      <span className="text-sm text-gray-600">
                        Score: {sheet.confidenceScore}%
                      </span>
                    </div>

                    {/* Submitted date */}
                    <p className="text-xs text-gray-400 mt-2">
                      Soumis le {new Date(sheet.updatedAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => navigate(`/sheet/${sheet.id}`)}
                      className="btn-secondary !py-2 !px-3"
                      title="Voir la fiche"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openValidationModal(sheet, 'NEEDS_CHANGES')}
                      className="btn-secondary !py-2 !px-3 text-orange-600 hover:bg-orange-50"
                      title="Demander des modifications"
                    >
                      <ChatBubbleLeftIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openValidationModal(sheet, 'REJECTED')}
                      className="btn-secondary !py-2 !px-3 text-red-600 hover:bg-red-50"
                      title="Rejeter"
                    >
                      <XCircleIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openValidationModal(sheet, 'APPROVED')}
                      className="btn-primary !py-2 !px-3"
                      title="Approuver"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation Modal */}
      {showModal && selectedSheet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {validationStatus === 'APPROVED' && 'Approuver la fiche'}
              {validationStatus === 'REJECTED' && 'Rejeter la fiche'}
              {validationStatus === 'NEEDS_CHANGES' && 'Demander des modifications'}
            </h3>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">{selectedSheet.title}</p>
              <p className="text-sm text-gray-500">
                {selectedSheet.competency.code} • Par {selectedSheet.user.firstName} {selectedSheet.user.lastName}
              </p>
            </div>

            {/* Status indicator */}
            <div className="flex gap-2 mb-4">
              {[
                { value: 'APPROVED', label: 'Approuver', color: 'green', icon: CheckCircleIcon },
                { value: 'NEEDS_CHANGES', label: 'Modifications', color: 'orange', icon: ChatBubbleLeftIcon },
                { value: 'REJECTED', label: 'Rejeter', color: 'red', icon: XCircleIcon }
              ].map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    onClick={() => setValidationStatus(option.value as any)}
                    className={clsx(
                      'flex-1 py-2 px-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 text-sm font-medium',
                      validationStatus === option.value
                        ? `border-${option.color}-500 bg-${option.color}-50 text-${option.color}-700`
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    )}
                    style={{
                      borderColor: validationStatus === option.value ? (option.color === 'green' ? '#22c55e' : option.color === 'orange' ? '#f97316' : '#ef4444') : undefined,
                      backgroundColor: validationStatus === option.value ? (option.color === 'green' ? '#f0fdf4' : option.color === 'orange' ? '#fff7ed' : '#fef2f2') : undefined,
                      color: validationStatus === option.value ? (option.color === 'green' ? '#15803d' : option.color === 'orange' ? '#c2410c' : '#b91c1c') : undefined
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {option.label}
                  </button>
                )
              })}
            </div>

            {/* Comments */}
            <div className="mb-6">
              <label className="label">
                Commentaires {validationStatus !== 'APPROVED' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder={
                  validationStatus === 'APPROVED'
                    ? 'Commentaires optionnels...'
                    : 'Expliquez les raisons de votre décision...'
                }
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false)
                  setSelectedSheet(null)
                  setComments('')
                }}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleValidate}
                disabled={validateMutation.isPending || (validationStatus !== 'APPROVED' && !comments.trim())}
                className={clsx(
                  'flex-1 font-medium py-2 px-4 rounded-lg transition-colors',
                  validationStatus === 'APPROVED'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : validationStatus === 'NEEDS_CHANGES'
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white',
                  (validateMutation.isPending || (validationStatus !== 'APPROVED' && !comments.trim())) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {validateMutation.isPending ? 'Envoi...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
