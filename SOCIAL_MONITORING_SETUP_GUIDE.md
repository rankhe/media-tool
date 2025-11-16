# 社交媒体监控模块 - API配置指南

## 概述

社交媒体监控模块已成功实现，支持微博和X(Twitter)平台的用户动态监控。以下是API配置指南。

## 已完成功能

✅ **微博平台监控**
- 用户动态监控
- 帖子检测和存储
- Webhook通知

✅ **X(Twitter)平台监控**
- 用户动态监控
- 推文检测和存储
- Webhook通知

✅ **通用功能**
- 用户管理界面
- Webhook配置
- 定时任务调度
- 跨域和限流处理

## API配置步骤

### 1. 微博API配置

#### 获取微博API凭证
1. 访问 [微博开放平台](https://open.weibo.com/)
2. 注册开发者账号
3. 创建应用获取以下凭证：
   - App Key
   - App Secret
   - Access Token

#### 配置微博API
更新数据库中的微博平台配置：

```sql
UPDATE social_monitoring_platforms 
SET 
    api_key = '你的微博App_Key',
    api_secret = '你的微博App_Secret',
    access_token = '你的微博Access_Token',
    is_active = true,
    updated_at = NOW()
WHERE platform_name = 'weibo';
```

### 2. X(Twitter) API配置

#### 获取Twitter API凭证
1. 访问 [Twitter Developer Portal](https://developer.twitter.com/)
2. 注册开发者账号
3. 创建应用获取以下凭证：
   - Bearer Token
   - API Key
   - API Secret
   - Access Token
   - Access Token Secret

#### 配置Twitter API
更新数据库中的Twitter平台配置：

```sql
UPDATE social_monitoring_platforms 
SET 
    api_key = '你的Twitter_API_Key',
    api_secret = '你的Twitter_API_Secret',
    access_token = '你的Twitter_Bearer_Token',
    refresh_token = '你的Twitter_Access_Token',
    is_active = true,
    updated_at = NOW()
WHERE platform_name = 'x_twitter';
```

### 3. Webhook配置

#### 飞书Webhook
1. 在飞书群聊中添加自定义机器人
2. 获取Webhook URL
3. 在系统中创建Webhook配置：
   - 类型: 飞书
   - URL: 你的飞书Webhook URL
   - 事件: 新帖子检测

#### 企业微信Webhook
1. 在企业微信群聊中添加机器人
2. 获取Webhook URL
3. 在系统中创建Webhook配置：
   - 类型: 企业微信
   - URL: 你的企业微信Webhook URL
   - 事件: 新帖子检测

## 使用方法

### 1. 添加监控用户
1. 访问社交监控页面
2. 点击"添加用户"按钮
3. 选择平台（微博或X）
4. 输入用户ID
5. 设置检查频率
6. 保存配置

### 2. 配置Webhook
1. 点击"Webhook配置"标签
2. 点击"创建Webhook"按钮
3. 选择平台类型
4. 输入Webhook URL
5. 测试连接
6. 保存配置

### 3. 监控状态
- 绿色: 正常监控中
- 橙色: 暂停监控
- 红色: 监控异常

## API端点测试

### 测试微博用户查询
```bash
curl -X GET "http://localhost:3001/api/monitoring/users/lookup/weibo/用户ID" \
  -H "Authorization: Bearer 你的JWT令牌"
```

### 测试Twitter用户查询
```bash
curl -X GET "http://localhost:3001/api/monitoring/users/lookup/x_twitter/用户ID" \
  -H "Authorization: Bearer 你的JWT令牌"
```

## 注意事项

1. **API限流**: 各平台都有API调用限制，请合理设置检查频率
2. **Token有效期**: Access Token可能会过期，需要定期更新
3. **错误处理**: 系统会自动处理API错误并重试
4. **数据存储**: 监控数据会存储在本地PostgreSQL数据库中

## 故障排除

### 常见问题

1. **403错误**: 检查API凭证是否正确配置
2. **429错误**: API限流，降低检查频率
3. **跨域错误**: 已配置CORS，如仍有问题检查前端配置
4. **数据库连接错误**: 检查PostgreSQL服务是否运行

### 日志查看
查看API日志获取详细信息：
```bash
tail -f api/logs/app.log
```

## 后续扩展

系统已预留接口，可轻松添加更多社交平台：
- 抖音
- 快手
- 小红书
- Instagram
- Facebook

只需在数据库中添加平台配置并实现相应的API接口即可。