import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Modal, Form, Input, Select, Switch, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import { accountService } from '../services/accountService';

const { Option } = Select;

interface Account {
  id: string;
  platform: string;
  username: string;
  nickname: string;
  status: 'active' | 'inactive' | 'expired';
  lastLogin?: string;
  cookies?: string;
  settings?: Record<string, any>;
}

const platformOptions = [
  { value: 'douyin', label: '抖音' },
  { value: 'kuaishou', label: '快手' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'bilibili', label: '哔哩哔哩' },
  { value: 'wechat', label: '微信视频号' },
];

const statusColors = {
  active: 'green',
  inactive: 'orange',
  expired: 'red',
};

const statusLabels = {
  active: '正常',
  inactive: '未激活',
  expired: '已过期',
};

export const AccountManagement: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await accountService.getAccounts();
      console.log('Fetched accounts:', data); // 调试日志
      setAccounts(data);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      message.error('获取账号列表失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingAccount(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    // 将数据库字段映射到表单字段
    const formData = {
      platform: account.platform,
      username: account.username,
      nickname: account.nickname || account.username, // 如果数据库没有nickname，用username
      cookies: account.cookies || '', // cookies字段可能不存在
      status: account.status || (account as any).is_active ? 'active' : 'inactive' // 处理is_active字段
    };
    console.log('Setting form values for edit:', formData); // 调试日志
    form.setFieldsValue(formData);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      onOk: async () => {
        try {
          console.log('Deleting account:', id); // 调试日志
          await accountService.deleteAccount(id);
          message.success('删除成功');
          // 延迟一下再刷新列表，确保服务器数据已更新
          setTimeout(() => {
            fetchAccounts();
          }, 300);
        } catch (error) {
          console.error('Failed to delete account:', error);
          message.error('删除失败：' + (error instanceof Error ? error.message : '未知错误'));
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      console.log('Form values:', values); // 调试日志
      
      if (editingAccount) {
        console.log('Updating account:', editingAccount.id, values); // 调试日志
        const updatedAccount = await accountService.updateAccount(editingAccount.id, values);
        console.log('Updated account result:', updatedAccount); // 调试日志
        message.success('更新成功');
      } else {
        console.log('Creating account:', values); // 调试日志
        const newAccount = await accountService.createAccount(values);
        console.log('Created account result:', newAccount); // 调试日志
        message.success('创建成功');
      }
      
      setModalVisible(false);
      // 延迟一下再刷新列表，确保服务器数据已更新
      setTimeout(() => {
        fetchAccounts();
      }, 500);
    } catch (error) {
      console.error('Account operation failed:', error);
      message.error('操作失败：' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  const handleStatusToggle = async (account: Account) => {
    try {
      const newStatus = account.status === 'active' ? 'inactive' : 'active';
      console.log('Toggling account status:', account.id, newStatus); // 调试日志
      await accountService.updateAccount(account.id, { status: newStatus });
      message.success('状态更新成功');
      // 延迟一下再刷新列表，确保服务器数据已更新
      setTimeout(() => {
        fetchAccounts();
      }, 300);
    } catch (error) {
      console.error('Failed to toggle account status:', error);
      message.error('状态更新失败：' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  const columns = [
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => {
        const option = platformOptions.find(opt => opt.value === platform);
        return option?.label || platform;
      },
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColors[status as keyof typeof statusColors]}>
          {statusLabels[status as keyof typeof statusLabels]}
        </Tag>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (date: string) => date ? new Date(date).toLocaleString() : '从未登录',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Account) => (
        <div className="space-x-2">
          <Button
            type="link"
            icon={<KeyOutlined />}
            onClick={() => handleStatusToggle(record)}
          >
            {record.status === 'active' ? '停用' : '启用'}
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">账号管理</h1>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加账号
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={accounts}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <Modal
        title={editingAccount ? '编辑账号' : '添加账号'}
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ status: 'active' }}
        >
          <Form.Item
            name="platform"
            label="平台"
            rules={[{ required: true, message: '请选择平台' }]}
          >
            <Select placeholder="选择平台">
              {platformOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="输入用户名" />
          </Form.Item>

          <Form.Item
            name="nickname"
            label="昵称"
            rules={[{ required: true, message: '请输入昵称' }]}
          >
            <Input placeholder="输入昵称" />
          </Form.Item>

          <Form.Item
            name="cookies"
            label="登录凭证 (Cookies)"
          >
            <Input.TextArea
              placeholder="粘贴登录后的cookies（可选）"
              rows={4}
            />
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            valuePropName="checked"
            getValueFromEvent={(checked) => checked ? 'active' : 'inactive'}
            getValueProps={(value) => ({ checked: value === 'active' })}
          >
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AccountManagement;