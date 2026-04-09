import { glob } from "glob";
import path, { relative } from "path";
import chalk from "chalk";
import { extractFunctions } from "./extractor.js";
import { batchAnalyze } from "./llm.js";
import { applyCacheToFunctions, cacheResults } from "./cache.js";

/**
 * Main entry point — discover files, extract all functions,
 * analyze them with AI, return results.
 */
export async function reviewFiles(config) {
  // 1. Discover files
  const files = await discoverFiles(config);

  if (files.length === 0) {
    console.log(chalk.yellow("  No files found matching your config.\n"));
    return [];
  }

  console.log(chalk.dim(`  Found ${files.length} file(s) to review\n`));

  // 2. Extract all functions from all files
  let allFunctions = [];
  for (const file of files) {
    const fns = extractFunctions(file);
    // Filter by minLines
    const filtered = fns.filter((fn) => fn.numLines >= config.minLines);
    allFunctions.push(...filtered);
  }

  if (allFunctions.length === 0) {
    console.log(chalk.yellow("  No functions found to review.\n"));
    return [];
  }

  console.log(
    chalk.dim(
      `  Found ${allFunctions.length} function(s) across ${files.length} file(s)`,
    ),
  );

  // 3. Apply cache
  const { toAnalyze, fromCache } = applyCacheToFunctions(
    allFunctions,
    config.cache,
  );

  if (fromCache.length > 0) {
    console.log(
      chalk.dim(`  ${fromCache.length} function(s) loaded from cache`),
    );
  }
  if (toAnalyze.length > 0) {
    console.log(chalk.dim(`  ${toAnalyze.length} function(s) to analyze\n`));
  } else {
    console.log(chalk.dim("  All results from cache\n"));
  }

  // 4. Analyze with LLM
  let analyzed = [];
  if (toAnalyze.length > 0) {
    analyzed = await analyzeWithProgress(toAnalyze, config);
    // Save to cache
    if (config.cache) {
      cacheResults(analyzed);
    }
  }
  console.log("analyzed ", analyzed);

  // 5. Merge cache + fresh results, preserving file order
  const allResultSingleFunction = [...fromCache, ...analyzed];

  // Sort by file then line number
  allResultSingleFunction.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  // 6. Filter by minScore if set
  return allResultSingleFunction.filter((r) => {
    if (!r.review) return true;
    return r.review.score <= config.minScore;
  });

}

async function analyzeWithProgress(functions, config) {
  const results = [];
  const { parallel = 5, model = "llama3.2:3b" } = config;
  let done = 0;

  for (let i = 0; i < functions.length; i += parallel) {
    const chunk = functions.slice(i, i + parallel);

    // Show progress
    chunk.forEach((fn) => {
      const rel = relative(process.cwd(), fn.file);
      process.stdout.write(
        chalk.dim(`  Analyzing ${rel}:${fn.line} ${fn.name}()...\r`),
      );
    });

    const chunkResults = await Promise.all(
      chunk.map((fn) => analyzeSingle(fn, model)),
    );

    done += chunk.length;
    results.push(...chunkResults);

    // Clear progress line
    process.stdout.write(" ".repeat(80) + "\r");
    console.log(
      chalk.dim(`  ✓ ${done}/${functions.length} functions analyzed`),
    );
  }

  console.log();
  return results;
}

async function analyzeSingle(fn, model) {
  const { batchAnalyze } = await import("./llm.js");
  const results = await batchAnalyze([fn], { model, parallel: 1 });
  return results[0];
}

async function discoverFiles(config) {
  const { path: basePath, include, exclude } = config;

  const patterns = include.map((p) => {
    const normalized = p.replace(/\\/g, "/");
    return `${basePath.replace(/\\/g, "/")}/${normalized}`;
  });
  const ignorePatterns = exclude;

  const files = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      ignore: ignorePatterns,
      absolute: true,
      nodir: true,
    });
    files.push(...matches);
  }

  // Deduplicate
  return [...new Set(files)];
}
