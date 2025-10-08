# Claude Code 重要提醒

## ⚠️ 部署规则（必读！）

### ❌ 禁止操作

1. **禁止在本地运行 `npm run build`**
   - 本地build会缺少GitHub Secrets中的环境变量
   - 会导致功能异常（例如：isAdmin失效，Movies文件夹不可见）

2. **禁止使用本地 .env 文件部署**
   - 本地 `.env` 仅用于开发调试
   - 生产环境变量必须在GitHub Secrets中配置

3. **禁止手动 `aws s3 sync` 部署前端**
   - 会覆盖正确的GitHub Actions部署
   - 导致环境变量丢失

### ✅ 正确的部署流程

1. **修改代码后**：
   ```bash
   git add .
   git commit -m "描述"
   git push origin main
   ```

2. **等待GitHub Actions自动部署**
   - 查看部署状态：https://github.com/damonxuda/my-projects/actions
   - GitHub Actions会自动：
     - 安装依赖
     - 注入GitHub Secrets环境变量
     - 构建
     - 部署到S3
     - 清除CDN缓存

3. **如果需要手动触发部署**：
   ```bash
   # 在需要部署的目录创建一个临时文件触发变更检测
   touch videos/.trigger
   git add videos/.trigger
   git commit -m "chore: 触发部署"
   git push origin main
   ```

### 📋 环境变量配置位置

- **开发环境**：`videos/.env`（git已忽略，仅本地有效）
- **生产环境**：GitHub仓库 Settings → Secrets and variables → Actions
- **部署配置**：`.github/workflows/deploy.yml`

### 🔑 重要的GitHub Secrets

前端需要的环境变量（已在deploy.yml配置）：
- `REACT_APP_ADMIN_EMAILS`
- `REACT_APP_CLERK_PUBLISHABLE_KEY`
- `REACT_APP_FILE_MANAGEMENT_API_URL`
- `REACT_APP_VIDEO_PLAYER_API_URL`
- `REACT_APP_THUMBNAIL_GENERATOR_API_URL`
- `REACT_APP_FORMAT_CONVERTER_API_URL`
- `REACT_APP_YOUTUBE_MANAGER_API_URL`
- `REACT_APP_SUBTITLE_API_URL`
- `REACT_APP_USER_MANAGEMENT_API_URL`

后端Lambda部署：
- 通过 `.github/workflows/deploy-lambda.yml` 自动部署
- 环境变量在Lambda函数配置中设置

### 🚨 常见错误案例

**案例1：本地build导致Movies文件夹不可见**
- 原因：本地build时`REACT_APP_ADMIN_EMAILS`未定义
- 结果：`isAdmin`返回false，Movies被隐藏
- 解决：通过git push触发GitHub Actions重新部署

**案例2：重复下载字幕到本地翻译**
- 错误：下载字幕到本地，用本地脚本翻译
- 正确：直接在AWS Lambda上处理，使用S3事件触发

### 📝 开发工作流

1. **本地开发**：
   ```bash
   cd videos
   npm install
   npm start  # 本地开发服务器，使用 .env 文件
   ```

2. **测试**：
   - 在本地开发服务器测试功能
   - 不要运行 `npm run build`

3. **部署**：
   - commit并push到GitHub
   - 让GitHub Actions处理build和部署

### 🎯 记住这一条

**如果你想部署任何前端改动：只需要 `git push`，其他什么都不要做！**
