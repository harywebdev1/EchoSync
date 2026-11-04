export function AudioRootContainer({ audioRef, trackId, onTimeUpdate, onLoadedMetadata, onCanPlay, onPlaying, onWaiting, onStalled, onEnded, onError }) {
  return (
    <div className="audio-root" data-testid="audio-root" data-track-id={trackId || ''}>
      <audio
        ref={audioRef}
        data-testid="root-audio"
        preload="auto"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onCanPlay={onCanPlay}
        onPlaying={onPlaying}
        onWaiting={onWaiting}
        onStalled={onStalled}
        onEnded={onEnded}
        onError={onError}
      />
    </div>
  )
}
