import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { exportApi } from '../lib/api'
import {
  XMarkIcon,
  DocumentArrowDownIcon,
  PrinterIcon,
  CodeBracketIcon,
  QuestionMarkCircleIcon,
  ShareIcon,
  LinkIcon,
  ClipboardIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface ExportOptionsModalProps {
  sheetId: string
  sheetTitle: string
  hasQuiz: boolean
  isOpen: boolean
  onClose: () => void
}

export default function ExportOptionsModal({
  sheetId,
  sheetTitle,
  hasQuiz,
  isOpen,
  onClose
}: ExportOptionsModalProps) {
  const queryClient = useQueryClient()
  const [copiedLink, setCopiedLink] = useState(false)

  // Fetch share status
  const { data: shareData, isLoading: loadingShare } = useQuery({
    queryKey: ['share-status', sheetId],
    queryFn: () => exportApi.shareStatus(sheetId),
    enabled: isOpen
  })

  const shareStatus = shareData?.data?.data

  // Export DOCX
  const exportDocx = useMutation({
    mutationFn: () => exportApi.docx(sheetId),
    onSuccess: (res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `fiche_${sheetTitle.replace(/\s+/g, '_')}.docx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Fichier DOCX telecharge !')
    },
    onError: () => {
      toast.error("Erreur lors de l'export")
    }
  })

  // Export Quiz
  const exportQuiz = useMutation({
    mutationFn: () => exportApi.quiz(sheetId),
    onSuccess: (res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `quiz_${sheetTitle.replace(/\s+/g, '_')}.docx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Quiz telecharge !')
    },
    onError: () => {
      toast.error("Erreur lors de l'export du quiz")
    }
  })

  // Export JSON
  const exportJson = useMutation({
    mutationFn: () => exportApi.json(sheetId),
    onSuccess: (res) => {
      const dataStr = JSON.stringify(res.data, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `fiche_${sheetTitle.replace(/\s+/g, '_')}.json`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Fichier JSON telecharge !')
    },
    onError: () => {
      toast.error("Erreur lors de l'export")
    }
  })

  // Open print view (PDF)
  const openPrintView = () => {
    window.open(`/api/export/html/${sheetId}`, '_blank')
    toast.success('Page ouverte - utilisez Imprimer > PDF')
  }

  // Create share link
  const createShare = useMutation({
    mutationFn: () => exportApi.createShare(sheetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-status', sheetId] })
      toast.success('Lien de partage cree !')
    },
    onError: () => {
      toast.error('Erreur lors de la creation du lien')
    }
  })

  // Revoke share link
  const revokeShare = useMutation({
    mutationFn: () => exportApi.revokeShare(sheetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-status', sheetId] })
      toast.success('Lien de partage supprime')
    },
    onError: () => {
      toast.error('Erreur lors de la suppression')
    }
  })

  const copyShareLink = async () => {
    if (shareStatus?.shareToken) {
      const url = `${window.location.origin}/api/export/public/${shareStatus.shareToken}`
      await navigator.clipboard.writeText(url)
      setCopiedLink(true)
      toast.success('Lien copie !')
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Exporter & Partager</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Export Options */}
        <div className="space-y-3 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Telecharger</p>

          <button
            onClick={() => exportDocx.mutate()}
            disabled={exportDocx.isPending}
            className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-all"
          >
            <div className="p-2 bg-blue-100 rounded-lg">
              <DocumentArrowDownIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-medium text-gray-900">Export Word (DOCX)</p>
              <p className="text-sm text-gray-500">Document editable pour Microsoft Word</p>
            </div>
            {exportDocx.isPending && <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-400" />}
          </button>

          <button
            onClick={openPrintView}
            className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-all"
          >
            <div className="p-2 bg-purple-100 rounded-lg">
              <PrinterIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-medium text-gray-900">Export PDF</p>
              <p className="text-sm text-gray-500">Ouvre une page imprimable (Imprimer &gt; PDF)</p>
            </div>
          </button>

          <button
            onClick={() => exportJson.mutate()}
            disabled={exportJson.isPending}
            className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-all"
          >
            <div className="p-2 bg-green-100 rounded-lg">
              <CodeBracketIcon className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-left flex-1">
              <p className="font-medium text-gray-900">Export JSON</p>
              <p className="text-sm text-gray-500">Format structure pour integration</p>
            </div>
            {exportJson.isPending && <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-400" />}
          </button>

          {hasQuiz && (
            <button
              onClick={() => exportQuiz.mutate()}
              disabled={exportQuiz.isPending}
              className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-all"
            >
              <div className="p-2 bg-orange-100 rounded-lg">
                <QuestionMarkCircleIcon className="w-6 h-6 text-orange-600" />
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-gray-900">Export Quiz (DOCX)</p>
                <p className="text-sm text-gray-500">Quiz d'evaluation avec corrige</p>
              </div>
              {exportQuiz.isPending && <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-400" />}
            </button>
          )}
        </div>

        {/* Sharing */}
        <div className="pt-4 border-t">
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <ShareIcon className="w-4 h-4" />
            Partage public
          </p>

          {loadingShare ? (
            <div className="flex items-center justify-center py-4">
              <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : shareStatus?.isShared ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                <GlobeAltIcon className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">Lien de partage actif</p>
                  <p className="text-xs text-green-600">
                    Expire le {new Date(shareStatus.expiresAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={copyShareLink}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {copiedLink ? (
                    <>
                      <CheckIcon className="w-4 h-4" />
                      Copie !
                    </>
                  ) : (
                    <>
                      <ClipboardIcon className="w-4 h-4" />
                      Copier le lien
                    </>
                  )}
                </button>
                <button
                  onClick={() => revokeShare.mutate()}
                  disabled={revokeShare.isPending}
                  className="btn-secondary text-red-600 hover:bg-red-50"
                >
                  {revokeShare.isPending ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <TrashIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => createShare.mutate()}
              disabled={createShare.isPending}
              className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-all"
            >
              <div className="p-2 bg-gray-100 rounded-lg">
                <LinkIcon className="w-6 h-6 text-gray-600" />
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-gray-900">Creer un lien de partage</p>
                <p className="text-sm text-gray-500">Permet a d'autres de voir cette fiche (30 jours)</p>
              </div>
              {createShare.isPending && <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-400" />}
            </button>
          )}
        </div>

        {/* Close */}
        <div className="mt-6 pt-4 border-t">
          <button onClick={onClose} className="btn-secondary w-full">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
