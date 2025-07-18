module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    'renderer.js',
    '!node_modules/**'
  ],
  moduleNameMapper: {
    '^electron$': '<rootDir>/tests/__mocks__/electron.js'
  }
};