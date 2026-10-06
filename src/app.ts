import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig, ConfigError, Config } from './config.js';
import { SourceResult } from './model.js';
import { renderReport } from './report.js';
import { createAdapters } from './sources/index.js';
import type { SourceAdapter } from './sources/adapter.js';

export interface AppDeps {
  adapters?: (config: Config) => SourceAdapter[];
  out?: (line: string) => void;
  err?: (line: string) => void;
}

export async function run(argv: string[], env: NodeJS.ProcessEnv, deps: AppDeps = {}): Promise<number> {
  const out = deps.out ?? console.log;
  const err = deps.err ?? console.error;

  let config: Config;
  try {
    config = loadConfig(argv, env);
  } catch (error) {
    if (error instanceof ConfigError) {
      err(`Erro: ${error.message}`);
      return 1;
    }
    throw error;
  }

  const adapters = (deps.adapters ?? ((c) => createAdapters(c)))(config);

  // Confirma todos os tokens antes de buscar qualquer dado.
  for (const adapter of adapters) {
    try {
      await adapter.identify();
    } catch (error) {
      err(`Erro em ${adapter.name}: ${(error as Error).message}`);
      return 1;
    }
  }

  const results = await Promise.all(
    adapters.map(async (adapter): Promise<SourceResult> => {
      try {
        return { ok: true, name: adapter.name, data: await adapter.collect(config.period) };
      } catch (error) {
        return { ok: false, name: adapter.name, reason: (error as Error).message };
      }
    }),
  );

  const markdown = renderReport(config.period, results);

  await mkdir(config.outDir, { recursive: true });
  const file = join(config.outDir, `relatorio-${config.period.from}_${config.period.to}.md`);
  await writeFile(file, markdown, 'utf8');
  out(`Relatório gerado: ${file}`);

  const incomplete = results.some((result) => !result.ok);
  if (incomplete) {
    err('Atenção: uma ou mais fontes estão incompletas. Veja a seção "Fontes" do relatório.');
  }
  return incomplete ? 1 : 0;
}
