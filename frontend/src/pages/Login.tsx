import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  })

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(form.email, form.password),
    onSuccess: (res) => {
      login(res.data.data.token, res.data.data.user)
      toast.success('Connexion réussie !')
      navigate('/')
    },
    onError: () => {
      toast.error('Email ou mot de passe incorrect')
    }
  })

  const registerMutation = useMutation({
    mutationFn: () => authApi.register(form),
    onSuccess: (res) => {
      login(res.data.data.token, res.data.data.user)
      toast.success('Compte créé avec succès !')
      navigate('/')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'inscription')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isRegister) {
      registerMutation.mutate()
    } else {
      loginMutation.mutate()
    }
  }

  const isLoading = loginMutation.isPending || registerMutation.isPending

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-6xl">🏭</span>
          <h1 className="text-3xl font-bold text-white mt-4">ATELIER FORGE</h1>
          <p className="text-primary-200 mt-2">
            Le co-pilote IA de conception pédagogique
          </p>
        </div>

        {/* Form card */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {isRegister ? 'Créer un compte' : 'Se connecter'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Prénom</label>
                  <input
                    type="text"
                    className="input"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required={isRegister}
                  />
                </div>
                <div>
                  <label className="label">Nom</label>
                  <input
                    type="text"
                    className="input"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    required={isRegister}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="prenom.nom@harmonia.fr"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Chargement...
                </span>
              ) : isRegister ? (
                'Créer mon compte'
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {isRegister
                ? 'Déjà un compte ? Se connecter'
                : 'Pas encore de compte ? S\'inscrire'}
            </button>
          </div>

          {/* Demo credentials */}
          {!isRegister && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-2">Compte démo :</p>
              <p className="text-sm text-gray-700 font-mono">demo@harmonia.fr / demo123</p>
            </div>
          )}
        </div>

        {/* Tagline */}
        <p className="text-center text-primary-200 text-sm mt-6">
          Une fiche exploitable en moins de 45 minutes
        </p>
      </div>
    </div>
  )
}
