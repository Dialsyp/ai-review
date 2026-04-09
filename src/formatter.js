import chalk from 'chalk'
import { relative } from 'path'

export function renderReport(results, config) {
  if (results.length === 0) {
    console.log(chalk.green('✓ Nothing to report.\n'))
    return
  }

  switch (config.format) {
    case 'json':
      renderJSON(results)
      break
    case 'github':
      renderGitHub(results)
      break
    case 'summary':
      renderSummary(results, config)
      break
    default:
      renderTerminal(results, config)
  }
}

// ─── Terminal (default) ───────────────────────────────────────────────────────

function renderTerminal(results, config) {
  // Group results by file
  const byFile = groupByFile(results)

  for (const [file, fns] of Object.entries(byFile)) {
    const rel = relative(process.cwd(), file)
    const fileScore = avgScore(fns)
    const scoreColor = scoreToColor(fileScore)

    console.log(
      chalk.bold(`\n📄 ${rel}`) +
      chalk.dim(` — ${fns.length} function(s)`) +
      '  ' + scoreColor(`avg score ${fileScore}/10`)
    )
    console.log(chalk.dim('─'.repeat(60)))

    for (const fn of fns) {
      renderFunction(fn)
    }
  }

  renderSummary(results, config)
}

function renderFunction(fn) {
  if (!fn.review) {
    console.log(chalk.yellow(`\n  ${fn.name}()`) + chalk.dim(` line ${fn.line}`))
    console.log(chalk.red(`    ✗ Analysis failed${fn.error ? ': ' + fn.error : ''}`))
    return
  }

  const { score, summary, issues, positives, suggestion } = fn.review
  const scoreColor = scoreToColor(score)
  const cacheLabel = fn.fromCache ? chalk.dim(' [cached]') : ''

  console.log(
    `\n  ${chalk.bold(fn.name + '()')}` +
    chalk.dim(` line ${fn.line}`) +
    '  ' + scoreColor(`${score}/10`) +
    cacheLabel
  )

  console.log(`    ${chalk.dim(summary)}`)

  if (issues.length > 0) {
    issues.forEach(issue => {
      console.log(`    ${chalk.yellow('⚠')} ${issue}`)
    })
  }

  if (positives.length > 0) {
    positives.forEach(pos => {
      console.log(`    ${chalk.green('✓')} ${pos}`)
    })
  }

  if (suggestion) {
    console.log(`    ${chalk.blue('🔧')} ${suggestion}`)
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function renderSummary(results) {
  const reviewed = results.filter(r => r.review)
  const failed = results.filter(r => !r.review)
  const fromCache = results.filter(r => r.fromCache)

  const scores = reviewed.map(r => r.review.score)
  const avg = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
    : 0

  const excellent = reviewed.filter(r => r.review.score >= 9).length
  const good = reviewed.filter(r => r.review.score >= 7 && r.review.score < 9).length
  const needsWork = reviewed.filter(r => r.review.score >= 5 && r.review.score < 7).length
  const critical = reviewed.filter(r => r.review.score < 5).length

  console.log(chalk.bold('\n─── Summary ' + '─'.repeat(48)))
  console.log(`  Functions reviewed : ${chalk.bold(reviewed.length)}`)
  console.log(`  Average score      : ${scoreToColor(avg)(avg + '/10')}`)
  console.log(
    `  Breakdown          : ` +
    chalk.green(`${excellent} excellent`) + '  ' +
    chalk.cyan(`${good} good`) + '  ' +
    chalk.yellow(`${needsWork} needs work`) + '  ' +
    chalk.red(`${critical} critical`)
  )

  if (fromCache.length > 0) {
    console.log(`  From cache         : ${fromCache.length}`)
  }
  if (failed.length > 0) {
    console.log(`  Analysis failed    : ${chalk.red(failed.length)}`)
  }

  if (critical > 0) {
    console.log(chalk.red(`\n  ✗ ${critical} critical function(s) with score < 5\n`))
  } else if (needsWork > 0) {
    console.log(chalk.yellow(`\n  ⚠ ${needsWork} function(s) could be improved\n`))
  } else {
    console.log(chalk.green('\n  ✓ All functions look good!\n'))
  }
}

// ─── JSON ─────────────────────────────────────────────────────────────────────

function renderJSON(results) {
  console.log(JSON.stringify(results, null, 2))
}

// ─── GitHub Actions ───────────────────────────────────────────────────────────

function renderGitHub(results) {
  for (const fn of results) {
    if (!fn.review) continue

    const rel = relative(process.cwd(), fn.file)
    const { score, issues, suggestion } = fn.review

    if (score < 7) {
      const level = score < 5 ? 'error' : 'warning'
      const allIssues = [...issues]
      if (suggestion) allIssues.push(`Suggestion: ${suggestion}`)

      allIssues.forEach(issue => {
        console.log(
          `::${level} file=${rel},line=${fn.line},title=AI Review (${fn.name})::${issue}`
        )
      })
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByFile(results) {
  return results.reduce((acc, r) => {
    if (!acc[r.file]) acc[r.file] = []
    acc[r.file].push(r)
    return acc
  }, {})
}

function avgScore(fns) {
  const scores = fns.filter(f => f.review).map(f => f.review.score)
  if (scores.length === 0) return 0
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
}

function scoreToColor(score) {
  if (score >= 9) return chalk.green
  if (score >= 7) return chalk.cyan
  if (score >= 5) return chalk.yellow
  return chalk.red
}