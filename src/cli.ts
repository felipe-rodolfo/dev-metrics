#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { run } from './app.js';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

run(process.argv.slice(2), process.env).then((code) => {
  process.exitCode = code;
});
