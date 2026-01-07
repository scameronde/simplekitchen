import { z } from 'zod';

export const ConversationTurnSchema = z.object({
  aiMessage: z.string(),
  extractedContext: z.object({
    energyLevel: z.enum(['low', 'medium', 'high']).nullable().optional(),
    availableTime: z.number().min(0).max(120).nullable().optional(),
    mood: z.string().nullable().optional(),
    canShop: z.boolean().nullable().optional(),
  }),
  shouldTransition: z.boolean(),
  reasoning: z.string().nullable().optional(),
});

export type ConversationTurnOutput = z.infer<typeof ConversationTurnSchema>;
