module.exports = {
  projects: [
    '<rootDir>/apps/web',
    '<rootDir>/apps/api',
    '<rootDir>/packages/db',
    '<rootDir>/packages/gql',
    '<rootDir>/packages/auth',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
}
