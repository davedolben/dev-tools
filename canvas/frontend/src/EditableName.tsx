import { useEffect, useState } from 'react'

interface Props {
  value: string
  onSave: (name: string) => void
  className?: string
  autoFocus?: boolean
  onDone?: () => void
}

export function EditableName({ value, onSave, className, autoFocus, onDone }: Props) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const commit = () => {
    const next = draft.trim()
    if (next && next !== value) onSave(next)
    else setDraft(value)
    onDone?.()
  }

  return (
    <input
      className={`editable-name ${className ?? ''}`}
      value={draft}
      aria-label="Canvas name"
      autoFocus={autoFocus}
      onFocus={(e) => autoFocus && e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(value)
          // Defer so the reset draft is in place before blur commits it.
          const el = e.currentTarget
          requestAnimationFrame(() => el.blur())
        }
      }}
    />
  )
}
