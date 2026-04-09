#!/usr/bin/env node

import { program } from "commander";
import { reviewFiles } from "../src/runner.js";
import { loadConfig } from "../src/config.js";
import { renderReport } from "../src/formatter.js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import chalk from "chalk";
import { pathToFileURL } from "url";
import { Ollama } from "ollama";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
program
  .name("ai-review")
  .description(
    "AI-powered code review on every function — not just ESLint warnings",
  )
  .version(pkg.version);

program
  .command("run [path]")
  .description(
    "Review all functions in the given path (default: current directory)",
  )
  .option("-m, --model <model>", "Ollama model to use", "llama3.2:3b")
  .option(
    "-f, --format <format>",
    "Output format: terminal | json | summary",
    "terminal",
  )
  .option("--no-cache", "Disable result cache")
  .option("--min-lines <n>", "Minimum function lines to analyze", "3")
  .option("-p ,--parallel <n>", "Functions analyzed in parallel", "5")
  .option(
    "--min-score <n>",
    "Only show functions with score below this value (1-10)",
    "10",
  )
  .option(
    "--config <path>",
    "Path to config file (default: ai-review.config.js)",
  )
  .action(async (targetPath = ".", options) => {
    console.log(chalk.bold("\n ai-review — AI code review\n"));

    // Load config file if present
    const configPath = options.config
      ? resolve(options.config)
      : resolve(process.cwd(), "ai-review.config.js");

    let fileConfig = {};
    if (existsSync(configPath)) {
      try {
        console.log();
        const mod = await import(pathToFileURL(configPath));
        fileConfig = mod.default ?? {};
        console.log(chalk.dim(`  Config loaded from ${configPath}\n`));
      } catch {
        console.log(
          chalk.yellow(`  ⚠ Could not load config from ${configPath}\n`),
        );
      }
    }

    const config = loadConfig({ ...fileConfig, ...options, path: targetPath });

    try {
      // Check Ollama is running
      await checkOllama(config.model);
    } catch (err) {
      console.error(chalk.red("\n✗ Cannot reach Ollama."));
      console.error(chalk.dim("  Make sure Ollama is running: ollama serve"));
      console.error(
        chalk.dim(`  And the model is pulled: ollama pull ${config.model}\n`),
      );
      console.error("error  ", err)
      process.exit(1);
    }

    console.log(chalk.dim(`  Model   : ${config.model}`));
    console.log(chalk.dim(`  Path    : ${config.path}`));
    console.log(
      chalk.dim(`  Cache   : ${config.cache ? "enabled" : "disabled"}`),
    );
    console.log(chalk.dim(`  Parallel: ${config.parallel}\n`));

    const results = await reviewFiles(config);

    renderReport(results, config);

    // Exit with error code if any function has score < 5
    const hasErrors = results.some((r) => r.review && r.review.score < 5);
    process.exit(hasErrors ? 1 : 0);
  });

program
  .command("models")
  .description("List available Ollama models on your machine")
  .action(async () => {
    try {
      const { Ollama } = await import("ollama");
      const ollama = new Ollama();
      const { models } = await ollama.list();
      console.log(chalk.bold("\nAvailable models:\n"));
      models.forEach((m) => {
        console.log(`  ${chalk.green("✓")} ${m.name}`);
      });
      console.log();
    } catch {
      console.error(chalk.red("Cannot reach Ollama. Is it running?"));
    }
  });

program
  .command("init")
  .description("Create a default ai-review.config.js in current directory")
  .action(async () => {
    const { writeFileSync, existsSync } = await import("fs");
    const configPath = resolve(process.cwd(), "ai-review.config.js");

    if (existsSync(configPath)) {
      console.log(chalk.yellow("ai-review.config.js already exists."));
      return;
    }

    const defaultConfig = `export default {
  model: 'llama3.2:3b',
  include: ['src/**/*.js', 'src/**/*.ts', 'src/**/*.jsx', 'src/**/*.tsx'],
  exclude: ['**/*.test.js', '**/*.spec.js', 'node_modules/**', 'dist/**'],
  minLines: 3,
  parallel: 5,
  cache: true,
  minScore: 10,   // show all functions (lower = only show low-score ones)
  format: 'terminal'
}
`;
    writeFileSync(configPath, defaultConfig);
    console.log(chalk.green("✓ Created ai-review.config.js"));
  });

async function checkOllama(model) {
  const ollama = new Ollama();
  await ollama.show({ model });
}

program.parse();
