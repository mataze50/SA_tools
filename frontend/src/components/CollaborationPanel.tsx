/**
 * Collaboration Panel Component
 * Sprint 11 - ATELIER FORGE
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  XMarkIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  UserCircleIcon,
  LockClosedIcon,
  ClockIcon,
  ChevronDownIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { collaborationApi, Comment, Collaborator } from '../lib/collaborationApi'

interface CollaborationPanelProps {
  sheetId: string
  isOpen: boolean
  onClose: () => void
  collaborators: Collaborator[]
  lockedSections: Record<string, { odiskette: string; firstName: string; color: string }>
  typingUsers: Record<string, { odiskette: string; firstName: string; section: string }>
  connected: boolean
  myColor: string | null
  onAddComment?: (section: string, content: string) => void
}

const SECTION_LABELS: Record<string, string> = {
  objectives: 'Objectifs',
  situations: 'Situations',
  flow: 'Deroule',
  evaluation: 'Evaluation',
  quiz: 'Quiz'
}

export default function CollaborationPanel({
  sheetId,
  isOpen,
  onClose,
  collaborators,
  lockedSections,
  typingUsers,
  connected,
  myColor,
  onAddComment
}: CollaborationPanelProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'collaborators' | 'comments' | 'activity'>('collaborators')
  const [showResolved, setShowResolved] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [commentSection, setCommentSection] = useState('objectives')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')

  // Fetch comments
  const { data: commentsData, isLoading: loadingComments } = useQuery({
    queryKey: ['comments', sheetId, showResolved],
    queryFn: () => collaborationApi.getComments(sheetId, showResolved ? undefined : false),
    enabled: isOpen && activeTab === 'comments'
  })

  const comments = commentsData?.data?.data?.comments || []

  // Fetch activity
  const { data: activityData, isLoading: loadingActivity } = useQuery({
    queryKey: ['collaboration-activity', sheetId],
    queryFn: () => collaborationApi.getActivity(sheetId, 20),
    enabled: isOpen && activeTab === 'activity'
  })

  const activity = activityData?.data?.data?.activity || []

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: (data: { section: string; content: string }) =>
      collaborationApi.addComment(sheetId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', sheetId] })
      setNewComment('')
      toast.success('Commentaire ajoute')
      onAddComment?.(commentSection, newComment)
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout du commentaire")
    }
  })

  // Add reply mutation
  const addReplyMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      collaborationApi.addReply(sheetId, commentId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', sheetId] })
      setReplyTo(null)
      setReplyContent('')
      toast.success('Reponse ajoutee')
    }
  })

  // Resolve comment mutation
  const resolveCommentMutation = useMutation({
    mutationFn: (commentId: string) => collaborationApi.resolveComment(sheetId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', sheetId] })
      toast.success('Commentaire resolu')
    }
  })

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => collaborationApi.deleteComment(sheetId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', sheetId] })
      toast.success('Commentaire supprime')
    }
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 1) return "A l'instant"
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const handleSubmitComment = () => {
    if (!newComment.trim()) return
    addCommentMutation.mutate({ section: commentSection, content: newComment.trim() })
  }

  const handleSubmitReply = (commentId: string) => {
    if (!replyContent.trim()) return
    addReplyMutation.mutate({ commentId, content: replyContent.trim() })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <UsersIcon className="w-6 h-6 text-gray-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Collaboration</h2>
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'w-2 h-2 rounded-full',
                  connected ? 'bg-green-500' : 'bg-red-500'
                )} />
                <p className="text-sm text-gray-500">
                  {connected ? `${collaborators.length} en ligne` : 'Deconnecte'}
                </p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {[
            { id: 'collaborators', label: 'Equipe', icon: UsersIcon },
            { id: 'comments', label: 'Commentaires', icon: ChatBubbleLeftRightIcon },
            { id: 'activity', label: 'Activite', icon: ClockIcon }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Collaborators Tab */}
          {activeTab === 'collaborators' && (
            <div className="p-4 space-y-4">
              {/* Online Collaborators */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">En ligne maintenant</h3>
                <div className="space-y-2">
                  {collaborators.map(collaborator => (
                    <div
                      key={collaborator.odiskette}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: collaborator.color }}
                      >
                        {collaborator.firstName[0]}{collaborator.lastName?.[0] || ''}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {collaborator.firstName} {collaborator.lastName}
                          {collaborator.isYou && (
                            <span className="ml-2 text-xs text-gray-500">(vous)</span>
                          )}
                        </p>
                        {collaborator.cursor && (
                          <p className="text-xs text-gray-500">
                            Dans: {SECTION_LABELS[collaborator.cursor.section] || collaborator.cursor.section}
                          </p>
                        )}
                      </div>
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: collaborator.color }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Typing Users */}
              {Object.keys(typingUsers).length > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    {Object.values(typingUsers).map(u => u.firstName).join(', ')} en train d'ecrire...
                  </p>
                </div>
              )}

              {/* Locked Sections */}
              {Object.keys(lockedSections).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Sections en edition</h3>
                  <div className="space-y-2">
                    {Object.entries(lockedSections).map(([section, info]) => (
                      <div
                        key={section}
                        className="flex items-center gap-3 p-2 bg-amber-50 rounded-lg border border-amber-200"
                      >
                        <LockClosedIcon className="w-4 h-4 text-amber-600" />
                        <span className="text-sm text-amber-800">
                          {SECTION_LABELS[section]} - {info.firstName}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full ml-auto"
                          style={{ backgroundColor: info.color }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* My Color */}
              {myColor && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Votre couleur:</span>
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: myColor }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comments Tab */}
          {activeTab === 'comments' && (
            <div className="p-4 space-y-4">
              {/* Add Comment */}
              <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <select
                    value={commentSection}
                    onChange={(e) => setCommentSection(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                  >
                    {Object.entries(SECTION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  rows={2}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  className="btn-primary text-sm w-full flex items-center justify-center gap-2"
                >
                  {addCommentMutation.isPending ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <PaperAirplaneIcon className="w-4 h-4" />
                  )}
                  Envoyer
                </button>
              </div>

              {/* Toggle Resolved */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {comments.length} commentaire{comments.length > 1 ? 's' : ''}
                </span>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showResolved}
                    onChange={(e) => setShowResolved(e.target.checked)}
                    className="rounded text-primary-600"
                  />
                  <span className="text-gray-600">Afficher resolus</span>
                </label>
              </div>

              {/* Comments List */}
              {loadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8">
                  <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">Aucun commentaire</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment: Comment) => (
                    <div
                      key={comment.id}
                      className={clsx(
                        'p-3 rounded-lg border',
                        comment.resolved
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-gray-200'
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <UserCircleIcon className="w-5 h-5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {comment.authorName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(comment.createdAt)}
                          </span>
                        </div>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {SECTION_LABELS[comment.section] || comment.section}
                        </span>
                      </div>

                      <p className="text-sm text-gray-700 mb-2">{comment.content}</p>

                      {comment.resolved && (
                        <div className="flex items-center gap-1 text-xs text-green-600 mb-2">
                          <CheckCircleIcon className="w-4 h-4" />
                          Resolu par {comment.resolvedBy}
                        </div>
                      )}

                      {/* Replies */}
                      {comment.replies.length > 0 && (
                        <div className="ml-4 mt-2 space-y-2 border-l-2 border-gray-200 pl-3">
                          {comment.replies.map(reply => (
                            <div key={reply.id} className="text-sm">
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="font-medium text-gray-700">{reply.authorName}</span>
                                <span>{formatDate(reply.createdAt)}</span>
                              </div>
                              <p className="text-gray-600">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      {!comment.resolved && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                          {replyTo === comment.id ? (
                            <div className="flex-1 flex gap-2">
                              <input
                                type="text"
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder="Votre reponse..."
                                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSubmitReply(comment.id)
                                }}
                              />
                              <button
                                onClick={() => handleSubmitReply(comment.id)}
                                disabled={!replyContent.trim()}
                                className="text-primary-600 hover:text-primary-700"
                              >
                                <PaperAirplaneIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setReplyTo(null); setReplyContent('') }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => setReplyTo(comment.id)}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                Repondre
                              </button>
                              <button
                                onClick={() => resolveCommentMutation.mutate(comment.id)}
                                className="text-xs text-green-600 hover:text-green-700"
                              >
                                Resoudre
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Supprimer ce commentaire?')) {
                                    deleteCommentMutation.mutate(comment.id)
                                  }
                                }}
                                className="text-xs text-red-500 hover:text-red-700 ml-auto"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="p-4">
              {loadingActivity ? (
                <div className="flex items-center justify-center py-8">
                  <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : activity.length === 0 ? (
                <div className="text-center py-8">
                  <ClockIcon className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">Aucune activite recente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        item.type === 'version' ? 'bg-blue-100' : 'bg-green-100'
                      )}>
                        {item.type === 'version' ? (
                          <ClockIcon className="w-4 h-4 text-blue-600" />
                        ) : (
                          <ChatBubbleLeftRightIcon className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{item.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {item.author && (
                            <span className="text-xs text-gray-500">{item.author}</span>
                          )}
                          <span className="text-xs text-gray-400">
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} className="btn-secondary w-full">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
