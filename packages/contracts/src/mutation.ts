import { z } from 'zod';

export const SearchReplaceChunkSchema = z.object({
  targetContent: z.string().min(1, 'targetContent cannot be empty'),
  replacementContent: z.string(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  allowMultiple: z.boolean().optional().default(false)
});

export type SearchReplaceChunk = z.infer<typeof SearchReplaceChunkSchema>;

export const SearchReplaceRequestSchema = z.object({
  targetFile: z.string().min(1, 'targetFile cannot be empty'),
  replacements: z.array(SearchReplaceChunkSchema).min(1, 'replacements must contain at least one chunk'),
  dryRun: z.boolean().optional().default(false),
  isRegex: z.boolean().optional().default(false),
  matchCase: z.boolean().optional().default(true),
  workspaceIds: z.array(z.string()).optional()
});

export type SearchReplaceRequest = z.infer<typeof SearchReplaceRequestSchema>;

export const SearchReplaceResultSchema = z.object({
  targetFile: z.string(),
  modified: z.boolean(),
  chunksApplied: z.number(),
  unifiedDiff: z.string(),
  tokensDelta: z.number(),
  backupPath: z.string().optional(),
  warnings: z.array(z.string()).optional().default([]),
  secretsDetected: z.number().optional().default(0)
});

export type SearchReplaceResult = z.infer<typeof SearchReplaceResultSchema>;
