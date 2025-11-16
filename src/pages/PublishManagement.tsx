import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Modal, Form, Select, Input, DatePicker, Space, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import { publishService } from '../services/publishService';

const { TextArea } = Input;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface PublishTask {
  id: string;
  title: string;
  videoUrl: string;
  platforms: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledTime?: string;
  publishedTime?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const platformOptions = [
  { value: 'douyin', label: '抖音', color: 'black' },
  { value: 'kuaishou', label: '快手', color: 'orange' },
  { value: 'xiaohongshu', label: '小红书', color: 'red' },
  { value: 'bilibili', label: '哔哩哔哩', color: 'blue' },
  { value: 'wechat', label: '微信视频号', color: 'green' },
];

const statusColors = {
  pending: 'orange',
  processing: 'blue',
  completed: 'green',
  failed: 'red',
};

const statusLabels = {
  pending: '待发布',
  processing: '发布中',
  completed: '已发布',
  failed: '发布失败',
};

export const PublishManagement: React.FC = () => {
  const [tasks, setTasks] = useState<PublishTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<PublishTask | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await publishService.getPublishTasks();
      setTasks(data);
    } catch (error) {
      message.error('获取发布任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTask(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (task: PublishTask) => {
    setEditingTask(task);
    form.setFieldsValue({
      ...task,
      scheduledTime: task.scheduledTime ? new Date(task.scheduledTime) : undefined,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      onOk: async () => {
        try {
          await publishService.deletePublishTask(id);
          message.success('删除成功');
          fetchTasks();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handlePublishNow = async (task: PublishTask) => {
    Modal.confirm({
      title: '立即发布',
      content: `确认立即发布 "${task.title}" 到选定的平台？`,
      onOk: async () => {
        try {
          await publishService.publishNow(task.id);
          message.success('发布任务已启动');
          fetchTasks();
        } catch (error) {
          message.error('发布失败');
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const taskData = {
        ...values,
        scheduledTime: values.scheduledTime ? values.scheduledTime.toISOString() : undefined,
      };

      if (editingTask) {
        await publishService.updatePublishTask(editingTask.id, taskData);
        message.success('更新成功');
      } else {
        await publishService.createPublishTask(taskData);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchTasks();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: '25%',
    },
    {
      title: '发布平台',
      dataIndex: 'platforms',
      key: 'platforms',
      width: '20%',
      render: (platforms: string[]) => (
        <Space size="small">
          {platforms.map(platform => {
            const option = platformOptions.find(opt => opt.value === platform);
            return (
              <Tag key={platform} color={option?.color}>
                {option?.label}
              </Tag>
            );
          })}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: '12%',
      render: (status: string) => (
        <Tag color={statusColors[status as keyof typeof statusColors]}>
          {statusLabels[status as keyof typeof statusLabels]}
        </Tag>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'scheduledTime',
      key: 'scheduledTime',
      width: '15%',
      render: (time: string, record: PublishTask) => {
        const displayTime = record.publishedTime || time;
        return displayTime ? new Date(displayTime).toLocaleString() : '立即发布';
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: '15%',
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: '13%',
      render: (_: any, record: PublishTask) => (
        <Space size="small">
          {record.status === 'pending' && (
            <Button
              type="link"
              icon={<SendOutlined />}
              onClick={() => handlePublishNow(record)}
            >
              立即发布
            </Button>
          )}
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
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">发布管理</h1>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            创建发布任务
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={tasks}
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
        title={editingTask ? '编辑发布任务' : '创建发布任务'}
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ status: 'pending' }}
        >
          <Form.Item
            name="title"
            label="任务标题"
            rules={[{ required: true, message: '请输入任务标题' }]}
          >
            <Input placeholder="输入发布任务标题" />
          </Form.Item>

          <Form.Item
            name="videoUrl"
            label="视频文件"
            rules={[{ required: true, message: '请选择视频文件' }]}
          >
            <Input placeholder="输入视频文件路径或URL" />
          </Form.Item>

          <Form.Item
            name="platforms"
            label="发布平台"
            rules={[{ required: true, message: '请选择发布平台' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择要发布的平台"
            >
              {platformOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="scheduledTime"
            label="定时发布"
          >
            <DatePicker
              showTime
              placeholder="选择发布时间（留空为立即发布）"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="发布描述"
          >
            <TextArea
              rows={3}
              placeholder="输入发布描述（可选）"
            />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
          >
            <Select
              mode="tags"
              placeholder="添加标签"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PublishManagement;