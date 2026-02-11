import prisma from '../../lib/prisma.js';
import { signToken } from '../../lib/jwt.js';
import { hashPassword, verifyPassword } from '../../lib/crypto.js';
import { env } from '../../config/env.js';
import { AppError } from '../../plugins/error.js';
import type { LoginInput, ChangePasswordInput } from './auth.schema.js';

export const authService = {
    /**
     * 管理员登录
     */
    async login(input: LoginInput, ip?: string) {
        const { username, password } = input;

        // 查询管理员
        const admin = await prisma.admin.findUnique({
            where: { username },
            select: {
                id: true,
                username: true,
                passwordHash: true,
                role: true,
                status: true,
            },
        });

        // 管理员不存在，检查是否是默认管理员
        if (!admin) {
            if (username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD) {
                // 如果是默认管理员但数据库不存在，自动创建
                const passwordHash = await hashPassword(password);
                const newAdmin = await prisma.admin.create({
                    data: {
                        username,
                        passwordHash,
                        role: 'SUPER_ADMIN',
                        status: 'ACTIVE',
                    },
                });

                // 使用新创建的管理员信息生成 Token
                const token = await signToken({
                    sub: newAdmin.id.toString(),
                    username: newAdmin.username,
                    role: newAdmin.role,
                });

                return {
                    token,
                    admin: {
                        id: newAdmin.id,
                        username: newAdmin.username,
                        role: newAdmin.role,
                    },
                };
            }

            throw new AppError('INVALID_CREDENTIALS', 'Invalid username or password', 401);
        }

        // 检查状态
        if (admin.status !== 'ACTIVE') {
            throw new AppError('ACCOUNT_DISABLED', 'Account is disabled', 403);
        }

        // 验证密码
        const isValid = await verifyPassword(password, admin.passwordHash);
        if (!isValid) {
            throw new AppError('INVALID_CREDENTIALS', 'Invalid username or password', 401);
        }

        // 更新登录信息
        await prisma.admin.update({
            where: { id: admin.id },
            data: {
                lastLoginAt: new Date(),
                lastLoginIp: ip,
            },
        });

        // 生成 Token
        const token = await signToken({
            sub: admin.id.toString(),
            username: admin.username,
            role: admin.role,
        });

        return {
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                role: admin.role,
            },
        };
    },

    /**
     * 修改密码
     */
    async changePassword(adminId: number, input: ChangePasswordInput) {
        const { oldPassword, newPassword } = input;

        // 环境变量管理员（id=0）不能修改密码
        if (adminId === 0) {
            throw new AppError('CANNOT_CHANGE', 'Cannot change password for default admin', 400);
        }

        const admin = await prisma.admin.findUnique({
            where: { id: adminId },
            select: { passwordHash: true },
        });

        if (!admin) {
            throw new AppError('NOT_FOUND', 'Admin not found', 404);
        }

        const isValid = await verifyPassword(oldPassword, admin.passwordHash);
        if (!isValid) {
            throw new AppError('INVALID_PASSWORD', 'Invalid old password', 400);
        }

        const newHash = await hashPassword(newPassword);
        await prisma.admin.update({
            where: { id: adminId },
            data: { passwordHash: newHash },
        });

        return { success: true };
    },

    /**
     * 获取当前管理员信息
     */
    async getMe(adminId: number) {
        if (adminId === 0) {
            return {
                id: 0,
                username: env.ADMIN_USERNAME,
                role: 'SUPER_ADMIN',
            };
        }

        const admin = await prisma.admin.findUnique({
            where: { id: adminId },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        if (!admin) {
            throw new AppError('NOT_FOUND', 'Admin not found', 404);
        }

        return admin;
    },
};
