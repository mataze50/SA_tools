import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { validationApi, sheetsApi } from '../lib/api'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  SparklesIcon,
  PencilIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface ValidationIssue {
  id: string
  type: 'error' | 'warning' | 'info'
  category: string
  description: string
  location: string
  suggestion?: string
}

interface Suggestion {
  id: string
  type: string
  original: string
  suggested: string
  reason: string
  autoApply: boolean
}

interface ValidationResult {
  isValid: boolean
  overallScore: number
  issues: ValidationIssue[]
  suggestions: Suggestion[]
}

type ReviewAction = 'accept' | 'modify' | 'ignore'

interface ReviewDecision {
  suggestionId: string
  action: ReviewAction
  customValue?: string
}

export default function ReviewWizard() {
  const { sheetId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [currentStep, setCurrentStep] = useState(0)
  const [decisions, setDecisions] = useState<ReviewDecision[]>([])
  const [editingValue, setEditingValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Fetch sheet
  const { data: sheetData } = useQuery({
    queryKey: ['sheet', sheetId],
    queryFn: () => sheetsApi.get(sheetId!),
    enabled: !!sheetId
  })

  // Fetch validation
  const { data: validationData, isLoading, error } = useQuery({
    queryKey: ['validation', sheetId],
    queryFn: () => validationApi.get(sheetId!),
    enabled: !!sheetId
  })

  const sheet = sheetData?.data?.data
  const validation: ValidationResult | null = validationData?.data?.data?.validation || null
  const issues = validation?.issues || []
  const suggestions = validation?.suggestions || []

  // Combine issues and suggestions for the wizard steps
  const steps = suggestions.length > 0 ? suggestions : issues.map(issue => ({
    id: issue.id,
    type: issue.category,
    original: issue.description,
    suggested: issue.suggestion || '',
    reason: issue.description,
    autoApply: false
  }))

  const currentItem = steps[currentStep]
  const totalSteps = steps.length
  const isLastStep = currentStep === totalSteps - 1

  // Apply all decisions
  const applyDecisions = useMutation({
    mutationFn: async () => {
      // Apply each decision
      for (const decision of decisions) {
        if (decision.action !== 'ignore') {
          await validationApi.apply(sheetId!, {
            suggestionId: decision.suggestionId,
            action: decision.action,
            customValue: decision.customValue
          })
        }
      }
      // Revalidate to get new score
      return validationApi.revalidate(sheetId!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheet', sheetId] })
      queryClient.invalidateQueries({ queryKey: ['validation', sheetId] })
      toast.success('Modifications appliquées !')
      navigate(`/sheet/${sheetId}`)
    },
    onError: () => {
      toast.error('Erreur lors de l\'application des modifications')
    }
  })

  // Apply all automatically
  const applyAll = useMutation({
    mutationFn: () => validationApi.applyAll(sheetId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheet', sheetId] })
      toast.success('Toutes les corrections ont été appliquées !')
      navigate(`/sheet/${sheetId}`)
    },
    onError: () => {
      toast.error('Erreur lors de l\'application automatique')
    }
  })

  const handleDecision = (action: ReviewAction) => {
    const decision: ReviewDecision = {
      suggestionId: currentItem.id,
      action,
      customValue: action === 'modify' ? editingValue : undefined
    }

    setDecisions([...decisions.filter(d => d.suggestionId !== currentItem.id), decision])
    setIsEditing(false)
    setEditingValue('')

    if (!isLastStep) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleFinish = () => {
    applyDecisions.mutate()
  }

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
      case 'warning':
        return <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500" />
      default:
        return <InformationCircleIcon className="w-6 h-6 text-blue-500" />
    }
  }

  const getCurrentDecision = () => {
    return decisions.find(d => d.suggestionId === currentItem?.id)
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
        <p className="text-gray-500 mt-4">Analyse en cours...</p>
      </div>
    )
  }

  if (error || !validation) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Erreur de validation
          </h2>
          <p className="text-gray-600 mb-6">
            Impossible de charger les résultats de validation.
          </p>
          <button onClick={() => navigate(`/sheet/${sheetId}`)} className="btn-primary">
            Retour à la fiche
          </button>
        </div>
      </div>
    )
  }

  // No issues - sheet is valid
  if (totalSteps === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            🎉 Ta fiche est prête !
          </h2>
          <p className="text-gray-600 mb-2">
            Niveau de confiance : <span className="font-bold text-primary-600">{validation.overallScore}%</span>
          </p>
          <p className="text-gray-500 mb-6">
            Aucun problème détecté. Tu peux passer à l'édition.
          </p>
          <button onClick={() => navigate(`/sheet/${sheetId}`)} className="btn-primary">
            Aller à l'éditeur →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(`/sheet/${sheetId}`)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Revue guidée</h1>
          <p className="text-sm text-gray-500">
            {sheet?.title || 'Fiche de conception'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Score actuel</p>
          <p className="text-lg font-bold text-primary-600">{validation.overallScore}%</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Point {currentStep + 1} sur {totalSteps}</span>
          <span>{decisions.length} décision(s) prise(s)</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Quick action */}
      {currentStep === 0 && (
        <div className="card !p-4 mb-6 bg-primary-50 border-primary-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-primary-900">
                Appliquer toutes les corrections automatiquement ?
              </p>
              <p className="text-sm text-primary-700">
                {suggestions.filter(s => s.autoApply).length} correction(s) peuvent être appliquées
              </p>
            </div>
            <button
              onClick={() => applyAll.mutate()}
              disabled={applyAll.isPending}
              className="btn-primary"
            >
              {applyAll.isPending ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <SparklesIcon className="w-5 h-5 mr-2" />
                  Tout appliquer
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Current issue card */}
      {currentItem && (
        <div className="card animate-slide-in">
          {/* Issue header */}
          <div className="flex items-start gap-3 mb-4">
            {getIssueIcon(currentItem.type || 'warning')}
            <div>
              <h2 className="font-semibold text-gray-900">
                Point d'attention #{currentStep + 1}
              </h2>
              <p className="text-sm text-gray-500">{currentItem.type}</p>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <p className="text-gray-700">{currentItem.reason}</p>
          </div>

          {/* Before/After comparison */}
          {currentItem.original && currentItem.suggested && (
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <p className="text-xs font-medium text-red-600 mb-2">AVANT</p>
                <p className="text-gray-800">{currentItem.original}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="text-xs font-medium text-green-600 mb-2">APRÈS (suggestion)</p>
                <p className="text-gray-800">{currentItem.suggested}</p>
              </div>
            </div>
          )}

          {/* Custom edit mode */}
          {isEditing && (
            <div className="mb-6">
              <label className="label">Ta version personnalisée</label>
              <textarea
                className="input"
                rows={3}
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                placeholder="Saisis ta propre formulation..."
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {!isEditing ? (
              <>
                <button
                  onClick={() => handleDecision('accept')}
                  className="btn-primary flex-1"
                >
                  <CheckCircleIcon className="w-5 h-5 mr-2" />
                  Accepter
                </button>
                <button
                  onClick={() => {
                    setIsEditing(true)
                    setEditingValue(currentItem.suggested || currentItem.original)
                  }}
                  className="btn-secondary flex-1"
                >
                  <PencilIcon className="w-5 h-5 mr-2" />
                  Modifier
                </button>
                <button
                  onClick={() => handleDecision('ignore')}
                  className="btn-ghost"
                >
                  Ignorer
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleDecision('modify')}
                  className="btn-primary flex-1"
                  disabled={!editingValue.trim()}
                >
                  Valider ma version
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setEditingValue('')
                  }}
                  className="btn-secondary"
                >
                  Annuler
                </button>
              </>
            )}
          </div>

          {/* Current decision indicator */}
          {getCurrentDecision() && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Décision : <span className="font-medium">
                  {getCurrentDecision()?.action === 'accept' && '✅ Accepté'}
                  {getCurrentDecision()?.action === 'modify' && '✏️ Modifié'}
                  {getCurrentDecision()?.action === 'ignore' && '⏭️ Ignoré'}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="btn-ghost disabled:opacity-50"
        >
          <ChevronLeftIcon className="w-5 h-5 mr-1" />
          Précédent
        </button>

        {isLastStep ? (
          <button
            onClick={handleFinish}
            disabled={applyDecisions.isPending}
            className="btn-primary"
          >
            {applyDecisions.isPending ? (
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
            ) : (
              'Terminer la revue →'
            )}
          </button>
        ) : (
          <button
            onClick={() => setCurrentStep(currentStep + 1)}
            className="btn-ghost"
          >
            Suivant
            <ChevronRightIcon className="w-5 h-5 ml-1" />
          </button>
        )}
      </div>

      {/* Step indicators */}
      <div className="flex justify-center gap-2 mt-6">
        {steps.map((_, index) => {
          const decision = decisions.find(d => d.suggestionId === steps[index].id)
          return (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={clsx(
                'w-3 h-3 rounded-full transition-all',
                index === currentStep
                  ? 'bg-primary-600 scale-125'
                  : decision
                  ? decision.action === 'accept'
                    ? 'bg-green-500'
                    : decision.action === 'modify'
                    ? 'bg-blue-500'
                    : 'bg-gray-300'
                  : 'bg-gray-300 hover:bg-gray-400'
              )}
            />
          )
        })}
      </div>

      {/* Reassurance */}
      <p className="text-center text-sm text-gray-500 mt-6">
        💡 Les corrections proposées sont toujours optionnelles — c'est toi qui décides.
      </p>
    </div>
  )
}
