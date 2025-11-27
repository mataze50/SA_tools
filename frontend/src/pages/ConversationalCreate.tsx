import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { conversationApi } from '../lib/api'
import {
  PaperAirplaneIcon,
  ArrowPathIcon,
  SparklesIcon,
  CheckCircleIcon,
  ChevronLeftIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface Message {
  id: string
  role: 'assistant' | 'user'
  content: string
  timestamp: Date
  isTyping?: boolean
}

interface ConversationState {
  sessionId: string | null
  currentStep: number
  totalSteps: number
  canGenerate: boolean
  summary: string | null
}

export default function ConversationalCreate() {
  const navigate = useNavigate()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [conversationState, setConversationState] = useState<ConversationState>({
    sessionId: null,
    currentStep: 0,
    totalSteps: 8,
    canGenerate: false,
    summary: null
  })

  // Start conversation
  const startConversation = useMutation({
    mutationFn: () => conversationApi.start(),
    onSuccess: (res) => {
      const data = res.data.data
      setConversationState({
        sessionId: data.sessionId,
        currentStep: data.currentStep,
        totalSteps: data.totalSteps,
        canGenerate: false,
        summary: null
      })
      // Add first question
      addAssistantMessage(data.question.question)
    },
    onError: () => {
      toast.error('Erreur lors du démarrage de la conversation')
    }
  })

  // Submit answer
  const submitAnswer = useMutation({
    mutationFn: (answer: string) =>
      conversationApi.answer(conversationState.sessionId!, answer),
    onSuccess: (res) => {
      const data = res.data.data

      setConversationState(prev => ({
        ...prev,
        currentStep: data.currentStep,
        canGenerate: data.canGenerate,
        summary: data.summary
      }))

      // Add follow-up if any
      if (data.followUp) {
        setTimeout(() => addAssistantMessage(data.followUp), 500)
      }

      // Add next question or completion message
      if (data.question) {
        setTimeout(() => addAssistantMessage(data.question.question), data.followUp ? 1500 : 500)
      } else if (data.canGenerate) {
        setTimeout(() => {
          addAssistantMessage(
            "Parfait ! J'ai toutes les informations nécessaires. Voici un récapitulatif :\n\n" +
            data.summary +
            "\n\nTu peux lancer la génération quand tu es prêt(e) !"
          )
        }, 500)
      }
    },
    onError: () => {
      toast.error('Erreur lors de l\'envoi de la réponse')
    }
  })

  // Generate sheet
  const generateSheet = useMutation({
    mutationFn: () => conversationApi.generate(conversationState.sessionId!),
    onSuccess: (res) => {
      toast.success('Génération lancée !')
      navigate(`/generate/${res.data.data.sessionId}`)
    },
    onError: () => {
      toast.error('Erreur lors de la génération')
    }
  })

  // Get AI assistance
  const getAssistance = useMutation({
    mutationFn: (message: string) =>
      conversationApi.assist(conversationState.sessionId!, message),
    onSuccess: (res) => {
      addAssistantMessage(res.data.data.assistance)
    }
  })

  // Start conversation on mount
  useEffect(() => {
    startConversation.mutate()
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [messages])

  const addAssistantMessage = (content: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date()
      }
    ])
  }

  const addUserMessage = (content: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date()
      }
    ])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || submitAnswer.isPending) return

    const message = inputValue.trim()
    addUserMessage(message)
    setInputValue('')

    // Check if user is asking for help
    if (message.toLowerCase().includes('aide') || message.toLowerCase().includes('help')) {
      getAssistance.mutate(message)
    } else {
      submitAnswer.mutate(message)
    }
  }

  const progress = (conversationState.currentStep / conversationState.totalSteps) * 100

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-12rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/create')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-primary-500" />
              Mode Conversationnel
            </h1>
            <p className="text-sm text-gray-500">
              Réponds aux questions pour créer ta fiche
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="text-right">
          <p className="text-sm text-gray-500">
            Étape {conversationState.currentStep}/{conversationState.totalSteps}
          </p>
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div className="card flex-1 overflow-y-auto !p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={clsx(
              'flex',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={clsx(
                'max-w-[80%] rounded-2xl px-4 py-3',
                message.role === 'user'
                  ? 'bg-primary-500 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-900 rounded-bl-md'
              )}
            >
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {(submitAnswer.isPending || getAssistance.isPending) && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="mt-4">
        {conversationState.canGenerate ? (
          <div className="flex gap-3">
            <button
              onClick={() => generateSheet.mutate()}
              disabled={generateSheet.isPending}
              className="btn-primary flex-1"
            >
              {generateSheet.isPending ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                  Lancement...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5 mr-2" />
                  Générer ma fiche
                </>
              )}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              className="input flex-1"
              placeholder="Ta réponse... (tape 'aide' si besoin)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={submitAnswer.isPending || !conversationState.sessionId}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || submitAnswer.isPending}
              className="btn-primary !px-4"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 text-center mt-2">
          💡 Tape "aide" si tu as besoin d'assistance sur une question
        </p>
      </div>
    </div>
  )
}
