export interface CompatibilityReportData {
  upstreamComponent: string;
  currentVersion: string;
  candidateVersion: string;
  status: 'compatible' | 'incompatible' | 'degraded';
  breakingSurfaces: Array<{
    endpoint: string;
    expected: string;
    received: string;
  }>;
  affectedContracts: string[];
  recommendedResolution: {
    type: 'direct_upgrade' | 'adapter_translation' | 'broker_contract_change';
    brokerContractChange: boolean;
  };
  requiredTests: string[];
}

export class CompatibilityReporter {
  generateMarkdownReport(data: CompatibilityReportData): string {
    return [
      `# Upstream Compatibility Report: ${data.upstreamComponent}`,
      ``,
      `| Parameter | Value |`,
      `| :--- | :--- |`,
      `| **Component** | \`${data.upstreamComponent}\` |`,
      `| **Current Version** | \`${data.currentVersion}\` |`,
      `| **Candidate Version** | \`${data.candidateVersion}\` |`,
      `| **Compatibility Status** | **\`${data.status.toUpperCase()}\`** |`,
      ``,
      `## Breaking Surfaces`,
      data.breakingSurfaces.length === 0
        ? `No breaking surfaces detected. Seamless upgrade possible.`
        : data.breakingSurfaces
            .map(
              (b) =>
                `- **Endpoint**: \`${b.endpoint}\`\n  - Expected: \`${b.expected}\`\n  - Received: \`${b.received}\``
            )
            .join('\n'),
      ``,
      `## Affected Broker Contracts`,
      data.affectedContracts.map((c) => `- \`${c}\``).join('\n') || `- None`,
      ``,
      `## Recommended Resolution`,
      `- **Type**: \`${data.recommendedResolution.type}\``,
      `- **Broker Contract Change Required**: \`${data.recommendedResolution.brokerContractChange}\``,
      ``,
      `## Required Test Verifications`,
      data.requiredTests.map((t) => `- \`${t}\``).join('\n')
    ].join('\n');
  }
}
