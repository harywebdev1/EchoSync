import { useState, useRef } from 'react'
import { SOLO_ROOM_ID } from '../lib/appServices.js'

// Playback state and media refs survive view navigation in the root controller.
export function usePlaybackState() {
const [soloQueue, setSoloQueue] = useState([])
const [soloPlayOrder, setSoloPlayOrder] = useState([])
const [currentByRoom, setCurrentByRoom] = useState({ [SOLO_ROOM_ID]: 0 })
const [isPlaying, setIsPlaying] = useState(false)
const [duration, setDuration] = useState(0)
const [volume, setVolume] = useState(0.82)
const [muted, setMuted] = useState(false)
const [crossfadeGain, setCrossfadeGain] = useState(1)
const [pendingPlayId, setPendingPlayId] = useState('')
const [seekSignal, setSeekSignal] = useState(0)
const [recoverySignal, setRecoverySignal] = useState(0)
const [buffering, setBuffering] = useState(false)
const [streamRecovering, setStreamRecovering] = useState(false)
const audioRef = useRef(null)
const loadedUrlRef = useRef('')
const pendingSeekRef = useRef(null)
const progressRef = useRef(0)
const lastPauseAtRef = useRef(0)
const playAttemptIdRef = useRef(0)
const resumeAttemptRef = useRef({ id: 0, trackId: '', resumeTime: 0, validate: false })
const advanceCheckRef = useRef(null)
const queueIdsRef = useRef([])
const currentIndexRef = useRef(0)
const isPlayingRef = useRef(false)
const canControlRef = useRef(true)
const ytPlayerRef = useRef(null)
const ytContainerRef = useRef(null)
const handleEndedRef = useRef(null)
const hasInteractedRef = useRef(false)
const stallTimerRef = useRef(null)
const recoveryRef = useRef({ id: '', at: 0, active: false })
const crossfadeGainRef = useRef(1)
const crossfadeLockRef = useRef(false)
const fadeFrameRef = useRef(null)
const soloSnapshotRef = useRef({ track: null, currentTime: 0, isPlaying: false, queue: [], index: 0 })
const soloResumeRef = useRef(null)
const soloQueueRef = useRef([])
const soloPlayOrderRef = useRef([])
const shuffleSeedRef = useRef(1)
const previousShuffleRef = useRef(false)
const playRequestRef = useRef({ seq: 0, id: '' })
  return { soloQueue,
    setSoloQueue,
    soloPlayOrder,
    setSoloPlayOrder,
    currentByRoom,
    setCurrentByRoom,
    isPlaying,
    setIsPlaying,
    duration,
    setDuration,
    volume,
    setVolume,
    muted,
    setMuted,
    crossfadeGain,
    setCrossfadeGain,
    pendingPlayId,
    setPendingPlayId,
    seekSignal,
    setSeekSignal,
    recoverySignal,
    setRecoverySignal,
    buffering,
    setBuffering,
    streamRecovering,
    setStreamRecovering,
    audioRef,
    loadedUrlRef,
    pendingSeekRef,
    progressRef,
    lastPauseAtRef,
    playAttemptIdRef,
    resumeAttemptRef,
    advanceCheckRef,
    queueIdsRef,
    currentIndexRef,
    isPlayingRef,
    canControlRef,
    ytPlayerRef,
    ytContainerRef,
    handleEndedRef,
    hasInteractedRef,
    stallTimerRef,
    recoveryRef,
    crossfadeGainRef,
    crossfadeLockRef,
    fadeFrameRef,
    soloSnapshotRef,
    soloResumeRef,
    soloQueueRef,
    soloPlayOrderRef,
    shuffleSeedRef,
    previousShuffleRef,
    playRequestRef }
}
