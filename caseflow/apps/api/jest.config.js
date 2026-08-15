/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { noUnusedLocals: false, noUnusedParameters: false } }] },
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['\\.module\\.ts$', 'main\\.ts$'],
  testEnvironment: 'node',
};
