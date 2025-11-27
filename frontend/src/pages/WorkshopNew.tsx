import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { workshopsApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import CompetencySelector from '../components/CompetencySelector'
import {
  ArrowLeftIcon,
  SparklesIcon,
  ClockIcon,
  UsersIcon,
  MapPinIcon,
  ArrowPathIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface SelectedCompetency {
  id: string
  code: string
  title: string
  isPrimary: boolean
}

const FORMAT_OPTIONS = [
  { value: 'IN_PERSON', label: 'Presentiel', description: 'Animation en salle avec participants physiques' },
  { value: 'REMOTE_SYNC', label: 'Distanciel synchrone', description: 'Visioconference en direct' },
  { value: 'REMOTE_ASYNC', label: 'Distanciel asynchrone', description: 'Formation a son rythme' },
  { value: 'HYBRID', label: 'Hybride', description: 'Melange presentiel et distanciel' }
]

const DURATION_PRESETS = [
  { value: 60, label: '1h' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2h' },
  { value: 180, label: '3h' },
  { value: 240, label: '4h (demi-journee)' },
  { value: 420, label: '7h (journee complete)' }
]

const AUDIENCE_SUGGESTIONS = [
  'Conseillers en insertion professionnelle',
  'Conseillers en evolution professionnelle',
  'Equipe de formateurs',
  'Managers de proximite',
  'Nouveaux collaborateurs',
  'Equipe RH'
]

export default function WorkshopNew() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  // Form state
  const [step, setStep] = useState(1)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [sector, setSector] = useState(user?.sector || '')
  const [audienceType, setAudienceType] = useState('')
  const [format, setFormat] = useState('IN_PERSON')
  const [duration, setDuration] = useState(120)
  const [customDuration, setCustomDuration] = useState('')
  const [participantMin, setParticipantMin] = useState(6)
  const [participantMax, setParticipantMax] = useState(12)
  const [selectedCompetencies, setSelectedCompetencies] = useState<SelectedCompetency[]>([])

  // Create workshop mutation
  const createWorkshop = useMutation({
    mutationFn: () => workshopsApi.create({
      title: subject,
      description,
      sector,
      audienceType,
      format,
      duration: customDuration ? parseInt(customDuration) : duration,
      participantMin,
      participantMax,
      competencyIds: selectedCompetencies.map(c => c.id)
    }),
    onSuccess: (response) => {
      toast.success('Atelier cree avec succes !')
      navigate(`/workshops/${response.data.data.id}`)
    },
    onError: () => {
      toast.error('Erreur lors de la creation')
    }
  })

  const canProceed = () => {
    switch (step) {
      case 1:
        return subject.trim().length >= 5
      case 2:
        return selectedCompetencies.length >= 1
      case 3:
        return sector.trim().length >= 2 && audienceType.trim().length >= 2
      case 4:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1)
    } else {
      createWorkshop.mutate()
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Retour
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <SparklesIcon className="w-8 h-8 text-primary-500" />
          Creer un nouvel atelier
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Definissez votre sujet et selectionnez les competences ciblees
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: 'Sujet' },
            { num: 2, label: 'Competences' },
            { num: 3, label: 'Contexte' },
            { num: 4, label: 'Parametres' }
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                step >= s.num
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              )}>
                {s.num}
              </div>
              <span className={clsx(
                'ml-2 text-sm hidden sm:inline',
                step >= s.num ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
              )}>
                {s.label}
              </span>
              {idx < 3 && (
                <div className={clsx(
                  'w-12 sm:w-20 h-0.5 mx-2',
                  step > s.num ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="card">
        {/* Step 1: Subject */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Quel est le sujet de votre atelier ?
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Decrivez le theme principal que vous souhaitez aborder
              </p>
            </div>

            <div>
              <label className="label">Titre / Sujet de l'atelier *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Accompagner les transitions professionnelles des seniors"
                className="input"
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-500">
                Minimum 5 caracteres
              </p>
            </div>

            <div>
              <label className="label">Description (optionnel)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Decrivez plus en detail les objectifs et le contexte de cet atelier..."
                className="input min-h-[100px]"
                rows={4}
              />
            </div>

            {/* Subject suggestions */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
              <div className="flex items-start gap-2">
                <LightBulbIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Exemples de sujets
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300">
                    <li>• Developper son reseau professionnel efficacement</li>
                    <li>• Preparer un entretien d'embauche</li>
                    <li>• Gerer les situations difficiles en accompagnement</li>
                    <li>• Decouvrir les outils numeriques de recherche d'emploi</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Competencies */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Quelles competences souhaitez-vous developper ?
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Selectionnez 1 a 5 competences du referentiel CEP
              </p>
            </div>

            <CompetencySelector
              selected={selectedCompetencies}
              onChange={setSelectedCompetencies}
              maxSelection={5}
            />
          </div>
        )}

        {/* Step 3: Context */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Contexte de l'atelier
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Definissez le public cible et le secteur d'activite
              </p>
            </div>

            <div>
              <label className="label">Secteur d'activite *</label>
              <input
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Ex: Mission Locale, France Travail, Cabinet RH..."
                className="input"
              />
            </div>

            <div>
              <label className="label">Public cible *</label>
              <input
                type="text"
                value={audienceType}
                onChange={(e) => setAudienceType(e.target.value)}
                placeholder="Ex: Conseillers en insertion professionnelle"
                className="input"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {AUDIENCE_SUGGESTIONS.map(suggestion => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setAudienceType(suggestion)}
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Parameters */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Parametres de l'atelier
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Configurez le format, la duree et le nombre de participants
              </p>
            </div>

            {/* Format */}
            <div>
              <label className="label flex items-center gap-2">
                <MapPinIcon className="w-4 h-4" />
                Format de l'atelier
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FORMAT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormat(opt.value)}
                    className={clsx(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      format === opt.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <p className="font-medium text-gray-900 dark:text-white">{opt.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="label flex items-center gap-2">
                <ClockIcon className="w-4 h-4" />
                Duree totale
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {DURATION_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      setDuration(preset.value)
                      setCustomDuration('')
                    }}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      duration === preset.value && !customDuration
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">ou</span>
                <input
                  type="number"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  placeholder="Duree personnalisee"
                  className="input w-40"
                  min={30}
                  max={480}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">minutes</span>
              </div>
            </div>

            {/* Participants */}
            <div>
              <label className="label flex items-center gap-2">
                <UsersIcon className="w-4 h-4" />
                Nombre de participants
              </label>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Min</span>
                  <input
                    type="number"
                    value={participantMin}
                    onChange={(e) => setParticipantMin(parseInt(e.target.value) || 1)}
                    className="input w-20 ml-2"
                    min={1}
                    max={50}
                  />
                </div>
                <span className="text-gray-400">-</span>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Max</span>
                  <input
                    type="number"
                    value={participantMax}
                    onChange={(e) => setParticipantMax(parseInt(e.target.value) || 1)}
                    className="input w-20 ml-2"
                    min={1}
                    max={100}
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Recapitulatif</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600 dark:text-gray-400">Sujet:</dt>
                  <dd className="font-medium text-gray-900 dark:text-white truncate max-w-[250px]">{subject}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600 dark:text-gray-400">Competences:</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {selectedCompetencies.map(c => c.code).join(', ')}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600 dark:text-gray-400">Public:</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{audienceType}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600 dark:text-gray-400">Format:</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {FORMAT_OPTIONS.find(f => f.value === format)?.label}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600 dark:text-gray-400">Duree:</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {customDuration || duration} minutes
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="btn-secondary"
            >
              Precedent
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={handleNext}
            disabled={!canProceed() || createWorkshop.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {createWorkshop.isPending && (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            )}
            {step === 4 ? 'Creer l\'atelier' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  )
}
