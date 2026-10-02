import { z } from 'zod';

export const ToolExecutionEventSchema = z.object({
  id: z.string(),
  tool: z.string(),
  args: z.string(),
  latency: z.number().nonnegative(),
  tokensSaved: z.number().int().nonnegative(),
  timestamp: z.string(),
  status: z.enum(['success', 'error']),
  requestPayload: z.unknown().optional(),
  responsePayload: z.unknown().optional(),
  details: z.record(z.unknown()).optional()
});

export type ToolExecutionEvent = z.infer<typeof ToolExecutionEventSchema>;
