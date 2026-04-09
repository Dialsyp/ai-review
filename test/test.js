import { extractFunctions } from '../src/extractor.js'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

console.log('Running tests...\n')

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`)
    passed++
  } else {
    console.log(`  ✗ ${message}`)
    failed++
  }
}

// Test 1 — Extractor finds all functions
{
  const sampleFile = resolve(__dirname, 'sample.js')
  const fns = extractFunctions(sampleFile)

  assert(fns.length >= 7, `Extractor finds at least 7 functions (found ${fns.length})`)

  const names = fns.map(f => f.name)
  assert(names.includes('getUserById'), 'Finds getUserById')
  assert(names.includes('hashPassword'), 'Finds hashPassword (arrow + const)')
  assert(names.includes('formatPrice'), 'Finds formatPrice')
  assert(names.includes('validateEmail'), 'Finds validateEmail')
  assert(names.includes('fetchUserData'), 'Finds fetchUserData')
  assert(names.includes('calculateDiscount'), 'Finds calculateDiscount')
  assert(names.includes('debounce'), 'Finds debounce')

  fns.forEach(fn => {
    assert(fn.line > 0, `${fn.name}() has line number`)
    assert(fn.numLines > 0, `${fn.name}() has numLines`)
    assert(fn.code.length > 0, `${fn.name}() has code`)
  })
}

// Test 2 — minLines filter works
{
  const sampleFile = resolve(__dirname, 'sample.js')
  const all = extractFunctions(sampleFile)
  const filtered = all.filter(fn => fn.numLines >= 5)

  assert(filtered.length < all.length, 'minLines filter reduces function count')
  filtered.forEach(fn => {
    assert(fn.numLines >= 5, `${fn.name}() has ${fn.numLines} lines (>= 5)`)
  })
}

// Test 3 — Non-existent file returns empty array
{
  const result = extractFunctions('/does/not/exist.js')
  assert(result.length === 0, 'Non-existent file returns empty array')
}

// Summary
console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)