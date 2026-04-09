import { Ollama } from 'ollama'

const ollama = new Ollama()

const SYSTEM_PROMPT = `You are a senior software engineer doing a thorough code review.
Your job is to analyze every function you receive — whether it looks fine or not.
You are NOT an ESLint rule checker. You look for deeper issues: logic, naming, 
robustness, edge cases, readability, and what is done well.

IMPORTANT rules:
- Be specific to THIS code, not generic advice
- If the function is simple and clean, say so clearly — don't invent issues
- "issues" should only contain real problems, not nitpicks
- "positives" should highlight what is genuinely good
- score: 1 (terrible) to 10 (excellent, production-ready)
- Keep each item concise: one sentence max
- Respond ONLY with valid JSON, nothing else

JSON format:
{
  "score": <1-10>,
  "summary": "<one sentence overall verdict>",
  "issues": ["<issue 1>", "<issue 2>"],
  "positives": ["<positive 1>"],
  "suggestion": "<the single most important improvement, or null if none>"
}`

/**
 * Analyze a batch of functions in parallel (chunked to avoid overloading Ollama).
 */
export async function batchAnalyze(functions, config) {
  const { parallel = 5, model = 'llama3.2:3b' } = config
  const results = []

  // Split into chunks of `parallel` size
  for (let i = 0; i < functions.length; i += parallel) {
    const chunk = functions.slice(i, i + parallel)
    const promises = chunk.map(fn => analyzeFn(fn, model))
    const chunkResults = await Promise.all(promises)
    results.push(...chunkResults)
  }

  return results
}

async function analyzeFn(fn, model) {
  const userMessage = `Function name: ${fn.name}
File: ${fn.file}:${fn.line}
Lines: ${fn.numLines}

\`\`\`
${fn.code}
\`\`\``

  try {
    const response = await ollama.chat({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      format: 'json',
      options: {
        temperature: 0.2  // Low temperature for consistent, factual output
      }
    })

    let review
    try {
      review = JSON.parse(response.message.content)
    } catch {
      // If JSON parse fails, extract what we can
      review = {
        score: 5,
        summary: 'Could not parse AI response',
        issues: [],
        positives: [],
        suggestion: null
      }
    }

    // Sanitize — ensure all fields exist
    return {
      ...fn,
      review: {
        score: clamp(parseInt(review.score) || 5, 1, 10),
        summary: review.summary ?? '',
        issues: Array.isArray(review.issues) ? review.issues : [],
        positives: Array.isArray(review.positives) ? review.positives : [],
        suggestion: review.suggestion ?? null
      }
    }
  } catch (err) {
    return {
      ...fn,
      review: null,
      error: err.message
    }
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}