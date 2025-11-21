## 当前状态
- 是的，目前尚未设置 `PUPPETEER_EXECUTABLE_PATH` 环境变量。
- 后端已支持 `puppeteer` / `puppeteer-core` 双模式；当使用 `puppeteer-core` 时必须指定本机 Chrome 可执行路径。

## 目标
- 为当前环境配置 `PUPPETEER_EXECUTABLE_PATH`，指向本机 Chrome。
- 重启服务并验证“自动投稿到知乎”功能（文本+图片）。

## 配置步骤
1. 查找本机 Chrome 路径（常见路径）：
   - `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
   - `C:\Users\<你的用户名>\AppData\Local\Google\Chrome\Application\chrome.exe`
2. 设置临时环境变量（当前终端生效）：
   - PowerShell：`$env:PUPPETEER_EXECUTABLE_PATH = "<Chrome路径>"`
3. 设置持久环境变量（系统范围）：
   - PowerShell：`setx PUPPETEER_EXECUTABLE_PATH "<Chrome路径>"`
4. 可选：在后端环境文件中加入（仅在服务器环境使用，避免提交到仓库）：
   - `api/.env`：`PUPPETEER_EXECUTABLE_PATH=<Chrome路径>`
   - 注：请勿将真实路径与登录 Cookie 提交到 Git 仓库。

## 登录态配置
- 二选一设置知乎登录态，用于自动化提交：
  - `ZHIHU_COOKIES_JSON`: 指向导出的 Cookie JSON 文件路径
  - 或 `ZHIHU_COOKIE_STRING`: `name=value; name2=value2` 格式 Cookie 字符串

## 重启与验证
1. 重启后端与前端开发服务。
2. 前端“Monitored Posts”→ 点击某条帖子的“发送到知乎”→ 选择类型后点击“自动投稿到知乎”。
3. 期望结果：后端自动打开知乎页面、填充文本、尝试上传图片；返回成功并提示已提交。

## 回退与兼容
- 若自动化受页面结构变化影响：使用“复制并前往发布”按钮，系统会复制文本与媒体链接，并打开知乎创作入口以手动粘贴发布。

## 安全注意
- 登录 Cookie 只能在运行环境中配置，不要提交到仓库。
- 若需服务器部署，请将上述环境变量通过操作系统或服务管理器（如 PM2、systemd）注入。