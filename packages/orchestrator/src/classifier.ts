import { QueryIntent } from '@context-broker/contracts';

export class QueryClassifier {
  /**
   * Deterministically classifies the user query intent based on linguistic patterns and heuristics.
   */
  classify(queryText: string): QueryIntent {
    const trimmed = queryText.trim().toLowerCase();

    // 1. Dependency Analysis heuristics
    if (
      /\b(who calls|what calls|where is .* used|callers of|callees of|find references to|dependenc(y|ies))\b/i.test(
        trimmed
      )
    ) {
      return 'dependency_analysis';
    }

    // 2. Impact Analysis heuristics
    if (
      /\b(what breaks|what is affected|blast radius|impact of|affecting|affected by changing)\b/i.test(
        trimmed
      )
    ) {
      return 'impact_analysis';
    }

    // 3. Decision Recall heuristics
    if (
      /\b(why did we|why was|architectural decision|adr|rationale for|decision on|why choose)\b/i.test(
        trimmed
      )
    ) {
      return 'decision_recall';
    }

    // 4. Documentation Search heuristics
    if (
      /\b(how to configure|documentation for|setup guide|readme|spec for|architecture doc)\b/i.test(
        trimmed
      )
    ) {
      return 'documentation_search';
    }

    // 5. Exact Identifier Lookup heuristics (CamelCase identifier or function call like FooBar or method())
    const isSingleIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(?:\(\))?$/.test(
      queryText.trim()
    );
    if (isSingleIdentifier || /\b(definition of|symbol|function|class|interface|type)\s+[a-zA-Z_$]/i.test(trimmed)) {
      return 'exact_lookup';
    }

    // 6. Implementation Search heuristics
    if (
      /\b(where is .* implemented|find implementation|locate handler|show code for)\b/i.test(
        trimmed
      )
    ) {
      return 'implementation_search';
    }

    // 7. Semantic Discovery heuristics
    if (
      /\b(how does .* work|concept of|overview of|explain the|pattern for)\b/i.test(
        trimmed
      )
    ) {
      return 'semantic_discovery';
    }

    // Default to hybrid
    return 'hybrid';
  }
}
