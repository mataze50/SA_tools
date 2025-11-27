import { Link } from 'react-router-dom'
import {
  StarIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  UserGroupIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ArrowPathRoundedSquareIcon,
  PlusIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import clsx from 'clsx'

interface Feedback {
  id: string
  workshopDate: string
  participantCount: number
  overallRating: number
  situationRatings: Record<string, 'top' | 'bof' | 'review'>
  timingFeedback: 'short' | 'perfect' | 'long'
  timingNote?: string
  comments?: string
  createdAt: string
}

interface FeedbackSummaryProps {
  sheetId: string
  feedbacks: Feedback[]
  situations: any[]
  aiSuggestions?: string[]
  onGenerateSuggestions?: () => void
  isGeneratingSuggestions?: boolean
}

export default function FeedbackSummary({
  sheetId,
  feedbacks,
  situations,
  aiSuggestions,
  onGenerateSuggestions,
  isGeneratingSuggestions
}: FeedbackSummaryProps) {
  if (feedbacks.length === 0) {
    return (
      <div className="text-center py-8">
        <ChatBubbleLeftIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 mb-4">Aucun retour d'atelier pour le moment</p>
        <Link
          to={`/sheet/${sheetId}/feedback`}
          className="btn-primary inline-flex items-center"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Ajouter un retour
        </Link>
      </div>
    )
  }

  // Calculate statistics
  const totalParticipants = feedbacks.reduce((sum, f) => sum + f.participantCount, 0)
  const avgRating = feedbacks.reduce((sum, f) => sum + f.overallRating, 0) / feedbacks.length

  // Calculate situation stats
  const situationStats: Record<string, { top: number; bof: number; review: number }> = {}
  feedbacks.forEach((f) => {
    Object.entries(f.situationRatings || {}).forEach(([sitId, rating]) => {
      if (!situationStats[sitId]) {
        situationStats[sitId] = { top: 0, bof: 0, review: 0 }
      }
      situationStats[sitId][rating]++
    })
  })

  // Calculate timing stats
  const timingStats = { short: 0, perfect: 0, long: 0 }
  feedbacks.forEach((f) => {
    timingStats[f.timingFeedback]++
  })

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-yellow-500 mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              star <= Math.round(avgRating) ? (
                <StarIconSolid key={star} className="w-5 h-5" />
              ) : (
                <StarIcon key={star} className="w-5 h-5 text-gray-300" />
              )
            ))}
          </div>
          <p className="text-2xl font-bold text-gray-900">{avgRating.toFixed(1)}</p>
          <p className="text-sm text-gray-500">Note moyenne</p>
        </div>

        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <UserGroupIcon className="w-6 h-6 mx-auto text-primary-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{totalParticipants}</p>
          <p className="text-sm text-gray-500">Participants</p>
        </div>

        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <ChatBubbleLeftIcon className="w-6 h-6 mx-auto text-primary-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{feedbacks.length}</p>
          <p className="text-sm text-gray-500">Retours</p>
        </div>
      </div>

      {/* Situation performance */}
      {situations.length > 0 && Object.keys(situationStats).length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Performance des situations</h3>
          <div className="space-y-2">
            {situations.map((sit, index) => {
              const sitKey = sit.id || `S${index + 1}`
              const stats = situationStats[sitKey]
              if (!stats) return null

              const total = stats.top + stats.bof + stats.review
              const topPercent = (stats.top / total) * 100
              const bofPercent = (stats.bof / total) * 100
              const reviewPercent = (stats.review / total) * 100

              return (
                <div key={sitKey} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      S{index + 1}: {sit.title}
                    </span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 text-green-600">
                        <HandThumbUpIcon className="w-4 h-4" />
                        {stats.top}
                      </span>
                      <span className="flex items-center gap-1 text-red-600">
                        <HandThumbDownIcon className="w-4 h-4" />
                        {stats.bof}
                      </span>
                      <span className="flex items-center gap-1 text-orange-600">
                        <ArrowPathRoundedSquareIcon className="w-4 h-4" />
                        {stats.review}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-green-500 h-full"
                      style={{ width: `${topPercent}%` }}
                    />
                    <div
                      className="bg-red-500 h-full"
                      style={{ width: `${bofPercent}%` }}
                    />
                    <div
                      className="bg-orange-500 h-full"
                      style={{ width: `${reviewPercent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Timing feedback */}
      <div>
        <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-primary-500" />
          Gestion du temps
        </h3>
        <div className="flex gap-4">
          {[
            { key: 'short', label: 'Trop court', color: 'text-orange-600 bg-orange-50' },
            { key: 'perfect', label: 'Parfait', color: 'text-green-600 bg-green-50' },
            { key: 'long', label: 'Trop long', color: 'text-red-600 bg-red-50' }
          ].map((item) => (
            <div
              key={item.key}
              className={clsx(
                'flex-1 p-3 rounded-lg text-center',
                item.color
              )}
            >
              <p className="text-2xl font-bold">{timingStats[item.key as keyof typeof timingStats]}</p>
              <p className="text-sm">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Suggestions */}
      {(aiSuggestions || onGenerateSuggestions) && (
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-purple-500" />
              Suggestions IA
            </h3>
            {onGenerateSuggestions && (
              <button
                onClick={onGenerateSuggestions}
                disabled={isGeneratingSuggestions}
                className="btn-secondary text-sm"
              >
                {isGeneratingSuggestions ? 'Analyse...' : 'Analyser les retours'}
              </button>
            )}
          </div>

          {aiSuggestions && aiSuggestions.length > 0 ? (
            <ul className="space-y-2">
              {aiSuggestions.map((suggestion, index) => (
                <li
                  key={index}
                  className="p-3 bg-purple-50 border border-purple-100 rounded-lg text-sm text-purple-900"
                >
                  💡 {suggestion}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              Cliquez sur "Analyser les retours" pour obtenir des suggestions d'amélioration basées sur les feedbacks.
            </p>
          )}
        </div>
      )}

      {/* Recent comments */}
      {feedbacks.some((f) => f.comments) && (
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Commentaires récents</h3>
          <div className="space-y-3">
            {feedbacks
              .filter((f) => f.comments)
              .slice(0, 3)
              .map((f) => (
                <div key={f.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">{f.comments}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(f.workshopDate).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                    {' • '}
                    {f.participantCount} participants
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Add feedback button */}
      <div className="text-center pt-4 border-t">
        <Link
          to={`/sheet/${sheetId}/feedback`}
          className="btn-secondary inline-flex items-center"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Ajouter un retour d'atelier
        </Link>
      </div>
    </div>
  )
}
