#!/usr/bin/env node
import { getContext } from '@context-broker/orchestrator';

async function main() {
  const args = process.argv.slice(2);
  let outlineOnly = true;
  let tokenBudget = 8000;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-t' || arg === '--max-tokens') {
      tokenBudget = parseInt(args[++i] || '8000', 10);
    } else if (arg === '--full') {
      outlineOnly = false;
    }
  }

  try {
    const pkg = await getContext({
      query: 'repository_map_digest',
      intent: 'hybrid',
      tokenBudget,
      outlineOnly
    });

    console.log(`=== Codebase Digest ===`);
    console.log(`Retrieved ${pkg.candidates.length} module outline(s) (${pkg.estimatedTokens} tokens)`);
    console.log(`--------------------------------------------------`);
    for (const c of pkg.candidates) {
      console.log(`\n### ${c.filePath || c.symbol || 'Module'}`);
      console.log(c.content);
    }
  } catch (err: unknown) {
    console.error('CLI digest error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
