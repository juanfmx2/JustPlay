export const SUNDAY_STAGE_SLUG = 'sunday'
export const PLAYOFF_DIVISION_LEVEL_SUFFIX = '-PLAYOFF'
export const PLAYOFF_PLACEHOLDER_TAG = 'PLAYOFF_PLACEHOLDER'
export const SUNDAY_ADVANCED_MARKER_PREFIX = '[SUNDAY_ADVANCED_LOCKED_AT='

export function isSundayStageAdvanced(description: string | null | undefined): boolean {
  if (!description) return false
  return description.includes(SUNDAY_ADVANCED_MARKER_PREFIX)
}

export function appendSundayAdvancedMarker(description: string | null | undefined, now = new Date()): string {
  if (isSundayStageAdvanced(description)) {
    return description ?? ''
  }

  const marker = `${SUNDAY_ADVANCED_MARKER_PREFIX}${now.toISOString()}]`
  if (!description || description.trim().length === 0) {
    return marker
  }

  return `${description.trim()}\n${marker}`
}

export function isPlayoffDivisionLevel(level: string | null | undefined): boolean {
  if (!level) return false
  return level.toUpperCase().endsWith(PLAYOFF_DIVISION_LEVEL_SUFFIX)
}

export function isPlayoffPlaceholderGameDescription(description: string | null | undefined): boolean {
  if (!description) return false
  return description.includes(PLAYOFF_PLACEHOLDER_TAG)
}