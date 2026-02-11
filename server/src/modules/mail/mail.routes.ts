import { FastifyPluginAsync } from 'fastify';
import { mailService } from './mail.service.js';
import { poolService } from './pool.service.js';
import { emailService } from '../email/email.service.js';
import { z } from 'zod';
import { AppError } from '../../plugins/error.js';

// 邮件请求 Schema
const mailRequestSchema = z.object({
    email: z.string().email(),
    mailbox: z.string().default('inbox'),
    socks5: z.string().optional(),
    http: z.string().optional(),
});

// 纯文本邮件请求 Schema
const mailTextRequestSchema = z.object({
    email: z.string().email(),
    match: z.string().optional(), // 正则表达式 (可选)
});

const mailRoutes: FastifyPluginAsync = async (fastify) => {
    // 所有路由需要 API Key 认证
    fastify.addHook('preHandler', fastify.authenticateApiKey);

    // ========================================
    // 新增：获取一个未使用的邮箱地址 (带重试机制)
    // ========================================
    fastify.all('/get-email', async (request) => {
        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }

        const params = request.method === 'GET' ? request.query as any : request.body as any;
        const groupName = params?.group as string | undefined;

        // 重试 3 次，防止并发冲突
        for (let i = 0; i < 3; i++) {
            const email = await poolService.getUnusedEmail(request.apiKey.id, groupName);
            if (!email) {
                const stats = await poolService.getStats(request.apiKey.id, groupName);
                throw new AppError(
                    'NO_UNUSED_EMAIL',
                    `No unused emails available${groupName ? ` in group '${groupName}'` : ''}. Used: ${stats.used}/${stats.total}`,
                    400
                );
            }

            try {
                await poolService.markUsed(request.apiKey.id, email.id);
                return {
                    success: true,
                    data: {
                        email: email.email,
                        id: email.id,
                    },
                };
            } catch (err: any) {
                if (err.code === 'ALREADY_USED') {
                    continue;
                }
                throw err;
            }
        }

        throw new AppError('CONCURRENCY_LIMIT', 'System busy, please try again', 429);
    });

    // ========================================
    // 获取最新邮件（必须指定 email）
    // ========================================
    fastify.all('/mail_new', async (request) => {
        const startTime = Date.now();
        const input = mailRequestSchema.parse(
            request.method === 'GET' ? request.query : request.body
        );

        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }

        // 查找邮箱
        const emailAccount = await emailService.getByEmail(input.email);
        if (!emailAccount) {
            throw new AppError('EMAIL_NOT_FOUND', 'Email account not found', 404);
        }

        const credentials = {
            id: emailAccount.id,
            email: emailAccount.email,
            clientId: emailAccount.clientId,
            refreshToken: emailAccount.refreshToken!,
            autoAssigned: false,
        };

        try {
            const result = await mailService.getEmails(credentials, {
                mailbox: input.mailbox,
                limit: 1,
                socks5: input.socks5,
                http: input.http,
            });

            await mailService.updateEmailStatus(credentials.id, true);

            await mailService.logApiCall(
                'mail_new',
                request.apiKey.id,
                credentials.id,
                request.ip,
                200,
                Date.now() - startTime
            );

            return {
                success: true,
                data: result,
                email: credentials.email,
            };
        } catch (err: any) {
            await mailService.updateEmailStatus(credentials.id, false, err.message);
            await mailService.logApiCall(
                'mail_new',
                request.apiKey.id,
                credentials.id,
                request.ip,
                500,
                Date.now() - startTime
            );
            throw err;
        }
    });

    // ========================================
    // 新增：获取最新邮件的纯文本内容 (脚本友好)
    // ========================================
    fastify.all('/mail_text', async (request, reply) => {
        const startTime = Date.now();
        const input = mailTextRequestSchema.parse(
            request.method === 'GET' ? request.query : request.body
        );

        if (!request.apiKey?.id) {
            reply.code(401).type('text/plain').send('Error: API Key required');
            return;
        }

        const emailAccount = await emailService.getByEmail(input.email);
        if (!emailAccount) {
            reply.code(404).type('text/plain').send('Error: Email account not found');
            return;
        }

        const credentials = {
            id: emailAccount.id,
            email: emailAccount.email,
            clientId: emailAccount.clientId,
            refreshToken: emailAccount.refreshToken!,
            autoAssigned: false,
        };

        try {
            const result = await mailService.getEmails(credentials, {
                mailbox: 'inbox',
                limit: 1, // 只取最新一封
            });

            await mailService.updateEmailStatus(credentials.id, true);
            await mailService.logApiCall(
                'mail_text',
                request.apiKey.id,
                credentials.id,
                request.ip,
                200,
                Date.now() - startTime
            );

            if (!result.messages || result.messages.length === 0) {
                reply.type('text/plain').send('Error: No messages found');
                return;
            }

            const message = result.messages[0];
            // 优先使用 text 字段
            let content = message.text || '';

            // 如果指定了正则匹配
            if (input.match) {
                try {
                    const regex = new RegExp(input.match);
                    const match = content.match(regex);
                    if (match) {
                        // 如果有捕获组，返回第一个捕获组；否则返回整个匹配
                        content = match[1] || match[0];
                    } else {
                        reply.code(404).type('text/plain').send('Error: No match found');
                        return;
                    }
                } catch (e) {
                    reply.code(400).type('text/plain').send('Error: Invalid regex pattern');
                    return;
                }
            }

            return reply.type('text/plain').send(content);

        } catch (err: any) {
            await mailService.updateEmailStatus(credentials.id, false, err.message);
            await mailService.logApiCall(
                'mail_text',
                request.apiKey.id,
                credentials.id,
                request.ip,
                500,
                Date.now() - startTime
            );
            reply.code(500).type('text/plain').send(`Error: ${err.message}`);
        }
    });

    // ========================================
    // 获取所有邮件（必须指定 email）
    // ========================================
    fastify.all('/mail_all', async (request) => {
        const startTime = Date.now();
        const input = mailRequestSchema.parse(
            request.method === 'GET' ? request.query : request.body
        );

        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }

        const emailAccount = await emailService.getByEmail(input.email);
        if (!emailAccount) {
            throw new AppError('EMAIL_NOT_FOUND', 'Email account not found', 404);
        }

        const credentials = {
            id: emailAccount.id,
            email: emailAccount.email,
            clientId: emailAccount.clientId,
            refreshToken: emailAccount.refreshToken!,
            autoAssigned: false,
        };

        try {
            const result = await mailService.getEmails(credentials, {
                mailbox: input.mailbox,
                socks5: input.socks5,
                http: input.http,
            });

            await mailService.updateEmailStatus(credentials.id, true);

            await mailService.logApiCall(
                'mail_all',
                request.apiKey.id,
                credentials.id,
                request.ip,
                200,
                Date.now() - startTime
            );

            return {
                success: true,
                data: result,
                email: credentials.email,
            };
        } catch (err: any) {
            await mailService.updateEmailStatus(credentials.id, false, err.message);
            await mailService.logApiCall(
                'mail_all',
                request.apiKey.id,
                credentials.id,
                request.ip,
                500,
                Date.now() - startTime
            );
            throw err;
        }
    });

    // ========================================
    // 清空邮箱（必须指定 email）
    // ========================================
    fastify.all('/process-mailbox', async (request) => {
        const startTime = Date.now();
        const input = mailRequestSchema.parse(
            request.method === 'GET' ? request.query : request.body
        );

        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }

        const emailAccount = await emailService.getByEmail(input.email);
        if (!emailAccount) {
            throw new AppError('EMAIL_NOT_FOUND', 'Email account not found', 404);
        }

        const credentials = {
            id: emailAccount.id,
            email: emailAccount.email,
            clientId: emailAccount.clientId,
            refreshToken: emailAccount.refreshToken!,
            autoAssigned: false,
        };

        try {
            const result = await mailService.processMailbox(credentials, {
                mailbox: input.mailbox,
                socks5: input.socks5,
                http: input.http,
            });

            await mailService.updateEmailStatus(credentials.id, true);

            await mailService.logApiCall(
                'process_mailbox',
                request.apiKey.id,
                credentials.id,
                request.ip,
                200,
                Date.now() - startTime
            );

            return {
                success: true,
                data: result,
                email: credentials.email,
            };
        } catch (err: any) {
            await mailService.updateEmailStatus(credentials.id, false, err.message);
            await mailService.logApiCall(
                'process_mailbox',
                request.apiKey.id,
                credentials.id,
                request.ip,
                500,
                Date.now() - startTime
            );
            throw err;
        }
    });

    // ========================================
    // 列出系统 ACTIVE 邮箱（支持分组过滤）
    // ========================================
    fastify.all('/list-emails', async (request) => {
        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }

        const params = request.method === 'GET' ? request.query as any : request.body as any;
        const groupName = params?.group as string | undefined;

        const result = await emailService.list({ page: 1, pageSize: 1000, status: 'ACTIVE', groupName });
        const emails = result.list.map((e: any) => ({
            email: e.email,
            status: e.status,
            group: e.group?.name || null,
        }));

        return {
            success: true,
            data: {
                total: result.total,
                emails: emails,
            },
        };
    });

    // ========================================
    // 邮箱池统计（支持分组过滤）
    // ========================================
    fastify.all('/pool-stats', async (request) => {
        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }
        const params = request.method === 'GET' ? request.query as any : request.body as any;
        const groupName = params?.group as string | undefined;
        const stats = await poolService.getStats(request.apiKey.id, groupName);
        return { success: true, data: stats };
    });

    // ========================================
    // 重置邮箱池（支持分组过滤）
    // ========================================
    fastify.all('/reset-pool', async (request) => {
        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }
        const params = request.method === 'GET' ? request.query as any : request.body as any;
        const groupName = params?.group as string | undefined;
        await poolService.reset(request.apiKey.id, groupName);
        return { success: true, data: { message: `Pool reset successfully${groupName ? ` for group '${groupName}'` : ''}` } };
    });
};

export default mailRoutes;
