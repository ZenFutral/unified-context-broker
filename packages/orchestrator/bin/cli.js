#!/usr/bin/env node

import { createDefaultOrchestrator } from '../dist/api.js';

async function main() {
  const orchestrator = await createDefaultOrchestrator(process.cwd());
  const cmd = process.argv[2];

  if (cmd === '--health' || cmd === 'health') {
    const report = await orchestrator.getRegistry().checkAllHealth();
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (cmd === 'search') {
    const query = process.argv[3] || '';
    let budget = 8000;
    const budgetIdx = process.argv.indexOf('--budget');
    if (budgetIdx !== -1 && process.argv[budgetIdx + 1]) {
      budget = parseInt(process.argv[budgetIdx + 1], 10);
    }
    const pkg = await orchestrator.executeSearch({
      queryId: `cli-${Date.now()}`,
      query,
      workspaceIds: [process.cwd()],
      tokenBudget: budget,
      resultLimit: 25,
      intent: 'hybrid',
      accessScope: ['workspace:read'],
      includeHistory: false,
      freshnessRequirement: 'either',
      metadata: {}
    });
    console.log(JSON.stringify(pkg, null, 2));
    return;
  }

  if (cmd === 'symbol') {
    const symbol = process.argv[3] || '';
    let filePath = undefined;
    const fileIdx = process.argv.indexOf('--file');
    if (fileIdx !== -1 && process.argv[fileIdx + 1]) {
      filePath = process.argv[fileIdx + 1];
    }
    const pkg = await orchestrator.executeSymbolLookup(symbol, filePath);
    console.log(JSON.stringify(pkg, null, 2));
    return;
  }

  if (cmd === 'digest') {
    const pkg = await orchestrator.executeRepositoryMap();
    console.log(JSON.stringify(pkg, null, 2));
    return;
  }

  if (cmd === 'memory') {
    const subCmd = process.argv[3];
    if (subCmd === 'record') {
      const titleIdx = process.argv.indexOf('--title');
      const decisionIdx = process.argv.indexOf('--decision');
      const rationaleIdx = process.argv.indexOf('--rationale');
      const title = titleIdx !== -1 ? process.argv[titleIdx + 1] : 'Architectural Decision';
      const decision = decisionIdx !== -1 ? process.argv[decisionIdx + 1] : '';
      const rationale = rationaleIdx !== -1 ? process.argv[rationaleIdx + 1] : '';
      const record = await orchestrator.executeDecisionRecord({
        title,
        decision,
        rationale,
        author: 'CLI User',
        tags: ['cli', 'adr']
      });
      console.log(JSON.stringify({ message: `Decision recorded as ${record.id}`, record }, null, 2));
      return;
    }
    const query = subCmd === 'recall' ? process.argv[4] || '' : subCmd || '';
    const pkg = await orchestrator.executeDecisionRecall(query);
    console.log(JSON.stringify(pkg, null, 2));
    return;
  }

  if (cmd === 'replace') {
    const file = process.argv[3];
    if (!file) {
      console.error('Error: Target file is required for replace command.');
      process.exit(1);
    }

    const dryRun = process.argv.includes('--dry-run');
    const isRegex = process.argv.includes('--regex');
    const matchCase = !process.argv.includes('--ignore-case');
    const allowMultiple = process.argv.includes('--allow-multiple') || process.argv.includes('--all');

    let replacements = [];

    const jsonIdx = process.argv.indexOf('--json') !== -1
      ? process.argv.indexOf('--json')
      : process.argv.indexOf('--payload');

    if (jsonIdx !== -1 && process.argv[jsonIdx + 1]) {
      const parsedJson = JSON.parse(process.argv[jsonIdx + 1]);
      if (Array.isArray(parsedJson)) {
        replacements = parsedJson;
      } else if (Array.isArray(parsedJson.replacements)) {
        replacements = parsedJson.replacements;
      } else if (parsedJson.targetContent && parsedJson.replacementContent) {
        replacements = [parsedJson];
      }
    } else {
      const findIdx = process.argv.indexOf('--find');
      const replaceIdx = process.argv.indexOf('--replace');

      if (findIdx === -1 || !process.argv[findIdx + 1]) {
        console.error('Error: --find "<target>" argument or --json <payload> is required.');
        process.exit(1);
      }

      const targetContent = process.argv[findIdx + 1];
      const replacementContent = replaceIdx !== -1 && process.argv[replaceIdx + 1] !== undefined
        ? process.argv[replaceIdx + 1]
        : '';

      const chunk = {
        targetContent,
        replacementContent,
        allowMultiple
      };

      const startLineIdx = process.argv.indexOf('--start-line');
      if (startLineIdx !== -1 && process.argv[startLineIdx + 1]) {
        chunk.startLine = parseInt(process.argv[startLineIdx + 1], 10);
      }

      const endLineIdx = process.argv.indexOf('--end-line');
      if (endLineIdx !== -1 && process.argv[endLineIdx + 1]) {
        chunk.endLine = parseInt(process.argv[endLineIdx + 1], 10);
      }

      replacements = [chunk];
    }

    const result = await orchestrator.executeSearchReplace({
      targetFile: file,
      replacements,
      dryRun,
      isRegex,
      matchCase,
      workspaceIds: [process.cwd()]
    });

    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Context Broker CLI

Usage:
  context-broker --health               Run backend health diagnostic
  context-broker search "<query>"       Search context with optional --budget <tokens>
  context-broker symbol <name>          Lookup symbol context with optional --file <path>
  context-broker digest                 Retrieve structural repository map digest
  context-broker memory recall "<q>"    Recall architectural decisions matching query
  context-broker replace <file> --find "<target>" --replace "<content>" [--dry-run]
`);
}

main().catch((err) => {
  console.error('CLI Error:', err);
  process.exit(1);
});
