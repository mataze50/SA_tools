import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme })
    }),
    {
      name: 'atelier-forge-theme'
    }
  )
)

// Initialize theme on page load
export function initializeTheme() {
  const stored = localStorage.getItem('atelier-forge-theme')
  const theme = stored ? JSON.parse(stored).state.theme : 'system'
  applyTheme(theme)
}

// Apply theme to document
export function applyTheme(theme: Theme) {
  const isDark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const stored = localStorage.getItem('atelier-forge-theme')
    const theme = stored ? JSON.parse(stored).state.theme : 'system'
    if (theme === 'system') {
      applyTheme('system')
    }
  })
}
