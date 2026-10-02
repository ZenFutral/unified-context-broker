import { z } from 'zod';

export const DecisionRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  decision: z.string().min(1),
  rationale: z.string().min(1),
  rejectedAlternatives: z.array(z.string()).default([]),
  affectedComponents: z.array(z.string()).default([]),
  author: z.string().default('AI Agent / Architect'),
  timestamp: z.string().datetime(),
  tags: z.array(z.string()).default([]),
  sourceFile: z.string().optional()
});

export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;
