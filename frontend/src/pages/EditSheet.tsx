import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { sheetsApi, exportApi, quizApi } from '../lib/api'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  ArrowPathIcon,
  TrashIcon,
  DocumentArrowDownIcon,
  ChevronLeftIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const tabs = [
  { id: 'context', label: 'Contexte', icon: '📋' },
  { id: 'objectives', label: 'Objectifs', icon: '🎯' },
  { id: 'situations', label: 'Situations', icon: '💼' },
  { id: 'flow', label: 'Déroulé', icon: '⏱️' },
  { id: 'evaluation', label: 'Évaluation', icon: '✅' }
]

export default function EditSheet() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('objectives')
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Fetch sheet
  const { data: sheetData, isLoading } = useQuery({
    queryKey: ['sheet', id],
    queryFn: () => sheetsApi.get(id!),
    enabled: !!id
  })

  const sheet = sheetData?.data?.data

  // Update sheet
  const updateSheet = useMutation({
    mutationFn: (data: any) => sheetsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheet', id] })
      toast.success('Modifications enregistrées')
      setEditingItem(null)
    },
    onError: () => {
      toast.error('Erreur lors de la sauvegarde')
    }
  })

  // Export DOCX
  const exportDocx = useMutation({
    mutationFn: () => exportApi.docx(id!),
    onSuccess: (res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `fiche_${sheet?.competency?.code || 'export'}.docx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Export téléchargé !')
    },
    onError: () => {
      toast.error('Erreur lors de l\'export')
    }
  })

  // Generate quiz
  const generateQuiz = useMutation({
    mutationFn: () => quizApi.generate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheet', id] })
      toast.success('Quiz généré !')
    },
    onError: () => {
      toast.error('Erreur lors de la génération du quiz')
    }
  })

  // Submit for validation
  const submitValidation = useMutation({
    mutationFn: () => sheetsApi.submitValidation(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheet', id] })
      toast.success('Fiche envoyée pour validation')
    },
    onError: () => {
      toast.error('Erreur lors de l\'envoi')
    }
  })

  if (isLoading || !sheet) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  const objectives = (sheet.objectives || []) as any[]
  const situations = (sheet.situations || []) as any[]
  const flow = (sheet.flow || []) as any[]
  const evaluation = (sheet.evaluation || {}) as any

  const handleSaveObjective = (index: number, newText: string) => {
    const updated = [...objectives]
    updated[index] = { ...updated[index], text: newText }
    updateSheet.mutate({ objectives: updated })
  }

  const handleDeleteObjective = (index: number) => {
    const updated = objectives.filter((_, i) => i !== index)
    updateSheet.mutate({ objectives: updated })
  }

  const handleSaveSituation = (index: number, field: string, value: string) => {
    const updated = [...situations]
    updated[index] = { ...updated[index], [field]: value }
    updateSheet.mutate({ situations: updated })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{sheet.title}</h1>
            <p className="text-sm text-gray-500">
              {sheet.competency?.code} — {sheet.competency?.title}
            </p>
          </div>
        </div>

        {/* Confidence score */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Niveau de confiance</p>
            <p className="text-lg font-bold text-primary-600">
              {sheet.confidenceScore}%
            </p>
          </div>
          <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden">
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
        </div>
      </div>

      {/* Tabs */}
      <div className="card !p-0">
        <div className="border-b">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                    isActive
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Context tab */}
          {activeTab === 'context' && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Secteur</label>
                  <p className="text-gray-900">{sheet.sector}</p>
                </div>
                <div>
                  <label className="label">Public</label>
                  <p className="text-gray-900">{sheet.audienceType}</p>
                </div>
                <div>
                  <label className="label">Format</label>
                  <p className="text-gray-900">{formatLabel(sheet.format)}</p>
                </div>
                <div>
                  <label className="label">Durée</label>
                  <p className="text-gray-900">{sheet.duration} minutes</p>
                </div>
              </div>
            </div>
          )}

          {/* Objectives tab */}
          {activeTab === 'objectives' && (
            <div className="space-y-4">
              {objectives.map((obj, index) => (
                <div
                  key={obj.id || index}
                  className="p-4 border rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="badge badge-info">
                          Objectif {index + 1}
                        </span>
                        <span className="badge bg-purple-100 text-purple-800">
                          {obj.bloomLevel}
                        </span>
                        {obj.isConform !== false && (
                          <CheckCircleIcon className="w-5 h-5 text-green-500" />
                        )}
                      </div>

                      {editingItem === `obj-${index}` ? (
                        <div className="space-y-2">
                          <textarea
                            className="input"
                            rows={3}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveObjective(index, editValue)}
                              className="btn-primary text-sm"
                              disabled={updateSheet.isPending}
                            >
                              Enregistrer
                            </button>
                            <button
                              onClick={() => setEditingItem(null)}
                              className="btn-secondary text-sm"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-900">{obj.text}</p>
                      )}
                    </div>

                    {editingItem !== `obj-${index}` && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingItem(`obj-${index}`)
                            setEditValue(obj.text)
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title="Modifier"
                        >
                          <PencilIcon className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteObjective(index)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title="Supprimer"
                        >
                          <TrashIcon className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <button className="btn-secondary w-full">
                <PlusIcon className="w-5 h-5 mr-2" />
                Ajouter un objectif
              </button>
            </div>
          )}

          {/* Situations tab */}
          {activeTab === 'situations' && (
            <div className="space-y-4">
              {situations.map((sit, index) => (
                <div
                  key={sit.id || index}
                  className="p-4 border rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge badge-info">Situation {index + 1}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{sit.title}</h3>
                  <p className="text-gray-600 text-sm mb-2">{sit.description}</p>
                  <div className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-500">Défi : </span>
                      <span className="text-gray-700">{sit.challenge}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Comportement attendu : </span>
                      <span className="text-gray-700">{sit.expectedBehavior}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Flow tab */}
          {activeTab === 'flow' && (
            <div className="space-y-4">
              {flow.map((phase, index) => (
                <div
                  key={phase.id || index}
                  className="p-4 border rounded-lg"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-gray-900">
                        {phase.name}
                      </span>
                      <span className="badge bg-gray-100 text-gray-700">
                        {phase.duration} min
                      </span>
                    </div>
                  </div>

                  {phase.activities?.length > 0 && (
                    <div className="space-y-2">
                      {phase.activities.map((activity: any, actIndex: number) => (
                        <div key={actIndex} className="pl-4 border-l-2 border-gray-200">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700">
                              {activity.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({activity.duration} min, {activityTypeLabel(activity.type)})
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {activity.instructions}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {phase.materials?.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Matériel :</span>
                      <div className="flex flex-wrap gap-1">
                        {phase.materials.map((m: string, i: number) => (
                          <span key={i} className="badge bg-gray-100 text-gray-600">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Evaluation tab */}
          {activeTab === 'evaluation' && (
            <div className="space-y-6">
              {evaluation.method && (
                <div>
                  <label className="label">Méthode d'évaluation</label>
                  <p className="text-gray-900">{evaluation.method}</p>
                </div>
              )}

              {evaluation.criteria?.length > 0 && (
                <div>
                  <label className="label">Critères d'évaluation</label>
                  <div className="space-y-2">
                    {evaluation.criteria.map((c: any, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-900">{c.criterion}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Observable : {c.observable}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {evaluation.successIndicators?.length > 0 && (
                <div>
                  <label className="label">Indicateurs de réussite</label>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {evaluation.successIndicators.map((ind: string, i: number) => (
                      <li key={i}>{ind}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="card">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => exportDocx.mutate()}
            disabled={exportDocx.isPending}
            className="btn-secondary"
          >
            <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
            {exportDocx.isPending ? 'Export...' : 'Exporter DOCX'}
          </button>

          <button
            onClick={() => generateQuiz.mutate()}
            disabled={generateQuiz.isPending || !!sheet.quiz}
            className="btn-secondary"
          >
            {sheet.quiz ? 'Quiz généré ✓' : generateQuiz.isPending ? 'Génération...' : 'Générer le quiz'}
          </button>

          {sheet.status === 'DRAFT' && (
            <button
              onClick={() => submitValidation.mutate()}
              disabled={submitValidation.isPending}
              className="btn-primary ml-auto"
            >
              {submitValidation.isPending ? 'Envoi...' : 'Envoyer pour validation →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function formatLabel(format: string): string {
  const labels: Record<string, string> = {
    IN_PERSON: 'Présentiel',
    REMOTE_SYNC: 'Distanciel synchrone',
    REMOTE_ASYNC: 'Distanciel asynchrone',
    HYBRID: 'Hybride'
  }
  return labels[format] || format
}

function activityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    individual: 'travail individuel',
    group: 'travail en groupe',
    plenary: 'plénière',
    practice: 'mise en pratique'
  }
  return labels[type] || type
}
