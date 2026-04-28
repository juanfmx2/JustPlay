export {}

console.log('Spring League 2026: starting registration, week 1, and week 2 generation...')

await import('./generateRegistration')
await import('./generateWeek1')
await import('./generateWeek1Scores')
await import('./generateWeek2')

console.log('Spring League 2026: all generation steps completed.')
