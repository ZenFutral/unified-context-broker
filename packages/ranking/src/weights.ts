import { ScoringWeights } from '@context-broker/contracts';

export const defaultScoringWeights: ScoringWeights = {
  lexicalWeight: 0.30,
  semanticWeight: 0.35,
  graphWeight: 0.20,
  recencyWeight: 0.10,
  pathPriorityWeight: 0.05,
  intentMatchBoost: 0.15,
  stalePenalty: 0.25,
  duplicatePenalty: 0.10
};
