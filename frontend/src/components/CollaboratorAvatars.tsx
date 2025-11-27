/**
 * Collaborator Avatars Component
 * Shows presence indicators for online collaborators
 * Sprint 11 - ATELIER FORGE
 */

import { Collaborator } from '../lib/collaborationApi'
import clsx from 'clsx'

interface CollaboratorAvatarsProps {
  collaborators: Collaborator[]
  maxVisible?: number
  onOpenPanel?: () => void
}

export default function CollaboratorAvatars({
  collaborators,
  maxVisible = 4,
  onOpenPanel
}: CollaboratorAvatarsProps) {
  const visibleCollaborators = collaborators.slice(0, maxVisible)
  const remainingCount = Math.max(0, collaborators.length - maxVisible)
  const otherCollaborators = collaborators.filter(c => !c.isYou)

  if (otherCollaborators.length === 0) {
    return null
  }

  return (
    <button
      onClick={onOpenPanel}
      className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div className="flex -space-x-2">
        {visibleCollaborators.filter(c => !c.isYou).map((collaborator, index) => (
          <div
            key={collaborator.odiskette}
            className={clsx(
              'w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white',
              'ring-2 ring-offset-1'
            )}
            style={{
              backgroundColor: collaborator.color,
              ringColor: collaborator.color,
              zIndex: maxVisible - index
            }}
            title={`${collaborator.firstName} ${collaborator.lastName}`}
          >
            {collaborator.firstName[0]}{collaborator.lastName?.[0] || ''}
          </div>
        ))}

        {remainingCount > 0 && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-gray-200 text-gray-600 border-2 border-white"
            style={{ zIndex: 0 }}
          >
            +{remainingCount}
          </div>
        )}
      </div>

      <span className="text-xs text-gray-500 ml-1">
        {otherCollaborators.length} en ligne
      </span>
    </button>
  )
}
