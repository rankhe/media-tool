import React, { useState, useEffect } from 'react';
import { Card, Progress, Tag, Timeline, Button, Space, Typography } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { taskAPI } from '../services/api';
import { Task } from '../store';
import { formatDate, formatRelativeTime } from '../utils/date';

const { Text, Title } = Typography;

interface TaskProgressTrackerProps {
  task: Task;
  onRefresh?: () => void;
  autoRefresh?: boolean;
}

const TaskProgressTracker: React.FC<TaskProgressTrackerProps> = ({
  task,
  onRefresh,
  autoRefresh = true
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 模拟日志生成（实际应该从后端获取）
  const generateMockLogs = (task: Task) => {
    const mockLogs: string[] = [];
    
    mockLogs.push(`[${formatDate(task.created_at)}] 任务创建成功`);
    
    if (task.status !== 'pending') {
      mockLogs.push(`[${formatDate(task.started_at || task.created_at)}] 开始执行任务`);
    }
    
    if (task.status === 'running' && task.progress !== undefined) {
      const progressPercent = Math.round(task.progress * 100);
      if (progressPercent < 30) {
        mockLogs.push(`[${formatDate(new Date().toISOString())}] 正在解析视频信息...`);
      } else if (progressPercent < 60) {
        mockLogs.push(`[${formatDate(new Date().toISOString())}] 正在下载视频数据...`);
      } else if (progressPercent < 90) {
        mockLogs.push(`[${formatDate(new Date().toISOString())}] 正在处理视频文件...`);
      } else {
        mockLogs.push(`[${formatDate(new Date().toISOString())}] 即将完成任务...`);
      }
    }
    
    if (task.status === 'completed') {
      mockLogs.push(`[${formatDate(task.completed_at || new Date().toISOString())}] 任务执行完成`);
    }
    
    if (task.status === 'failed' && task.error_message) {
      mockLogs.push(`[${formatDate(new Date().toISOString())}] 任务执行失败: ${task.error_message}`);
    }
    
    if (task.status === 'cancelled') {
      mockLogs.push(`[${formatDate(new Date().toISOString())}] 任务已被取消`);
    }
    
    return mockLogs;
  };

  useEffect(() => {
    setLogs(generateMockLogs(task));
  }, [task]);

  // 自动刷新任务详情
  useEffect(() => {
    if (!autoRefresh || task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await taskAPI.getTask(task.id);
        if (response.success && onRefresh) {
          // 触发父组件刷新
          onRefresh();
        }
      } catch (error) {
        console.error('Failed to refresh task:', error);
      }
    }, 3000); // 每3秒刷新一次

    return () => clearInterval(interval);
  }, [task.id, task.status, autoRefresh, onRefresh]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'running':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
      case 'cancelled':
        return <CloseCircleOutlined style={{ color: '#faad14' }} />;
      default:
        return <ClockCircleOutlined />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'running': return 'processing';
      case 'pending': return 'default';
      case 'cancelled': return 'warning';
      default: return 'default';
    }
  };

  const getProgressStatus = () => {
    if (task.status === 'completed') return 'success';
    if (task.status === 'failed') return 'exception';
    if (task.status === 'cancelled') return 'exception';
    return 'active';
  };

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>任务进度跟踪</span>
          <Button
            icon={<ReloadOutlined />}
            loading={isRefreshing}
            onClick={handleManualRefresh}
            size="small"
          >
            刷新
          </Button>
        </div>
      }
      style={{ marginBottom: 16 }}
    >
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            {getStatusIcon(task.status)}
            <Text strong>状态: </Text>
            <Tag color={getStatusColor(task.status)}>{task.status.toUpperCase()}</Tag>
          </Space>
          <Text type="secondary">
            创建于: {formatRelativeTime(task.created_at)}
          </Text>
        </div>

        {task.status === 'running' && task.progress !== undefined && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text>下载进度</Text>
              <Text>{Math.round(task.progress * 100)}%</Text>
            </div>
            <Progress
              percent={task.progress * 100}
              status={getProgressStatus()}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </div>
        )}

        {task.status === 'completed' && (
          <div style={{ marginBottom: 16 }}>
            <Progress
              percent={100}
              status="success"
              strokeColor="#52c41a"
            />
          </div>
        )}

        {task.status === 'failed' && (
          <div style={{ marginBottom: 16 }}>
            <Progress
              percent={task.progress ? task.progress * 100 : 0}
              status="exception"
            />
            {task.error_message && (
              <div style={{ marginTop: 8 }}>
                <Text type="danger">
                  <strong>错误信息:</strong> {task.error_message}
                </Text>
              </div>
            )}
          </div>
        )}

        {task.status === 'cancelled' && (
          <div style={{ marginBottom: 16 }}>
            <Progress
              percent={task.progress ? task.progress * 100 : 0}
              status="exception"
              strokeColor="#faad14"
            />
          </div>
        )}
      </div>

      <div>
        <Title level={5} style={{ marginBottom: 16 }}>执行日志</Title>
        <Timeline>
          {logs.map((log, index) => (
            <Timeline.Item key={index}>
              <Text style={{ fontSize: 12 }}>{log}</Text>
            </Timeline.Item>
          ))}
        </Timeline>
        
        {task.status === 'running' && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Text type="secondary">任务正在执行中，日志会自动更新...</Text>
          </div>
        )}
      </div>

      {task.status === 'completed' && task.completed_at && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f6ffed', borderRadius: 6 }}>
          <Text type="success">
            <CheckCircleOutlined /> 任务已完成，总耗时: {Math.round((new Date(task.completed_at).getTime() - new Date(task.created_at).getTime()) / 1000)}秒
          </Text>
        </div>
      )}
    </Card>
  );
};

export default TaskProgressTracker;