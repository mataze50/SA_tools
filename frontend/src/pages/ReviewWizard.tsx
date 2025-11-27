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
  PencilIcon,
  ClockIcon,
  AcademicCapIcon,
  ClipboardDocumentCheckIcon,
  UserGroupIcon
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

interface ScoreBreakdown {
  timing: number
  bloomAlignment: number
  smartCriteria: number
  evaluationCoherence: number
  situationsQuality: number
}

interface ValidationResult {
  isValid: boolean
  overallScore: number
  scoreBreakdown?: ScoreBreakdown
  issues: ValidationIssue[]
  suggestions: Suggestion[]
  durationCheck?: {
    isValid: boolean
    expected: number
    actual: number
    difference: number
  }
}

type ReviewAction = 'accept' | 'modify' | 'ignore'

interface ReviewDecision {
  suggestionId: string
  action: ReviewAction
  customValue?: string
}

const SCORE_CATEGORIES = [
  { key: 'timing', label: 'Timing', icon: ClockIcon, max: 25, color: 'blue' },
  { key: 'bloomAlignment', label: 'Bloom', icon: AcademicCapIcon, max: 30, color: 'purple' },
  { key: 'smartCriteria', label: 'SMART', icon: SparklesIcon, max: 20, color: 'yellow' },
  { key: 'evaluationCoherence', label: 'Évaluation', icon: ClipboardDocumentCheckIcon, max: 15, color: 'green' },
  { key: 'situationsQuality', label: 'Situations', icon: UserGroupIcon, max: 10, color: 'orange' }
]

export default function ReviewWizard() {
  const { sheetId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [currentStep, setCurrentStep] = useState(0)
  const [decisions, setDecisions] = useState<ReviewDecision[]>([])
  const [editingValue, setEditingValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [projectedScore, setProjectedScore] = useState<number | null>(null)

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
  const scoreBreakdown = validation?.scoreBreakdown

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

  // Calculate projected score when decisions change
  const calculateScore = useMutation({
    mutationFn: () => validationApi.calculateScore(sheetId!, decisions),
    onSuccess: (res) => {
      setProjectedScore(res.data.data.projectedScore)
    }
  })

  // Recalculate score when decisions change
  useEffect(() => {
    if (decisions.length > 0 && sheetId) {
      calculateScore.mutate()
    }
  }, [decisions, sheetId])

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

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'timing':
        return <ClockIcon className="w-5 h-5" />
      case 'cohérence bloom':
      case 'bloom':
        return <AcademicCapIcon className="w-5 h-5" />
      case 'évaluation':
        return <ClipboardDocumentCheckIcon className="w-5 h-5" />
      case 'situations':
        return <UserGroupIcon className="w-5 h-5" />
      default:
        return <SparklesIcon className="w-5 h-5" />
    }
  }

  const getCurrentDecision = () => {
    return decisions.find(d => d.suggestionId === currentItem?.id)
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getProgressColor = (score: number, max: number) => {
    const percentage = (score / max) * 100
    if (percentage >= 80) return 'bg-green-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
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
            Ta fiche est prête !
          </h2>
          <p className="text-gray-600 mb-2">
            Niveau de confiance : <span className={clsx('font-bold', getScoreColor(validation.overallScore))}>{validation.overallScore}%</span>
          </p>
          <p className="text-gray-500 mb-6">
            Aucun problème détecté. Tu peux passer à l'édition.
          </p>

          {/* Score breakdown */}
          {scoreBreakdown && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg text-left">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Détail du score</h3>
              <div className="space-y-2">
                {SCORE_CATEGORIES.map(cat => {
                  const score = scoreBreakdown[cat.key as keyof ScoreBreakdown] || 0
                  return (
                    <div key={cat.key} className="flex items-center gap-2">
                      <cat.icon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 w-24">{cat.label}</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={clsx('h-full rounded-full', getProgressColor(score, cat.max))}
                          style={{ width: `${(score / cat.max) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{score}/{cat.max}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <button onClick={() => navigate(`/sheet/${sheetId}`)} className="btn-primary">
            Aller à l'éditeur
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
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

        {/* Score display with projection */}
        <div className="text-right">
          <p className="text-sm text-gray-500">Score</p>
          <div className="flex items-center gap-2">
            <span className={clsx('text-lg font-bold', getScoreColor(validation.overallScore))}>
              {validation.overallScore}%
            </span>
            {projectedScore !== null && projectedScore !== validation.overallScore && (
              <>
                <span className="text-gray-400">→</span>
                <span className={clsx('text-lg font-bold', getScoreColor(projectedScore))}>
                  {projectedScore}%
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Score breakdown sidebar */}
      {scoreBreakdown && (
        <div className="card !p-4 mb-6 bg-gray-50">
          <div className="flex flex-wrap gap-4">
            {SCORE_CATEGORIES.map(cat => {
              const score = scoreBreakdown[cat.key as keyof ScoreBreakdown] || 0
              const isOk = score === cat.max
              return (
                <div
                  key={cat.key}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg',
                    isOk ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-200'
                  )}
                >
                  <cat.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{cat.label}</span>
                  <span className={clsx(
                    'text-sm',
                    isOk ? 'text-green-600' : score > 0 ? 'text-yellow-600' : 'text-red-600'
                  )}>
                    {score}/{cat.max}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
      {currentStep === 0 && suggestions.filter(s => s.autoApply).length > 0 && (
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
            <div className="p-2 bg-gray-100 rounded-lg">
              {getCategoryIcon(currentItem.type)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">
                  Point #{currentStep + 1}
                </h2>
                <span className={clsx(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  currentItem.type === 'error' ? 'bg-red-100 text-red-700' :
                  currentItem.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                )}>
                  {currentItem.type || 'suggestion'}
                </span>
              </div>
              <p className="text-sm text-gray-500">{currentItem.type}</p>
            </div>
            {getCurrentDecision() && (
              <div className={clsx(
                'px-3 py-1 rounded-full text-sm font-medium',
                getCurrentDecision()?.action === 'accept' ? 'bg-green-100 text-green-700' :
                getCurrentDecision()?.action === 'modify' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              )}>
                {getCurrentDecision()?.action === 'accept' && 'Accepté'}
                {getCurrentDecision()?.action === 'modify' && 'Modifié'}
                {getCurrentDecision()?.action === 'ignore' && 'Ignoré'}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-700">{currentItem.reason}</p>
          </div>

          {/* Before/After comparison */}
          {currentItem.original && currentItem.suggested && (
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <p className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  AVANT
                </p>
                <p className="text-gray-800 text-sm">{currentItem.original}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
                  <CheckCircleIcon className="w-4 h-4" />
                  SUGGESTION
                </p>
                <p className="text-gray-800 text-sm">{currentItem.suggested}</p>
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
                autoFocus
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
              <>
                Terminer la revue
                <ChevronRightIcon className="w-5 h-5 ml-1" />
              </>
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
              title={`Point ${index + 1}${decision ? ` - ${decision.action}` : ''}`}
            />
          )
        })}
      </div>

      {/* Summary of decisions */}
      {decisions.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Résumé des décisions</h3>
          <div className="flex gap-4 text-sm">
            <span className="text-green-600">
              {decisions.filter(d => d.action === 'accept').length} accepté(s)
            </span>
            <span className="text-blue-600">
              {decisions.filter(d => d.action === 'modify').length} modifié(s)
            </span>
            <span className="text-gray-500">
              {decisions.filter(d => d.action === 'ignore').length} ignoré(s)
            </span>
          </div>
        </div>
      )}

      {/* Reassurance */}
      <p className="text-center text-sm text-gray-500 mt-6">
        Les corrections proposées sont toujours optionnelles — c'est toi qui décides.
      </p>
    </div>
  )
}
