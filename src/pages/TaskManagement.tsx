import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Progress, Space, Modal, Form, Input, Select, message, Row, Col, Card } from 'antd';
import { ReloadOutlined, PauseCircleOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { taskAPI } from '../services/api';
import { Task } from '../store';
import { formatDate } from '../utils/date';
import CreateTaskModal from '../components/CreateTaskModal';
import TaskProgressTracker from '../components/TaskProgressTracker';

const { Option } = Select;
const { Search } = Input;

const TaskManagement: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    status: 'all',
    taskType: 'all',
    search: ''
  });
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // 获取任务列表
  const fetchTasks = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await taskAPI.getTasks({
        page,
        limit: pageSize,
        status: filters.status === 'all' ? undefined : filters.status
      });

      if (response.success) {
        setTasks(response.data.tasks);
        setPagination({
          current: response.data.pagination.page,
          pageSize: response.data.pagination.limit,
          total: response.data.pagination.total
        });
      }
    } catch (error) {
      message.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks(pagination.current, pagination.pageSize);
  }, [filters]);

  // 刷新任务列表
  const handleRefresh = () => {
    fetchTasks(pagination.current, pagination.pageSize);
  };

  // 取消任务
  const handleCancelTask = async (taskId: string) => {
    try {
      const response = await taskAPI.cancelTask(taskId);
      if (response.success) {
        message.success('任务已取消');
        handleRefresh();
      }
    } catch (error) {
      message.error('取消任务失败');
    }
  };

  // 删除任务
  const handleDeleteTask = async (taskId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个任务吗？此操作不可恢复。',
      onOk: async () => {
        try {
          const response = await taskAPI.deleteTask(taskId);
          if (response.success) {
            message.success('任务已删除');
            handleRefresh();
          }
        } catch (error) {
          message.error('删除任务失败');
        }
      }
    });
  };

  // 查看任务详情
  const handleViewDetails = (task: Task) => {
    setSelectedTask(task);
    setDetailModalVisible(true);
  };

  // 分页变化
  const handleTableChange = (newPagination: any) => {
    fetchTasks(newPagination.current, newPagination.pageSize);
  };

  // 筛选条件变化
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // 获取状态标签颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'running': return 'processing';
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'cancelled': return 'warning';
      default: return 'default';
    }
  };

  // 获取任务类型标签
  const getTaskTypeLabel = (taskType: string) => {
    switch (taskType) {
      case 'download': return '下载';
      case 'process': return '处理';
      case 'publish': return '发布';
      case 'batch': return '批量';
      default: return taskType;
    }
  };

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <span className="font-mono text-xs">{id.slice(0, 8)}...</span>
    },
    {
      title: '任务类型',
      dataIndex: 'task_type',
      key: 'task_type',
      width: 100,
      render: (taskType: string) => (
        <Tag color="blue">{getTaskTypeLabel(taskType)}</Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string, record: Task) => (
        <div>
          <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>
          {status === 'running' && record.progress !== undefined && (
            <div className="mt-1">
              <Progress 
                percent={Math.round(record.progress * 100)} 
                size="small" 
                status="active"
              />
            </div>
          )}
        </div>
      )
    },
    {
      title: '源配置',
      dataIndex: 'source_config',
      key: 'source_config',
      width: 200,
      render: (sourceConfig: any) => (
        <div className="text-xs">
          {sourceConfig?.platform && (
            <div>平台: {sourceConfig.platform}</div>
          )}
          {sourceConfig?.videoId && (
            <div>视频ID: {sourceConfig.videoId}</div>
          )}
          {sourceConfig?.quality && (
            <div>质量: {sourceConfig.quality}</div>
          )}
        </div>
      )
    },
    {
      title: '目标配置',
      dataIndex: 'target_config',
      key: 'target_config',
      width: 150,
      render: (targetConfig: any) => (
        <div className="text-xs">
          {targetConfig?.outputPath && (
            <div>路径: {targetConfig.outputPath}</div>
          )}
          {targetConfig?.renamePattern && (
            <div>重命名: {targetConfig.renamePattern}</div>
          )}
        </div>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => formatDate(date)
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Task) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          >
            详情
          </Button>
          {(record.status === 'pending' || record.status === 'running') && (
            <Button
              type="link"
              size="small"
              danger
              icon={<PauseCircleOutlined />}
              onClick={() => handleCancelTask(record.id)}
            >
              取消
            </Button>
          )}
          {(record.status === 'completed' || record.status === 'failed' || record.status === 'cancelled') && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteTask(record.id)}
            >
              删除
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="p-6">
      <Card>
        <Row gutter={[16, 16]} className="mb-6">
          <Col span={24}>
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold">任务管理</h1>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建任务
              </Button>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Search
              placeholder="搜索任务ID或配置"
              allowClear
              onSearch={(value) => handleFilterChange('search', value)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="任务类型"
              style={{ width: '100%' }}
              value={filters.taskType}
              onChange={(value) => handleFilterChange('taskType', value)}
            >
              <Option value="all">全部类型</Option>
              <Option value="download">下载</Option>
              <Option value="process">处理</Option>
              <Option value="publish">发布</Option>
              <Option value="batch">批量</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="任务状态"
              style={{ width: '100%' }}
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
            >
              <Option value="all">全部状态</Option>
              <Option value="pending">等待中</Option>
              <Option value="running">运行中</Option>
              <Option value="completed">已完成</Option>
              <Option value="failed">已失败</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
              style={{ width: '100%' }}
            >
              刷新
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>

      <CreateTaskModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          handleRefresh();
        }}
      />

      {selectedTask && (
        <Modal
          title="任务详情"
          visible={detailModalVisible}
          onCancel={() => setDetailModalVisible(false)}
          footer={null}
          width={800}
        >
          <TaskProgressTracker
            task={selectedTask}
            onRefresh={handleRefresh}
            autoRefresh={selectedTask.status === 'running' || selectedTask.status === 'pending'}
          />
        </Modal>
      )}
    </div>
  );
};

export default TaskManagement;