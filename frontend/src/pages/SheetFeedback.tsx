import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { sheetsApi, dashboardApi } from '../lib/api'
import {
  ChevronLeftIcon,
  ArrowPathIcon,
  StarIcon,
  ClockIcon,
  UserGroupIcon,
  CalendarIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ArrowPathRoundedSquareIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import clsx from 'clsx'

type SituationRating = 'top' | 'bof' | 'review'
type TimingFeedback = 'short' | 'perfect' | 'long'

export default function SheetFeedback() {
  const { sheetId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [workshopDate, setWorkshopDate] = useState(new Date().toISOString().split('T')[0])
  const [participantCount, setParticipantCount] = useState(8)
  const [overallRating, setOverallRating] = useState(0)
  const [situationRatings, setSituationRatings] = useState<Record<string, SituationRating>>({})
  const [timingFeedback, setTimingFeedback] = useState<TimingFeedback>('perfect')
  const [timingNote, setTimingNote] = useState('')
  const [comments, setComments] = useState('')

  // Fetch sheet
  const { data: sheetData, isLoading } = useQuery({
    queryKey: ['sheet', sheetId],
    queryFn: () => sheetsApi.get(sheetId!),
    enabled: !!sheetId
  })

  const sheet = sheetData?.data?.data
  const situations = (sheet?.situations || []) as any[]

  // Submit feedback
  const submitFeedback = useMutation({
    mutationFn: (data: any) => dashboardApi.submitFeedback(data),
    onSuccess: () => {
      toast.success('Merci pour ton retour !')
      queryClient.invalidateQueries({ queryKey: ['sheet', sheetId] })
      navigate(`/sheet/${sheetId}`)
    },
    onError: () => {
      toast.error('Erreur lors de l\'envoi du feedback')
    }
  })

  const handleSubmit = () => {
    if (!overallRating) {
      toast.error('Merci de noter ton atelier')
      return
    }

    submitFeedback.mutate({
      sheetId,
      workshopDate,
      participantCount,
      overallRating,
      situationRatings,
      timingFeedback,
      timingNote: timingNote || undefined,
      comments: comments || undefined
    })
  }

  const getRatingIcon = (rating: SituationRating) => {
    switch (rating) {
      case 'top':
        return <HandThumbUpIcon className="w-5 h-5" />
      case 'bof':
        return <HandThumbDownIcon className="w-5 h-5" />
      case 'review':
        return <ArrowPathRoundedSquareIcon className="w-5 h-5" />
    }
  }

  const getRatingColor = (rating: SituationRating) => {
    switch (rating) {
      case 'top':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'bof':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'review':
        return 'text-orange-600 bg-orange-50 border-orange-200'
    }
  }

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
          <h1 className="text-xl font-semibold text-gray-900">
            Retour post-atelier
          </h1>
          <p className="text-sm text-gray-500">
            {sheet.competency?.code} — {sheet.title}
          </p>
        </div>
      </div>

      {/* Workshop info */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-primary-500" />
          Informations sur l'atelier
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Date de l'atelier</label>
            <input
              type="date"
              className="input"
              value={workshopDate}
              onChange={(e) => setWorkshopDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Nombre de participants</label>
            <div className="flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5 text-gray-400" />
              <input
                type="number"
                className="input"
                min={1}
                max={50}
                value={participantCount}
                onChange={(e) => setParticipantCount(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Overall rating */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <StarIcon className="w-5 h-5 text-yellow-500" />
          Note globale de l'atelier
        </h2>

        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setOverallRating(star)}
              className="p-1 hover:scale-110 transition-transform"
            >
              {star <= overallRating ? (
                <StarIconSolid className="w-10 h-10 text-yellow-400" />
              ) : (
                <StarIcon className="w-10 h-10 text-gray-300" />
              )}
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-gray-500">
          {overallRating === 0 && 'Clique pour noter'}
          {overallRating === 1 && 'Très insuffisant'}
          {overallRating === 2 && 'Insuffisant'}
          {overallRating === 3 && 'Correct'}
          {overallRating === 4 && 'Bien'}
          {overallRating === 5 && 'Excellent !'}
        </p>
      </div>

      {/* Situation ratings */}
      {situations.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            Évaluation des situations
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Comment chaque situation a-t-elle fonctionné avec les participants ?
          </p>

          <div className="space-y-4">
            {situations.map((sit: any, index: number) => {
              const sitKey = sit.id || `S${index + 1}`
              const rating = situationRatings[sitKey]

              return (
                <div key={sitKey} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge badge-info">S{index + 1}</span>
                        <span className="font-medium text-gray-900">{sit.title}</span>
                      </div>
                      <p className="text-sm text-gray-500">{sit.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {(['top', 'bof', 'review'] as SituationRating[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => setSituationRatings((prev) => ({ ...prev, [sitKey]: r }))}
                          className={clsx(
                            'p-2 rounded-lg border-2 transition-all',
                            rating === r
                              ? getRatingColor(r)
                              : 'border-gray-200 text-gray-400 hover:border-gray-300'
                          )}
                          title={r === 'top' ? 'Super !' : r === 'bof' ? 'Bof...' : 'À revoir'}
                        >
                          {getRatingIcon(r)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <HandThumbUpIcon className="w-4 h-4 text-green-500" /> Super
            </span>
            <span className="flex items-center gap-1">
              <HandThumbDownIcon className="w-4 h-4 text-red-500" /> Bof
            </span>
            <span className="flex items-center gap-1">
              <ArrowPathRoundedSquareIcon className="w-4 h-4 text-orange-500" /> À revoir
            </span>
          </div>
        </div>
      )}

      {/* Timing feedback */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-primary-500" />
          Gestion du temps
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          La durée prévue ({sheet.duration} min) était-elle adaptée ?
        </p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { value: 'short', label: 'Trop court', icon: '⏱️' },
            { value: 'perfect', label: 'Parfait', icon: '✨' },
            { value: 'long', label: 'Trop long', icon: '🐌' }
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setTimingFeedback(option.value as TimingFeedback)}
              className={clsx(
                'p-4 rounded-lg border-2 transition-all text-center',
                timingFeedback === option.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              <span className="text-2xl mb-1 block">{option.icon}</span>
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>

        {timingFeedback !== 'perfect' && (
          <div>
            <label className="label">Précisions sur le timing</label>
            <input
              type="text"
              className="input"
              placeholder={
                timingFeedback === 'short'
                  ? 'Qu\'aurais-tu aimé développer davantage ?'
                  : 'Qu\'est-ce qui a pris trop de temps ?'
              }
              value={timingNote}
              onChange={(e) => setTimingNote(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">
          Commentaires libres
        </h2>
        <textarea
          className="input"
          rows={4}
          placeholder="Autres remarques, suggestions d'amélioration, points forts, difficultés rencontrées..."
          value={comments}
          onChange={(e) => setComments(e.target.value)}
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
          onClick={handleSubmit}
          disabled={submitFeedback.isPending || !overallRating}
          className="btn-primary flex-1"
        >
          {submitFeedback.isPending ? (
            <>
              <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
              Envoi...
            </>
          ) : (
            <>
              <CheckCircleIcon className="w-5 h-5 mr-2" />
              Envoyer mon retour
            </>
          )}
        </button>
      </div>
    </div>
  )
}
