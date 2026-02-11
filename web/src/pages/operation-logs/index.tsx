import React, { useEffect, useState } from 'react';
import { Table, Tag, Space, Card, Select, Button, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { PageHeader } from '../../components';
import { logsApi } from '../../api';
import dayjs from 'dayjs';

const { Text } = Typography;

interface LogItem {
    id: number;
    action: string;
    apiKeyName: string;
    email: string;
    requestIp: string;
    responseCode: number;
    responseTimeMs: number;
    createdAt: string;
}

const actionLabels: Record<string, string> = {
    'mail_new': '获取最新邮件',
    'mail_all': '获取所有邮件',
    'process-mailbox': '清空邮箱',
    'pool_stats': '邮箱池统计',
    'pool_reset': '重置邮箱池',
    'emails': '获取邮箱列表',
};

const OperationLogsPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [actionFilter, setActionFilter] = useState<string | undefined>();

    useEffect(() => {
        fetchLogs();
    }, [page, pageSize, actionFilter]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res: any = await logsApi.getList({ page, pageSize, action: actionFilter });
            if (res.code === 200) {
                setLogs(res.data.list);
                setTotal(res.data.total);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: '时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 170,
            render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
        },
        {
            title: 'API Key',
            dataIndex: 'apiKeyName',
            key: 'apiKeyName',
            width: 150,
            render: (name: string) => name === '-' ? <Text type="secondary">-</Text> : <Tag color="blue">{name}</Tag>,
        },
        {
            title: '操作',
            dataIndex: 'action',
            key: 'action',
            width: 140,
            render: (action: string) => {
                const label = actionLabels[action] || action;
                const colors: Record<string, string> = {
                    'mail_new': 'processing',
                    'mail_all': 'processing',
                    'process-mailbox': 'error',
                    'pool_stats': 'default',
                    'pool_reset': 'warning',
                    'emails': 'default',
                };
                return <Tag color={colors[action] || 'default'}>{label}</Tag>;
            },
        },
        {
            title: '邮箱',
            dataIndex: 'email',
            key: 'email',
            ellipsis: true,
            render: (email: string) => email === '-' ? <Text type="secondary">-</Text> : email,
        },
        {
            title: '状态码',
            dataIndex: 'responseCode',
            key: 'responseCode',
            width: 80,
            align: 'center' as const,
            render: (code: number) => (
                <Tag color={code === 200 ? 'success' : 'error'}>{code}</Tag>
            ),
        },
        {
            title: '耗时',
            dataIndex: 'responseTimeMs',
            key: 'responseTimeMs',
            width: 100,
            align: 'right' as const,
            render: (ms: number) => `${ms} ms`,
        },
        {
            title: 'IP 地址',
            dataIndex: 'requestIp',
            key: 'requestIp',
            width: 140,
        },
    ];

    const actionOptions = [
        { value: 'mail_new', label: '获取最新邮件' },
        { value: 'mail_all', label: '获取所有邮件' },
        { value: 'process-mailbox', label: '清空邮箱' },
        { value: 'pool_stats', label: '邮箱池统计' },
        { value: 'pool_reset', label: '重置邮箱池' },
        { value: 'emails', label: '获取邮箱列表' },
    ];

    return (
        <div>
            <PageHeader
                title="API 调用日志"
                subtitle="记录所有通过 API Key 的外部调用"
                extra={
                    <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
                        刷新
                    </Button>
                }
            />

            <Card bordered={false}>
                <Space style={{ marginBottom: 16 }}>
                    <Select
                        placeholder="筛选操作类型"
                        style={{ width: 160 }}
                        allowClear
                        options={actionOptions}
                        onChange={(val) => setActionFilter(val)}
                    />
                    <Text type="secondary">
                        提示：只有通过 API Key 调用的接口才会记录日志
                    </Text>
                </Space>

                <Table
                    dataSource={logs}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (t) => `共 ${t} 条`,
                        onChange: (p, ps) => {
                            setPage(p);
                            setPageSize(ps);
                        },
                    }}
                    locale={{ emptyText: '暂无 API 调用日志' }}
                />
            </Card>
        </div>
    );
};

export default OperationLogsPage;
