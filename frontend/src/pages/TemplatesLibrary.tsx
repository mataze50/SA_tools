import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { templatesApi, competenciesApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import {
  DocumentDuplicateIcon,
  PlusIcon,
  TrashIcon,
  GlobeAltIcon,
  LockClosedIcon,
  UserIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const templateTypes = [
  { id: '', label: 'Tous les types' },
  { id: 'DISCOVERY', label: 'Découverte', color: 'bg-blue-100 text-blue-700' },
  { id: 'IMPROVEMENT', label: 'Perfectionnement', color: 'bg-green-100 text-green-700' },
  { id: 'REMEDIATION', label: 'Remédiation', color: 'bg-orange-100 text-orange-700' },
  { id: 'CUSTOM', label: 'Personnalisé', color: 'bg-purple-100 text-purple-700' }
]

interface Template {
  id: string
  name: string
  description?: string
  type: string
  isPublic: boolean
  usageCount: number
  content: any
  userId: string
  user: { firstName: string; lastName: string }
  createdAt: string
}

export default function TemplatesLibrary() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const [typeFilter, setTypeFilter] = useState('')
  const [showPublicOnly, setShowPublicOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [useTemplateModal, setUseTemplateModal] = useState(false)
  const [newSheetTitle, setNewSheetTitle] = useState('')
  const [selectedCompetencyId, setSelectedCompetencyId] = useState('')

  // Fetch templates
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates', typeFilter, showPublicOnly],
    queryFn: () => templatesApi.list({
      type: typeFilter || undefined,
      isPublic: showPublicOnly || undefined
    })
  })

  // Fetch competencies for the modal
  const { data: competenciesData } = useQuery({
    queryKey: ['competencies'],
    queryFn: () => competenciesApi.list()
  })

  const templates: Template[] = templatesData?.data?.data || []
  const competencies = competenciesData?.data?.data || []

  // Use template mutation
  const useTemplateMutation = useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: any }) =>
      templatesApi.use(templateId, data),
    onSuccess: (res) => {
      toast.success('Fiche créée à partir du template !')
      navigate(`/sheet/${res.data.data.id}`)
    },
    onError: () => {
      toast.error('Erreur lors de la création')
    }
  })

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast.success('Template supprimé')
    }
  })

  const handleUseTemplate = () => {
    if (!selectedTemplate || !selectedCompetencyId || !newSheetTitle) {
      toast.error('Veuillez remplir tous les champs')
      return
    }

    useTemplateMutation.mutate({
      templateId: selectedTemplate.id,
      data: {
        competencyId: selectedCompetencyId,
        title: newSheetTitle
      }
    })
  }

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getTypeConfig = (type: string) => {
    return templateTypes.find((t) => t.id === type) || templateTypes[4]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bibliothèque de templates</h1>
          <p className="text-gray-600">
            {templates.length} template(s) disponible(s)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card !p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Type filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <select
              className="input !py-1.5 !w-auto"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              {templateTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Public only toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPublicOnly}
              onChange={(e) => setShowPublicOnly(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-600">Templates publics uniquement</span>
          </label>

          {/* Search */}
          <div className="relative ml-auto">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="input !py-1.5 !pl-10 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Templates grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <ArrowPathIcon className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="card text-center py-12">
          <DocumentDuplicateIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">Aucun template trouvé</p>
          <p className="text-sm text-gray-400">
            Créez votre premier template depuis une fiche existante
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const typeConfig = getTypeConfig(template.type)
            const isOwner = template.userId === user?.id

            return (
              <div key={template.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={clsx('badge', typeConfig.color)}>
                      {typeConfig.label}
                    </span>
                    {template.isPublic ? (
                      <GlobeAltIcon className="w-4 h-4 text-green-500" title="Public" />
                    ) : (
                      <LockClosedIcon className="w-4 h-4 text-gray-400" title="Privé" />
                    )}
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => {
                        if (confirm('Supprimer ce template ?')) {
                          deleteTemplateMutation.mutate(template.id)
                        }
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <TrashIcon className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>

                <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                {template.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {template.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                  <span className="flex items-center gap-1">
                    <UserIcon className="w-3 h-3" />
                    {template.user.firstName} {template.user.lastName}
                  </span>
                  <span>
                    Utilisé {template.usageCount}x
                  </span>
                </div>

                {/* Template content preview */}
                <div className="text-xs text-gray-500 mb-4 space-y-1">
                  {template.content?.duration && (
                    <p>Durée: {template.content.duration} min</p>
                  )}
                  {template.content?.objectives?.length > 0 && (
                    <p>{template.content.objectives.length} objectif(s)</p>
                  )}
                  {template.content?.situations?.length > 0 && (
                    <p>{template.content.situations.length} situation(s)</p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedTemplate(template)
                    setNewSheetTitle(`Fiche depuis "${template.name}"`)
                    setUseTemplateModal(true)
                  }}
                  className="btn-primary w-full text-sm"
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Utiliser ce template
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Use Template Modal */}
      {useTemplateModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Créer depuis "{selectedTemplate.name}"
              </h3>
              <button
                onClick={() => {
                  setUseTemplateModal(false)
                  setSelectedTemplate(null)
                }}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Compétence cible *</label>
                <select
                  className="input"
                  value={selectedCompetencyId}
                  onChange={(e) => setSelectedCompetencyId(e.target.value)}
                >
                  <option value="">Sélectionner une compétence</option>
                  {competencies.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Titre de la fiche *</label>
                <input
                  type="text"
                  className="input"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  placeholder="Ex: Atelier communication client"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setUseTemplateModal(false)
                  setSelectedTemplate(null)
                }}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleUseTemplate}
                disabled={useTemplateMutation.isPending || !selectedCompetencyId || !newSheetTitle}
                className="btn-primary flex-1"
              >
                {useTemplateMutation.isPending ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-4 h-4 mr-2" />
                    Créer la fiche
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
