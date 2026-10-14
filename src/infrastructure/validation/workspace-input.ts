import { z } from 'zod';

export const workspaceInput = z.strictObject({
  name: z.string().trim().min(1).refine((name) => [...name].length <= 120, { message: 'Workspace names must contain 1–120 characters.' }),
  type: z.enum(['PERSONAL', 'BUSINESS']),
  timezone: z.string().min(1).max(100),
});
