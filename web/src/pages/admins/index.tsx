import React, { useEffect, useState } from 'react';
import {
    Table,
    Button,
    Space,
    Modal,
    Form,
    Input,
    Select,
    message,
    Popconfirm,
    Tag,
    Typography,
    Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { adminApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import dayjs from 'dayjs';

const { Title } = Typography;

interface Admin {
    id: number;
    username: string;
    email: string | null;
    role: 'super_admin' | 'admin';
    status: 'active' | 'disabled';
    last_login_at: string | null;
    last_login_ip: string | null;
    created_at: string;
}

const AdminsPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<Admin[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form] = Form.useForm();
    const { admin: currentAdmin } = useAuthStore();

    useEffect(() => {
        fetchData();
    }, [page, pageSize]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res: any = await adminApi.getList({ page, pageSize });
            if (res.code === 200) {
                setData(res.data.list);
                setTotal(res.data.total);
            }
        } catch (err) {
            message.error('获取数据失败');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingId(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (record: Admin) => {
        setEditingId(record.id);
        form.setFieldsValue({
            username: record.username,
            email: record.email,
            role: record.role,
            status: record.status,
            password: '',
        });
        setModalVisible(true);
    };

    const handleDelete = async (id: number) => {
        try {
            const res: any = await adminApi.delete(id);
            if (res.code === 200) {
                message.success('删除成功');
                fetchData();
            } else {
                message.error(res.message);
            }
        } catch (err: any) {
            message.error(err.message || '删除失败');
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (editingId) {
                // 如果密码为空，不更新密码
                if (!values.password) {
                    delete values.password;
                }
                const res: any = await adminApi.update(editingId, values);
                if (res.code === 200) {
                    message.success('更新成功');
                    setModalVisible(false);
                    fetchData();
                } else {
                    message.error(res.message);
                }
            } else {
                const res: any = await adminApi.create(values);
                if (res.code === 200) {
                    message.success('创建成功');
                    setModalVisible(false);
                    fetchData();
                } else {
                    message.error(res.message);
                }
            }
        } catch (err: any) {
            if (err.message) {
                message.error(err.message);
            }
        }
    };

    const columns: ColumnsType<Admin> = [
        {
            title: '用户名',
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: '邮箱',
            dataIndex: 'email',
            key: 'email',
            render: (val) => val || '-',
        },
        {
            title: '角色',
            dataIndex: 'role',
            key: 'role',
            render: (role) => (
                <Tag color={role === 'super_admin' ? 'gold' : 'blue'}>
                    {role === 'super_admin' ? '超级管理员' : '管理员'}
                </Tag>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={status === 'active' ? 'green' : 'red'}>
                    {status === 'active' ? '启用' : '禁用'}
                </Tag>
            ),
        },
        {
            title: '最后登录',
            dataIndex: 'last_login_at',
            key: 'last_login_at',
            render: (val, record) =>
                val ? (
                    <Tooltip title={`IP: ${record.last_login_ip || '未知'}`}>
                        {dayjs(val).format('YYYY-MM-DD HH:mm')}
                    </Tooltip>
                ) : (
                    '-'
                ),
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm'),
        },
        {
            title: '操作',
            key: 'action',
            width: 120,
            render: (_, record) => (
                <Space>
                    <Tooltip title="编辑">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    {record.id !== currentAdmin?.id && (
                        <Tooltip title="删除">
                            <Popconfirm
                                title="确定要删除此管理员吗？"
                                onConfirm={() => handleDelete(record.id)}
                            >
                                <Button type="text" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Title level={4} style={{ margin: 0 }}>
                    管理员管理
                </Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    添加管理员
                </Button>
            </div>

            <Table
                columns={columns}
                dataSource={data}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                    onChange: (p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                    },
                }}
            />

            <Modal
                title={editingId ? '编辑管理员' : '添加管理员'}
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => setModalVisible(false)}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="username"
                        label="用户名"
                        rules={[
                            { required: true, message: '请输入用户名' },
                            { min: 3, message: '用户名至少 3 个字符' },
                        ]}
                    >
                        <Input placeholder="请输入用户名" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        label="密码"
                        rules={
                            editingId
                                ? []
                                : [
                                    { required: true, message: '请输入密码' },
                                    { min: 6, message: '密码至少 6 个字符' },
                                ]
                        }
                    >
                        <Input.Password
                            placeholder={editingId ? '留空则不修改密码' : '请输入密码'}
                        />
                    </Form.Item>
                    <Form.Item name="email" label="邮箱">
                        <Input placeholder="可选" type="email" />
                    </Form.Item>
                    <Form.Item name="role" label="角色" initialValue="admin">
                        <Select>
                            <Select.Option value="admin">管理员</Select.Option>
                            <Select.Option value="super_admin">超级管理员</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="status" label="状态" initialValue="active">
                        <Select>
                            <Select.Option value="active">启用</Select.Option>
                            <Select.Option value="disabled">禁用</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AdminsPage;
