# Publishing Guide: GitHub & Open VSX

This guide details how to upload the **Unified Context Broker** monorepo to GitHub and publish the **VS Code Companion Extension** to the **Open VSX Registry** (and optionally the VS Code Marketplace).

---

## 1. Uploading to GitHub

### Prerequisites
- [Git](https://git-scm.com/) installed on your machine (`C:\Users\<user>\AppData\Local\Programs\Git\cmd\git.exe` on Windows).
- A GitHub account.

### Step 1: Create a New Repository on GitHub
1. Go to [github.com/new](https://github.com/new).
2. Set Repository Name: `context-broker` (or your preferred name).
3. Set Visibility: **Public** (recommended for Open VSX companions) or Private.
4. Leave **"Initialize with README, .gitignore, and license"** unchecked (they already exist in this repository).
5. Click **Create repository**.

### Step 2: Initialize & Push Code
Open a terminal in the `context-broker` directory and execute:

```powershell
# Ensure git is in your PATH
$env:PATH += ";C:\Users\ZenFutral\AppData\Local\Programs\Git\cmd"

# Initialize git repository
git init -b main

# Stage all files (the curated .gitignore ensures build caches and node_modules are excluded)
git add .

# Create initial commit
git commit -m "feat: initial commit of Unified Context Broker monorepo and VS Code companion"

# Link to your remote GitHub repository (replace with your GitHub username)
git remote add origin https://github.com/ZenFutral/unified-context-broker.git

# Push to main
git push -u origin main
```

---

## 2. Publishing Extension to Open VSX

The Open VSX Registry powers open-source VS Code distributions like **VSCodium**, **Gitpod**, **Eclipse Theia**, and **Antigravity IDE**.

### Step 1: Register on Open VSX
1. Go to [open-vsx.org](https://open-vsx.org).
2. Sign in with your GitHub account.

### Step 2: Create a Namespace
1. In Open VSX, publisher names are called **namespaces**.
2. If using the default namespace in `package.json` (`context-broker`):
   - Claim or request the `context-broker` namespace via your Open VSX account settings (or change `"publisher": "<your-namespace>"` in [apps/vscode-extension/package.json](file:///apps/vscode-extension/package.json) to match an existing namespace you own).
3. You can also create a namespace via CLI:
   ```bash
   npx ovsx create-namespace <your-namespace> -p <YOUR_OVSX_TOKEN>
   ```

### Step 3: Generate an Access Token (PAT)
1. Go to your Open VSX profile settings: [open-vsx.org/user-settings/tokens](https://open-vsx.org/user-settings/tokens).
2. Click **Generate New Token**.
3. Name it (e.g., `context-broker-ci`).
4. Copy the generated token.

### Step 4: Option A — Publish Locally via CLI
To package and publish directly from your workstation:

```powershell
cd apps/vscode-extension

# 1. Package extension into .vsix
npx @vscode/vsce package --no-dependencies

# 2. Publish to Open VSX
npx ovsx publish context-broker-vscode-0.1.0.vsix -p <YOUR_OVSX_TOKEN>
```

### Step 5: Option B — Automated GitHub Actions CI/CD (Recommended)
This repository includes an automated GitHub Actions workflow at [.github/workflows/publish-extension.yml](file:///.github/workflows/publish-extension.yml).

1. In your GitHub repository:
   - Navigate to **Settings** > **Secrets and variables** > **Actions**.
   - Click **New repository secret**.
   - Name: `OVSX_PAT`
   - Value: `<YOUR_OVSX_ACCESS_TOKEN>`
   - (Optional) Name: `VSCE_PAT` if you also wish to cross-publish to the Visual Studio Marketplace.
2. To trigger a release:
   - Push a git tag:
     ```bash
     git tag v0.1.0
     git push origin v0.1.0
     ```
   - Or go to the **Actions** tab on GitHub, select **Publish VS Code Extension to Open VSX**, and click **Run workflow**.
3. The workflow will automatically:
   - Build all monorepo packages.
   - Run the test suite.
   - Package the `.vsix` bundle.
   - Publish to Open VSX.
   - Create a GitHub Release with the downloadable `.vsix` attached.

---

## 3. Extension Quality Checklist

Before publishing, verify the following:

- [x] **SPDX License**: `MIT` declared in both root and extension manifests.
- [x] **Icon**: 128x128 PNG icon (`resources/icon.png`) for marketplace cards.
- [x] **Zero Runtime Dependency Bloat**: Extension bundles zero unneeded node_modules; runs purely against VS Code and Node APIs.
- [x] **Exclusions**: Clean `.vscodeignore` omitting source TypeScript and tests from the final `.vsix`.
- [x] **Repository Links**: Git repository, issue tracker, and homepage metadata mapped in `package.json`.
