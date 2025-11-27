import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { generationApi } from '../lib/api'
import { useGenerationPolling } from '../hooks/useGenerationStream'
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  HandThumbUpIcon,
  HandThumbDownIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const pipelineSteps = [
  { id: 'PENDING', label: 'Analyse de ta demande', icon: '📋' },
  { id: 'ENRICHING', label: 'Recherche de situations réelles', icon: '🔍' },
  { id: 'GENERATING', label: 'Rédaction de la fiche', icon: '✍️' },
  { id: 'VALIDATING', label: 'Contrôle de cohérence', icon: '🔎' },
  { id: 'IMPROVING', label: 'Améliorations automatiques', icon: '✨' },
  { id: 'COMPLETED', label: 'Préparation des ressources', icon: '📦' }
]

export default function Generation() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [sheetTitle, setSheetTitle] = useState('')
  const [createdSheetId, setCreatedSheetId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({})

  // Use polling hook for generation status (faster updates)
  const { data: streamData, isLoading, error } = useGenerationPolling(sessionId)

  const status = streamData?.status || 'PENDING'
  const progress = streamData?.progress || { step: 0, totalSteps: 6, label: '', estimatedTimeRemaining: '~45s' }
  const generatedContent = streamData?.generatedContent || streamData?.finalContent

  // Create sheet from completed generation
  const createSheet = useMutation({
    mutationFn: () => generationApi.createSheet(sessionId!, sheetTitle || undefined),
    onSuccess: (res) => {
      const sheetId = res.data.data.id
      setCreatedSheetId(sheetId)
      toast.success('Fiche créée avec succès !')
    },
    onError: () => {
      toast.error('Erreur lors de la création de la fiche')
    }
  })

  const goToEditor = () => {
    if (createdSheetId) {
      navigate(`/sheet/${createdSheetId}`)
    }
  }

  const goToReview = () => {
    if (createdSheetId) {
      navigate(`/sheet/${createdSheetId}/review`)
    }
  }

  const handleFeedback = (itemId: string, type: 'up' | 'down') => {
    setFeedback(prev => ({
      ...prev,
      [itemId]: prev[itemId] === type ? undefined : type
    } as any))
  }

  // Set default title from generated content
  useEffect(() => {
    if (generatedContent?.title && !sheetTitle) {
      setSheetTitle(generatedContent.title)
    }
  }, [generatedContent, sheetTitle])

  const currentStepIndex = pipelineSteps.findIndex((s) => s.id === status)

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <XCircleIcon className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Erreur de génération
          </h2>
          <p className="text-gray-600 mb-6">
            Une erreur s'est produite lors de la génération. Veuillez réessayer.
          </p>
          <button onClick={() => navigate('/create')} className="btn-primary">
            Recommencer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-5xl">🏭</span>
          <h1 className="text-xl font-semibold text-gray-900 mt-4">
            Préparation de ta fiche
          </h1>
          {status !== 'COMPLETED' && status !== 'FAILED' && (
            <p className="text-gray-500 mt-1">
              {progress.estimatedTimeRemaining}
            </p>
          )}
        </div>

        {/* Pipeline steps */}
        <div className="space-y-3 mb-8">
          {pipelineSteps.map((step, index) => {
            const isComplete = currentStepIndex > index || status === 'COMPLETED'
            const isCurrent = currentStepIndex === index && status !== 'COMPLETED'
            const isPending = currentStepIndex < index

            return (
              <div
                key={step.id}
                className={clsx(
                  'flex items-center gap-4 p-3 rounded-lg transition-all',
                  isComplete && 'bg-green-50',
                  isCurrent && 'bg-primary-50 animate-pulse-soft',
                  isPending && 'opacity-50'
                )}
              >
                <div
                  className={clsx(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                    isComplete && 'bg-green-100 text-green-600',
                    isCurrent && 'bg-primary-100 text-primary-600',
                    isPending && 'bg-gray-100 text-gray-400'
                  )}
                >
                  {isComplete ? (
                    <CheckCircleIcon className="w-5 h-5" />
                  ) : isCurrent ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="text-sm">{step.icon}</span>
                  )}
                </div>
                <span
                  className={clsx(
                    'font-medium',
                    isComplete && 'text-green-700',
                    isCurrent && 'text-primary-700',
                    isPending && 'text-gray-400'
                  )}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Live preview during generation */}
        {generatedContent && status !== 'COMPLETED' && status !== 'FAILED' && (
          <div className="border-t pt-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              👀 Aperçu en temps réel
              <span className="text-xs font-normal text-gray-500">(tu peux réagir !)</span>
            </h2>

            {/* Preview objectives as they're generated */}
            {generatedContent.objectives?.length > 0 && (
              <div className="space-y-3">
                {generatedContent.objectives.slice(0, 2).map((obj: any, i: number) => (
                  <div
                    key={obj.id || i}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 animate-slide-in"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <span className="text-xs font-medium text-primary-600">
                          OBJECTIF {i + 1}
                        </span>
                        <p className="text-sm text-gray-700 mt-1">{obj.text}</p>
                        {obj.bloomLevel && (
                          <span className="text-xs text-gray-500 mt-1">
                            Niveau: {obj.bloomLevel}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleFeedback(`obj-${i}`, 'up')}
                          className={clsx(
                            'p-1.5 rounded-lg transition-colors',
                            feedback[`obj-${i}`] === 'up'
                              ? 'bg-green-100 text-green-600'
                              : 'hover:bg-gray-200 text-gray-400'
                          )}
                        >
                          <HandThumbUpIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleFeedback(`obj-${i}`, 'down')}
                          className={clsx(
                            'p-1.5 rounded-lg transition-colors',
                            feedback[`obj-${i}`] === 'down'
                              ? 'bg-red-100 text-red-600'
                              : 'hover:bg-gray-200 text-gray-400'
                          )}
                        >
                          <HandThumbDownIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Preview situations as they're generated */}
            {generatedContent.situations?.length > 0 && (
              <div className="mt-4 space-y-3">
                {generatedContent.situations.slice(0, 1).map((sit: any, i: number) => (
                  <div
                    key={sit.id || i}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 animate-slide-in"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <span className="text-xs font-medium text-orange-600">
                          SITUATION {i + 1}
                        </span>
                        <p className="text-sm font-medium text-gray-800 mt-1">{sit.title}</p>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{sit.description}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleFeedback(`sit-${i}`, 'up')}
                          className={clsx(
                            'p-1.5 rounded-lg transition-colors',
                            feedback[`sit-${i}`] === 'up'
                              ? 'bg-green-100 text-green-600'
                              : 'hover:bg-gray-200 text-gray-400'
                          )}
                        >
                          <HandThumbUpIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleFeedback(`sit-${i}`, 'down')}
                          className={clsx(
                            'p-1.5 rounded-lg transition-colors',
                            feedback[`sit-${i}`] === 'down'
                              ? 'bg-red-100 text-red-600'
                              : 'hover:bg-gray-200 text-gray-400'
                          )}
                        >
                          <HandThumbDownIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500 mt-4 text-center">
              💡 Tes réactions aident l'IA à mieux comprendre tes préférences
            </p>
          </div>
        )}

        {/* Completed preview */}
        {generatedContent && status === 'COMPLETED' && (
          <div className="border-t pt-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              🎉 Ton brouillon est prêt !
            </h2>

            {/* Confidence score */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Niveau de confiance
                </span>
                <span className="text-lg font-bold text-primary-600">
                  {generatedContent.confidenceScore}%
                </span>
              </div>
              <div className="confidence-bar">
                <div
                  className={clsx(
                    'confidence-fill',
                    generatedContent.confidenceScore >= 85
                      ? 'bg-green-500'
                      : generatedContent.confidenceScore >= 70
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  )}
                  style={{ width: `${generatedContent.confidenceScore}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {generatedContent.confidenceScore >= 85
                  ? 'Prêt pour ton manager !'
                  : 'Quelques ajustements recommandés'}
              </p>
            </div>

            {/* Quick preview */}
            <div className="space-y-4 mb-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Objectifs générés
                </h3>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {generatedContent.objectives?.slice(0, 3).map((obj: any, i: number) => (
                    <li key={i} className="truncate">
                      {obj.text}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Situations professionnelles
                </h3>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {generatedContent.situations?.slice(0, 3).map((sit: any, i: number) => (
                    <li key={i} className="truncate">
                      {sit.title}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Title input */}
            <div className="mb-6">
              <label className="label">Titre de ta fiche</label>
              <input
                type="text"
                className="input"
                value={sheetTitle}
                onChange={(e) => setSheetTitle(e.target.value)}
                placeholder="Ex: Analyse des feedbacks - Consultants CEP"
              />
            </div>

            {/* Actions - before sheet creation */}
            {!createdSheetId && (
              <div className="flex gap-3">
                <button
                  onClick={() => createSheet.mutate()}
                  disabled={createSheet.isPending}
                  className="btn-primary flex-1"
                >
                  {createSheet.isPending ? 'Création...' : 'Créer la fiche'}
                </button>
              </div>
            )}

            {/* Actions - after sheet creation */}
            {createdSheetId && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 text-center">
                  🎉 Fiche créée ! Que veux-tu faire ?
                </p>

                {generatedContent.confidenceScore < 85 ? (
                  <>
                    {/* Low confidence - recommend review */}
                    <button
                      onClick={goToReview}
                      className="btn-primary w-full"
                    >
                      👀 Passer en revue avec l'IA
                      <span className="text-xs ml-2 opacity-75">(recommandé)</span>
                    </button>
                    <button
                      onClick={goToEditor}
                      className="btn-secondary w-full"
                    >
                      ✏️ Aller directement à l'éditeur
                    </button>
                  </>
                ) : (
                  <>
                    {/* High confidence - can go directly to editor */}
                    <button
                      onClick={goToEditor}
                      className="btn-primary w-full"
                    >
                      ✏️ Continuer vers l'éditeur
                    </button>
                    <button
                      onClick={goToReview}
                      className="btn-secondary w-full"
                    >
                      👀 Voir les suggestions d'amélioration
                    </button>
                  </>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500 text-center mt-4">
              💡 Tu pourras modifier tous les contenus dans l'éditeur
            </p>
          </div>
        )}

        {/* Failed state */}
        {status === 'FAILED' && (
          <div className="border-t pt-6 text-center">
            <XCircleIcon className="w-12 h-12 mx-auto text-red-400 mb-4" />
            <h2 className="font-semibold text-gray-900 mb-2">
              Génération échouée
            </h2>
            <p className="text-gray-600 mb-4">
              Une erreur s'est produite. Veuillez réessayer.
            </p>
            <button onClick={() => navigate('/create')} className="btn-primary">
              Recommencer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
