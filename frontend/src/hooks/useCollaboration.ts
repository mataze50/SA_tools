/**
 * Real-time Collaboration Hook
 * Sprint 11 - ATELIER FORGE
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { collaborationApi, Collaborator } from '../lib/collaborationApi'

interface CollaborationState {
  connected: boolean
  odiskette: string | null
  myColor: string | null
  collaborators: Collaborator[]
  lockedSections: Record<string, { odiskette: string; firstName: string; color: string }>
  typingUsers: Record<string, { odiskette: string; firstName: string; section: string }>
}

interface WSMessage {
  type: string
  payload: any
}

export function useCollaboration(sheetId: string, enabled: boolean = true) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [state, setState] = useState<CollaborationState>({
    connected: false,
    odiskette: null,
    myColor: null,
    collaborators: [],
    lockedSections: {},
    typingUsers: {}
  })

  // Get WebSocket token
  const { data: tokenData } = useQuery({
    queryKey: ['collab-token', sheetId],
    queryFn: () => collaborationApi.getToken(sheetId),
    enabled: enabled && !!sheetId,
    staleTime: 30 * 60 * 1000 // 30 minutes
  })

  const token = tokenData?.data?.data?.token

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!token || !sheetId || wsRef.current?.readyState === WebSocket.OPEN) return

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = window.location.host
    const wsUrl = `${wsProtocol}//${wsHost}/ws/collab?token=${token}&sheetId=${sheetId}`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('🔌 Collaboration connected')
        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', payload: {} }))
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)
          handleMessage(message)
        } catch (error) {
          console.error('WebSocket message parse error:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('🔌 Collaboration disconnected', event.code)
        setState(prev => ({ ...prev, connected: false }))

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
        }

        // Attempt reconnection
        if (enabled && event.code !== 4001 && event.code !== 4002) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, 3000)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
    }
  }, [token, sheetId, enabled])

  // Handle incoming messages
  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'connected':
        setState(prev => ({
          ...prev,
          connected: true,
          odiskette: message.payload.odiskette,
          myColor: message.payload.color,
          collaborators: message.payload.collaborators,
          lockedSections: Object.entries(message.payload.lockedSections || {}).reduce((acc, [section, odisque]) => {
            const collaborator = message.payload.collaborators.find((c: Collaborator) => c.odiskette === odisque)
            if (collaborator) {
              acc[section] = {
                odiskette: collaborator.odiskette,
                firstName: collaborator.firstName,
                color: collaborator.color
              }
            }
            return acc
          }, {} as Record<string, { odiskette: string; firstName: string; color: string }>)
        }))
        break

      case 'collaborator_joined':
        setState(prev => ({
          ...prev,
          collaborators: [...prev.collaborators, message.payload as Collaborator]
        }))
        break

      case 'collaborator_left':
        setState(prev => ({
          ...prev,
          collaborators: prev.collaborators.filter(c => c.odiskette !== message.payload.odiskette),
          typingUsers: Object.fromEntries(
            Object.entries(prev.typingUsers).filter(([_, v]) => v.odiskette !== message.payload.odiskette)
          )
        }))
        break

      case 'cursor_update':
        setState(prev => ({
          ...prev,
          collaborators: prev.collaborators.map(c =>
            c.odiskette === message.payload.odiskette
              ? { ...c, cursor: message.payload.cursor }
              : c
          )
        }))
        break

      case 'selection_update':
        setState(prev => ({
          ...prev,
          collaborators: prev.collaborators.map(c =>
            c.odiskette === message.payload.odiskette
              ? { ...c, selection: message.payload.selection }
              : c
          )
        }))
        break

      case 'section_locked':
        setState(prev => ({
          ...prev,
          lockedSections: {
            ...prev.lockedSections,
            [message.payload.section]: message.payload.lockedBy
          }
        }))
        break

      case 'section_unlocked':
        setState(prev => {
          const newLocked = { ...prev.lockedSections }
          delete newLocked[message.payload.section]
          return { ...prev, lockedSections: newLocked }
        })
        break

      case 'user_typing':
        setState(prev => {
          if (message.payload.isTyping) {
            return {
              ...prev,
              typingUsers: {
                ...prev.typingUsers,
                [message.payload.odiskette]: {
                  odiskette: message.payload.odiskette,
                  firstName: message.payload.firstName,
                  section: message.payload.section
                }
              }
            }
          } else {
            const newTyping = { ...prev.typingUsers }
            delete newTyping[message.payload.odiskette]
            return { ...prev, typingUsers: newTyping }
          }
        })
        break

      case 'pong':
        // Heartbeat received
        break
    }
  }, [])

  // Send message helper
  const send = useCallback((type: string, payload: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

  // Public API
  const moveCursor = useCallback((section: string, position: number) => {
    send('cursor_move', { section, position })
  }, [send])

  const changeSelection = useCallback((section: string, start: number, end: number) => {
    send('selection_change', { section, start, end })
  }, [send])

  const lockSection = useCallback((section: string) => {
    send('lock_section', { section })
  }, [send])

  const unlockSection = useCallback((section: string) => {
    send('unlock_section', { section })
  }, [send])

  const notifyContentChange = useCallback((section: string, changeType: string, data?: any) => {
    send('content_change', { section, changeType, data })
  }, [send])

  const startTyping = useCallback((section: string) => {
    send('typing_start', { section })
  }, [send])

  const stopTyping = useCallback((section: string) => {
    send('typing_stop', { section })
  }, [send])

  const addComment = useCallback((data: { section: string; content: string; position?: { start: number; end: number } }) => {
    send('comment_add', data)
  }, [send])

  const resolveComment = useCallback((commentId: string) => {
    send('comment_resolve', { commentId })
  }, [send])

  // Connect/disconnect based on enabled flag
  useEffect(() => {
    if (enabled && token) {
      connect()
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [enabled, token, connect])

  return {
    ...state,
    moveCursor,
    changeSelection,
    lockSection,
    unlockSection,
    notifyContentChange,
    startTyping,
    stopTyping,
    addComment,
    resolveComment
  }
}
