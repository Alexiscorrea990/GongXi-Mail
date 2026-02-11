import { z } from 'zod';

export const createGroupSchema = z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(255).optional(),
});

export const updateGroupSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    description: z.string().max(255).optional(),
});

export const assignEmailsSchema = z.object({
    emailIds: z.array(z.number().int().positive()),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type AssignEmailsInput = z.infer<typeof assignEmailsSchema>;
