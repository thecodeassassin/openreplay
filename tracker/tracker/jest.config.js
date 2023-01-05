import tsPreset from 'ts-jest/jest-preset.js'
import puppeteerPreset from 'jest-puppeteer/jest-preset.js'

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
const config = {
  ...tsPreset,
  ...puppeteerPreset,
  //preset: 'ts-jest',
  testEnvironment: 'jsdom',
  // .js file extension fix
  moduleNameMapper: {
    '(.+)\\.js': '$1',
  },
}

export default config
