import { useState, useCallback } from 'react'

export function useAppShellOnboarding(isDataReady: boolean) {
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem('sanctuary_onboarding_completed'),
  )
  const [onboardingForced, setOnboardingForced] = useState(false)
  const showOnboarding = (isDataReady && !onboardingDismissed) || onboardingForced

  const handleCloseOnboarding = useCallback(() => {
    localStorage.setItem('sanctuary_onboarding_completed', 'true')
    setOnboardingDismissed(true)
    setOnboardingForced(false)
  }, [])

  const openOnboarding = useCallback(() => setOnboardingForced(true), [])

  return { showOnboarding, handleCloseOnboarding, openOnboarding }
}
