import { createHash } from 'crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Cache stored in ~/.ai-review/cache.json
const CACHE_DIR = join(homedir(), '.ai-review')
const CACHE_FILE = join(CACHE_DIR, 'cache.json')

let _cache = null

function loadCache() {
  if (_cache) return _cache
  if (!existsSync(CACHE_FILE)) {
    _cache = {}
    return _cache
  }
  try {
    _cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
  } catch {
    _cache = {}
  }
  return _cache
}

function saveCache() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(CACHE_FILE, JSON.stringify(_cache, null, 2))
}

export function hashFunction(fn) {
  return createHash('md5')
    .update(fn.code + fn.name + fn.file)
    .digest('hex')
}

export function getCached(fn) {
  const cache = loadCache()
  const key = hashFunction(fn)
  return cache[key] ?? null
}

export function setCached(fn, review) {
  const cache = loadCache()
  const key = hashFunction(fn)
  cache[key] = {
    review,
    cachedAt: new Date().toISOString()
  }
  saveCache()
}

export function applyCacheToFunctions(functions, useCache) {
  if (!useCache) {
    return {
      toAnalyze: functions,
      fromCache: []
    }
  }

  const toAnalyze = []
  const fromCache = []

  for (const fn of functions) {
    const cached = getCached(fn)
    if (cached) {
      fromCache.push({ ...fn, review: cached.review, fromCache: true })
    } else {
      toAnalyze.push(fn)
    }
  }

  return { toAnalyze, fromCache }
}

export function cacheResults(results) {
  for (const r of results) {
    if (r.review && !r.fromCache) {
      setCached(r, r.review)
    }
  }
}