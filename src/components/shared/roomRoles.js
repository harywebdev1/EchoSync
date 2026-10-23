import { Headphones, Crown, Disc3 } from 'lucide-react'

export const ROLE_COPY = {
  admin: { label: 'Admin', note: 'Full playback and queue control', Icon: Crown },
  dj: { label: 'DJ', note: 'Playback control, locked queue', Icon: Disc3 },
  listener: { label: 'Listener', note: 'Listen along, controls locked', Icon: Headphones },
}
