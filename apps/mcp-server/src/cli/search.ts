#!/usr/bin/env node
import { getContext } from '@context-broker/orchestrator';

async function main() {
  const args = process.argv.slice(2);
  let queryText = '';
  let tokenBudget = 4000;
  let outlineOnly = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-t' || arg === '--max-tokens') {
      tokenBudget = parseInt(args[++i] || '4000', 10);
    } else if (arg === '--outline' || arg === '--ast') {
      outlineOnly = true;
    } else if (!queryText && arg && !arg.startsWith('-')) {
      queryText = arg;
    }
  }

  if (!queryText) {
    console.log('Usage: context-search <query> [-t / --max-tokens <tokens>] [--outline / --ast]');
    process.exit(1);
  }

  try {
    const pkg = await getContext({
      query: queryText,
      tokenBudget,
      outlineOnly
    });

    console.log(JSON.stringify(pkg, null, 2));
  } catch (err: unknown) {
    console.error('CLI search error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
