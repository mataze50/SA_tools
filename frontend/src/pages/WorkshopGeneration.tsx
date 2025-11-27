import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { workshopGenerationApi, workshopsApi } from '../lib/api'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ClockIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  PresentationChartBarIcon,
  ClipboardDocumentCheckIcon,
  BookOpenIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface GenerationStep {
  id: string
  label: string
  icon: any
  status: 'pending' | 'active' | 'completed' | 'error'
}

const GENERATION_STEPS: GenerationStep[] = [
  { id: 'ANALYZING', label: 'Analyse du sujet', icon: SparklesIcon, status: 'pending' },
  { id: 'STRUCTURING', label: 'Structuration', icon: DocumentTextIcon, status: 'pending' },
  { id: 'GENERATING_INTRO', label: 'Introduction', icon: BookOpenIcon, status: 'pending' },
  { id: 'GENERATING_ACTIVITIES', label: 'Activites', icon: AcademicCapIcon, status: 'pending' },
  { id: 'GENERATING_EVALUATION', label: 'Evaluation', icon: ClipboardDocumentCheckIcon, status: 'pending' },
  { id: 'VALIDATING', label: 'Validation', icon: CheckCircleIcon, status: 'pending' },
  { id: 'IMPROVING', label: 'Amelioration', icon: ArrowPathIcon, status: 'pending' },
  { id: 'COMPLETED', label: 'Termine', icon: CheckCircleIcon, status: 'pending' }
]

export default function WorkshopGeneration() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [steps, setSteps] = useState<GenerationStep[]>(GENERATION_STEPS)
  const [currentStatus, setCurrentStatus] = useState<string>('PENDING')
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [finalContent, setFinalContent] = useState<any>(null)
  const [validationResult, setValidationResult] = useState<any>(null)

  const eventSourceRef = useRef<EventSource | null>(null)

  // Fetch initial status
  const { data: statusData, refetch } = useQuery({
    queryKey: ['workshop-generation-status', sessionId],
    queryFn: () => workshopGenerationApi.status(sessionId!),
    enabled: !!sessionId,
    refetchInterval: currentStatus !== 'COMPLETED' && currentStatus !== 'FAILED' ? 2000 : false
  })

  // Create workshop mutation
  const createWorkshop = useMutation({
    mutationFn: (title?: string) => workshopGenerationApi.createWorkshop(sessionId!, title),
    onSuccess: (response) => {
      toast.success('Atelier cree avec succes !')
      navigate(`/workshops/${response.data.data.id}`)
    },
    onError: () => {
      toast.error('Erreur lors de la creation')
    }
  })

  // Update state from status data
  useEffect(() => {
    if (statusData?.data?.data) {
      const data = statusData.data.data
      setCurrentStatus(data.status)
      setProgress(data.progress || 0)
      setCurrentStep(data.currentStep || '')
      if (data.error) setError(data.error)
      if (data.finalContent) setFinalContent(data.finalContent)
      if (data.validationResult) setValidationResult(data.validationResult)

      // Update steps status
      setSteps(prevSteps => {
        const statusIndex = GENERATION_STEPS.findIndex(s => s.id === data.status)
        return prevSteps.map((step, idx) => {
          const stepIndex = GENERATION_STEPS.findIndex(s => s.id === step.id)
          if (stepIndex < statusIndex) {
            return { ...step, status: 'completed' }
          } else if (stepIndex === statusIndex) {
            return { ...step, status: data.status === 'FAILED' ? 'error' : 'active' }
          }
          return { ...step, status: 'pending' }
        })
      })
    }
  }, [statusData])

  // Connect to SSE stream
  useEffect(() => {
    if (!sessionId) return

    const eventSource = new EventSource(workshopGenerationApi.stream(sessionId), {
      withCredentials: true
    })
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'status') {
          setCurrentStatus(data.status)
          setProgress(data.progress || 0)
          setCurrentStep(data.currentStep || '')
          if (data.error) setError(data.error)
        } else if (data.type === 'complete') {
          setFinalContent(data.finalContent)
          setValidationResult(data.validationResult)
        }
      } catch (e) {
        console.error('SSE parse error:', e)
      }
    }

    eventSource.onerror = () => {
      // Fallback to polling
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [sessionId])

  const isComplete = currentStatus === 'COMPLETED'
  const isFailed = currentStatus === 'FAILED'

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/50 mb-4">
          <SparklesIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isComplete ? 'Atelier genere !' : isFailed ? 'Erreur de generation' : 'Generation en cours...'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {isComplete
            ? 'Votre atelier pedagogique est pret'
            : isFailed
            ? 'Une erreur est survenue pendant la generation'
            : currentStep}
        </p>
      </div>

      {/* Progress Bar */}
      {!isComplete && !isFailed && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Progression</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{progress}%</span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="card mb-8">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Etapes de generation</h2>
        <div className="space-y-3">
          {steps.map((step, index) => {
            const StepIcon = step.icon
            return (
              <div
                key={step.id}
                className={clsx(
                  'flex items-center gap-4 p-3 rounded-lg transition-all',
                  step.status === 'active' && 'bg-purple-50 dark:bg-purple-900/30',
                  step.status === 'completed' && 'bg-green-50 dark:bg-green-900/30',
                  step.status === 'error' && 'bg-red-50 dark:bg-red-900/30'
                )}
              >
                <div className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  step.status === 'pending' && 'bg-gray-200 dark:bg-gray-700',
                  step.status === 'active' && 'bg-purple-500 animate-pulse',
                  step.status === 'completed' && 'bg-green-500',
                  step.status === 'error' && 'bg-red-500'
                )}>
                  {step.status === 'active' ? (
                    <ArrowPathIcon className="w-5 h-5 text-white animate-spin" />
                  ) : step.status === 'completed' ? (
                    <CheckCircleIcon className="w-5 h-5 text-white" />
                  ) : step.status === 'error' ? (
                    <XCircleIcon className="w-5 h-5 text-white" />
                  ) : (
                    <StepIcon className={clsx(
                      'w-5 h-5',
                      step.status === 'pending' ? 'text-gray-400' : 'text-white'
                    )} />
                  )}
                </div>
                <div className="flex-1">
                  <p className={clsx(
                    'font-medium',
                    step.status === 'pending' && 'text-gray-400 dark:text-gray-500',
                    step.status === 'active' && 'text-purple-700 dark:text-purple-300',
                    step.status === 'completed' && 'text-green-700 dark:text-green-300',
                    step.status === 'error' && 'text-red-700 dark:text-red-300'
                  )}>
                    {step.label}
                  </p>
                </div>
                {step.status === 'completed' && (
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Error State */}
      {isFailed && error && (
        <div className="card bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 mb-8">
          <div className="flex items-start gap-4">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-800 dark:text-red-200">Erreur de generation</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
              <button
                onClick={() => navigate(-1)}
                className="mt-4 btn-secondary"
              >
                Retour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success State - Preview */}
      {isComplete && finalContent && (
        <div className="space-y-6">
          {/* Validation Score */}
          {validationResult && (
            <div className={clsx(
              'card',
              validationResult.isValid
                ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
                : 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800'
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {validationResult.isValid ? (
                    <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
                  ) : (
                    <ExclamationTriangleIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                  )}
                  <div>
                    <h3 className={clsx(
                      'font-semibold',
                      validationResult.isValid
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-yellow-800 dark:text-yellow-200'
                    )}>
                      {validationResult.isValid ? 'Atelier valide' : 'Atelier genere avec avertissements'}
                    </h3>
                    <p className={clsx(
                      'text-sm',
                      validationResult.isValid
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-yellow-700 dark:text-yellow-300'
                    )}>
                      Score de confiance: {finalContent.confidenceScore}%
                    </p>
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {finalContent.confidenceScore}%
                </div>
              </div>
            </div>
          )}

          {/* Workshop Preview */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {finalContent.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {finalContent.description}
            </p>

            {/* Timeline Preview */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-gray-400" />
                Deroulé de l'atelier
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {finalContent.timeline?.map((phase: any) => (
                  <div
                    key={phase.id}
                    className={clsx(
                      'flex-shrink-0 p-3 rounded-lg border',
                      phase.type === 'accueil' && 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
                      phase.type === 'decouverte' && 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
                      phase.type === 'appropriation' && 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
                      phase.type === 'application' && 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
                      phase.type === 'synthese' && 'bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800'
                    )}
                  >
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{phase.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{phase.duration} min</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Activities Count */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {finalContent.activities?.length || 0}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Activites</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {finalContent.materials?.length || 0}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Materiels</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {finalContent.competencyCoverage?.length || 0}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Competences</p>
              </div>
            </div>

            {/* Key Takeaways */}
            {finalContent.synthesis?.keyTakeaways && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Points cles</h3>
                <ul className="space-y-2">
                  {finalContent.synthesis.keyTakeaways.slice(0, 3).map((takeaway: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      {takeaway}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => navigate(-1)}
              className="btn-secondary flex-1"
            >
              Modifier les parametres
            </button>
            <button
              onClick={() => createWorkshop.mutate()}
              disabled={createWorkshop.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {createWorkshop.isPending && (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              )}
              Creer l'atelier
            </button>
          </div>
        </div>
      )}

      {/* Waiting animation */}
      {!isComplete && !isFailed && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <ClockIcon className="w-5 h-5" />
            <span>Generation en cours, veuillez patienter...</span>
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Cela peut prendre 1-2 minutes
          </p>
        </div>
      )}
    </div>
  )
}
