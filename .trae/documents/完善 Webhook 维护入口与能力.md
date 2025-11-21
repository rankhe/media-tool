## 问题定位
- 当前页面仅支持新增 Webhook 与测试，缺少“编辑/启用禁用/删除/筛选分页”等维护入口。
- 后端路由仅存在 `GET /monitoring/webhooks`、`POST /monitoring/webhooks` 与 `POST /monitoring/webhooks/:id/test`，没有更新/删除端点；前端的“编辑”按钮未真正调用更新接口。

## 后端改造
### 路由与能力扩展（api/routes/monitoring.ts）
1. `PUT /monitoring/webhooks/:id`：更新 `webhook_name/webhook_type/webhook_url/webhook_secret/message_template/is_active`
2. `DELETE /monitoring/webhooks/:id`：删除指定 Webhook（校验 `req.user.id` 所属）
3. `POST /monitoring/webhooks/:id/toggle`：切换 `is_active` 状态（启用/禁用）
4. `GET /monitoring/webhooks` 增强：支持 `q`（名称搜索）、`type`、`active`、`limit/page` 分页
5. 输入校验与权限校验：使用 `express-validator` 与数据库所有权校验；避免将 `webhook_secret` 回显到日志

## 前端改造
### Service 层（src/services/monitoringService.ts）
1. 新增：`updateWebhookConfig(id, payload)`、`deleteWebhookConfig(id)`、`toggleWebhook(id, isActive)`
2. 为 `getWebhookConfigs` 增加查询参数支持：`q/type/active/limit/page`

### 页面（src/pages/SocialMonitoring.tsx → Webhook Configurations 标签页）
1. 维护入口：
   - “编辑”弹窗完整表单，保存时调用 `updateWebhookConfig`
   - “启用/禁用”开关（Switch），调用 `toggleWebhook`
   - “删除”按钮（Popconfirm），调用 `deleteWebhookConfig`
   - “测试”按钮保留现状
2. 维护工具：
   - 顶部筛选条（搜索名称、类型选择、状态选择）与刷新按钮
   - 分页（pageSize 可选、切换页时自动加载）
3. 数据展示：
   - 保留成功率与最近发送时间
   - 若有 `last_error_message` 字段，新增“查看详情”抽屉展示最近错误信息
4. 交互与校验：
   - 前端隐藏 `webhook_secret` 文本，不在列表中直接显示；仅在编辑表单中输入
   - 所有操作成功后刷新列表并提示

## 安全与合规
- 后端日志不打印 `webhook_secret`
- 前端不缓存 `webhook_secret`，仅在编辑表单中使用
- 权限校验：仅允许当前用户维护自己创建的 Webhook

## 验证与回归
1. 新增 Webhook → 编辑 URL/模板 → 启用/禁用 → 测试 → 删除，流程均可用
2. 搜索与筛选能够正确过滤列表；分页正常滚动
3. 回归社交监控其它功能（帖子拉取/统计）不受影响

## 交付
- 完成后端路由与前端交互的全链路改造
- 提供使用说明：如何编辑、启用禁用、删除与筛选
- 保持现有数据结构与 UI 风格一致