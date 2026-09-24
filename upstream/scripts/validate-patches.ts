import { z } from 'zod';

export const PatchLedgerEntrySchema = z.object({
  patch_id: z.string().regex(/^PATCH-[A-Z]+-\d{3}$/, 'patch_id must match format PATCH-XXX-000'),
  component: z.string().min(1),
  target_version: z.string().min(1),
  reason: z.string().min(10, 'Must provide detailed reason for the patch'),
  upstream_issue: z.string().url('upstream_issue must be a valid issue URL or tracker link'),
  introduced_against: z.string().min(1),
  owner: z.string().min(1),
  removal_condition: z.string().min(10, 'removal_condition must explicitly state when to remove the patch'),
  covered_by: z.array(z.string()).min(1, 'Patch must be covered by at least one test file')
});

export type PatchLedgerEntry = z.infer<typeof PatchLedgerEntrySchema>;

export function validatePatchEntry(entry: unknown): { valid: boolean; errors?: string[] } {
  const result = PatchLedgerEntrySchema.safeParse(entry);
  if (result.success) {
    return { valid: true };
  }
  return {
    valid: false,
    errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
  };
}
