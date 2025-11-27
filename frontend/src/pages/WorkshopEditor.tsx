import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { workshopsApi, workshopExportApi } from '../lib/api'
import {
  ArrowLeftIcon,
  ClockIcon,
  UsersIcon,
  MapPinIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  DocumentArrowDownIcon,
  SparklesIcon,
  AcademicCapIcon,
  BookOpenIcon,
  ClipboardDocumentCheckIcon,
  LightBulbIcon,
  ChatBubbleLeftRightIcon,
  PlayIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface WorkshopActivity {
  id: string
  title: string
  description: string
  duration: number
  type: string
  bloomLevel: number
  instructions: string[]
  materials: string[]
  competencyLinks: string[]
}

interface TimelinePhase {
  id: string
  name: string
  duration: number
  type: string
  description: string
  activities: string[]
}

export default function WorkshopEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'activities' | 'materials' | 'evaluation' | 'notes'>('overview')
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set())
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Fetch workshop
  const { data: workshopData, isLoading, error } = useQuery({
    queryKey: ['workshop', id],
    queryFn: () => workshopsApi.get(id!),
    enabled: !!id
  })

  const workshop = workshopData?.data?.data

  // Update workshop mutation
  const updateWorkshop = useMutation({
    mutationFn: (data: any) => workshopsApi.update(id!, data),
    onSuccess: () => {
      toast.success('Modifications enregistrees')
      queryClient.invalidateQueries({ queryKey: ['workshop', id] })
      setEditingSection(null)
    },
    onError: () => {
      toast.error('Erreur lors de la sauvegarde')
    }
  })

  // Update section mutation
  const updateSection = useMutation({
    mutationFn: ({ section, content }: { section: string; content: any }) =>
      workshopsApi.updateContent(id!, section, content),
    onSuccess: () => {
      toast.success('Section mise a jour')
      queryClient.invalidateQueries({ queryKey: ['workshop', id] })
      setEditingSection(null)
    },
    onError: () => {
      toast.error('Erreur lors de la mise a jour')
    }
  })

  const toggleActivity = (activityId: string) => {
    const newExpanded = new Set(expandedActivities)
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId)
    } else {
      newExpanded.add(activityId)
    }
    setExpandedActivities(newExpanded)
  }

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`
  }

  const getPhaseColor = (type: string): string => {
    const colors: Record<string, string> = {
      accueil: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700',
      decouverte: 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700',
      appropriation: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700',
      application: 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700',
      synthese: 'bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700'
    }
    return colors[type] || 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
  }

  const getBloomLabel = (level: number): string => {
    const labels = ['', 'Connaitre', 'Comprendre', 'Appliquer', 'Analyser', 'Evaluer', 'Creer']
    return labels[level] || ''
  }

  const handleExportScorm = async (version: string = '1.2') => {
    if (!id) return
    setIsExporting(true)
    setShowExportMenu(false)

    try {
      const response = await workshopExportApi.scorm(id, { version })
      const blob = new Blob([response.data], { type: 'application/zip' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `atelier_${workshop?.title?.substring(0, 30) || 'export'}_SCORM${version.replace(/[.-]/g, '')}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Export SCORM telecharge !')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'export SCORM')
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !workshop) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Atelier non trouve</p>
        <button onClick={() => navigate('/')} className="btn-primary mt-4">
          Retour a l'accueil
        </button>
      </div>
    )
  }

  const timeline = workshop.timeline || []
  const activities = workshop.activities || []
  const materials = workshop.materials || []
  const evaluation = workshop.evaluation || {}
  const trainerNotes = workshop.trainerNotes || {}
  const synthesis = workshop.synthesis || {}
  const introduction = workshop.introduction || {}

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Retour
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <SparklesIcon className="w-8 h-8 text-purple-500" />
              {workshop.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {workshop.description}
            </p>
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="btn-secondary flex items-center gap-2"
            >
              {isExporting ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowDownTrayIcon className="w-4 h-4" />
              )}
              {isExporting ? 'Export...' : 'Exporter'}
              <ChevronDownIcon className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <div className="p-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2 font-medium">
                    Export SCORM (e-learning)
                  </p>
                  <button
                    onClick={() => handleExportScorm('1.2')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    SCORM 1.2 (compatibilite max)
                  </button>
                  <button
                    onClick={() => handleExportScorm('2004-3rd')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    SCORM 2004 3rd Edition
                  </button>
                  <button
                    onClick={() => handleExportScorm('2004-4th')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    SCORM 2004 4th Edition
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <ClockIcon className="w-4 h-4" />
            {formatDuration(workshop.duration)}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <UsersIcon className="w-4 h-4" />
            {workshop.participantMin}-{workshop.participantMax} participants
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <MapPinIcon className="w-4 h-4" />
            {workshop.format === 'IN_PERSON' ? 'Presentiel' :
             workshop.format === 'REMOTE_SYNC' ? 'Distanciel synchrone' :
             workshop.format === 'REMOTE_ASYNC' ? 'Distanciel asynchrone' : 'Hybride'}
          </div>
          {workshop.confidenceScore > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <div className={clsx(
                'px-2 py-0.5 rounded-full font-medium',
                workshop.confidenceScore >= 85 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                workshop.confidenceScore >= 70 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
              )}>
                Score: {workshop.confidenceScore}%
              </div>
            </div>
          )}
        </div>

        {/* Competencies */}
        <div className="flex flex-wrap gap-2 mt-4">
          {workshop.competencies?.map((wc: any) => (
            <span
              key={wc.id}
              className={clsx(
                'px-3 py-1 rounded-full text-sm',
                wc.isPrimary
                  ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              )}
            >
              {wc.competency?.code} {wc.isPrimary && '★'}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-6 -mb-px">
          {[
            { id: 'overview', label: 'Vue d\'ensemble', icon: BookOpenIcon },
            { id: 'timeline', label: 'Deroulé', icon: ClockIcon },
            { id: 'activities', label: 'Activites', icon: AcademicCapIcon },
            { id: 'materials', label: 'Materiels', icon: ClipboardDocumentCheckIcon },
            { id: 'evaluation', label: 'Evaluation', icon: CheckCircleIcon },
            { id: 'notes', label: 'Notes formateur', icon: ChatBubbleLeftRightIcon }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                'flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Introduction */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <BookOpenIcon className="w-5 h-5 text-primary-500" />
                  Introduction
                </h2>
                <button className="text-primary-600 dark:text-primary-400 hover:text-primary-700 text-sm flex items-center gap-1">
                  <PencilSquareIcon className="w-4 h-4" />
                  Modifier
                </button>
              </div>

              {introduction.hook && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Accroche</h3>
                  <p className="text-gray-600 dark:text-gray-400">{introduction.hook}</p>
                </div>
              )}

              {introduction.objectives && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Objectifs pedagogiques</h3>
                  <ul className="space-y-1">
                    {introduction.objectives.map((obj: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                        <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {introduction.icebreaker && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <LightBulbIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div>
                      <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Icebreaker suggere</h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300">{introduction.icebreaker}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline Preview */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-primary-500" />
                Deroulé de l'atelier
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {timeline.map((phase: TimelinePhase) => (
                  <div
                    key={phase.id}
                    className={clsx(
                      'flex-shrink-0 p-4 rounded-lg border-2 min-w-[150px]',
                      getPhaseColor(phase.type)
                    )}
                  >
                    <p className="font-medium text-gray-900 dark:text-white">{phase.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{phase.duration} min</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">{phase.activities?.length || 0} activite(s)</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Takeaways */}
            {synthesis.keyTakeaways && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <LightBulbIcon className="w-5 h-5 text-primary-500" />
                  Points cles a retenir
                </h2>
                <ul className="space-y-2">
                  {synthesis.keyTakeaways.map((takeaway: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 text-sm font-medium flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Deroulé detaille</h2>
              <button className="text-primary-600 dark:text-primary-400 hover:text-primary-700 text-sm flex items-center gap-1">
                <PencilSquareIcon className="w-4 h-4" />
                Modifier
              </button>
            </div>

            <div className="space-y-4">
              {timeline.map((phase: TimelinePhase, idx: number) => (
                <div
                  key={phase.id}
                  className={clsx(
                    'p-4 rounded-lg border-l-4',
                    getPhaseColor(phase.type)
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{phase.name}</h3>
                    <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <ClockIcon className="w-4 h-4" />
                      {phase.duration} min
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{phase.description}</p>

                  {phase.activities?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">Activites:</p>
                      <div className="flex flex-wrap gap-2">
                        {phase.activities.map((actId: string) => {
                          const activity = activities.find((a: WorkshopActivity) => a.id === actId)
                          return activity ? (
                            <span
                              key={actId}
                              className="px-2 py-1 bg-white dark:bg-gray-900 rounded text-xs text-gray-700 dark:text-gray-300"
                            >
                              {activity.title}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total Duration */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Duree totale</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatDuration(timeline.reduce((acc: number, p: TimelinePhase) => acc + p.duration, 0))}
              </span>
            </div>
          </div>
        )}

        {/* Activities Tab */}
        {activeTab === 'activities' && (
          <div className="space-y-4">
            {activities.map((activity: WorkshopActivity) => (
              <div key={activity.id} className="card">
                <button
                  onClick={() => toggleActivity(activity.id)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                      <AcademicCapIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{activity.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          {activity.duration} min
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                          {activity.type}
                        </span>
                        {activity.bloomLevel && (
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded text-xs">
                            Bloom: {getBloomLabel(activity.bloomLevel)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedActivities.has(activity.id) ? (
                    <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {expandedActivities.has(activity.id) && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</h4>
                      <p className="text-gray-600 dark:text-gray-400">{activity.description}</p>
                    </div>

                    {activity.instructions?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Deroulement</h4>
                        <ol className="space-y-2">
                          {activity.instructions.map((instr: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs flex-shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-gray-600 dark:text-gray-400">{instr}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {activity.materials?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Materiels necessaires</h4>
                        <div className="flex flex-wrap gap-2">
                          {activity.materials.map((mat: string, idx: number) => (
                            <span key={idx} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm text-gray-600 dark:text-gray-400">
                              {mat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {activity.competencyLinks?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Competences travaillees</h4>
                        <div className="flex flex-wrap gap-2">
                          {activity.competencyLinks.map((comp: string, idx: number) => (
                            <span key={idx} className="px-2 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-sm">
                              {comp}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Materials Tab */}
        {activeTab === 'materials' && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Liste du materiel</h2>
              <button className="text-primary-600 dark:text-primary-400 hover:text-primary-700 text-sm flex items-center gap-1">
                <PencilSquareIcon className="w-4 h-4" />
                Modifier
              </button>
            </div>

            {materials.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">Aucun materiel specifie</p>
            ) : (
              <div className="space-y-3">
                {materials.map((material: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <ClipboardDocumentCheckIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{material.name || material}</p>
                      {material.quantity && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Quantite: {material.quantity}</p>
                      )}
                    </div>
                    {material.optional && (
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 rounded text-xs">
                        Optionnel
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Evaluation Tab */}
        {activeTab === 'evaluation' && (
          <div className="space-y-6">
            {/* Evaluation Criteria */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Criteres d'evaluation</h2>
              {evaluation.criteria?.length > 0 ? (
                <div className="space-y-3">
                  {evaluation.criteria.map((criterion: any, idx: number) => (
                    <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="font-medium text-gray-900 dark:text-white">{criterion.name || criterion}</p>
                      {criterion.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{criterion.description}</p>
                      )}
                      {criterion.indicators && (
                        <ul className="mt-2 space-y-1">
                          {criterion.indicators.map((ind: string, i: number) => (
                            <li key={i} className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              <CheckCircleIcon className="w-4 h-4 text-green-500" />
                              {ind}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Aucun critere d'evaluation defini</p>
              )}
            </div>

            {/* Assessment Methods */}
            {evaluation.methods && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Methodes d'evaluation</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {evaluation.methods.map((method: any, idx: number) => (
                    <div key={idx} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <h3 className="font-medium text-gray-900 dark:text-white">{method.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{method.description}</p>
                      {method.timing && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Moment: {method.timing}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trainer Notes Tab */}
        {activeTab === 'notes' && (
          <div className="space-y-6">
            {/* Tips */}
            {trainerNotes.tips && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <LightBulbIcon className="w-5 h-5 text-amber-500" />
                  Conseils pour l'animateur
                </h2>
                <ul className="space-y-2">
                  {trainerNotes.tips.map((tip: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                      <span className="text-amber-600 dark:text-amber-400">💡</span>
                      <span className="text-gray-700 dark:text-gray-300">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Common Issues */}
            {trainerNotes.commonIssues && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Points de vigilance</h2>
                <ul className="space-y-2">
                  {trainerNotes.commonIssues.map((issue: any, idx: number) => (
                    <li key={idx} className="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg">
                      <p className="font-medium text-red-800 dark:text-red-200">{issue.issue || issue}</p>
                      {issue.solution && (
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          <span className="font-medium">Solution:</span> {issue.solution}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Adaptations */}
            {trainerNotes.adaptations && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Adaptations possibles</h2>
                <div className="space-y-3">
                  {trainerNotes.adaptations.map((adaptation: any, idx: number) => (
                    <div key={idx} className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <p className="font-medium text-blue-800 dark:text-blue-200">{adaptation.context || adaptation}</p>
                      {adaptation.suggestion && (
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{adaptation.suggestion}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
