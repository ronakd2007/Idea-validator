/**
 * Unit tests only — no database, no network, no Nest DI container.
 *
 * The AI Deep Dive logic worth testing (normalization, evidence rules, scoring,
 * the search client's failure modes, the run lifecycle guards) is deliberately
 * written as pure functions or against a stubbed Prisma, so the suite runs in
 * seconds and needs nothing running.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
};
