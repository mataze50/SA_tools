import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { sheetsApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import {
  SparklesIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  RectangleGroupIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

export default function Home() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: recentSheets, isLoading } = useQuery({
    queryKey: ['sheets', 'recent'],
    queryFn: () => sheetsApi.recent()
  })

  const sheets = recentSheets?.data?.data || []

  const statusConfig: Record<string, { icon: any; label: string; class: string }> = {
    DRAFT: {
      icon: ClockIcon,
      label: 'Brouillon',
      class: 'text-yellow-600 bg-yellow-50'
    },
    PENDING_VALIDATION: {
      icon: ClockIcon,
      label: 'En validation',
      class: 'text-blue-600 bg-blue-50'
    },
    VALIDATED: {
      icon: CheckCircleIcon,
      label: 'Validée',
      class: 'text-green-600 bg-green-50'
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Bonjour {user?.firstName} !
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          Une fiche exploitable en moins de 45 minutes, validée par l'IA,<br />
          que ton manager n'a plus qu'à signer.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Create workshop */}
        <button
          onClick={() => navigate('/workshops/new')}
          className="card hover:shadow-md hover:border-purple-300 transition-all text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-xl group-hover:bg-purple-200 dark:group-hover:bg-purple-900/70 transition-colors">
              <RectangleGroupIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Creer un atelier complet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Guide d'animation multi-competences
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 font-medium">NOUVEAU</p>
            </div>
          </div>
        </button>

        {/* Create sheet */}
        <button
          onClick={() => navigate('/create')}
          className="card hover:shadow-md hover:border-primary-300 transition-all text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/50 rounded-xl group-hover:bg-primary-200 dark:group-hover:bg-primary-900/70 transition-colors">
              <SparklesIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Creer une fiche</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Fiche pedagogique mono-competence
              </p>
              <p className="text-xs text-primary-600 dark:text-primary-400 mt-2">~30-45 minutes</p>
            </div>
          </div>
        </button>

        {/* Adapt existing */}
        <button
          onClick={() => navigate('/dashboard')}
          className="card hover:shadow-md hover:border-gray-300 transition-all text-left group opacity-75"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gray-100 rounded-xl">
              <ArrowPathIcon className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Adapter une fiche existante</h3>
              <p className="text-sm text-gray-500 mt-1">
                Duplique et modifie une fiche validée
              </p>
              <p className="text-xs text-gray-500 mt-2">~15-20 minutes</p>
            </div>
          </div>
        </button>

        {/* Continue draft */}
        <button
          onClick={() => navigate('/dashboard?status=DRAFT')}
          className="card hover:shadow-md hover:border-gray-300 transition-all text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gray-100 rounded-xl">
              <DocumentTextIcon className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Continuer un brouillon</h3>
              <p className="text-sm text-gray-500 mt-1">
                Reprends là où tu t'es arrêté
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {sheets.filter((s: any) => s.status === 'DRAFT').length} brouillon(s)
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Recent sheets */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Tes fiches récentes
          </h2>
          <Link
            to="/dashboard"
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Voir tout →
          </Link>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-gray-500">
            Chargement...
          </div>
        ) : sheets.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <DocumentTextIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Aucune fiche pour le moment</p>
            <p className="text-sm mt-1">Crée ta première fiche pour commencer !</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sheets.slice(0, 5).map((sheet: any) => {
              const status = statusConfig[sheet.status] || statusConfig.DRAFT
              const StatusIcon = status.icon

              return (
                <Link
                  key={sheet.id}
                  to={`/sheet/${sheet.id}`}
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={clsx('p-2 rounded-lg', status.class)}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {sheet.competency?.code} - {sheet.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {status.label} • Modifié {formatRelativeTime(sheet.updatedAt)}
                      </p>
                    </div>
                  </div>

                  {sheet.confidenceScore > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full',
                            sheet.confidenceScore >= 85
                              ? 'bg-green-500'
                              : sheet.confidenceScore >= 70
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          )}
                          style={{ width: `${sheet.confidenceScore}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 w-10">
                        {sheet.confidenceScore}%
                      </span>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Reassurance */}
      <div className="text-center py-4">
        <p className="text-sm text-gray-500">
          💡 Tu peux modifier tous les contenus, l'IA ne publie jamais sans toi.
        </p>
      </div>
    </div>
  )
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "à l'instant"
  if (diffMins < 60) return `il y a ${diffMins} min`
  if (diffHours < 24) return `il y a ${diffHours}h`
  if (diffDays === 1) return 'hier'
  if (diffDays < 7) return `il y a ${diffDays} jours`

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
