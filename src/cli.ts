#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { run } from './app.js';

const { version } = createRequire(import.meta.url)('../package.json');

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const program = new Command()
  .name('dev-metrics')
  .description('Generates a local metrics report for one developer (Jira, GitHub and GitLab) over a date range.')
  .version(version, '-v, --version')
  .requiredOption('-f, --from <date>', 'start date, inclusive (YYYY-MM-DD)')
  .requiredOption('-t, --to <date>', 'end date, inclusive (YYYY-MM-DD)')
  .option('-o, --out <dir>', 'output folder', './reports')
  .parse();

run(program.opts(), process.env).then((code) => {
  process.exitCode = code;
});
