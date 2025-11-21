import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, message, Tabs, Statistic, Row, Col, Badge, Tooltip, Popconfirm, DatePicker, Checkbox, Drawer, Radio, Upload } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined, SyncOutlined, BellOutlined, UserOutlined, MessageOutlined, SettingOutlined, DashboardOutlined } from '@ant-design/icons';
import monitoringService, { MonitoringUser, MonitoredPost, WebhookConfig, MonitoringStats, SchedulerStatus } from '../services/monitoringService';

const { TabPane } = Tabs;
const { Option } = Select;

const SocialMonitoring: React.FC = () => {
  const [activeTab, setActiveTab] = useState('posts');
  const [monitoringUsers, setMonitoringUsers] = useState<MonitoringUser[]>([]);
  const [monitoredPosts, setMonitoredPosts] = useState<MonitoredPost[]>([]);
  const [webhookConfigs, setWebhookConfigs] = useState<WebhookConfig[]>([]);
  const [monitoringStats, setMonitoringStats] = useState<MonitoringStats[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [platforms, setPlatforms] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'user' | 'webhook' | 'platform'>('user');
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [fetchModalVisible, setFetchModalVisible] = useState(false);
  const [fetchingUserId, setFetchingUserId] = useState<number | null>(null);
  const [fetchingUsername, setFetchingUsername] = useState<string>('');
  const [form] = Form.useForm();
  const [zhihuModalVisible, setZhihuModalVisible] = useState(false);
  const [zhihuStatus, setZhihuStatus] = useState<{ cookie_string: boolean; cookies_json: boolean } | null>(null);
  const [zhihuCookieString, setZhihuCookieString] = useState('');
  const [zhihuFile, setZhihuFile] = useState<File | undefined>(undefined);
  const [postPageSize, setPostPageSize] = useState(20);
  const [postPage, setPostPage] = useState(1);
  const [filterPlatform, setFilterPlatform] = useState<string | undefined>(undefined);
  const [filterUserId, setFilterUserId] = useState<number | undefined>(undefined);
  const [filterIsNew, setFilterIsNew] = useState<boolean | undefined>(undefined);
  const [filterDateRange, setFilterDateRange] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentPost, setCurrentPost] = useState<MonitoredPost | null>(null);
  const [publishVisible, setPublishVisible] = useState(false);
  const [publishPost, setPublishPost] = useState<MonitoredPost | null>(null);
  const [publishType, setPublishType] = useState<'idea' | 'article'>('idea');
  const [publishTitle, setPublishTitle] = useState<string>('');

  // Fetch initial data
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [usersRes, webhooksRes, statsRes, platformsRes, schedulerRes, zhihuCfg] = await Promise.all([
        monitoringService.getMonitoringUsers(),
        monitoringService.getWebhookConfigs(),
        monitoringService.getMonitoringStats(),
        monitoringService.getPlatforms(),
        monitoringService.getSchedulerStatus(),
        monitoringService.getZhihuConfigStatus().catch(() => ({ data: { cookie_string: false, cookies_json: false } }))
      ]);

      setMonitoringUsers(usersRes.data);
      setWebhookConfigs(webhooksRes.data);
      setMonitoringStats(statsRes.data);
      setPlatforms(platformsRes.data);
      setSchedulerStatus(schedulerRes.data);
      setZhihuStatus(zhihuCfg.data);
      await loadPosts(1, postPageSize);
    } catch (error) {
      message.error('Failed to fetch monitoring data');
      console.error('Error fetching monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stripHtml = (html: string) => {
    if (!html) return '';
    const text = html
      .replace(/<br\s*\/>/gi, '\n')
      .replace(/<br\s*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    return text;
  };

  const handlePublishZhihu = (post: MonitoredPost) => {
    setPublishPost(post);
    setPublishType('idea');
    setPublishTitle('');
    setPublishVisible(true);
  };

  const doPublishZhihu = async () => {
    if (!publishPost) return;
    try {
      const contentText = stripHtml(publishPost.post_content || '');
      const parts: string[] = [];
      if (publishType === 'article' && publishTitle) {
        parts.push(`# ${publishTitle}`);
      }
      parts.push(contentText);
      if (publishPost.post_images && publishPost.post_images.length > 0) {
        parts.push('\n图片：');
        (publishPost.post_images as any[]).forEach((img) => parts.push(String(img)));
      }
      if (publishPost.post_videos && publishPost.post_videos.length > 0) {
        parts.push('\n视频：');
        (publishPost.post_videos as any[]).forEach((vid) => parts.push(String(vid)));
      }
      if (publishPost.post_url) {
        parts.push(`\n原帖链接：${publishPost.post_url}`);
      }
      const finalText = parts.join('\n');

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(finalText);
        message.success('内容已复制到剪贴板');
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = finalText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        message.success('内容已复制到剪贴板');
      }

      const url = publishType === 'idea' 
        ? 'https://www.zhihu.com/creator' 
        : 'https://zhuanlan.zhihu.com';
      window.open(url, '_blank');
      setPublishVisible(false);
    } catch (error) {
      message.error('发送到知乎失败');
    }
  };

  const doPublishZhihuAuto = async () => {
    if (!publishPost) return;
    try {
      const contentText = stripHtml(publishPost.post_content || '');
      const images = (publishPost.post_images as any[])?.map((i) => String(i)) || [];
      const res = await monitoringService.publishToZhihu({
        type: publishType,
        title: publishType === 'article' ? publishTitle : undefined,
        content: contentText,
        images,
        source_url: publishPost.post_url || undefined,
      });
      if (res.success) {
        message.success('已提交到后端自动发布，请前往知乎确认');
        setPublishVisible(false);
      } else {
        message.error(res.error || '自动发布失败');
      }
    } catch (e) {
      message.error('自动发布失败');
    }
  };

  const loadPosts = async (page: number, pageSize: number) => {
    try {
      setLoading(true);
      const params: any = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      if (filterPlatform) params.platform = filterPlatform;
      if (filterUserId) params.monitoring_user_id = filterUserId;
      if (filterIsNew !== undefined) params.is_new = filterIsNew;
      if (filterDateRange && filterDateRange.length === 2) {
        params.start_date = filterDateRange[0].format('YYYY-MM-DD');
        params.end_date = filterDateRange[1].format('YYYY-MM-DD');
      }
      if (searchQuery) params.q = searchQuery;
      const res = await monitoringService.getMonitoredPosts(params);
      setMonitoredPosts(res.data);
      setPostPage(page);
      setPostPageSize(pageSize);
    } catch (error) {
      message.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setModalType('user');
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditUser = (user: MonitoringUser) => {
    setModalType('user');
    setEditingRecord(user);
    form.setFieldsValue({
      platform: user.platform,
      target_user_id: user.target_user_id,
      target_username: user.target_username,
      category: user.category,
      check_frequency_minutes: user.check_frequency_minutes,
      monitoring_status: user.monitoring_status
    });
    setModalVisible(true);
  };

  const handleDeleteUser = async (id: number) => {
    try {
      await monitoringService.deleteMonitoringUser(id);
      message.success('User deleted successfully');
      fetchInitialData();
    } catch (error) {
      message.error('Failed to delete user');
    }
  };

  const handleAddWebhook = () => {
    setModalType('webhook');
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditWebhook = (webhook: WebhookConfig) => {
    setModalType('webhook');
    setEditingRecord(webhook);
    form.setFieldsValue({
      webhook_name: webhook.webhook_name,
      webhook_type: webhook.webhook_type,
      webhook_url: webhook.webhook_url,
      webhook_secret: webhook.webhook_secret,
      message_template: webhook.message_template
    });
    setModalVisible(true);
  };

  const handleTestWebhook = async (id: number) => {
    try {
      const result = await monitoringService.testWebhook(id);
      if (result.success) {
        message.success('Webhook test successful');
      } else {
        message.error(`Webhook test failed: ${result.message}`);
      }
    } catch (error) {
      message.error('Failed to test webhook');
    }
  };

  const handleManualCheck = async () => {
    try {
      setLoading(true);
      await monitoringService.runManualCheck();
      message.success('Manual check completed');
      fetchInitialData();
    } catch (error) {
      message.error('Manual check failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchUserPosts = (user: MonitoringUser) => {
    setFetchingUserId(user.id);
    setFetchingUsername(user.target_username || user.target_display_name || 'Unknown');
    setFetchModalVisible(true);
  };

  const handleConfirmFetchPosts = async (values: { days_back: number }) => {
    if (!fetchingUserId) return;
    
    try {
      setLoading(true);
      const result = await monitoringService.fetchUserPostsByDays(fetchingUserId, values.days_back);
      message.success(`Successfully fetched ${result.data.totalPosts} posts, ${result.data.newPosts} new posts`);
      fetchInitialData();
      setFetchModalVisible(false);
    } catch (error) {
      message.error('Failed to fetch user posts');
      console.error('Fetch posts error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulerToggle = async () => {
    try {
      if (schedulerStatus?.isActive) {
        await monitoringService.stopScheduler();
        message.success('Scheduler stopped');
      } else {
        await monitoringService.startScheduler();
        message.success('Scheduler started');
      }
      const statusRes = await monitoringService.getSchedulerStatus();
      setSchedulerStatus(statusRes.data);
    } catch (error) {
      message.error('Failed to toggle scheduler');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      if (modalType === 'user') {
        if (editingRecord) {
          await monitoringService.updateMonitoringUser(editingRecord.id, values);
          message.success('User updated successfully');
        } else {
          await monitoringService.addMonitoringUser(values);
          message.success('User added successfully');
        }
      } else if (modalType === 'webhook') {
        if (editingRecord) {
          // Update webhook
          message.success('Webhook updated successfully');
        } else {
          await monitoringService.createWebhookConfig(values);
          message.success('Webhook created successfully');
        }
      }
      
      setModalVisible(false);
      fetchInitialData();
    } catch (error) {
      message.error('Operation failed');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'paused': return 'orange';
      case 'stopped': return 'red';
      default: return 'default';
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'weibo': return '#e6162d';
      case 'x_twitter': return '#1da1f2';
      default: return '#666';
    }
  };

  const userColumns = [
    {
      title: 'User',
      dataIndex: 'target_display_name',
      key: 'target_display_name',
      render: (text: string, record: MonitoringUser) => (
        <div className="flex items-center space-x-3">
          {record.target_avatar_url && (
            <img src={record.target_avatar_url} alt="" className="w-10 h-10 rounded-full" />
          )}
          <div>
            <div className="font-medium">{record.target_display_name || record.target_username}</div>
            <div className="text-gray-500">@{record.target_username}</div>
          </div>
        </div>
      )
    },
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => (
        <Tag color={getPlatformColor(platform)}>
          {platform === 'weibo' ? 'Weibo' : 'X (Twitter)'}
        </Tag>
      )
    },
    {
      title: 'Status',
      dataIndex: 'monitoring_status',
      key: 'monitoring_status',
      render: (status: string) => (
        <Badge status={getStatusColor(status) as any} text={status} />
      )
    },
    {
      title: 'Followers',
      dataIndex: 'target_follower_count',
      key: 'target_follower_count',
      render: (count: number) => count.toLocaleString()
    },
    {
      title: 'Check Freq',
      dataIndex: 'check_frequency_minutes',
      key: 'check_frequency_minutes',
      render: (minutes: number) => `${minutes} min`
    },
    {
      title: 'Posts Found',
      dataIndex: 'post_count',
      key: 'post_count'
    },
    {
      title: 'Last Check',
      dataIndex: 'last_check_at',
      key: 'last_check_at',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'Never'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: MonitoringUser) => (
        <Space>
          <Tooltip title="Fetch Posts - Get recent posts from this user">
            <Button 
              type="primary" 
              size="small"
              icon={<SyncOutlined />} 
              onClick={() => handleFetchUserPosts(record)}
            >
              Fetch Posts
            </Button>
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEditUser(record)} />
          </Tooltip>
          <Popconfirm
            title="Are you sure to delete this user?"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const postColumns = [
    {
      title: 'User',
      dataIndex: 'target_display_name',
      key: 'target_display_name',
      render: (text: string, record: MonitoredPost) => (
        <div className="flex items-center space-x-2">
          <span>{text || record.target_username}</span>
          <Tag color={getPlatformColor(record.platform)}>
            {record.platform_label}
          </Tag>
        </div>
      )
    },
    {
      title: 'Content',
      dataIndex: 'post_content',
      key: 'post_content',
      render: (content: string) => (
        <div className="max-w-md truncate" title={content}>
          {content}
        </div>
      )
    },
    {
      title: 'Type',
      dataIndex: 'post_type',
      key: 'post_type',
      render: (type: string) => (
        <Tag>{type}</Tag>
      )
    },
    {
      title: 'Published',
      dataIndex: 'published_at',
      key: 'published_at',
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: 'Notification',
      dataIndex: 'notification_sent',
      key: 'notification_sent',
      render: (sent: boolean, record: MonitoredPost) => (
        <Badge 
          status={sent ? 'success' : 'error'} 
          text={sent ? 'Sent' : record.notification_error ? 'Failed' : 'Pending'} 
        />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: MonitoredPost) => (
        <Space>
          <Button size="small" onClick={() => { setCurrentPost(record); setDetailVisible(true); }}>查看内容</Button>
          <a href={record.post_url} target="_blank" rel="noopener noreferrer">
            View Post
          </a>
          <Button size="small" type="primary" onClick={() => handlePublishZhihu(record)}>发送到知乎</Button>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Social Media Monitoring</h1>
        
        {/* Control Panel */}
        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Badge status={schedulerStatus?.isActive ? 'success' : 'default'} />
                <span>Scheduler: {schedulerStatus?.isActive ? 'Active' : 'Stopped'}</span>
              </div>
              <Button
                type={schedulerStatus?.isActive ? 'default' : 'primary'}
                icon={schedulerStatus?.isActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={handleSchedulerToggle}
              >
                {schedulerStatus?.isActive ? 'Stop' : 'Start'}
              </Button>
              <Button
                icon={<SyncOutlined />}
                onClick={handleManualCheck}
                loading={loading}
              >
                Manual Check
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUser}>
                Add User
              </Button>
              <Button icon={<PlusOutlined />} onClick={handleAddWebhook}>
                Add Webhook
              </Button>
              <Button onClick={() => setZhihuModalVisible(true)}>Zhihu Config</Button>
            </div>
          </div>
        </Card>

        {/* Statistics */}
        <Row gutter={16} className="mb-4">
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Users"
                value={monitoringUsers.length}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Posts"
                value={monitoredPosts.length}
                prefix={<MessageOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Active Webhooks"
                value={webhookConfigs.filter(w => w.is_active).length}
                prefix={<BellOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Today's Checks"
                value={monitoringStats.find(s => s.date === new Date().toISOString().split('T')[0])?.total_checks || 0}
                prefix={<SyncOutlined />}
              />
            </Card>
          </Col>
        </Row>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Monitoring Users" key="users">
          <Table
            columns={userColumns}
            dataSource={monitoringUsers}
            loading={loading}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </TabPane>
        
        <TabPane tab="Monitored Posts" key="posts">
          <Card className="mb-3">
            <Space wrap>
              <Select
                allowClear
                placeholder="Platform"
                style={{ width: 160 }}
                value={filterPlatform}
                onChange={(v) => setFilterPlatform(v)}
              >
                {platforms.map((p: any) => (
                  <Option key={p.platform_name} value={p.platform_name}>{p.platform_label}</Option>
                ))}
              </Select>
              <Select
                allowClear
                placeholder="User"
                style={{ width: 220 }}
                value={filterUserId}
                onChange={(v) => setFilterUserId(v)}
              >
                {monitoringUsers.map((u) => (
                  <Option key={u.id} value={u.id}>{u.target_display_name || u.target_username}</Option>
                ))}
              </Select>
              <Checkbox checked={!!filterIsNew} onChange={(e) => setFilterIsNew(e.target.checked)}>Only New</Checkbox>
              <DatePicker.RangePicker onChange={(range) => setFilterDateRange(range)} />
              <Input.Search
                placeholder="Search content"
                allowClear
                onSearch={(val) => setSearchQuery(val)}
                style={{ width: 240 }}
              />
              <Button type="primary" onClick={() => loadPosts(1, postPageSize)} icon={<SyncOutlined />}>刷新</Button>
            </Space>
          </Card>
          {monitoredPosts.length === 0 && (
            <Card className="mb-3">
              <div style={{ color: '#666' }}>当前没有已拉取的帖子。请在“Monitoring Users”列表中选择账号后点击“Fetch Posts”，或等待定时调度完成拉取。</div>
              <div style={{ marginTop: 12 }}>
                <Button onClick={() => setActiveTab('users')} icon={<UserOutlined />}>前往 Monitoring Users</Button>
                <Button style={{ marginLeft: 8 }} type="primary" onClick={() => loadPosts(1, postPageSize)} icon={<SyncOutlined />}>刷新列表</Button>
              </div>
            </Card>
          )}
          <Table
            columns={postColumns}
            dataSource={monitoredPosts}
            loading={loading}
            rowKey="id"
            pagination={{ current: postPage, pageSize: postPageSize }}
            onChange={(pagination) => {
              const page = (pagination as any).current || 1;
              const size = (pagination as any).pageSize || postPageSize;
              loadPosts(page, size);
            }}
          />
        </TabPane>
        
        <TabPane tab="Webhook Configurations" key="webhooks">
          <Table
            columns={[
              {
                title: 'Name',
                dataIndex: 'webhook_name',
                key: 'webhook_name'
              },
              {
                title: 'Type',
                dataIndex: 'webhook_type',
                key: 'webhook_type',
                render: (type: string) => (
                  <Tag>{type}</Tag>
                )
              },
              {
                title: 'Status',
                dataIndex: 'is_active',
                key: 'is_active',
                render: (active: boolean) => (
                  <Badge status={active ? 'success' : 'default'} text={active ? 'Active' : 'Inactive'} />
                )
              },
              {
                title: 'Success Rate',
                key: 'success_rate',
                render: (_: any, record: WebhookConfig) => {
                  const total = record.success_count + record.failure_count;
                  const rate = total > 0 ? (record.success_count / total * 100).toFixed(1) : '0';
                  return `${rate}%`;
                }
              },
              {
                title: 'Last Sent',
                dataIndex: 'last_sent_at',
                key: 'last_sent_at',
                render: (date: string) => date ? new Date(date).toLocaleString() : 'Never'
              },
              {
                title: 'Actions',
                key: 'actions',
                render: (_: any, record: WebhookConfig) => (
                  <Space>
                    <Button type="text" icon={<EditOutlined />} onClick={() => handleEditWebhook(record)} />
                    <Button type="text" icon={<SyncOutlined />} onClick={() => handleTestWebhook(record.id)}>
                      Test
                    </Button>
                  </Space>
                )
              }
            ]}
            dataSource={webhookConfigs}
            loading={loading}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </TabPane>
        
        <TabPane tab="Statistics" key="stats">
          <Table
            columns={[
              {
                title: 'Date',
                dataIndex: 'date',
                key: 'date'
              },
              {
                title: 'Platform',
                dataIndex: 'platform_label',
                key: 'platform_label'
              },
              {
                title: 'Checks',
                dataIndex: 'total_checks',
                key: 'total_checks'
              },
              {
                title: 'New Posts',
                dataIndex: 'new_posts_found',
                key: 'new_posts_found'
              },
              {
                title: 'Notifications',
                dataIndex: 'notifications_sent',
                key: 'notifications_sent'
              },
              {
                title: 'Errors',
                dataIndex: 'errors_count',
                key: 'errors_count',
                render: (count: number) => <span style={{ color: count > 0 ? 'red' : 'inherit' }}>{count}</span>
              }
            ]}
            dataSource={monitoringStats}
            loading={loading}
            rowKey="id"
            pagination={{ pageSize: 20 }}
          />
        </TabPane>
      </Tabs>

      {/* Modal */}
      <Modal
        title={editingRecord ? `Edit ${modalType === 'user' ? 'User' : 'Webhook'}` : `Add ${modalType === 'user' ? 'User' : 'Webhook'}`}
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          {modalType === 'user' ? (
            <>
              <Form.Item
                name="platform"
                label="Platform"
                rules={[{ required: true, message: 'Please select platform' }]}
                initialValue="weibo"
              >
                <Select placeholder="Select platform">
                  {platforms.map((platform: any) => (
                    <Option key={platform.platform_name} value={platform.platform_name}>
                      {platform.platform_label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="target_user_id"
                label="User ID"
                rules={[{ required: true, message: 'Please enter user ID' }]}
              >
                <Input placeholder="Enter user ID from platform" />
              </Form.Item>
              <Form.Item
                name="target_username"
                label="Username (Optional)"
              >
                <Input placeholder="Enter username" />
              </Form.Item>
              <Form.Item
                name="category"
                label="Category"
              >
                <Input placeholder="e.g., Technology, Entertainment, News" />
              </Form.Item>
              <Form.Item
                name="check_frequency_minutes"
                label="Check Frequency (minutes)"
                initialValue={30}
                rules={[{ required: true, message: 'Please enter check frequency' }]}
              >
                <Input type="number" min={5} max={1440} placeholder="30" />
              </Form.Item>
              {!editingRecord && (
                <Form.Item
                  name="monitoring_status"
                  label="Status"
                  initialValue="active"
                >
                  <Select>
                    <Option value="active">Active</Option>
                    <Option value="paused">Paused</Option>
                    <Option value="stopped">Stopped</Option>
                  </Select>
                </Form.Item>
              )}
            </>
          ) : (
            <>
              <Form.Item
                name="webhook_name"
                label="Webhook Name"
                rules={[{ required: true, message: 'Please enter webhook name' }]}
              >
                <Input placeholder="Enter webhook name" />
              </Form.Item>
              <Form.Item
                name="webhook_type"
                label="Webhook Type"
                rules={[{ required: true, message: 'Please select webhook type' }]}
              >
                <Select placeholder="Select webhook type">
                  <Option value="feishu">Feishu (Lark)</Option>
                  <Option value="wechat_work">WeChat Work</Option>
                  <Option value="dingtalk">DingTalk</Option>
                  <Option value="custom">Custom</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="webhook_url"
                label="Webhook URL"
                rules={[{ required: true, message: 'Please enter webhook URL' }]}
              >
                <Input placeholder="https://example.com/webhook" />
              </Form.Item>
              <Form.Item
                name="webhook_secret"
                label="Webhook Secret (Optional)"
              >
                <Input.Password placeholder="Enter webhook secret for signature verification" />
              </Form.Item>
              <Form.Item
                name="message_template"
                label="Message Template (Optional)"
              >
                <Input.TextArea 
                  rows={4} 
                  placeholder="Available variables: {{platform}}, {{target_username}}, {{post_content}}, {{post_url}}, {{likes}}, {{shares}}, {{comments}}"
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title="Zhihu 登录配置"
        visible={zhihuModalVisible}
        onOk={async () => {
          try {
            await monitoringService.setZhihuConfig({ cookie_string: zhihuCookieString, cookies_json_file: zhihuFile });
            const status = await monitoringService.getZhihuConfigStatus();
            setZhihuStatus(status.data);
            message.success('配置已保存');
            setZhihuModalVisible(false);
          } catch (e) {
            message.error('保存失败');
          }
        }}
        onCancel={() => setZhihuModalVisible(false)}
        okText="保存"
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#666' }}>可二选一：填写 Cookie 字符串 或 上传浏览器导出的 Cookie JSON。</div>
        </div>
        <Form layout="vertical">
          <Form.Item label="Cookie 字符串">
            <Input.TextArea value={zhihuCookieString} onChange={(e) => setZhihuCookieString(e.target.value)} rows={4} placeholder="name=value; name2=value2" />
          </Form.Item>
          <Form.Item label="Cookie JSON 文件">
            <input type="file" accept="application/json" onChange={(e) => setZhihuFile(e.target.files?.[0])} />
          </Form.Item>
        </Form>
        {zhihuStatus && (
          <div style={{ marginTop: 12, color: '#666' }}>当前状态：字符串 {zhihuStatus.cookie_string ? '已配置' : '未配置'}，JSON {zhihuStatus.cookies_json ? '已配置' : '未配置'}</div>
        )}
      </Modal>

      <Modal
        title="发送到知乎"
        visible={publishVisible}
        onOk={doPublishZhihu}
        onCancel={() => setPublishVisible(false)}
        okText="前往知乎发布"
        footer={[
          <Button key="auto" type="primary" onClick={doPublishZhihuAuto}>自动投稿到知乎</Button>,
          <Button key="manual" onClick={doPublishZhihu}>复制并前往发布</Button>,
        ]}
      >
        <div style={{ marginBottom: 12 }}>
          <Radio.Group value={publishType} onChange={(e) => setPublishType(e.target.value)}>
            <Radio.Button value="idea">想法</Radio.Button>
            <Radio.Button value="article">文章</Radio.Button>
          </Radio.Group>
        </div>
        {publishType === 'article' && (
          <Form layout="vertical">
            <Form.Item label="文章标题">
              <Input value={publishTitle} onChange={(e) => setPublishTitle(e.target.value)} placeholder="请输入文章标题" />
            </Form.Item>
          </Form>
        )}
        <div style={{ color: '#666', fontSize: 12 }}>将复制帖子内容到剪贴板并打开知乎发布页面，请在新页面中粘贴并完善后发布。</div>
        <div style={{ marginTop: 8 }}>
          <a href="https://www.zhihu.com/creator" target="_blank" rel="noreferrer">知乎创作中心</a>
          <span style={{ margin: '0 8px' }}>·</span>
          <a href="https://zhuanlan.zhihu.com" target="_blank" rel="noreferrer">知乎专栏</a>
        </div>
      </Modal>

      <Drawer
        title="帖子内容详情"
        placement="right"
        width={520}
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
      >
        {currentPost && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Tag color={getPlatformColor(currentPost.platform)}>{currentPost.platform_label}</Tag>
              <span style={{ marginLeft: 8 }}>{currentPost.target_display_name || currentPost.target_username}</span>
            </div>
            <div style={{ marginBottom: 12, whiteSpace: 'pre-wrap' }}>{currentPost.post_content}</div>
            {currentPost.post_images && currentPost.post_images.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>图片</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(currentPost.post_images as any[]).map((img, idx) => (
                    <a href={img as any} target="_blank" rel="noreferrer" key={idx}>
                      <img src={img as any} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 4 }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {currentPost.post_videos && currentPost.post_videos.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>视频</div>
                <ul>
                  {(currentPost.post_videos as any[]).map((vid, idx) => (
                    <li key={idx}><a href={vid as any} target="_blank" rel="noreferrer">{vid as any}</a></li>
                  ))}
                </ul>
              </div>
            )}
            {currentPost.post_metadata && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>元数据</div>
                <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>{JSON.stringify(currentPost.post_metadata, null, 2)}</pre>
              </div>
            )}
            <div>
              <a href={currentPost.post_url} target="_blank" rel="noreferrer">在平台查看</a>
              <div style={{ color: '#666', marginTop: 8 }}>发布时间：{new Date(currentPost.published_at).toLocaleString()}</div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Fetch Posts Modal */}
      <Modal
        title={`Fetch Posts for ${fetchingUsername}`}
        visible={fetchModalVisible}
        onOk={() => form.submit()}
        onCancel={() => setFetchModalVisible(false)}
        okText="Fetch Posts"
        cancelText="Cancel"
        confirmLoading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleConfirmFetchPosts}
          initialValues={{ days_back: 7 }}
        >
          <Form.Item
            label="Quick Select Days"
          >
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <Button 
                size="small" 
                onClick={() => form.setFieldsValue({ days_back: 7 })}
                style={{ backgroundColor: form.getFieldValue('days_back') === 7 ? '#1890ff' : undefined, color: form.getFieldValue('days_back') === 7 ? 'white' : undefined }}
              >
                7 Days
              </Button>
              <Button 
                size="small" 
                onClick={() => form.setFieldsValue({ days_back: 30 })}
                style={{ backgroundColor: form.getFieldValue('days_back') === 30 ? '#1890ff' : undefined, color: form.getFieldValue('days_back') === 30 ? 'white' : undefined }}
              >
                30 Days
              </Button>
              <Button 
                size="small" 
                onClick={() => form.setFieldsValue({ days_back: 90 })}
                style={{ backgroundColor: form.getFieldValue('days_back') === 90 ? '#1890ff' : undefined, color: form.getFieldValue('days_back') === 90 ? 'white' : undefined }}
              >
                90 Days
              </Button>
              <Button 
                size="small" 
                onClick={() => form.setFieldsValue({ days_back: 180 })}
                style={{ backgroundColor: form.getFieldValue('days_back') === 180 ? '#1890ff' : undefined, color: form.getFieldValue('days_back') === 180 ? 'white' : undefined }}
              >
                180 Days
              </Button>
            </div>
          </Form.Item>
          <Form.Item
            name="days_back"
            label="Days to Fetch"
            rules={[{ required: true, message: 'Please enter number of days' }]}
            help="How many days back to fetch posts from this user"
          >
            <Input type="number" min={1} max={365} placeholder="Enter number of days" />
          </Form.Item>
          <div style={{ color: '#666', fontSize: '12px', marginTop: '-8px', marginBottom: '8px' }}>
            💡 Tip: Fetching more days will take longer. Start with 7-30 days for quick results.
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default SocialMonitoring;