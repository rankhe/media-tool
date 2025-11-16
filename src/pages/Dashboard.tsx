import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Progress, Table, Tag, Select, DatePicker } from 'antd';
import { Line, Bar, Pie } from '@ant-design/charts';
import { 
  Video, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Users,
  Search,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { statsAPI, taskAPI } from '../services/api';
import { useAuth } from '../store';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  totalVideos: number;
  totalPublishes: number;
  successRate: number;
  successfulPublishes: number;
}

interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  success_rate: number;
  daily_stats?: Record<string, {
    total: number;
    completed: number;
    failed: number;
  }>;
}

interface PlatformStats {
  platform_stats: Record<string, {
    total_publishes: number;
    successful_publishes: number;
    failed_publishes: number;
    success_rate: number;
  }>;
  account_stats: Record<string, {
    total_accounts: number;
    active_accounts: number;
    inactive_accounts: number;
  }>;
  total_platforms: number;
  total_accounts: number;
}

interface RecentTask {
  id: string;
  task_type: string;
  status: string;
  progress: number;
  created_at: string;
  error_message?: string;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    try {
      const [statsResponse, tasksResponse, taskStatsResponse, platformStatsResponse] = await Promise.all([
        statsAPI.getDashboardStats(),
        taskAPI.getTasks({ limit: 10 }),
        statsAPI.getTaskStats(timeRange),
        statsAPI.getPlatformStats()
      ]);

      if (statsResponse.success) {
        setStats(statsResponse.data);
      }

      if (tasksResponse.success) {
        setRecentTasks(tasksResponse.data.tasks || []);
      }

      if (taskStatsResponse.success) {
        setTaskStats(taskStatsResponse.data.task_stats);
      }

      if (platformStatsResponse.success) {
        setPlatformStats(platformStatsResponse.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'running':
        return 'blue';
      case 'failed':
        return 'red';
      case 'pending':
        return 'orange';
      default:
        return 'default';
    }
  };

  const getTaskTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      download: '下载任务',
      process: '处理任务',
      publish: '发布任务',
      batch: '批量任务'
    };
    return typeMap[type] || type;
  };

  const getPlatformName = (platform: string) => {
    const platformMap: Record<string, string> = {
      douyin: '抖音',
      kuaishou: '快手',
      xiaohongshu: '小红书',
      bilibili: '哔哩哔哩',
      wechat: '微信'
    };
    return platformMap[platform] || platform;
  };

  const getTaskChartData = () => {
    if (!taskStats) return [];
    return [
      { type: '待处理', value: taskStats.pending, color: '#faad14' },
      { type: '进行中', value: taskStats.running, color: '#1890ff' },
      { type: '已完成', value: taskStats.completed, color: '#52c41a' },
      { type: '失败', value: taskStats.failed, color: '#f5222d' },
      { type: '已取消', value: taskStats.cancelled, color: '#722ed1' }
    ];
  };

  const getPlatformChartData = () => {
    if (!platformStats) return [];
    return Object.entries(platformStats.platform_stats).map(([platform, stats]) => ({
      platform: getPlatformName(platform),
      success_rate: stats.success_rate,
      total_publishes: stats.total_publishes
    }));
  };

  const getDailyChartData = () => {
    if (!taskStats || !taskStats.daily_stats) return [];
    return Object.entries(taskStats.daily_stats).map(([date, stats]: [string, any]) => ({
      date: dayjs(date).format('MM-DD'),
      total: stats.total,
      completed: stats.completed,
      failed: stats.failed
    }));
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'running':
        return '进行中';
      case 'failed':
        return '失败';
      case 'pending':
        return '待处理';
      default:
        return status;
    }
  };

  const columns = [
    {
      title: '任务类型',
      dataIndex: 'task_type',
      key: 'task_type',
      render: (text: string) => getTaskTypeText(text)
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => (
        <Tag color={getStatusColor(text)}>{getStatusText(text)}</Tag>
      )
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => (
        <Progress percent={progress} size="small" />
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString()
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          欢迎回来，{user?.name}！
        </h1>
        <div className="text-sm text-gray-500">
          今日剩余任务额度：{Math.max(0, (user?.max_daily_tasks || 10) - (user?.usage_count || 0))}
        </div>
      </div>

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总任务数"
              value={stats?.totalTasks || 0}
              prefix={<Video className="w-4 h-4" />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成任务"
              value={stats?.completedTasks || 0}
              prefix={<CheckCircle className="w-4 h-4 text-green-500" />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总视频数"
              value={stats?.totalVideos || 0}
              prefix={<TrendingUp className="w-4 h-4 text-blue-500" />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="发布成功率"
              value={stats?.successRate || 0}
              precision={1}
              suffix="%"
              prefix={<TrendingUp className="w-4 h-4 text-purple-500" />}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* 时间范围选择器 */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">数据分析</h2>
          <div className="flex items-center space-x-4">
            <Select
              value={timeRange}
              onChange={setTimeRange}
              style={{ width: 120 }}
              options={[
                { label: '今日', value: 'day' },
                { label: '本周', value: 'week' },
                { label: '本月', value: 'month' },
                { label: '本年', value: 'year' }
              ]}
            />
            <Select
              value={chartType}
              onChange={setChartType}
              style={{ width: 100 }}
              options={[
                { label: '折线图', value: 'line' },
                { label: '柱状图', value: 'bar' }
              ]}
            />
          </div>
        </div>

        <Row gutter={16}>
          <Col span={8}>
            <Card title="任务状态分布" size="small">
              {taskStats && (
                <Pie
                  data={getTaskChartData()}
                  angleField="value"
                  colorField="type"
                  color={({ type }: any) => {
                    const colors = {
                      '待处理': '#faad14',
                      '进行中': '#1890ff',
                      '已完成': '#52c41a',
                      '失败': '#f5222d',
                      '已取消': '#722ed1'
                    };
                    return colors[type as keyof typeof colors] || '#8c8c8c';
                  }}
                  radius={0.8}
                  label={{
                    type: 'outer',
                    content: '{name}: {percentage}'
                  }}
                  height={200}
                />
              )}
            </Card>
          </Col>
          <Col span={16}>
            <Card title="每日任务趋势" size="small">
              {chartType === 'line' ? (
                <Line
                  data={getDailyChartData()}
                  xField="date"
                  yField="total"
                  seriesField="type"
                  yAxis={{ min: 0 }}
                  height={200}
                  legend={{ position: 'top-right' }}
                  smooth
                />
              ) : (
                <Bar
                  data={getDailyChartData()}
                  xField="date"
                  yField="total"
                  seriesField="type"
                  yAxis={{ min: 0 }}
                  height={200}
                  legend={{ position: 'top-right' }}
                />
              )}
            </Card>
          </Col>
        </Row>

        {platformStats && platformStats.total_platforms > 0 && (
          <Row gutter={16} className="mt-4">
            <Col span={24}>
              <Card title="平台发布成功率" size="small">
                <Bar
                  data={getPlatformChartData()}
                  xField="platform"
                  yField="success_rate"
                  color="#52c41a"
                  height={200}
                  yAxis={{ min: 0, max: 100, tickCount: 6 }}
                  label={{
                    position: 'top',
                    content: '{value}%'
                  }}
                />
              </Card>
            </Col>
          </Row>
        )}
      </Card>

      <Card title="最近任务" loading={loading}>
        <Table
          columns={columns}
          dataSource={recentTasks}
          rowKey="id"
          pagination={false}
          locale={{
            emptyText: '暂无任务记录'
          }}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="快速操作" className="h-full">
          <div className="space-y-4">
            <button 
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
              onClick={() => navigate('/discover')}
            >
              <Search className="w-4 h-4 mr-2" />
              发现热门视频
            </button>
            <button 
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
              onClick={() => navigate('/tasks')}
            >
              <Video className="w-4 h-4 mr-2" />
              创建搬运任务
            </button>
            <button 
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center"
              onClick={() => navigate('/accounts')}
            >
              <Users className="w-4 h-4 mr-2" />
              管理账号
            </button>
          </div>
        </Card>

        <Card title="系统状态">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">系统状态</span>
              <Tag color="green">正常运行</Tag>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">队列状态</span>
              <Tag color="blue">空闲</Tag>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">存储空间</span>
              <span className="text-sm text-gray-500">2.5GB / 10GB</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};