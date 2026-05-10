export {}

console.log('Banana Cup 2026: starting registration and week progression generation...')

await import('./generateRegistration.ts')
await import('./generateBananaCup2026-05.ts')

console.log('Banana Cup 2026: all generation steps completed.')
