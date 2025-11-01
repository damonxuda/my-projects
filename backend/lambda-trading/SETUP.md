# LLM Trading Lambda 设置指南

## 概述

这个Lambda函数会每小时调用Gemini API做出交易决策，并将结果保存到Supabase数据库。

## 前置条件

✅ Supabase数据库表已创建（llm_trading_decisions, llm_trading_portfolios）
✅ Gemini API密钥已获取：`AIzaSyBQ9_zDUreNKYY9Lixxq3cW1J0AFWObsXU`
✅ Supabase URL和Service Role Key可用

---

## 方案A：自动部署（推荐）

### 1. 配置GitHub Secrets

访问：https://github.com/damonxuda/my-projects/settings/secrets/actions

添加以下secret（如果还没有的话）：

| Secret名称 | 值 |
|-----------|-----|
| `GEMINI_API_KEY` | `AIzaSyBQ9_zDUreNKYY9Lixxq3cW1J0AFWObsXU` |
| `SUPABASE_URL` | `https://qeedsnqbudbogqpcerqb.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (从Supabase获取) |

### 2. 手动运行设置脚本（一次性）

在本地运行以下命令创建Lambda函数和CloudWatch Events：

```bash
cd backend/lambda-trading

# 设置环境变量（临时）
export GEMINI_API_KEY="AIzaSyBQ9_zDUreNKYY9Lixxq3cW1J0AFWObsXU"
export SUPABASE_URL="https://qeedsnqbudbogqpcerqb.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"

# 运行设置脚本
chmod +x setup-aws.sh
./setup-aws.sh
```

**如果提示需要IAM角色ARN**，使用现有的Lambda执行角色，或者在AWS Console中查看其他Lambda函数使用的角色。

### 3. 后续自动部署

设置完成后，每次推送代码到`backend/lambda-trading/`，GitHub Actions会自动部署：

```bash
git add backend/lambda-trading/
git commit -m "Update trading lambda"
git push
```

---

## 方案B：手动部署

### 1. 创建Lambda Layer

```bash
cd backend/lambda-trading

# 安装依赖
mkdir -p layer/nodejs
cd layer/nodejs
npm init -y
npm install @supabase/supabase-js@^2.39.0
cd ..

# 打包
zip -r trading-dependencies-layer.zip nodejs/

# 上传到AWS
aws lambda publish-layer-version \
  --layer-name trading-dependencies \
  --description "Dependencies for LLM Trading Lambda" \
  --zip-file fileb://trading-dependencies-layer.zip \
  --compatible-runtimes nodejs20.x \
  --region ap-northeast-1

# 记住返回的 LayerVersionArn
```

### 2. 创建Lambda函数

在AWS Console:
1. 访问 Lambda → Create function
2. 配置:
   - 函数名: `TRADING_LAMBDA`
   - Runtime: Node.js 20.x
   - 架构: x86_64
   - 执行角色: 使用现有角色（选择有基本Lambda执行权限的角色）

3. 上传代码:
   - 压缩 `index.mjs` 为 `function.zip`
   - 上传到Lambda

4. 添加Layer:
   - 点击"Add a layer"
   - 选择之前创建的 `trading-dependencies` layer

5. 配置环境变量:
   - `GEMINI_API_KEY`: `AIzaSyBQ9_zDUreNKYY9Lixxq3cW1J0AFWObsXU`
   - `SUPABASE_URL`: `https://qeedsnqbudbogqpcerqb.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: (你的密钥)

6. 调整配置:
   - Timeout: 60秒
   - Memory: 256MB

### 3. 配置CloudWatch Events

在AWS Console:
1. 访问 EventBridge → Rules → Create rule
2. 配置:
   - 名称: `trading-lambda-hourly`
   - Rule type: Schedule
   - Schedule pattern: `rate(1 hour)`
   - Target: Lambda function
   - Function: `TRADING_LAMBDA`

---

## 测试

### 手动触发测试

```bash
aws lambda invoke \
  --function-name TRADING_LAMBDA \
  --region ap-northeast-1 \
  response.json

cat response.json
```

### 查看日志

```bash
aws logs tail /aws/lambda/TRADING_LAMBDA --follow --region ap-northeast-1
```

### 查看Trading Dashboard

访问：https://damonxuda.site/trading/

应该能看到Gemini的交易决策和账户变化！

---

## 预期行为

✅ **每小时自动执行**：Lambda会在每小时整点（或接近整点）自动运行
✅ **调用Gemini API**：获取基于市场数据的交易决策
✅ **模拟交易**：更新虚拟账户（$10,000初始资金）
✅ **保存数据**：决策和账户状态保存到Supabase
✅ **Dashboard显示**：可在网页上看到实时数据

---

## 故障排除

### 问题1: Lambda执行失败
- 检查CloudWatch Logs查看错误详情
- 确认环境变量配置正确
- 确认Layer已正确添加

### 问题2: Gemini API调用失败
- 检查API密钥是否有效
- 查看Gemini API配额使用情况
- Lambda会降级返回"hold"决策

### 问题3: Supabase写入失败
- 确认SUPABASE_SERVICE_ROLE_KEY正确
- 检查表是否存在
- 检查RLS策略是否允许service_role写入

---

## 费用说明

### 免费额度
- **Gemini API**: 免费（有每日请求限制）
- **AWS Lambda**: 每月100万次请求免费
- **CloudWatch Events**: 免费
- **Supabase**: 免费套餐足够

### 预计成本
每小时1次 × 24小时 × 30天 = **720次/月**

完全在AWS Lambda免费额度内，**预计费用: $0**

---

## 下一步

- [ ] 配置GitHub Secrets
- [ ] 运行setup-aws.sh脚本
- [ ] 测试Lambda函数
- [ ] 查看Trading Dashboard
- [ ] （可选）添加GPT-4和Claude agents
