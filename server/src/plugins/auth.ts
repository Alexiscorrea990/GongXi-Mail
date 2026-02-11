import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyToken, JwtPayload } from '../lib/jwt.js';
import { hashApiKey } from '../lib/crypto.js';
import prisma from '../lib/prisma.js';
import { AppError } from './error.js';

declare module 'fastify' {
    interface FastifyRequest {
        user?: {
            id: number;
            username: string;
            role: string;
        };
        apiKey?: {
            id: number;
            name: string;
            rateLimit: number;
        };
    }
}

/**
 * 提取 Token（从 Header 或 Cookie）
 */
function extractToken(request: FastifyRequest): string | null {
    // Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // Cookie
    const cookieToken = request.cookies?.token;
    if (cookieToken) {
        return cookieToken;
    }

    return null;
}

/**
 * 提取 API Key
 */
function extractApiKey(request: FastifyRequest): string | null {
    // X-API-Key header
    const headerKey = request.headers['x-api-key'];
    if (typeof headerKey === 'string') {
        return headerKey;
    }

    // Authorization: Bearer sk_xxx
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer sk_')) {
        return authHeader.substring(7);
    }

    // Query parameter
    const queryKey = (request.query as Record<string, string>)?.api_key;
    if (queryKey) {
        return queryKey;
    }

    return null;
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
    /**
     * JWT 认证 (管理后台)
     */
    fastify.decorate('authenticateJwt', async (request: FastifyRequest, reply: FastifyReply) => {
        const token = extractToken(request);

        if (!token) {
            throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
        }

        const payload = await verifyToken(token);
        if (!payload) {
            throw new AppError('INVALID_TOKEN', 'Invalid or expired token', 401);
        }

        request.user = {
            id: parseInt(payload.sub),
            username: payload.username,
            role: payload.role,
        };
    });

    /**
     * API Key 认证 (外部 API)
     */
    fastify.decorate('authenticateApiKey', async (request: FastifyRequest, reply: FastifyReply) => {
        const key = extractApiKey(request);

        if (!key) {
            throw new AppError('UNAUTHORIZED', 'API Key required', 401);
        }

        const keyHash = hashApiKey(key);
        const apiKey = await prisma.apiKey.findUnique({
            where: { keyHash },
            select: {
                id: true,
                name: true,
                rateLimit: true,
                status: true,
                expiresAt: true,
            },
        });

        if (!apiKey) {
            throw new AppError('INVALID_API_KEY', 'Invalid API Key', 401);
        }

        if (apiKey.status !== 'ACTIVE') {
            throw new AppError('API_KEY_DISABLED', 'API Key is disabled', 403);
        }

        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            throw new AppError('API_KEY_EXPIRED', 'API Key has expired', 403);
        }

        // 更新使用统计
        await prisma.apiKey.update({
            where: { id: apiKey.id },
            data: {
                usageCount: { increment: 1 },
                lastUsedAt: new Date(),
            },
        });

        request.apiKey = {
            id: apiKey.id,
            name: apiKey.name,
            rateLimit: apiKey.rateLimit,
        };
    });

    /**
     * 超级管理员权限检查
     */
    fastify.decorate('requireSuperAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.user) {
            throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
        }

        if (request.user.role !== 'SUPER_ADMIN') {
            throw new AppError('FORBIDDEN', 'Super admin access required', 403);
        }
    });
};

declare module 'fastify' {
    interface FastifyInstance {
        authenticateJwt: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
        authenticateApiKey: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
        requireSuperAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}

export default fp(authPlugin, { name: 'auth', dependencies: ['error'] });
