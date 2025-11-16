import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, DatePicker, Select, Button, Space, Progress } from 'antd';
import { 
  VideoCameraOutlined, 
  CloudDownloadOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  EyeOutlined,
  LikeOutlined,
  CommentOutlined,
  ShareAltOutlined
} from '@ant-design/icons';
import { Line, Pie, Bar } from '@ant-design/charts';
import { analyticsService } from '../services/analyticsService';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface StatsData {
  totalVideos: number;
  totalDownloads: number;
  totalPublishes: number;
  successRate: number;
  platformStats: Array<{
    platform: string;
    videos: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }>;
  dailyStats: Array<{
    date: string;
    downloads: number;
    processes: number;
    publishes: number;
  }>;
  recentTasks: Array<{
    id: string;
    title: string;
    platform: string;
    status: string;
    createdAt: string;
  }>;
}

export const AnalyticsDashboard: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<string[]>([]);
  const [platform, setPlatform] = useState<string>('all');

  useEffect(() => {
    fetchStats();
  }, [dateRange, platform]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await analyticsService.getStats({
        dateRange,
        platform: platform === 'all' ? undefined : platform,
      });
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const lineConfig = {
    data: stats?.dailyStats || [],
    xField: 'date',
    yField: 'value',
    seriesField: 'type',
    xAxis: {
      type: 'time',
    },
    yAxis: {
      value: {
        nice: true,
      },
    },
    smooth: true,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
  };

  const pieConfig = {
    data: stats?.platformStats.map(item => ({
      platform: item.platform,
      value: item.videos,
    })) || [],
    angleField: 'value',
    colorField: 'platform',
    radius: 0.8,
    label: {
      type: 'outer',
      content: '{name}: {percentage}',
    },
    interactions: [
      {
        type: 'element-active',
      },
    ],
  };

  const barConfig = {
    data: stats?.platformStats.map(item => ({
      platform: item.platform,
      views: item.views,
      likes: item.likes,
      comments: item.comments,
      shares: item.shares,
    })) || [],
    xField: 'platform',
    yField: 'value',
    seriesField: 'type',
    isGroup: true,
    columnStyle: {
      radius: [2, 2, 0, 0],
    },
  };

  const columns = [
    {
      title: '任务标题',
      dataIndex: 'title',
      key: 'title',
      width: '40%',
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: '20%',
      render: (platform: string) => {
        const platformNames: Record<string, string> = {
          douyin: '抖音',
          kuaishou: '快手',
          xiaohongshu: '小红书',
          bilibili: '哔哩哔哩',
          wechat: '微信视频号',
        };
        return platformNames[platform] || platform;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: '20%',
      render: (status: string) => {
        const statusColors: Record<string, string> = {
          pending: 'orange',
          processing: 'blue',
          completed: 'green',
          failed: 'red',
        };
        const statusLabels: Record<string, string> = {
          pending: '待处理',
          processing: '处理中',
          completed: '已完成',
          failed: '失败',
        };
        return (
          <span style={{ color: statusColors[status] }}>
            {statusLabels[status]}
          </span>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: '20%',
      render: (time: string) => new Date(time).toLocaleString(),
    },
  ];

  return (
    <div className="analytics-dashboard">
      <Space className="mb-6" size="large">
        <RangePicker
          onChange={(dates) => {
            if (dates) {
              setDateRange(dates.map(date => date.format('YYYY-MM-DD')));
            } else {
              setDateRange([]);
            }
          }}
        />
        <Select
          value={platform}
          onChange={setPlatform}
          style={{ width: 120 }}
        >
          <Option value="all">全部平台</Option>
          <Option value="douyin">抖音</Option>
          <Option value="kuaishou">快手</Option>
          <Option value="xiaohongshu">小红书</Option>
          <Option value="bilibili">哔哩哔哩</Option>
          <Option value="wechat">微信视频号</Option>
        </Select>
        <Button type="primary" onClick={fetchStats} loading={loading}>
          刷新数据
        </Button>
      </Space>

      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="总视频数"
              value={stats?.totalVideos || 0}
              prefix={<VideoCameraOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总下载数"
              value={stats?.totalDownloads || 0}
              prefix={<CloudDownloadOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总发布数"
              value={stats?.totalPublishes || 0}
              prefix={<CheckCircleOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功率"
              value={stats?.successRate || 0}
              precision={2}
              suffix="%"
              prefix={stats && stats.successRate >= 80 ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              loading={loading}
            />
            <Progress 
              percent={stats?.successRate || 0} 
              strokeColor={stats && stats.successRate >= 80 ? '#52c41a' : '#ff4d4f'}
              showInfo={false}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} className="mb-6">
        <Col span={12}>
          <Card title="每日趋势" loading={loading}>
            <Line 
              {...lineConfig} 
              data={stats?.dailyStats.map(item => ([
                { date: item.date, value: item.downloads, type: '下载' },
                { date: item.date, value: item.processes, type: '处理' },
                { date: item.date, value: item.publishes, type: '发布' },
              ])).flat() || []}
              height={300}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="平台分布" loading={loading}>
            <Pie {...pieConfig} height={300} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} className="mb-6">
        <Col span={24}>
          <Card title="平台数据对比" loading={loading}>
            <Bar 
              {...barConfig} 
              data={stats?.platformStats.map(item => ([
                { platform: item.platform, value: item.views, type: '播放量' },
                { platform: item.platform, value: item.likes, type: '点赞' },
                { platform: item.platform, value: item.comments, type: '评论' },
                { platform: item.platform, value: item.shares, type: '分享' },
              ])).flat() || []}
              height={300}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Card title="最近任务" loading={loading}>
            <Table
              columns={columns}
              dataSource={stats?.recentTasks || []}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AnalyticsDashboard;