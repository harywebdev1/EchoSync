import { useState } from 'react'
import { TASTE_VIBES } from '../../core/tasteEngine.js'
import { Check, Plus, Sparkles } from 'lucide-react'

export function TastePicker({ selected = [], onSave, onSkip }) {
  const [picked, setPicked] = useState(() => [...selected])
  const toggle = (id) => {
    setPicked((previous) => (
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    ))
  }
  return (
    <div className="taste-picker">
      <div className="taste-vibe-grid">
        {TASTE_VIBES.map((vibe) => {
          const active = picked.includes(vibe.id)
          return (
            <button
              type="button"
              key={vibe.id}
              className={`taste-vibe ${active ? 'selected' : ''}`}
              onClick={() => toggle(vibe.id)}
              aria-pressed={active}
            >
              <span>{vibe.label}</span>
              <small>{vibe.hint}</small>
              <i>{active ? <Check size={11} /> : <Plus size={11} />}</i>
            </button>
          )
        })}
      </div>
      <div className="taste-picker-actions">
        <span>{picked.length ? `${picked.length} vibe${picked.length === 1 ? '' : 's'} selected` : 'Pick as many as you like'}</span>
        <div>
          {picked.length > 0 && <button type="button" className="text-btn" onClick={() => setPicked([])}>Clear</button>}
          {onSkip && <button type="button" className="text-btn" onClick={onSkip}>Not now</button>}
          <button type="button" className="primary-btn" onClick={() => onSave(picked)}>
            <Sparkles size={12} /> Save taste
          </button>
        </div>
      </div>
    </div>
  )
}
