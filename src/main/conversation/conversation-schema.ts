import { z } from 'zod';

export const ConversationTurnSchema = z.object({
  aiMessage: z.string(),
  extractedContext: z.object({
    energyLevel: z.enum(['low', 'medium', 'high']).optional(),
    availableTime: z.number().min(0).max(120).optional(),
    mood: z.string().optional(),
    canShop: z.boolean().optional(),
  }),
  shouldTransition: z.boolean(),
  reasoning: z.string().optional(),
});

export type ConversationTurnOutput = z.infer<typeof ConversationTurnSchema>;
