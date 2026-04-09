import { resolve } from 'path'

const DEFAULTS = {
  model: 'llama3.2:3b',
  include: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
  exclude: [
    '**/*.test.js',
    '**/*.test.ts',
    '**/*.spec.js',
    '**/*.spec.ts',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**'
  ],
  minLines: 3,
  parallel: 5,
  cache: true,
  minScore: 10,
  format: 'terminal'
}

export function loadConfig(options = {}) {
  const config = { ...DEFAULTS }

  if (options.model) config.model = options.model
  if (options.include) config.include = options.include
  if (options.exclude) config.exclude = options.exclude
  if (options.minLines !== undefined) config.minLines = parseInt(options.minLines)
  if (options.parallel !== undefined) config.parallel = parseInt(options.parallel)
  if (options.cache === false || options.cache === 'false') config.cache = false
  if (options.minScore !== undefined) config.minScore = parseInt(options.minScore)
  if (options.format) config.format = options.format

  // Resolve path
  config.path = resolve(process.cwd(), options.path ?? '.')

  return config
}