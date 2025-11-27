import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../stores/auth'

interface GenerationProgress {
  step: number
  totalSteps: number
  label: string
  estimatedTimeRemaining: string
}

interface GenerationData {
  sessionId: string
  status: string
  progress: GenerationProgress
  estimatedTimeRemaining: string
  enrichmentData: any
  generatedContent: any
  validationResult: any
  finalContent: any
  error?: string
}

interface UseGenerationStreamResult {
  data: GenerationData | null
  isConnected: boolean
  error: string | null
  reconnect: () => void
}

export function useGenerationStream(sessionId: string | undefined): UseGenerationStreamResult {
  const [data, setData] = useState<GenerationData | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const token = useAuthStore((s) => s.token)

  const connect = useCallback(() => {
    if (!sessionId || !token) return

    setError(null)

    // Create EventSource with auth token in URL (SSE doesn't support headers)
    const url = `/api/generation/${sessionId}/stream?token=${encodeURIComponent(token)}`
    const eventSource = new EventSource(url)

    eventSource.onopen = () => {
      setIsConnected(true)
      setError(null)
    }

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)
        setData(parsed)

        // Auto-close on completion or failure
        if (parsed.status === 'COMPLETED' || parsed.status === 'FAILED') {
          eventSource.close()
          setIsConnected(false)
        }

        if (parsed.error) {
          setError(parsed.error)
          eventSource.close()
          setIsConnected(false)
        }
      } catch (e) {
        console.error('Failed to parse SSE data:', e)
      }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      // Don't set error on close - it might be intentional
      if (eventSource.readyState === EventSource.CLOSED) {
        return
      }
      setError('Connection lost. Reconnecting...')
      eventSource.close()

      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (data?.status !== 'COMPLETED' && data?.status !== 'FAILED') {
          connect()
        }
      }, 2000)
    }

    return () => {
      eventSource.close()
    }
  }, [sessionId, token, data?.status])

  useEffect(() => {
    const cleanup = connect()
    return () => {
      cleanup?.()
    }
  }, [connect])

  const reconnect = useCallback(() => {
    connect()
  }, [connect])

  return { data, isConnected, error, reconnect }
}

// Fallback hook using polling (for when SSE is not available)
export function useGenerationPolling(sessionId: string | undefined) {
  const [data, setData] = useState<GenerationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!sessionId || !token) return

    let intervalId: ReturnType<typeof setInterval>
    let isMounted = true

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/generation/${sessionId}/status`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch status')
        }

        const result = await response.json()
        if (isMounted) {
          setData(result.data)
          setIsLoading(false)

          // Stop polling on completion or failure
          if (result.data.status === 'COMPLETED' || result.data.status === 'FAILED') {
            clearInterval(intervalId)
          }
        }
      } catch (e) {
        if (isMounted) {
          setError('Failed to fetch generation status')
          setIsLoading(false)
        }
      }
    }

    // Initial fetch
    fetchStatus()

    // Poll every 1.5 seconds
    intervalId = setInterval(fetchStatus, 1500)

    return () => {
      isMounted = false
      clearInterval(intervalId)
    }
  }, [sessionId, token])

  return { data, isLoading, error }
}
