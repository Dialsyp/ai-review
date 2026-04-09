# eslint-plugin-ai-review
 
AI-powered code review that analyzes **every function** in your codebase — not just ESLint warnings.
 
Unlike ESLint rules that check syntax and style, `ai-review` uses a local LLM to understand the *intent* of your code and surface real issues: missing edge cases, misleading names, incomplete error handling, security smells, and what's genuinely well done.
 
```
📄 src/auth/login.js — 4 functions
 
  getUserById()  line 12   3/10
  ✗ SQL query built with string interpolation — SQL injection risk
  ✗ Returns null on missing id but also on DB error — caller can't distinguish
  🔧 Use parameterized queries: db.query('SELECT * FROM users WHERE id = ?', [id])
 
  hashPassword()  line 34   4/10
  ✗ MD5 is not a secure hashing algorithm for passwords
  ✗ Salt is hardcoded — defeats the purpose of salting
  🔧 Replace with bcrypt: await bcrypt.hash(password, 12)
 
  formatPrice()  line 56   9/10
  ✓ Clean, single responsibility
  ✓ Handles decimal precision correctly
 
  debounce()  line 78   9/10
  ✓ Correct implementation with proper cleanup
  ✓ Accepts generic function — reusable
```
 
---
 
## Requirements
 
- **Node.js 18+**
- **[Ollama](https://ollama.com)** running locally
 
```bash
# Install Ollama, then pull a model
ollama pull llama3.1
```
 
---
 
## Install
 
```bash
# As a global CLI tool
npm install -g eslint-plugin-ai-review
 
# Or as a dev dependency in your project
npm install --save-dev eslint-plugin-ai-review
```
 
---
 
## Usage
 
### CLI (recommended)
 
```bash
# Review the whole src/ directory
ai-review run src/
 
# Review a single file
ai-review run src/auth/login.js
 
# Use a different model
ai-review run src/ --model mistral
 
# Only show functions with score below 7
ai-review run src/ --min-score 6
 
# Output as JSON
ai-review run src/ --format json
 
# GitHub Actions format (inline PR annotations)
ai-review run src/ --format github
 
# Disable cache (re-analyze everything)
ai-review run src/ --no-cache
```
 
### As an ESLint plugin
 
Run `ai-review run` first to generate the cache, then configure ESLint to report low-score functions inline:
 
```js
// eslint.config.js
import aiReview from 'eslint-plugin-ai-review'
 
export default [
  {
    plugins: { 'ai-review': aiReview },
    rules: {
      'ai-review/all': ['warn', { minScore: 6 }]
    }
  }
]
```
 
---
 
## Configuration
 
Create `ai-review.config.js` at the root of your project:
 
```bash
ai-review init
```
 
Or manually:
 
```js
// ai-review.config.js
export default {
  model: 'llama3.1',
  include: ['src/**/*.js', 'src/**/*.ts'],
  exclude: ['**/*.test.js', 'node_modules/**'],
  minLines: 3,       // skip functions shorter than this
  parallel: 5,       // functions analyzed simultaneously
  cache: true,       // skip re-analyzing unchanged functions
  minScore: 10,      // show all (lower to filter)
  format: 'terminal'
}
```
 
---
 
## GitHub Actions
 
```yaml
- name: Run AI review
  run: ai-review run src/ --format github --min-score 6
```
 
See `.github/workflows/ai-review.yml` for the full workflow with Ollama setup.
 
---
 
## How it works
 
1. **Discovers** all JS/TS files matching your config
2. **Parses** each file into an AST and extracts every function (declarations, expressions, arrow functions)
3. **Sends** each function's source code to a local LLM via Ollama
4. **Caches** results keyed by function content hash — unchanged functions are never re-analyzed
5. **Renders** a detailed report with scores, issues, positives, and suggestions
 
No code ever leaves your machine. Everything runs locally via Ollama.
 
---
 
## Supported languages
 
- JavaScript (`.js`, `.jsx`)
- TypeScript (`.ts`, `.tsx`)
 
---
 
## Available commands
 
| Command | Description |
|---|---|
| `ai-review run [path]` | Review all functions in path |
| `ai-review models` | List available Ollama models |
| `ai-review init` | Create default config file |
 
---
 
## License
 
MIT
