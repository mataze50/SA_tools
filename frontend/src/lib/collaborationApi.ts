import api from './api'

export interface Collaborator {
  odiskette: string
  firstName: string
  lastName: string
  color: string
  cursor?: { section: string; position: number }
  selection?: { section: string; start: number; end: number }
  isYou?: boolean
}

export interface Comment {
  id: string
  sheetId: string
  section: string
  content: string
  position?: { start: number; end: number }
  authorId: string
  authorName: string
  resolved: boolean
  resolvedBy?: string
  resolvedAt?: string
  replies: CommentReply[]
  createdAt: string
  updatedAt: string
}

export interface CommentReply {
  id: string
  content: string
  authorId: string
  authorName: string
  createdAt: string
}

export interface SessionInfo {
  active: boolean
  collaboratorCount?: number
  collaborators?: Collaborator[]
  lockedSections?: Record<string, string>
}

export interface ActivityItem {
  type: 'version' | 'comment'
  id: string
  content: string
  author?: string
  createdAt: string
}

export const collaborationApi = {
  // Get WebSocket connection token
  getToken: (sheetId: string) =>
    api.get<{ success: boolean; data: { token: string; wsUrl: string } }>(
      '/collaboration/token',
      { params: { sheetId } }
    ),

  // Get current session info
  getSession: (sheetId: string) =>
    api.get<{ success: boolean; data: SessionInfo }>(`/collaboration/session/${sheetId}`),

  // Comments
  getComments: (sheetId: string, resolved?: boolean) =>
    api.get<{ success: boolean; data: { comments: Comment[] } }>(
      `/collaboration/comments/${sheetId}`,
      { params: { resolved } }
    ),

  addComment: (sheetId: string, data: { section: string; content: string; position?: { start: number; end: number } }) =>
    api.post<{ success: boolean; data: { comment: Comment } }>(
      `/collaboration/comments/${sheetId}`,
      data
    ),

  addReply: (sheetId: string, commentId: string, content: string) =>
    api.post<{ success: boolean; data: { reply: CommentReply } }>(
      `/collaboration/comments/${sheetId}/${commentId}/reply`,
      { content }
    ),

  resolveComment: (sheetId: string, commentId: string) =>
    api.post<{ success: boolean; data: { comment: Comment } }>(
      `/collaboration/comments/${sheetId}/${commentId}/resolve`
    ),

  deleteComment: (sheetId: string, commentId: string) =>
    api.delete(`/collaboration/comments/${sheetId}/${commentId}`),

  // Activity
  getActivity: (sheetId: string, limit?: number) =>
    api.get<{ success: boolean; data: { activity: ActivityItem[] } }>(
      `/collaboration/activity/${sheetId}`,
      { params: { limit } }
    )
}
