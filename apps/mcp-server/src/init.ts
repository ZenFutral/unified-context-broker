import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONTEXT_BROKER_RULE, getBrokerRoot } from '@context-broker/contracts';

export const CONTEXT_BROKER_RULE_CONTENT = DEFAULT_CONTEXT_BROKER_RULE;

export function deploySingleIndicatorToAgentsMd(hostDir: string, brokerFolderName: string): void {
  const startTag = '<!-- CONTEXT_BROKER_START -->';
  const endTag = '<!-- CONTEXT_BROKER_END -->';

  const relPrefix = `./${brokerFolderName}`;

  const skillBlock = `${startTag}
## Context Broker Retrieval Engine (Embedded)

This codebase embeds a self-contained context engine at \`${relPrefix}/\`.
When inspecting, searching, navigating, or refactoring this repository, prioritize the embedded broker over brute-force file reads.

### Direct Retrieval Commands (Zero-Daemon CLI)
- **Hybrid Search:** \`node ${relPrefix}/packages/orchestrator/bin/cli.js search "<query>" --budget 8000\`
- **Symbol Lookup:** \`node ${relPrefix}/packages/orchestrator/bin/cli.js symbol <name> [--file <path>]\`
- **Repository Structure Digest:** \`node ${relPrefix}/packages/orchestrator/bin/cli.js digest\`
- **Architectural Memory Recall:** \`node ${relPrefix}/packages/orchestrator/bin/cli.js memory recall "<query>"\`
- **Persist Decision:** \`node ${relPrefix}/packages/orchestrator/bin/cli.js memory record --title "<title>" --decision "<decision>" --rationale "<rationale>"\`
- **Engine Diagnostics:** \`node ${relPrefix}/packages/orchestrator/bin/cli.js --health\`

### MCP Integration (IDE & Multi-Agent Swarms)
- **MCP Server Binary:** \`node ${relPrefix}/apps/mcp-server/dist/index.js\`
- **Canonical Tools:** \`search_context\`, \`get_symbol_context\`, \`lookup_symbol\`, \`get_impact_context\`, \`analyze_impact\`, \`get_repository_map\`, \`get_repo_map\`, \`recall_decisions\`, \`record_decision\`, \`explain_context\`, \`backend_health\`, \`check_health\`
${endTag}`;

  let agentsFile = path.join(hostDir, 'AGENTS.md');
  if (!fs.existsSync(agentsFile) && fs.existsSync(path.join(hostDir, 'agent.md'))) {
    agentsFile = path.join(hostDir, 'agent.md');
  }

  if (fs.existsSync(agentsFile)) {
    const content = fs.readFileSync(agentsFile, 'utf8');
    if (content.includes(startTag) && content.includes(endTag)) {
      const before = content.split(startTag)[0];
      const after = content.split(endTag)[1];
      fs.writeFileSync(agentsFile, before + skillBlock + after, 'utf8');
    } else {
      fs.writeFileSync(agentsFile, content.trimEnd() + '\n\n' + skillBlock + '\n', 'utf8');
    }
  } else {
    fs.writeFileSync(agentsFile, skillBlock + '\n', 'utf8');
  }

  console.log(`  [OK] Deployed single external indicator: ${agentsFile}`);
}

/**
 * Initializes Context Broker configuration and single external indicator (AGENTS.md) in a target codebase.
 */
export function initializeCodebase(targetPath?: string): void {
  const targetDir = targetPath ? path.resolve(targetPath) : process.cwd();
  const brokerRoot = getBrokerRoot();
  const brokerFolderName = path.basename(brokerRoot);

  console.log(`\n  Initializing Context Broker MCP in: ${targetDir}`);

  // 1. Scaffold internal rules strictly inside brokerRoot
  const internalAgentsDir = path.join(brokerRoot, '.agents');
  const internalRulesDir = path.join(internalAgentsDir, 'rules');
  if (!fs.existsSync(internalRulesDir)) {
    fs.mkdirSync(internalRulesDir, { recursive: true });
  }
  fs.writeFileSync(path.join(internalRulesDir, 'context-broker.md'), CONTEXT_BROKER_RULE_CONTENT, 'utf8');

  // 2. Scaffold internal MCP config inside brokerRoot
  const currentFilePath = fileURLToPath(import.meta.url);
  const serverPath = path.join(path.dirname(currentFilePath), 'index.js').replace(/\\/g, '/');

  const mcpConfigPath = path.join(internalAgentsDir, 'mcp_config.json');
  const mcpConfig = {
    mcpServers: {
      'context-broker': {
        command: 'node',
        args: [serverPath],
        env: {
          CONTEXT_BROKER_MOCK: 'true'
        }
      }
    }
  };
  fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf8');

  // 3. Deploy single indicator to targetDir/AGENTS.md
  deploySingleIndicatorToAgentsMd(targetDir, brokerFolderName);

  console.log(`\n  ==============================================================`);
  console.log(`  Context Broker MCP successfully initialized!`);
  console.log(`  - Single external indicator deployed to AGENTS.md.`);
  console.log(`  - Engine 100% self-contained inside ./${brokerFolderName}/.`);
  console.log(`  ==============================================================\n`);
}
