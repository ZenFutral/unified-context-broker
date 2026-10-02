#!/usr/bin/env python3
"""
Unified Context Broker - Cross-Platform Python Bootstrap Launcher
Single External Indicator Deployment Engine (AGENTS.md)
"""
import os
import sys
import subprocess
import json
from pathlib import Path

# Enforce UTF-8 output encoding for Windows CLI environments
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def get_host_root_and_broker_folder(repo_root: Path):
    parent = repo_root.parent
    user_home = Path.home().resolve()
    
    # Do not treat user profile directories (e.g. C:\Users\Zen or C:\Users\Zen\Documents) as host projects
    if parent.resolve() in (user_home, user_home / "Documents", user_home / "Desktop") or parent.parent == parent:
        return repo_root, "unified-context-broker"

    # Check if parent is a host project workspace containing .git or package.json
    if (parent / ".git").exists() or (parent / "package.json").exists():
        return parent, "unified-context-broker"

    return repo_root, "unified-context-broker"

def main():
    print("[+] Starting Unified Context Broker Python Bootstrap Launcher...")
    repo_root = Path(__file__).parent.resolve()
    host_root, broker_folder_name = get_host_root_and_broker_folder(repo_root)

    is_win = sys.platform == "win32"

    # Check Node.js
    try:
        node_version = subprocess.check_output(["node", "-v"], text=True, shell=is_win).strip()
        print(f"[OK] Node.js detected: {node_version}")
    except Exception:
        print("[ERROR] Node.js is required but not found in PATH.")
        sys.exit(1)

    # Determine pnpm
    pnpm_cmd = ["npx", "pnpm"]

    print("[PACKAGES] Installing monorepo dependencies...")
    subprocess.run(pnpm_cmd + ["install"], cwd=repo_root, check=True, shell=is_win)

    print("[BUILD] Building monorepo packages...")
    subprocess.run(pnpm_cmd + ["run", "build"], cwd=repo_root, check=True, shell=is_win)

    print("[CONFIG] Scaffolding internal agent rules & MCP configurations inside broker...")

    # Load canonical rule template
    template_path = repo_root / "packages" / "contracts" / "src" / "templates" / "context-broker.md"
    if template_path.exists():
        rule_content = template_path.read_text(encoding="utf-8")
    else:
        rule_content = """# Context Broker MCP Directive

AI agents MUST prioritize Context Broker retrieval tools over brute-force file reads.
"""

    # Scaffold rules strictly inside broker root
    internal_rule_targets = [
        repo_root / ".agents" / "rules" / "context-broker.md",
    ]

    for target in internal_rule_targets:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(rule_content, encoding="utf-8")
        print(f"[OK] Scaffolded internal rule at: {target.relative_to(repo_root)}")

    # Internal MCP Config
    mcp_server_js = str((repo_root / "apps" / "mcp-server" / "dist" / "index.js").resolve())
    mcp_config = {
        "mcpServers": {
            "context-broker": {
                "command": "node",
                "args": [mcp_server_js]
            }
        }
    }

    internal_mcp_targets = [
        Path.home() / ".gemini" / "config" / "mcp_config.json",
        repo_root / ".agents" / "mcp_config.json"
    ]

    for mcp_target in internal_mcp_targets:
        mcp_target.parent.mkdir(parents=True, exist_ok=True)
        mcp_target.write_text(json.dumps(mcp_config, indent=2), encoding="utf-8")
        print(f"[OK] Scaffolded internal MCP config at: {mcp_target.relative_to(repo_root)}")

    # Deploy single external indicator to host root AGENTS.md
    print("[DEPLOY] Deploying single external indicator to AGENTS.md...")
    deploy_single_indicator(host_root, broker_folder_name)

    print("[HEALTH] Running engine self-check...")
    try:
        subprocess.run(["node", mcp_server_js, "--health"], cwd=repo_root, check=True, shell=is_win)
    except Exception as e:
        print(f"[WARNING] Health check exited with notice: {e}")

    print("[COMPLETE] Context Broker Bootstrap Complete!")

def deploy_single_indicator(host_root: Path, broker_folder_name: str):
    start_tag = "<!-- CONTEXT_BROKER_START -->"
    end_tag = "<!-- CONTEXT_BROKER_END -->"

    rel_prefix = f"./{broker_folder_name}"

    if host_root == repo_root:
        skill_block = f"""{start_tag}
## Context Broker Retrieval Engine (Embedded)

This codebase embeds a self-contained context engine at `./unified-context-broker/`.
When inspecting, searching, navigating, or refactoring this repository, prioritize the embedded broker over brute-force file reads.

### Direct Retrieval Commands (Zero-Daemon CLI)
- **Hybrid Search:** `node ./packages/orchestrator/bin/cli.js search "<query>" --budget 8000` (or `node ./unified-context-broker/packages/orchestrator/bin/cli.js`)
- **Symbol Lookup:** `node ./packages/orchestrator/bin/cli.js symbol <name> [--file <path>]` (or `node ./unified-context-broker/packages/orchestrator/bin/cli.js`)
- **Repository Structure Digest:** `node ./packages/orchestrator/bin/cli.js digest`
- **Architectural Memory Recall:** `node ./packages/orchestrator/bin/cli.js memory recall "<query>"`
- **Persist Decision:** `node ./packages/orchestrator/bin/cli.js memory record --title "<title>" --decision "<decision>" --rationale "<rationale>"`
- **Engine Diagnostics:** `node ./packages/orchestrator/bin/cli.js --health`
- **Safe Source Mutation:** `node ./packages/orchestrator/bin/cli.js replace <file> --find "<target>" --replace "<replacement>"`

### MCP Integration (IDE & Multi-Agent Swarms)
- **MCP Server Binary:** `node ./apps/mcp-server/dist/bundle.js` (or `./unified-context-broker/apps/mcp-server/dist/bundle.js`)
- **Canonical Tools:** `search_context`, `get_symbol_context`, `lookup_symbol`, `get_impact_context`, `analyze_impact`, `get_repository_map`, `get_repo_map`, `recall_decisions`, `record_decision`, `explain_context`, `backend_health`, `check_health`, `search_and_replace`, `replace_in_file`, `patch_file`
{end_tag}"""
    else:
        skill_block = f"""{start_tag}
## Context Broker Retrieval Engine (Embedded)

This codebase embeds a self-contained context engine at `{rel_prefix}/`.
When inspecting, searching, navigating, or refactoring this repository, prioritize the embedded broker over brute-force file reads.

### Direct Retrieval Commands (Zero-Daemon CLI)
- **Hybrid Search:** `node {rel_prefix}/packages/orchestrator/bin/cli.js search "<query>" --budget 8000`
- **Symbol Lookup:** `node {rel_prefix}/packages/orchestrator/bin/cli.js symbol <name> [--file <path>]`
- **Repository Structure Digest:** `node {rel_prefix}/packages/orchestrator/bin/cli.js digest`
- **Architectural Memory Recall:** `node {rel_prefix}/packages/orchestrator/bin/cli.js memory recall "<query>"`
- **Persist Decision:** `node {rel_prefix}/packages/orchestrator/bin/cli.js memory record --title "<title>" --decision "<decision>" --rationale "<rationale>"`
- **Engine Diagnostics:** `node {rel_prefix}/packages/orchestrator/bin/cli.js --health`
- **Safe Source Mutation:** `node {rel_prefix}/packages/orchestrator/bin/cli.js replace <file> --find "<target>" --replace "<replacement>"`

### MCP Integration (IDE & Multi-Agent Swarms)
- **MCP Server Binary:** `node {rel_prefix}/apps/mcp-server/dist/bundle.js` (or `{rel_prefix}/apps/mcp-server/dist/index.js`)
- **Canonical Tools:** `search_context`, `get_symbol_context`, `lookup_symbol`, `get_impact_context`, `analyze_impact`, `get_repository_map`, `get_repo_map`, `recall_decisions`, `record_decision`, `explain_context`, `backend_health`, `check_health`, `search_and_replace`, `replace_in_file`, `patch_file`
{end_tag}"""

    agents_file = host_root / "AGENTS.md"
    if not agents_file.exists() and (host_root / "agent.md").exists():
        agents_file = host_root / "agent.md"

    if agents_file.exists():
        content = agents_file.read_text(encoding="utf-8")
        if start_tag in content and end_tag in content:
            before = content.split(start_tag)[0]
            after = content.split(end_tag)[1]
            new_content = before + skill_block + after
        else:
            new_content = content.rstrip() + "\n\n" + skill_block + "\n"
    else:
        new_content = skill_block + "\n"

    agents_file.write_text(new_content, encoding="utf-8")
    print(f"[OK] Deployed single external indicator at: {agents_file.resolve()}")

if __name__ == "__main__":
    main()
