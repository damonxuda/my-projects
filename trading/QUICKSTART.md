# 🚀 快速启动指南

最快5分钟看到效果！

## Step 1: 获取 Gemini API Key (2分钟)

1. 访问 https://makersuite.google.com/app/apikey
2. 登录你的 Google 账户
3. 点击 "Create API Key"
4. 复制 API Key

## Step 2: 配置环境变量 (1分钟)

```bash
# 前端
cd my-projects/trading
cp .env.example .env.local

# 编辑 .env.local
REACT_APP_CLERK_PUBLISHABLE_KEY=你的clerk_key
REACT_APP_ADMIN_EMAILS=你的邮箱
REACT_APP_TRADING_API_URL=https://xxx.supabase.co/functions/v1/trading-api
```

## Step 3: 初始化数据库 (1分钟)

1. 登录 Supabase Dashboard
2. 打开 SQL Editor
3. 复制粘贴 `backend/supabase/migrations/20250101000000_create_trading_tables.sql`
4. 点击 Run

## Step 4: 启动本地开发 (30秒)

```bash
cd my-projects/trading
npm install
npm start
```

访问 http://localhost:3000

## Step 5: 手动触发一次交易 (可选)

如果想立即看到数据（不等Lambda定时执行）：

```bash
cd backend/lambda-trading
npm install

# 创建 .env 文件
cp .env.example .env
# 填入你的 API keys

# 本地测试运行
node index.mjs
```

查看 Supabase Dashboard，应该能看到新增的数据。

刷新前端，就能看到交易决策了！

---

## 🎯 期望看到的结果

### Dashboard 应该显示

1. ✅ Agent Card (Gemini)
   - 总资产约 $10,000
   - 盈亏 $0 或有小幅波动

2. ✅ 决策时间线
   - 显示 Gemini 的最新决策
   - 买入/卖出/持有
   - 决策理由

3. ✅ 性能图表
   - 显示收益率条形图

### 如果看不到数据

1. 检查浏览器 Console
2. 检查 Supabase 数据库是否有数据
3. 检查 Edge Function 是否部署成功
4. 查看 [故障排除](./README.md#-故障排除)

---

**🎉 完成！现在你有了一个属于自己的 LLM 交易观察系统！**
