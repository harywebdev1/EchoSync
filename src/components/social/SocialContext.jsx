import { createContext, useContext } from 'react'
export const SocialContext = createContext({ profiles: {}, telemetry: {}, openProfile: () => {} })
export const useSocial = () => useContext(SocialContext)
