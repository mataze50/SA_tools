import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { competenciesApi } from '../lib/api'
import {
  MagnifyingGlassIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
  StarIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import clsx from 'clsx'

interface Competency {
  id: string
  code: string
  axis: string
  axisName: string
  title: string
  description?: string
  keywords: string[]
}

interface SelectedCompetency {
  id: string
  code: string
  title: string
  isPrimary: boolean
}

interface CompetencySelectorProps {
  selected: SelectedCompetency[]
  onChange: (selected: SelectedCompetency[]) => void
  maxSelection?: number
  showDescription?: boolean
}

// Group competencies by axis
function groupByAxis(competencies: Competency[]) {
  const grouped: Record<string, { axisName: string; competencies: Competency[] }> = {}

  competencies.forEach(comp => {
    if (!grouped[comp.axis]) {
      grouped[comp.axis] = {
        axisName: comp.axisName,
        competencies: []
      }
    }
    grouped[comp.axis].competencies.push(comp)
  })

  // Sort by axis code (C1, C2, etc.)
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([axis, data]) => ({
      axis,
      axisName: data.axisName,
      competencies: data.competencies.sort((a, b) => a.code.localeCompare(b.code))
    }))
}

export default function CompetencySelector({
  selected,
  onChange,
  maxSelection = 5,
  showDescription = true
}: CompetencySelectorProps) {
  const [search, setSearch] = useState('')
  const [expandedAxes, setExpandedAxes] = useState<Set<string>>(new Set(['C1', 'C2', 'C3']))

  const { data: competenciesData, isLoading } = useQuery({
    queryKey: ['competencies'],
    queryFn: () => competenciesApi.list()
  })

  const competencies = competenciesData?.data?.data || []
  const grouped = useMemo(() => groupByAxis(competencies), [competencies])

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return grouped

    const searchLower = search.toLowerCase()
    return grouped.map(group => ({
      ...group,
      competencies: group.competencies.filter(c =>
        c.code.toLowerCase().includes(searchLower) ||
        c.title.toLowerCase().includes(searchLower) ||
        c.keywords.some(k => k.toLowerCase().includes(searchLower))
      )
    })).filter(g => g.competencies.length > 0)
  }, [grouped, search])

  const toggleAxis = (axis: string) => {
    const newExpanded = new Set(expandedAxes)
    if (newExpanded.has(axis)) {
      newExpanded.delete(axis)
    } else {
      newExpanded.add(axis)
    }
    setExpandedAxes(newExpanded)
  }

  const isSelected = (id: string) => selected.some(s => s.id === id)
  const isPrimary = (id: string) => selected.find(s => s.id === id)?.isPrimary || false

  const toggleCompetency = (comp: Competency) => {
    if (isSelected(comp.id)) {
      // Remove from selection
      onChange(selected.filter(s => s.id !== comp.id))
    } else if (selected.length < maxSelection) {
      // Add to selection (first one is primary)
      onChange([
        ...selected,
        {
          id: comp.id,
          code: comp.code,
          title: comp.title,
          isPrimary: selected.length === 0
        }
      ])
    }
  }

  const togglePrimary = (id: string) => {
    onChange(selected.map(s => ({
      ...s,
      isPrimary: s.id === id
    })))
  }

  const removeCompetency = (id: string) => {
    const newSelected = selected.filter(s => s.id !== id)
    // Ensure first remaining is primary
    if (newSelected.length > 0 && !newSelected.some(s => s.isPrimary)) {
      newSelected[0].isPrimary = true
    }
    onChange(newSelected)
  }

  return (
    <div className="space-y-4">
      {/* Selected competencies */}
      {selected.length > 0 && (
        <div className="bg-primary-50 dark:bg-primary-900/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-primary-900 dark:text-primary-100">
              Competences selectionnees ({selected.length}/{maxSelection})
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.map(comp => (
              <div
                key={comp.id}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                  comp.isPrimary
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                )}
              >
                <button
                  onClick={() => togglePrimary(comp.id)}
                  className="hover:opacity-80"
                  title={comp.isPrimary ? 'Competence principale' : 'Definir comme principale'}
                >
                  {comp.isPrimary ? (
                    <StarIconSolid className="w-4 h-4" />
                  ) : (
                    <StarIcon className="w-4 h-4" />
                  )}
                </button>
                <span className="font-medium">{comp.code}</span>
                <span className="hidden sm:inline truncate max-w-[150px]">{comp.title}</span>
                <button
                  onClick={() => removeCompetency(comp.id)}
                  className="hover:opacity-80 ml-1"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {selected.length > 1 && (
            <p className="mt-2 text-xs text-primary-700 dark:text-primary-300">
              Cliquez sur l'etoile pour definir la competence principale
            </p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une competence (code, titre, mots-cles)..."
          className="input pl-10"
        />
      </div>

      {/* Competency list by axis */}
      {isLoading ? (
        <div className="py-8 text-center text-gray-500">
          Chargement du referentiel...
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
          {filteredGroups.map(group => (
            <div key={group.axis}>
              {/* Axis header */}
              <button
                onClick={() => toggleAxis(group.axis)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedAxes.has(group.axis) ? (
                    <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="font-semibold text-primary-600 dark:text-primary-400">
                    {group.axis}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{group.axisName}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {group.competencies.length} competences
                </span>
              </button>

              {/* Competencies */}
              {expandedAxes.has(group.axis) && (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {group.competencies.map(comp => {
                    const selected_ = isSelected(comp.id)
                    const primary = isPrimary(comp.id)
                    const disabled = !selected_ && selected.length >= maxSelection

                    return (
                      <button
                        key={comp.id}
                        onClick={() => !disabled && toggleCompetency(comp)}
                        disabled={disabled}
                        className={clsx(
                          'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                          selected_
                            ? 'bg-primary-50 dark:bg-primary-900/30'
                            : disabled
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        )}
                      >
                        <div className={clsx(
                          'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5',
                          selected_
                            ? 'bg-primary-600 border-primary-600'
                            : 'border-gray-300 dark:border-gray-600'
                        )}>
                          {selected_ && <CheckIcon className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary-600 dark:text-primary-400">
                              {comp.code}
                            </span>
                            {primary && (
                              <span className="px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300 rounded">
                                Principale
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                            {comp.title}
                          </p>
                          {showDescription && comp.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {comp.description}
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <div className="py-8 text-center text-gray-500">
              Aucune competence trouvee pour "{search}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
