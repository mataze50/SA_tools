import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { sheetsApi, remixApi } from '../lib/api'
import {
  ArrowPathIcon,
  SparklesIcon,
  ChevronLeftIcon,
  CheckIcon,
  XMarkIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

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
  { value: 'REMOTE_SYNC', label: 'Distanciel synchrone' },
  { value: 'REMOTE_ASYNC', label: 'Distanciel asynchrone' },
  { value: 'HYBRID', label: 'Hybride' }
]

export default function RemixSheet() {
  const { sourceId } = useParams()
  const navigate = useNavigate()

  const [changes, setChanges] = useState({
    sector: '',
    audienceType: '',
    format: '' as '' | 'IN_PERSON' | 'REMOTE_SYNC' | 'REMOTE_ASYNC' | 'HYBRID',
    duration: 0,
    keepObjectives: true,
    keepSituations: false,
    keepFlow: true,
    additionalInstructions: ''
  })

  // Fetch source sheet
  const { data: sheetData, isLoading } = useQuery({
    queryKey: ['sheet', sourceId],
    queryFn: () => sheetsApi.get(sourceId!),
    enabled: !!sourceId
  })

  const sheet = sheetData?.data?.data

  // Initialize changes from source sheet
  useEffect(() => {
    if (sheet) {
      setChanges(prev => ({
        ...prev,
        sector: sheet.sector,
        audienceType: sheet.audienceType,
        format: sheet.format,
        duration: sheet.duration
      }))
    }
  }, [sheet])

  // Preview remix
  const previewMutation = useMutation({
    mutationFn: () => remixApi.preview(sourceId!, changes),
    onSuccess: (res) => {
      // Show preview data
      console.log('Preview:', res.data.data)
    }
  })

  // Create remix
  const createRemix = useMutation({
    mutationFn: () => remixApi.create(sourceId!, changes),
    onSuccess: (res) => {
      toast.success('Remix lancé !')
      // Poll for completion
      pollRemixStatus(res.data.data.sessionId)
    },
    onError: () => {
      toast.error('Erreur lors du remix')
    }
  })

  // Poll remix status
  const pollRemixStatus = async (sessionId: string) => {
    const poll = async () => {
      const res = await remixApi.status(sessionId)
      const { status, sheetId } = res.data.data

      if (status === 'COMPLETED' && sheetId) {
        toast.success('Remix terminé !')
        navigate(`/sheet/${sheetId}`)
      } else if (status === 'FAILED') {
        toast.error('Le remix a échoué')
      } else {
        setTimeout(poll, 2000)
      }
    }
    poll()
  }

  const hasChanges = sheet && (
    changes.sector !== sheet.sector ||
    changes.audienceType !== sheet.audienceType ||
    changes.format !== sheet.format ||
    changes.duration !== sheet.duration
  )

  if (isLoading || !sheet) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ArrowsRightLeftIcon className="w-5 h-5 text-primary-500" />
            Mode Remix
          </h1>
          <p className="text-sm text-gray-500">
            Adapter "{sheet.title}" à un nouveau contexte
          </p>
        </div>
      </div>

      {/* Source sheet info */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">📋 Fiche source</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Compétence:</span>
            <p className="font-medium">{sheet.competency?.code} - {sheet.competency?.title}</p>
          </div>
          <div>
            <span className="text-gray-500">Secteur:</span>
            <p className="font-medium">{sheet.sector}</p>
          </div>
          <div>
            <span className="text-gray-500">Public:</span>
            <p className="font-medium">{sheet.audienceType}</p>
          </div>
          <div>
            <span className="text-gray-500">Durée:</span>
            <p className="font-medium">{sheet.duration} minutes</p>
          </div>
        </div>
      </div>

      {/* Changes form */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">🔄 Nouveau contexte</h2>

        <div className="space-y-4">
          {/* Sector */}
          <div>
            <label className="label">Secteur</label>
            <select
              className="input"
              value={changes.sector}
              onChange={(e) => setChanges(prev => ({ ...prev, sector: e.target.value }))}
            >
              {sectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {changes.sector !== sheet.sector && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ Les situations seront adaptées au nouveau secteur
              </p>
            )}
          </div>

          {/* Audience */}
          <div>
            <label className="label">Public cible</label>
            <select
              className="input"
              value={changes.audienceType}
              onChange={(e) => setChanges(prev => ({ ...prev, audienceType: e.target.value }))}
            >
              {audienceTypes.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Format */}
          <div>
            <label className="label">Format</label>
            <select
              className="input"
              value={changes.format}
              onChange={(e) => setChanges(prev => ({ ...prev, format: e.target.value as any }))}
            >
              {formats.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            {changes.format !== sheet.format && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ Le déroulé sera adapté au nouveau format
              </p>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="label">Durée (minutes)</label>
            <input
              type="number"
              className="input"
              min={15}
              max={480}
              value={changes.duration}
              onChange={(e) => setChanges(prev => ({ ...prev, duration: parseInt(e.target.value) || 75 }))}
            />
            {changes.duration !== sheet.duration && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ Le déroulé sera recalculé pour la nouvelle durée
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Keep/Adapt options */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">⚙️ Options de remix</h2>

        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={changes.keepObjectives}
              onChange={(e) => setChanges(prev => ({ ...prev, keepObjectives: e.target.checked }))}
              className="w-4 h-4 text-primary-600"
            />
            <div>
              <p className="font-medium text-gray-900">Garder les objectifs</p>
              <p className="text-sm text-gray-500">Les objectifs restent identiques</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={changes.keepSituations}
              onChange={(e) => setChanges(prev => ({ ...prev, keepSituations: e.target.checked }))}
              className="w-4 h-4 text-primary-600"
              disabled={changes.sector !== sheet.sector}
            />
            <div>
              <p className={clsx('font-medium', changes.sector !== sheet.sector ? 'text-gray-400' : 'text-gray-900')}>
                Garder les situations
              </p>
              <p className="text-sm text-gray-500">
                {changes.sector !== sheet.sector
                  ? 'Désactivé car le secteur change'
                  : 'Les situations restent identiques'}
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={changes.keepFlow}
              onChange={(e) => setChanges(prev => ({ ...prev, keepFlow: e.target.checked }))}
              className="w-4 h-4 text-primary-600"
              disabled={changes.duration !== sheet.duration || changes.format !== sheet.format}
            />
            <div>
              <p className={clsx(
                'font-medium',
                (changes.duration !== sheet.duration || changes.format !== sheet.format) ? 'text-gray-400' : 'text-gray-900'
              )}>
                Garder le déroulé
              </p>
              <p className="text-sm text-gray-500">
                {changes.duration !== sheet.duration || changes.format !== sheet.format
                  ? 'Désactivé car durée/format change'
                  : 'Le déroulé reste identique'}
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Additional instructions */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">💬 Instructions supplémentaires</h2>
        <textarea
          className="input"
          rows={3}
          placeholder="Ex: Ajoute plus d'exercices pratiques, simplifie le vocabulaire technique..."
          value={changes.additionalInstructions}
          onChange={(e) => setChanges(prev => ({ ...prev, additionalInstructions: e.target.value }))}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="btn-secondary flex-1"
        >
          Annuler
        </button>
        <button
          onClick={() => createRemix.mutate()}
          disabled={createRemix.isPending}
          className="btn-primary flex-1"
        >
          {createRemix.isPending ? (
            <>
              <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
              Remix en cours...
            </>
          ) : (
            <>
              <SparklesIcon className="w-5 h-5 mr-2" />
              Créer le remix
            </>
          )}
        </button>
      </div>

      {!hasChanges && (
        <p className="text-sm text-gray-500 text-center mt-4">
          💡 Modifie au moins un paramètre pour créer un remix
        </p>
      )}
    </div>
  )
}
