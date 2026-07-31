// Divisions are named e.g. "Men Division 1 - Pool A". The "big division"
// (Men Division 1) spans several pools that don't play each other directly,
// but are still shown together as one combined standings table.

export function splitDivisionName(name: string): { groupTitle: string; poolLabel: string | null } {
  const match = name.match(/^(.*?)\s*-\s*(Pool\s+[A-Za-z0-9]+)$/i)

  if (!match) {
    return { groupTitle: name, poolLabel: null }
  }

  return { groupTitle: match[1].trim(), poolLabel: match[2].trim() }
}

export function slugifyGroupTitle(groupTitle: string): string {
  return groupTitle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
