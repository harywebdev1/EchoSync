import { createContext, useContext } from 'react'

export const MembersContext = createContext({})

export function useMembers() {
  return useContext(MembersContext)
}
