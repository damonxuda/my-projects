# LLM Trading Observer - 部署指南

## 📋 目录结构

```
my-projects/
├── trading/                          # 前端 React 应用
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/
│   ├── lambda-trading/               # AWS Lambda 函数
│   │   ├── index.mjs
│   │   └── package.json
│   └── supabase/
│       ├── migrations/
│       │   └── 20250101000000_create_trading_tables.sql
│       └── functions/
│           └── trading-api/          # Supabase Edge Function
│               └── index.ts
└── .github/workflows/
    ├── deploy.yml                    # 需要更新
    ├── deploy-lambda.yml             # 需要更新
    └── deploy-supabase.yml           # 已包含
```

## 🔧 部署步骤

### 步骤 1: 初始化数据库

```bash
# 1. 登录 Supabase Dashboard
# 2. 进入 SQL Editor
# 3. 执行 backend/supabase/migrations/20250101000000_create_trading_tables.sql
```

### 步骤 2: 配置环境变量

在 GitHub Secrets 中添加以下变量：

```yaml
# Gemini API
GEMINI_API_KEY: "your_gemini_api_key"

# Supabase
SUPABASE_URL: "https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY: "your_service_role_key"
SUPABASE_ANON_KEY: "your_anon_key"
SUPABASE_ACCESS_TOKEN: "your_access_token"
SUPABASE_PROJECT_REF: "your_project_ref"

# Clerk
REACT_APP_CLERK_PUBLISHABLE_KEY: "已存在"
REACT_APP_ADMIN_EMAILS: "已存在"

# Trading API URL (部署 Edge Function 后获得)
REACT_APP_TRADING_API_URL: "https://your-project.supabase.co/functions/v1/trading-api"
```

### 步骤 3: 部署 Supabase Edge Function

Edge Function 会通过现有的 `deploy-supabase.yml` 自动部署。

确保在 Supabase Dashboard 中设置 Edge Function 的环境变量：

```bash
# 通过 Supabase CLI 设置
supabase secrets set ADMIN_EMAILS='your_admin@example.com' --project-ref your_project_ref
```

### 步骤 4: 部署 AWS Lambda 函数

#### 4.1 安装依赖
```bash
cd backend/lambda-trading
npm install
```

#### 4.2 创建部署包
```bash
zip -r function.zip index.mjs node_modules/
```

#### 4.3 上传到 AWS Lambda

选项 A: 通过 AWS Console
1. 登录 AWS Lambda Console
2. 创建新函数：`llm-trading-decision`
3. Runtime: Node.js 18.x
4. 上传 function.zip
5. 配置环境变量（见下方）
6. 设置执行角色权限

选项 B: 通过 AWS CLI
```bash
# 创建 Lambda 函数
aws lambda create-function \
  --function-name llm-trading-decision \
  --runtime nodejs18.x \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --timeout 30 \
  --memory-size 256

# 配置环境变量
aws lambda update-function-configuration \
  --function-name llm-trading-decision \
  --environment Variables="{GEMINI_API_KEY=your_key,SUPABASE_URL=your_url,SUPABASE_SERVICE_ROLE_KEY=your_key}"
```

#### 4.4 Lambda 环境变量
```
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### 4.5 配置 CloudWatch Events (定时触发)
```bash
# 创建每小时触发的规则
aws events put-rule \
  --name llm-trading-hourly \
  --schedule-expression "cron(0 * * * ? *)"

# 授权 EventBridge 调用 Lambda
aws lambda add-permission \
  --function-name llm-trading-decision \
  --statement-id llm-trading-hourly \
  --action 'lambda:InvokeFunction' \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:REGION:ACCOUNT_ID:rule/llm-trading-hourly

# 添加 Lambda 作为目标
aws events put-targets \
  --rule llm-trading-hourly \
  --targets "Id"="1","Arn"="arn:aws:lambda:REGION:ACCOUNT_ID:function:llm-trading-decision"
```

### 步骤 5: 部署前端应用

#### 5.1 更新 `.github/workflows/deploy.yml`

在 `paths:` 中添加:
```yaml
paths:
  - 'quiz/**'
  - 'videos/**'
  - 'admin/**'
  - 'trading/**'  # ← 添加这一行
  - ...
```

在 `Detect changed projects` 步骤中添加:
```yaml
for project in schedule auth-clerk shared quiz videos admin trading; do  # ← 添加 trading
```

在依赖关系处理中添加:
```yaml
if [[ "$(cat $GITHUB_OUTPUT | grep -E 'auth_clerk_changed=true|shared_changed=true')" ]]; then
  echo "quiz_changed=true" >> $GITHUB_OUTPUT
  echo "videos_changed=true" >> $GITHUB_OUTPUT
  echo "admin_changed=true" >> $GITHUB_OUTPUT
  echo "trading_changed=true" >> $GITHUB_OUTPUT  # ← 添加这一行
```

添加完整的 Trading 部署步骤 (参考 admin 模块):
```yaml
# X. 构建并部署 Trading 项目
- name: Install Trading Dependencies
  if: steps.changes.outputs.trading_changed == 'true' || steps.changes.outputs.force_deploy == 'true'
  run: |
    echo "📦 Installing Trading dependencies..."
    if [ -d "./trading" ]; then
      cd trading && npm ci
      cd ../auth-clerk && npm ci
      echo "✅ Trading dependencies installed"
    else
      echo "⚠️ Trading directory not found"
    fi

- name: Build Trading Application
  if: steps.changes.outputs.trading_changed == 'true' || steps.changes.outputs.force_deploy == 'true'
  working-directory: ./trading
  env:
    CI: false
  run: |
    echo "🔧 Setting environment variables..."
    echo "REACT_APP_CLERK_PUBLISHABLE_KEY=${{ secrets.REACT_APP_CLERK_PUBLISHABLE_KEY }}" >> .env.production
    echo "REACT_APP_ADMIN_EMAILS=${{ secrets.REACT_APP_ADMIN_EMAILS }}" >> .env.production
    echo "REACT_APP_TRADING_API_URL=${{ secrets.REACT_APP_TRADING_API_URL }}" >> .env.production
    echo "GENERATE_SOURCEMAP=false" >> .env.production

    echo "🏗️ Building Trading React application..."
    npm run build

- name: Deploy Trading to S3
  if: steps.changes.outputs.trading_changed == 'true' || steps.changes.outputs.force_deploy == 'true'
  run: |
    echo "☁️ Deploying Trading to S3..."
    aws s3 rm s3://damonxuda-projects/trading/ --recursive
    aws s3 sync ./trading/build/ s3://damonxuda-projects/trading/ \
      --cache-control "no-cache, no-store, must-revalidate" \
      --exclude ".DS_Store"
    echo "✅ Trading deployed"
    echo "📁 Trading: https://damonxuda.site/trading/"
```

#### 5.2 更新主页链接 (可选)

在 `index.html` 中添加 Trading 入口(仅管理员可见)：

```html
<!-- 在主页添加，需要 JavaScript 动态显示 -->
<div id="admin-only-links" style="display:none;">
  <a href="/trading/">📊 Trading Observatory</a>
</div>

<script>
  // 检查是否为管理员
  const adminEmails = '${REACT_APP_ADMIN_EMAILS}'.split(',');
  // 从 Clerk 获取当前用户 email
  // 如果是管理员，显示链接
  if (isAdmin) {
    document.getElementById('admin-only-links').style.display = 'block';
  }
</script>
```

### 步骤 6: 验证部署

1. **数据库检查**:
   ```sql
   SELECT * FROM llm_trading_portfolios LIMIT 10;
   SELECT * FROM llm_trading_decisions LIMIT 10;
   ```

2. **Lambda 测试**:
   ```bash
   # 手动触发 Lambda
   aws lambda invoke \
     --function-name llm-trading-decision \
     --payload '{}' \
     response.json

   cat response.json
   ```

3. **Edge Function 测试**:
   ```bash
   curl -X GET \
     "https://your-project.supabase.co/functions/v1/trading-api/portfolios" \
     -H "clerk-token: YOUR_ADMIN_TOKEN"
   ```

4. **前端访问**:
   - 以管理员身份登录
   - 访问 `https://damonxuda.site/trading/`
   - 应该能看到 Dashboard

## 🔒 安全检查清单

- [ ] Supabase RLS 策略已启用
- [ ] Edge Function 验证管理员权限
- [ ] React App 检查 `isAdmin`
- [ ] Lambda 环境变量已加密
- [ ] API Keys 存储在 Secrets 中
- [ ] 主页不显示 Trading 链接（非管理员）

## 🐛 常见问题

### Q: Edge Function 返回 403
A: 检查 ADMIN_EMAILS 环境变量是否正确设置

### Q: Lambda 无法写入数据库
A: 检查 SUPABASE_SERVICE_ROLE_KEY 是否正确

### Q: 前端无法获取数据
A: 检查 REACT_APP_TRADING_API_URL 是否正确

### Q: Gemini API 调用失败
A: 检查 GEMINI_API_KEY 是否有效，是否有免费额度

## 📊 监控和维护

### CloudWatch Logs
```bash
# 查看 Lambda 日志
aws logs tail /aws/lambda/llm-trading-decision --follow
```

### Supabase Logs
- 进入 Supabase Dashboard
- Logs & Analytics
- 查看 Edge Function 和 Database 日志

### 数据清理 (可选)
```sql
-- 清理超过 30 天的历史数据
DELETE FROM llm_trading_decisions
WHERE created_at < NOW() - INTERVAL '30 days';

DELETE FROM llm_trading_portfolios
WHERE created_at < NOW() - INTERVAL '30 days';
```

## 🚀 下一步优化

1. **添加更多 LLM**:
   - 在 Lambda 中添加 GPT-4, Claude 的调用
   - 更新 Edge Function 返回多个 agent 数据

2. **高级功能**:
   - 邮件通知（盈亏达到阈值）
   - Slack 集成
   - 性能分析报告

3. **成本优化**:
   - 调整 Lambda 执行频率
   - 使用市场数据缓存
   - 优化 Gemini API 调用（减少 token）

---

**完成部署后，系统将每小时自动运行，无需人工干预！** 🎉
