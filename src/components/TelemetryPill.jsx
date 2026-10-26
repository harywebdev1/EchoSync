import { useEffect, useState } from 'react'
import { Wifi } from 'lucide-react'
import { useLiveTelemetry } from '../state/playbackStore'
import { getDriftTone as telemetryTone, getDriftLabel as telemetryLabel } from '../core/roomSyncMath.js'
export { telemetryTone, telemetryLabel }

export function SyncDot({ ms = 0 }) {
  return <i className={`sync-dot ${telemetryTone(ms)}`} aria-hidden="true" />
}

export function TelemetryPill({ compact = false, detail = false, className = '' }) {
  const telemetry = useLiveTelemetry()
  const [now,setNow] = useState(Date.now)
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),2000);return()=>clearInterval(timer)},[])
  const measured = telemetry.driftMeasuredAt > 0 && now - telemetry.driftMeasuredAt < 6000
  const ms = Math.max(0, Math.round(telemetry.roomDriftMs || 0))
  const display = ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`
  const tone = telemetryTone(ms)
  if(!measured)return <span className={`live-sync-pill pending ${className}`} data-testid="live-sync-pill" data-tone="unknown">Awaiting sync</span>
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
        <b>{display}</b>
      ) : (
        <>
          <Wifi aria-hidden="true" />
          <span>{telemetryLabel(ms)}</span>
          <b>{display}</b>
          {detail && <em>drift</em>}
        </>
      )}
    </span>
  )
}
