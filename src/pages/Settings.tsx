import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, Switch, message, Tabs, Upload, Row, Col } from 'antd';
import { SaveOutlined, UploadOutlined, KeyOutlined, DatabaseOutlined, CloudOutlined } from '@ant-design/icons';
import { settingsService } from '../services/settingsService';

const { TabPane } = Tabs;
const { TextArea } = Input;

interface SettingsData {
  general: {
    siteName: string;
    siteDescription: string;
    language: string;
    timezone: string;
    maintenanceMode: boolean;
  };
  video: {
    maxFileSize: number;
    allowedFormats: string[];
    defaultQuality: string;
    autoTranscribe: boolean;
    autoTranslate: boolean;
  };
  download: {
    maxConcurrentDownloads: number;
    retryAttempts: number;
    timeout: number;
    userAgent: string;
  };
  publish: {
    defaultPlatforms: string[];
    publishInterval: number;
    maxDailyPublishes: number;
    autoPublish: boolean;
  };
  api: {
    openaiKey: string;
    googleKey: string;
    baiduKey: string;
    tencentKey: string;
  };
  storage: {
    type: 'local' | 'cloud';
    cloudProvider: 'aws' | 'aliyun' | 'tencent';
    bucketName: string;
    region: string;
    accessKey: string;
    secretKey: string;
  };
  redis: {
    host: string;
    port: number;
    password: string;
    db: number;
  };
  database: {
    type: 'sqlite' | 'mysql' | 'postgresql';
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
}

const languageOptions = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁体中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
];

const timezoneOptions = [
  { value: 'Asia/Shanghai', label: '北京时间 (UTC+8)' },
  { value: 'Asia/Tokyo', label: '东京时间 (UTC+9)' },
  { value: 'America/New_York', label: '纽约时间 (UTC-5/-4)' },
  { value: 'Europe/London', label: '伦敦时间 (UTC+0/+1)' },
];

const platformOptions = [
  { value: 'douyin', label: '抖音' },
  { value: 'kuaishou', label: '快手' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'bilibili', label: '哔哩哔哩' },
  { value: 'wechat', label: '微信视频号' },
];

const cloudProviderOptions = [
  { value: 'aws', label: 'Amazon AWS' },
  { value: 'aliyun', label: '阿里云' },
  { value: 'tencent', label: '腾讯云' },
];

const databaseTypeOptions = [
  { value: 'sqlite', label: 'SQLite' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
];

export const Settings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const settings = await settingsService.getSettings();
      form.setFieldsValue(settings);
    } catch (error) {
      message.error('获取设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await settingsService.updateSettings(values);
      message.success('设置保存成功');
    } catch (error) {
      message.error('保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };

  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  return (
    <div className="settings-page">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">系统设置</h1>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            保存设置
          </Button>
        </div>

        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <TabPane tab="基础设置" key="general">
            <Form form={form} layout="vertical" initialValues={{}}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['general', 'siteName']}
                    label="网站名称"
                    rules={[{ required: true, message: '请输入网站名称' }]}
                  >
                    <Input placeholder="输入网站名称" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['general', 'language']}
                    label="语言"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="选择语言">
                      {languageOptions.map(option => (
                        <Select.Option key={option.value} value={option.value}>
                          {option.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name={['general', 'siteDescription']}
                label="网站描述"
              >
                <TextArea rows={3} placeholder="输入网站描述" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['general', 'timezone']}
                    label="时区"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="选择时区">
                      {timezoneOptions.map(option => (
                        <Select.Option key={option.value} value={option.value}>
                          {option.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['general', 'maintenanceMode']}
                    label="维护模式"
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </TabPane>

          <TabPane tab="视频设置" key="video">
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name={['video', 'maxFileSize']}
                    label="最大文件大小 (MB)"
                    rules={[{ required: true, type: 'number', min: 1 }]}
                  >
                    <Input type="number" placeholder="输入最大文件大小" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name={['video', 'defaultQuality']}
                    label="默认质量"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="选择默认质量">
                      <Select.Option value="high">高质量</Select.Option>
                      <Select.Option value="medium">中等质量</Select.Option>
                      <Select.Option value="low">低质量</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name={['video', 'allowedFormats']}
                    label="允许的视频格式"
                  >
                    <Select
                      mode="tags"
                      placeholder="输入视频格式"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['video', 'autoTranscribe']}
                    label="自动转录"
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['video', 'autoTranslate']}
                    label="自动翻译"
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </TabPane>

          <TabPane tab="下载设置" key="download">
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name={['download', 'maxConcurrentDownloads']}
                    label="最大并发下载数"
                    rules={[{ required: true, type: 'number', min: 1, max: 10 }]}
                  >
                    <Input type="number" placeholder="1-10" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name={['download', 'retryAttempts']}
                    label="重试次数"
                    rules={[{ required: true, type: 'number', min: 0, max: 5 }]}
                  >
                    <Input type="number" placeholder="0-5" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name={['download', 'timeout']}
                    label="超时时间 (秒)"
                    rules={[{ required: true, type: 'number', min: 30 }]}
                  >
                    <Input type="number" placeholder="输入超时时间" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name={['download', 'userAgent']}
                label="User Agent"
              >
                <TextArea rows={3} placeholder="输入User Agent字符串" />
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab="发布设置" key="publish">
            <Form form={form} layout="vertical">
              <Form.Item
                name={['publish', 'defaultPlatforms']}
                label="默认发布平台"
              >
                <Select
                  mode="multiple"
                  placeholder="选择默认发布平台"
                >
                  {platformOptions.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name={['publish', 'publishInterval']}
                    label="发布间隔 (分钟)"
                    rules={[{ required: true, type: 'number', min: 1 }]}
                  >
                    <Input type="number" placeholder="输入发布间隔" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name={['publish', 'maxDailyPublishes']}
                    label="每日最大发布数"
                    rules={[{ required: true, type: 'number', min: 1 }]}
                  >
                    <Input type="number" placeholder="输入最大发布数" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name={['publish', 'autoPublish']}
                    label="自动发布"
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </TabPane>

          <TabPane tab="API密钥" key="api">
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['api', 'openaiKey']}
                    label="OpenAI API密钥"
                  >
                    <Input.Password
                      prefix={<KeyOutlined />}
                      placeholder="输入OpenAI API密钥"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['api', 'googleKey']}
                    label="Google API密钥"
                  >
                    <Input.Password
                      prefix={<KeyOutlined />}
                      placeholder="输入Google API密钥"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['api', 'baiduKey']}
                    label="百度API密钥"
                  >
                    <Input.Password
                      prefix={<KeyOutlined />}
                      placeholder="输入百度API密钥"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['api', 'tencentKey']}
                    label="腾讯API密钥"
                  >
                    <Input.Password
                      prefix={<KeyOutlined />}
                      placeholder="输入腾讯API密钥"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </TabPane>

          <TabPane tab="存储设置" key="storage">
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['storage', 'type']}
                    label="存储类型"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="选择存储类型">
                      <Select.Option value="local">本地存储</Select.Option>
                      <Select.Option value="cloud">云存储</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['storage', 'cloudProvider']}
                    label="云服务商"
                  >
                    <Select placeholder="选择云服务商">
                      {cloudProviderOptions.map(option => (
                        <Select.Option key={option.value} value={option.value}>
                          {option.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['storage', 'bucketName']}
                    label="存储桶名称"
                  >
                    <Input placeholder="输入存储桶名称" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['storage', 'region']}
                    label="区域"
                  >
                    <Input placeholder="输入区域代码" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['storage', 'accessKey']}
                    label="Access Key"
                  >
                    <Input placeholder="输入Access Key" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['storage', 'secretKey']}
                    label="Secret Key"
                  >
                    <Input.Password placeholder="输入Secret Key" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </TabPane>

          <TabPane tab="Redis配置" key="redis">
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['redis', 'host']}
                    label="主机地址"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="输入Redis主机地址" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['redis', 'port']}
                    label="端口"
                    rules={[{ required: true, type: 'number' }]}
                  >
                    <Input type="number" placeholder="输入Redis端口" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['redis', 'password']}
                    label="密码"
                  >
                    <Input.Password placeholder="输入Redis密码（可选）" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['redis', 'db']}
                    label="数据库"
                    rules={[{ required: true, type: 'number' }]}
                  >
                    <Input type="number" placeholder="输入数据库编号" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </TabPane>

          <TabPane tab="数据库配置" key="database">
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['database', 'type']}
                    label="数据库类型"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="选择数据库类型">
                      {databaseTypeOptions.map(option => (
                        <Select.Option key={option.value} value={option.value}>
                          {option.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['database', 'host']}
                    label="主机地址"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="输入数据库主机地址" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name={['database', 'port']}
                    label="端口"
                    rules={[{ required: true, type: 'number' }]}
                  >
                    <Input type="number" placeholder="输入数据库端口" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name={['database', 'username']}
                    label="用户名"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="输入数据库用户名" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name={['database', 'password']}
                    label="密码"
                  >
                    <Input.Password placeholder="输入数据库密码" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name={['database', 'database']}
                label="数据库名称"
                rules={[{ required: true }]}
              >
                <Input placeholder="输入数据库名称" />
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default Settings;