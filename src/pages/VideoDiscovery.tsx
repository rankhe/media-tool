import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Input, 
  Select, 
  Button, 
  Tabs, 
  Tag, 
  Avatar, 
  Space, 
  Spin, 
  Empty,
  message,
  Modal,
  Form,
  Dropdown
} from 'antd';
import { 
  Search, 
  TrendingUp, 
  Play, 
  Download, 
  Eye, 
  Heart, 
  Share,
  User,
  Calendar,
  Filter
} from 'lucide-react';
import { videoAPI, taskAPI } from '../services/api';
import { useAuth } from '../store';
import TaskProgressTracker from '../components/TaskProgressTracker';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// 添加相对时间插件
dayjs.extend(relativeTime);

const { Search: SearchInput } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  video_url: string;
  duration: number;
  view_count: number;
  like_count: number;
  share_count: number;
  platform: string;
  author: {
    id: string;
    name: string;
    avatar_url: string;
    follower_count: number;
    verified?: boolean;
  };
  created_at: string;
  tags: string[];
  category: string;
  relevanceScore?: number;
  is_real_data?: boolean;
}

interface Account {
  id: string;
  platform: string;
  username: string;
  display_name: string;
  avatar_url: string;
  follower_count: number;
  video_count: number;
  verified: boolean;
  category: string;
  bio: string;
  top_id?: number;
}

export const VideoDiscovery: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('bilibili');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [minViews, setMinViews] = useState<number>(0);
  const [maxDuration, setMaxDuration] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>('relevance');
  const [videos, setVideos] = useState<Video[]>([]);
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [topAccounts, setTopAccounts] = useState<Account[]>([]);
  const [activeTab, setActiveTab] = useState('videos');
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [createdTask, setCreatedTask] = useState<any>(null);
  const [downloadForm] = Form.useForm();
  const [advancedFiltersVisible, setAdvancedFiltersVisible] = useState(false);
  const proxify = (u: string) => `/api/proxy/image?url=${encodeURIComponent(u || '')}`;

  const platforms = [
    { value: 'all', label: '全部平台' },
    { value: 'bilibili', label: '哔哩哔哩' },
    { value: 'douyin', label: '抖音' },
    { value: 'kuaishou', label: '快手' },
    { value: 'xiaohongshu', label: '小红书' },
  ];

  const categories = [
    { value: 'all', label: '全部分类' },
    { value: 'entertainment', label: '娱乐' },
    { value: 'education', label: '教育' },
    { value: 'lifestyle', label: '生活' },
    { value: 'food', label: '美食' },
    { value: 'travel', label: '旅行' },
    { value: 'technology', label: '科技' },
    { value: 'fashion', label: '时尚' },
];

  useEffect(() => {
    let timer: any;
    const poll = async () => {
      if (!createdTask?.id) return;
      try {
        const resp = await taskAPI.getTask(createdTask.id);
        const data = resp?.data || resp;
        if (data) setCreatedTask(data);
      } catch {}
    };
    if (downloadModalVisible && createdTask?.id) {
      timer = setInterval(poll, 3000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [downloadModalVisible, createdTask?.id]);

  useEffect(() => {
    fetchTrendingVideos();
    fetchTopAccounts();
  }, [selectedPlatform]);

  const fetchTrendingVideos = async () => {
    try {
      setLoading(true);
      if (selectedPlatform === 'all') {
        setTrendingVideos([]);
        message.info('请先选择具体平台以获取热门视频');
        return;
      }
      const response = await videoAPI.getTrendingVideos(selectedPlatform, 20);
      if (response.success) {
        setTrendingVideos(response.data.videos || []);
      }
    } catch (error: any) {
      const code = error?.response?.data?.error?.code;
      if (code === 'PLATFORM_NOT_SUPPORTED') {
        message.warning('该平台暂不支持热门视频真实数据');
        setTrendingVideos([]);
        return;
      }
      console.error('Failed to fetch trending videos:', error);
      message.error('获取热门视频失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchTopAccounts = async () => {
    try {
      const params: any = selectedPlatform !== 'all' ? { platform: selectedPlatform } : {};
      const res = await (await import('../services/topCreatorsService')).default.getTopCreators(params);
      if (res.success) {
        const rows = res.data || [];
        const accounts: Account[] = rows.map((u: any) => ({
          id: u.creator_user_id?.toString(),
          platform: u.platform,
          username: u.creator_username,
          display_name: u.creator_display_name || u.creator_username,
          avatar_url: u.avatar_url || '',
          follower_count: u.follower_count || 0,
          video_count: 0,
          verified: !!u.verified,
          category: u.category || 'entertainment',
          bio: u.bio || '',
          top_id: u.id,
        }));
        setTopAccounts(accounts);
      }
    } catch (error) {
      console.error('Failed to fetch top accounts:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() && activeTab === 'search') {
      message.warning('请输入搜索关键词');
      return;
    }

    try {
      setLoading(true);
      const params = {
        q: searchQuery.trim(),
        platform: selectedPlatform === 'all' ? undefined : selectedPlatform,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        min_views: minViews || undefined,
        max_duration: maxDuration || undefined,
        sort_by: sortBy,
        limit: 20
      };
      
      const response = await videoAPI.searchVideos(searchQuery.trim(), selectedPlatform === 'all' ? undefined : selectedPlatform);
      if (response.success) {
        let resultVideos = response.data.videos || [];
        
        // 客户端筛选（因为后端可能不支持所有筛选条件）
        if (minViews > 0) {
          resultVideos = resultVideos.filter((video: Video) => video.view_count >= minViews);
        }
        if (maxDuration > 0) {
          resultVideos = resultVideos.filter((video: Video) => video.duration <= maxDuration);
        }
        
        // 排序
        if (sortBy === 'views') {
          resultVideos.sort((a, b) => b.view_count - a.view_count);
        } else if (sortBy === 'likes') {
          resultVideos.sort((a, b) => b.like_count - a.like_count);
        } else if (sortBy === 'date') {
          resultVideos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        
        setVideos(resultVideos);
      }
    } catch (error: any) {
      const code = error?.response?.data?.error?.code;
      if (code === 'PLATFORM_NOT_SUPPORTED') {
        message.warning('该平台暂不支持搜索真实数据');
        setVideos([]);
        return;
      }
      console.error('Search failed:', error);
      message.error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (video: Video) => {
    if (!isAuthenticated) {
      message.warning('请先登录后再创建下载任务');
      return;
    }
    setSelectedVideo(video);
    setDownloadModalVisible(true);
  };

  const handleCreateDownloadTask = async (values: any) => {
    if (!selectedVideo) return;

    try {
      const taskData = {
        task_type: 'download' as const,
        source_config: {
          platform: selectedVideo.platform,
          videoId: selectedVideo.id,
          url: selectedVideo.video_url,
          quality: values.quality || 'high',
          extractAudio: values.extractAudio || false,
        },
        target_config: {
          outputPath: values.savePath || './downloads',
          renamePattern: values.renamePattern || '{title}_{id}',
          autoProcess: values.autoProcess || false,
          processingConfig: { processingType: values.processingType || 'none' }
        }
      };

      const response = await taskAPI.createTask(taskData);
      if (response.success) {
        message.success('下载任务创建成功');
        setCreatedTask(response.data);
        // 保持模态框打开，展示进度
      }
    } catch (error) {
      console.error('Failed to create download task:', error);
      message.error('创建下载任务失败');
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toString();
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const VideoCard = ({ video }: { video: Video }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    
    const handlePlay = () => {
      setIsPlaying(true);
      
      // 创建自定义模态框，包含关闭按钮
      const modal = Modal.info({
        title: (<div className="truncate">{video.title}</div>),
        width: 800,
        content: (
          <div className="text-center">
            {video.platform === 'bilibili' ? (
              (() => {
                const match = video.video_url.match(/\/video\/(BV[\w]+)/);
                const bvid = match ? match[1] : '';
                const src = bvid ? `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=1` : video.video_url;
                return (
                  <iframe
                    src={src}
                    allow="autoplay"
                    className="w-full max-h-96 rounded-lg"
                    style={{ height: 400, border: 0 }}
                  />
                );
              })()
            ) : (
              <div>
                <a href={video.video_url} target="_blank" rel="noreferrer">打开原始链接</a>
              </div>
            )}
            <div className="mt-4 text-left bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700 mb-3">{video.description}</p>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center space-x-4">
                  <span className="flex items-center">
                    <Eye className="w-4 h-4 mr-1" />
                    {formatNumber(video.view_count)} 播放
                  </span>
                  <span className="flex items-center">
                    <Heart className="w-4 h-4 mr-1" />
                    {formatNumber(video.like_count)} 点赞
                  </span>
                </div>
                <span>{dayjs(video.created_at).fromNow()}</span>
              </div>
              <div className="mt-2 flex items-center space-x-2">
                <Avatar src={proxify(video.author.avatar_url)} size="small" />
                <span className="text-sm text-gray-600">{video.author.name}</span>
                <Tag color="blue">{platforms.find(p => p.value === video.platform)?.label}</Tag>
                {((video as any).is_real_data || (video as any).is_real) && <Tag color="green">真实</Tag>}
              </div>
            </div>
          </div>
        ),
        onCancel: () => {
          setIsPlaying(false);
        },
        okButtonProps: { style: { display: 'none' } },
        closable: true,
        maskClosable: true,
        keyboard: true,
        afterClose: () => {
          setIsPlaying(false);
        }
      });
    };
    
    return (
      <Card
        hoverable
        cover={
          <div className="relative group">
            <img
              alt={video.title}
              src={proxify(video.thumbnail_url)}
              className="w-full h-48 object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
              {formatDuration(video.duration)}
            </div>
            <div className="absolute top-2 left-2">
              <Tag color="blue">{platforms.find(p => p.value === video.platform)?.label}</Tag>
            </div>
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
              <Button
                type="primary"
                shape="circle"
                size="large"
                icon={<Play className="w-6 h-6" />}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handlePlay}
              />
            </div>
          </div>
        }
        actions={[
          <Button key="play" icon={<Play className="w-4 h-4" />} size="small" onClick={handlePlay}>
            播放
          </Button>,
          <Button 
            key="download" 
            icon={<Download className="w-4 h-4" />} 
            size="small"
            onClick={() => handleDownload(video)}
          >
            下载
          </Button>,
          <Button key="share" icon={<Share className="w-4 h-4" />} size="small">
            分享
          </Button>,
        ]}
      >
        <Card.Meta
          avatar={null}
          title={
            <div className="truncate" title={video.title}>
              {video.title}
            </div>
          }
          description={
            <div className="space-y-2">
              <div className="text-sm text-gray-700 line-clamp-2" title={video.description}>
                {video.description}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {formatNumber(video.view_count)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {formatNumber(video.like_count)}
                  </span>
                </div>
                <span className="whitespace-nowrap">{dayjs(video.created_at).fromNow()}</span>
              </div>
              <div className="flex items-center justify-between">
                <Dropdown
                  trigger={["click","contextMenu"]}
                  menu={{
                    items: [
                      { key: 'add', label: '加入优质账号' },
                      { key: 'view', label: '查看UP主页' },
                    ],
                    onClick: async ({ key }) => {
                      try {
                        if (key === 'add') {
                          const topCreatorsService = (await import('../services/topCreatorsService')).default;
                          await topCreatorsService.addTopCreator({
                            platform: video.platform,
                            creator_user_id: String(video.author.id || ''),
                            creator_username: video.author.name,
                            creator_display_name: video.author.name,
                            avatar_url: video.author.avatar_url,
                            follower_count: 0,
                            verified: false,
                            bio: '',
                            category: video.category || 'discovery',
                            score: video.relevanceScore || 0,
                          });
                          message.success('已将该UP主加入优质账号');
                          fetchTopAccounts();
                        } else if (key === 'view') {
                          if (video.platform === 'bilibili' && video.author.id) {
                            window.open(`https://space.bilibili.com/${video.author.id}`, '_blank');
                          }
                        }
                      } catch (e: any) {
                        message.error((e?.response?.data?.error?.details) || '操作失败，可能未登录或此账号已存在');
                      }
                    }
                  }}
                >
                  <div className="flex items-center gap-2 text-xs text-gray-600" style={{ cursor: 'pointer' }}>
                    <Avatar src={proxify(video.author.avatar_url)} size={20} />
                    <span className="truncate max-w-[140px]">{video.author.name}</span>
                    {video.author.verified && <span className="text-blue-500">✓</span>}
                  </div>
                </Dropdown>
                <Tag color="blue" className="text-xs">{platforms.find(p => p.value === video.platform)?.label}</Tag>
              </div>
            </div>
          }
        />
      </Card>
    );
  };

  const AccountCard = ({ account }: { account: Account }) => {
    const [following, setFollowing] = useState(false);
    const handleAddToTop = async () => {
      try {
        const monitoringService = (await import('../services/monitoringService')).default;
        await monitoringService.addMonitoringUser({
          platform: account.platform || selectedPlatform,
          target_user_id: account.id,
          target_username: account.username,
          category: account.category,
          check_frequency_minutes: 60
        });
        message.success('已添加到优质账号');
        fetchTopAccounts();
      } catch (e) {
        message.error('添加失败');
      }
    };
    
    const handleFollow = () => {
      setFollowing(!following);
      message.success(following ? '已取消关注' : '关注成功');
    };
    
    return (
      <Card hoverable bodyStyle={{ minHeight: 160 }}>
        <div>
          <div className="flex items-start gap-3">
            <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flex: '0 0 64px' }}>
              <img src={proxify(account.avatar_url)} alt={account.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div className="flex-1">
              <div className="font-semibold truncate text-base">{account.display_name}</div>
              <div className="text-xs text-gray-500 truncate">@{account.username}</div>
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
                <span>粉丝 {formatNumber(account.follower_count)}</span>
                <span>作品 {account.video_count}</span>
                {account.verified && <Tag color="green" className="text-xxs">认证</Tag>}
              </div>
              {account.bio && (
                <div className="mt-2 text-xs text-gray-600 line-clamp-2">{account.bio}</div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Tag color="blue" className="text-xs">
                  {platforms.find(p => p.value === account.platform)?.label || account.platform}
                </Tag>
                <Tag color="blue" className="text-xs">
                  {categories.find(c => c.value === account.category)?.label || account.category}
                </Tag>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="small" onClick={() => {
                  if (account.platform === 'bilibili' && account.id) {
                    window.open(`https://space.bilibili.com/${account.id}`, '_blank');
                  }
                }}>主页</Button>
                {account.top_id ? (
                  <Button size="small" danger onClick={async () => {
                    try {
                      const svc = (await import('../services/topCreatorsService')).default;
                      await svc.deleteTopCreator(account.top_id!);
                      message.success('已移出优质账号');
                      fetchTopAccounts();
                    } catch (e) {
                      message.error('移出失败');
                    }
                  }}>移出</Button>
                ) : (
                  <Button size="small" type="primary" onClick={handleAddToTop}>加入</Button>
                )}
                <Button size="small" onClick={handleFollow} type={following ? 'default' : 'dashed'}>
                  {following ? '已关注' : '关注'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">视频发现</h1>
        <div className="text-sm text-gray-500">
          今日剩余任务额度：{Math.max(0, (user?.max_daily_tasks || 10) - (user?.usage_count || 0))}
        </div>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <div className="space-y-4">
          <div className="flex gap-4">
            <SearchInput
              placeholder="搜索视频、账号或关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={handleSearch}
              style={{ width: 400 }}
              enterButton={<Search className="w-4 h-4" />}
            />
            <Select
              value={selectedPlatform}
              onChange={setSelectedPlatform}
              style={{ width: 150 }}
              suffixIcon={<Filter className="w-4 h-4" />}
            >
              {platforms.map(platform => (
                <Option key={platform.value} value={platform.value}>
                  {platform.label}
                </Option>
              ))}
            </Select>
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              style={{ width: 150 }}
            >
              {categories.map(category => (
                <Option key={category.value} value={category.value}>
                  {category.label}
                </Option>
              ))}
            </Select>
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
            <Button 
              icon={<Filter className="w-4 h-4" />} 
              onClick={() => setAdvancedFiltersVisible(!advancedFiltersVisible)}
            >
              高级筛选
            </Button>
          </div>
          
          {advancedFiltersVisible && (
            <div className="border-t pt-4 space-y-4">
              <Row gutter={16}>
                <Col span={8}>
                  <div className="text-sm font-medium mb-2">播放量筛选</div>
                  <Select
                    value={minViews}
                    onChange={setMinViews}
                    style={{ width: '100%' }}
                    options={[
                      { label: '不限', value: 0 },
                      { label: '1万以上', value: 10000 },
                      { label: '5万以上', value: 50000 },
                      { label: '10万以上', value: 100000 },
                      { label: '50万以上', value: 500000 },
                      { label: '100万以上', value: 1000000 }
                    ]}
                  />
                </Col>
                <Col span={8}>
                  <div className="text-sm font-medium mb-2">时长筛选</div>
                  <Select
                    value={maxDuration}
                    onChange={setMaxDuration}
                    style={{ width: '100%' }}
                    options={[
                      { label: '不限', value: 0 },
                      { label: '1分钟以内', value: 60 },
                      { label: '3分钟以内', value: 180 },
                      { label: '5分钟以内', value: 300 },
                      { label: '10分钟以内', value: 600 },
                      { label: '30分钟以内', value: 1800 }
                    ]}
                  />
                </Col>
                <Col span={8}>
                  <div className="text-sm font-medium mb-2">排序方式</div>
                  <Select
                    value={sortBy}
                    onChange={setSortBy}
                    style={{ width: '100%' }}
                    options={[
                      { label: '相关度', value: 'relevance' },
                      { label: '播放量', value: 'views' },
                      { label: '点赞数', value: 'likes' },
                      { label: '发布时间', value: 'date' }
                    ]}
                  />
                </Col>
              </Row>
            </div>
          )}
        </div>
      </Card>

      {/* 标签页 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane 
          tab={
            <span>
              <TrendingUp className="w-4 h-4 inline mr-2" />
              热门视频
            </span>
          } 
          key="videos"
        >
          <Spin spinning={loading}>
            {trendingVideos.length > 0 ? (
              <Row gutter={[16, 16]}>
                {trendingVideos.map(video => (
                  <Col key={video.id} xs={24} sm={12} md={8} lg={6}>
                    <VideoCard video={video} />
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty description={selectedPlatform === 'all' ? '请选择具体平台以获取热门视频' : '暂无热门视频'} />
            )}
          </Spin>
        </TabPane>

        <TabPane 
          tab={
            <span>
              <User className="w-4 h-4 inline mr-2" />
              优质账号
            </span>
          } 
          key="accounts"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">共 {topAccounts.length} 个优质账号</div>
            <Button size="small" onClick={fetchTopAccounts}>刷新</Button>
          </div>
          <Row gutter={[16, 16]}>
            {topAccounts.map(account => (
              <Col key={account.id} xs={24} sm={12} md={8} lg={6}>
                <AccountCard account={account} />
              </Col>
            ))}
          </Row>
        </TabPane>

        <TabPane 
          tab={
            <span>
              <Search className="w-4 h-4 inline mr-2" />
              搜索结果
            </span>
          } 
          key="search"
        >
          <Spin spinning={loading}>
            {videos.length > 0 ? (
              <Row gutter={[16, 16]}>
                {videos.map(video => (
                  <Col key={video.id} xs={24} sm={12} md={8} lg={6}>
                    <VideoCard video={video} />
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty description="暂无搜索结果" />
            )}
          </Spin>
        </TabPane>
      </Tabs>

      {/* 下载模态框 */}
      <Modal
        title="创建下载任务"
        open={downloadModalVisible}
        onCancel={() => setDownloadModalVisible(false)}
        footer={null}
        width={600}
      >
        {createdTask ? (
          <TaskProgressTracker 
            task={createdTask}
            onRefresh={async () => {
              try {
                const resp = await taskAPI.getTask(createdTask.id);
                const data = resp?.data || resp;
                if (data) setCreatedTask(data);
              } catch {}
            }}
            autoRefresh={false}
          />
        ) : selectedVideo && (
          <Form
            form={downloadForm}
            layout="vertical"
            onFinish={handleCreateDownloadTask}
            initialValues={{
              quality: 'high',
              extractAudio: false,
              savePath: './downloads',
              renamePattern: '{title}_{id}',
              autoProcess: false,
              processingType: 'none'
            }}
          >
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <div className="flex items-center space-x-3">
                <img src={proxify(selectedVideo.thumbnail_url)} alt={selectedVideo.title} className="w-16 h-16 object-cover rounded" />
                <div>
                  <div className="font-medium truncate">{selectedVideo.title}</div>
                  <div className="text-sm text-gray-500">{selectedVideo.author.name}</div>
                </div>
              </div>
            </div>

            <Form.Item
              label="下载质量"
              name="quality"
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="high">高清 (1080p)</Option>
                <Option value="medium">标清 (720p)</Option>
                <Option value="low">流畅 (480p)</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="提取音频"
              name="extractAudio"
              valuePropName="checked"
            >
              <Select>
                <Option value={false}>仅下载视频</Option>
                <Option value={true}>同时提取音频</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="保存路径"
              name="savePath"
              rules={[{ required: true }]}
            >
              <Input placeholder="例如: ./downloads" />
            </Form.Item>

            <Form.Item
              label="重命名规则"
              name="renamePattern"
              rules={[{ required: true }]}
            >
              <Input placeholder="例如: {title}_{id}" />
            </Form.Item>

            <Form.Item
              label="自动处理"
              name="autoProcess"
              valuePropName="checked"
            >
              <Select>
                <Option value={false}>下载完成后手动处理</Option>
                <Option value={true}>下载完成后自动处理</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="处理方式"
              name="processingType"
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="none">不处理</Option>
                <Option value="basic">基础处理（去水印等）</Option>
                <Option value="advanced">高级处理（AI二创）</Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <div className="flex justify-end space-x-3">
                <Button onClick={() => setDownloadModalVisible(false)}>取消</Button>
                <Button type="primary" htmlType="submit">创建任务</Button>
              </div>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};