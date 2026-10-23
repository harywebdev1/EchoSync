import { Wifi } from 'lucide-react'
import { useLiveTelemetry } from '../state/playbackStore'

export function telemetryTone(ms) {
  if (ms <= 80) return 'good'
  if (ms <= 250) return 'fair'
  return 'poor'
}

export function telemetryLabel(ms) {
  if (ms <= 80) return 'In sync'
  if (ms <= 250) return 'Slight drift'
  return 'Lagging'
}

export function SyncDot({ ms = 0 }) {
  return <i className={`sync-dot ${telemetryTone(ms)}`} aria-hidden="true" />
}

export function TelemetryPill({ compact = false, detail = false, className = '' }) {
  const telemetry = useLiveTelemetry()
  const ms = Math.max(2, Math.round(telemetry.roomDriftMs || 2))
  const tone = telemetryTone(ms)
  return (
    <span
      className={`live-sync-pill ${tone} ${compact ? 'compact' : ''} ${className}`.trim()}
      data-testid="live-sync-pill"
      data-ms={ms}
      data-tone={tone}
      title={`Live audio drift ${ms} ms`}
    >
      <SyncDot ms={ms} />
      {compact ? (
        <b>{ms} ms</b>
      ) : (
        <>
          <Wifi aria-hidden="true" />
          <span>{telemetryLabel(ms)}</span>
          <b>{ms} ms</b>
          {detail && <em>drift</em>}
        </>
      )}
    </span>
  )
}
