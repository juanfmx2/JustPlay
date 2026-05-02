export {}

console.log('Spring League 2026: starting registration and week progression generation...')

await import('./generateRegistration.ts')
await import('./generateWeek1.ts')
await import('./generateWeek1Scores.ts')
await import('./generateWeek2.ts')
await import('./generateWeek2Scores.ts')
await import('./generateWeek3.ts')
await import('./calculateGlobalStandings.ts')

console.log('Spring League 2026: all generation steps completed.')
