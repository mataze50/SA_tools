import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { competenciesApi, generationApi } from '../lib/api'
import {
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

// Options for dropdowns
const sectors = [
  'Conseil en évolution professionnelle (CEP)',
  'Outplacement',
  'Bilan de compétences',
  'Formation professionnelle',
  'Insertion professionnelle',
  'Ressources humaines'
]

const audienceTypes = [
  'Consultants débutants (< 2 ans)',
  'Consultants confirmés (2-5 ans)',
  'Consultants experts (> 5 ans)',
  'Managers',
  'Public mixte'
]

const formats = [
  { value: 'IN_PERSON', label: 'Présentiel' },
  { value: 'REMOTE_SYNC', label: 'Distanciel synchrone (visio)' },
  { value: 'REMOTE_ASYNC', label: 'Distanciel asynchrone' },
  { value: 'HYBRID', label: 'Hybride' }
]

const constraints = [
  { id: 'digital', label: 'Participants peu à l\'aise avec le numérique' },
  { id: 'time', label: 'Temps de préparation très limité' },
  { id: 'heterogeneous', label: 'Groupe hétérogène (niveaux variés)' },
  { id: 'large', label: 'Groupe nombreux (> 12 personnes)' }
]

const priorities = [
  { id: 'conform', label: 'Je veux être sûr d\'être conforme au référentiel' },
  { id: 'realistic', label: 'Je veux des situations réalistes et actuelles' },
  { id: 'detailed', label: 'Je veux un déroulé très détaillé minute par minute' },
  { id: 'flexible', label: 'Je veux pouvoir personnaliser facilement après' }
]

export default function CreateSheet() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCompetency, setSelectedCompetency] = useState<any>(null)

  const [formData, setFormData] = useState({
    sector: sectors[0],
    audienceType: audienceTypes[1],
    format: 'IN_PERSON',
    duration: 75,
    constraints: [] as string[],
    priorities: ['conform', 'realistic'] as string[]
  })

  // Fetch competencies
  const { data: competenciesData, isLoading: loadingCompetencies } = useQuery({
    queryKey: ['competencies', searchQuery],
    queryFn: () => competenciesApi.list({ search: searchQuery || undefined })
  })

  const competencies = competenciesData?.data?.data?.all || []
  const competenciesByAxis = competenciesData?.data?.data?.byAxis || []

  // Start generation
  const startGeneration = useMutation({
    mutationFn: () =>
      generationApi.start({
        competencyId: selectedCompetency.id,
        sector: formData.sector,
        audienceType: formData.audienceType,
        format: formData.format,
        constraints: formData.constraints,
        priorities: formData.priorities,
        duration: formData.duration
      }),
    onSuccess: (res) => {
      const sessionId = res.data.data.sessionId
      navigate(`/generate/${sessionId}`)
    },
    onError: () => {
      toast.error('Erreur lors du lancement de la génération')
    }
  })

  const handleConstraintToggle = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      constraints: prev.constraints.includes(id)
        ? prev.constraints.filter((c) => c !== id)
        : [...prev.constraints, id]
    }))
  }

  const handlePriorityToggle = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      priorities: prev.priorities.includes(id)
        ? prev.priorities.filter((p) => p !== id)
        : [...prev.priorities, id]
    }))
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => (step === 1 ? navigate('/') : setStep(step - 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Nouvelle fiche</h1>
          <p className="text-sm text-gray-500">Étape {step}/2</p>
        </div>
      </div>

      {/* Mode switch banner */}
      {step === 1 && (
        <Link
          to="/create/chat"
          className="flex items-center justify-between p-4 mb-6 bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-200 rounded-xl hover:border-primary-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-primary-500" />
            <div>
              <p className="font-medium text-gray-900">Préfères-tu être guidé(e) ?</p>
              <p className="text-sm text-gray-600">Essaie le mode conversationnel : réponds à quelques questions</p>
            </div>
          </div>
          <span className="text-sm text-primary-600 font-medium">Essayer →</span>
        </Link>
      )}

      {/* Step 1: Select competency */}
      {step === 1 && (
        <div className="card animate-slide-in">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            📚 Quelle compétence veux-tu travailler ?
          </h2>

          {/* Search */}
          <div className="relative mb-6">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              className="input pl-10"
              placeholder="Rechercher une compétence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Competencies by axis */}
          {loadingCompetencies ? (
            <div className="py-8 text-center text-gray-500">Chargement...</div>
          ) : (
            <div className="space-y-6">
              {competenciesByAxis.map((group: any) => (
                <div key={group.axis}>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    {group.axis} — {group.axisName}
                  </h3>
                  <div className="space-y-2">
                    {group.competencies.map((comp: any) => (
                      <button
                        key={comp.id}
                        onClick={() => {
                          setSelectedCompetency(comp)
                          setStep(2)
                        }}
                        className={clsx(
                          'w-full text-left p-3 rounded-lg border transition-all',
                          selectedCompetency?.id === comp.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        )}
                      >
                        <span className="font-medium text-primary-600">
                          {comp.code}
                        </span>
                        <span className="text-gray-600"> — {comp.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Context & preferences */}
      {step === 2 && selectedCompetency && (
        <div className="card animate-slide-in">
          {/* Selected competency */}
          <div className="mb-6 p-3 bg-primary-50 rounded-lg">
            <p className="text-sm text-gray-500">Compétence sélectionnée</p>
            <p className="font-medium text-primary-700">
              {selectedCompetency.code} — {selectedCompetency.title}
            </p>
            <button
              onClick={() => setStep(1)}
              className="text-sm text-primary-600 hover:underline mt-1"
            >
              Modifier
            </button>
          </div>

          {/* Context form */}
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            📋 Précise ton contexte
          </h2>

          <div className="space-y-4">
            {/* Sector */}
            <div>
              <label className="label">Secteur d'activité</label>
              <select
                className="input"
                value={formData.sector}
                onChange={(e) =>
                  setFormData({ ...formData, sector: e.target.value })
                }
              >
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Audience */}
            <div>
              <label className="label">Type de public</label>
              <select
                className="input"
                value={formData.audienceType}
                onChange={(e) =>
                  setFormData({ ...formData, audienceType: e.target.value })
                }
              >
                {audienceTypes.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Format */}
            <div>
              <label className="label">Format prévu</label>
              <select
                className="input"
                value={formData.format}
                onChange={(e) =>
                  setFormData({ ...formData, format: e.target.value })
                }
              >
                {formats.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="label">Durée (minutes)</label>
              <input
                type="number"
                className="input"
                min={15}
                max={480}
                value={formData.duration}
                onChange={(e) =>
                  setFormData({ ...formData, duration: parseInt(e.target.value) || 75 })
                }
              />
            </div>

            {/* Constraints */}
            <div>
              <label className="label">Contraintes particulières (optionnel)</label>
              <div className="space-y-2">
                {constraints.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.constraints.includes(c.id)}
                      onChange={() => handleConstraintToggle(c.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Priorities */}
            <div>
              <label className="label">
                🎯 Qu'est-ce qui compte le plus pour toi ?
              </label>
              <div className="space-y-2">
                {priorities.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.priorities.includes(p.id)}
                      onChange={() => handlePriorityToggle(p.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{p.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Ces priorités aident l'IA à mieux cibler ce qui est important pour toi
              </p>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={() => startGeneration.mutate()}
            disabled={startGeneration.isPending}
            className="btn-primary w-full mt-6"
          >
            {startGeneration.isPending ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Lancement...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5" />
                Générer ma fiche
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
