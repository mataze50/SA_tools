import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { templatesApi } from '../lib/api'
import {
  XMarkIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const templateTypes = [
  { id: 'DISCOVERY', label: 'Découverte', description: 'Pour initier à une compétence' },
  { id: 'IMPROVEMENT', label: 'Perfectionnement', description: 'Pour approfondir une compétence' },
  { id: 'REMEDIATION', label: 'Remédiation', description: 'Pour corriger des lacunes' },
  { id: 'CUSTOM', label: 'Personnalisé', description: 'Autre type de template' }
]

interface SaveAsTemplateModalProps {
  sheetId: string
  sheetTitle: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function SaveAsTemplateModal({
  sheetId,
  sheetTitle,
  isOpen,
  onClose,
  onSuccess
}: SaveAsTemplateModalProps) {
  const [name, setName] = useState(`Template - ${sheetTitle}`)
  const [description, setDescription] = useState('')
  const [type, setType] = useState<string>('CUSTOM')
  const [isPublic, setIsPublic] = useState(false)
  const [includeObjectives, setIncludeObjectives] = useState(true)
  const [includeSituations, setIncludeSituations] = useState(true)
  const [includeFlow, setIncludeFlow] = useState(true)
  const [includeEvaluation, setIncludeEvaluation] = useState(true)

  const saveTemplateMutation = useMutation({
    mutationFn: (data: any) => templatesApi.createFromSheet(sheetId, data),
    onSuccess: () => {
      toast.success('Template créé avec succès !')
      onClose()
      onSuccess?.()
    },
    onError: () => {
      toast.error('Erreur lors de la création du template')
    }
  })

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Veuillez donner un nom au template')
      return
    }

    saveTemplateMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      isPublic,
      includeObjectives,
      includeSituations,
      includeFlow,
      includeEvaluation
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <DocumentDuplicateIcon className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Sauvegarder comme template
              </h3>
              <p className="text-sm text-gray-500">
                Réutilisez cette structure pour de futures fiches
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="label">Nom du template *</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Atelier découverte communication"
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez l'utilisation de ce template..."
            />
          </div>

          {/* Type */}
          <div>
            <label className="label">Type de template</label>
            <div className="grid grid-cols-2 gap-2">
              {templateTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={clsx(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    type === t.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <p className={clsx(
                    'font-medium text-sm',
                    type === t.id ? 'text-primary-700' : 'text-gray-900'
                  )}>
                    {t.label}
                  </p>
                  <p className="text-xs text-gray-500">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="label">Visibilité</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={clsx(
                  'flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all',
                  !isPublic
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <LockClosedIcon className="w-5 h-5" />
                Privé (moi seul)
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={clsx(
                  'flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all',
                  isPublic
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <GlobeAltIcon className="w-5 h-5" />
                Public (tous)
              </button>
            </div>
          </div>

          {/* Content to include */}
          <div>
            <label className="label">Éléments à inclure</label>
            <div className="space-y-2">
              {[
                { key: 'objectives', label: 'Objectifs pédagogiques', state: includeObjectives, setState: setIncludeObjectives },
                { key: 'situations', label: 'Situations professionnelles', state: includeSituations, setState: setIncludeSituations },
                { key: 'flow', label: 'Déroulé pédagogique', state: includeFlow, setState: setIncludeFlow },
                { key: 'evaluation', label: 'Évaluation', state: includeEvaluation, setState: setIncludeEvaluation }
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={item.state}
                    onChange={(e) => item.setState(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Le contexte (secteur, public, format, durée) est toujours inclus.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saveTemplateMutation.isPending || !name.trim()}
            className="btn-primary flex-1"
          >
            {saveTemplateMutation.isPending ? (
              <>
                <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-4 h-4 mr-2" />
                Créer le template
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
