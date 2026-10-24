const OPTIONS = [['off', 'Off'], ['15m', '15m'], ['30m', '30m'], ['end-of-track', 'End of track']]

export function SleepTimerControl({ timer, onChange, compact = false }) {
  const seconds = Math.ceil((timer?.remainingMs || 0) / 1000)
  return (
    <label className="sleep-timer-control">
      <span>{compact ? '🌙' : '🌙 Sleep timer'}</span>
      <select aria-label="Sleep timer" value={timer?.mode || 'off'} onChange={event => onChange(event.target.value)}>
        {OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {timer?.deadline != null && <small role="timer">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} left</small>}
    </label>
  )
}
