import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),

    // Database
    DATABASE_URL: z.string().url(),

    // Redis (optional)
    REDIS_URL: z.string().optional(),

    // JWT
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('2h'),

    // Encryption
    ENCRYPTION_KEY: z.string().length(32),

    // Default Admin
    ADMIN_USERNAME: z.string().default('admin'),
    ADMIN_PASSWORD: z.string().default('admin123'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        console.error('❌ Invalid environment variables:');
        console.error(result.error.format());
        process.exit(1);
    }

    return result.data;
}

export const env = loadEnv();
