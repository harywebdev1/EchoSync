import { useEffect, useState } from 'react'
import { readStorage, writeStorage, THEME_KEY } from '../lib/appServices.js'

export function useThemePreference() {
  const [themePreference, setPreference] = useState(() => {
    const saved = readStorage(THEME_KEY, 'system')
    return ['system', 'light', 'dark'].includes(saved) ? saved : 'system'
  })
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const theme = themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference
  const setTheme = value => setPreference(previous => typeof value === 'function' ? value(previous === 'system' ? theme : previous) : value)
  useEffect(() => { writeStorage(THEME_KEY, themePreference) }, [themePreference])
  return { theme, themePreference, setTheme }
}
