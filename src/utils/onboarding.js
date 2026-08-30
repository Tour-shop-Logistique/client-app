const ONBOARDING_KEY = 'tourshop_onboarding_seen';

export function hasSeenOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  } catch {
    return true;
  }
}

export function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_KEY, 'true');
  } catch {
    // localStorage unavailable (private mode, etc.) - onboarding will simply reshow
  }
}
