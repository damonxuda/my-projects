# EventBridge 定时触发配置

## 重要说明
⚠️ **只允许有一个EventBridge规则用于触发TRADING_LAMBDA**

## 当前配置

### 规则信息
- **规则名称**: `trading-lambda-hourly-trigger`
- **触发时间**: 每小时第10分钟 (`cron(10 * * * ? *)`)
- **目标函数**: `TRADING_LAMBDA`
- **状态**: ENABLED
- **区域**: ap-northeast-1

## 修改定时触发时间

### ✅ 正确做法
如果需要修改触发时间，**必须更新现有规则**，不要创建新规则：

```bash
# 更新现有规则的触发时间（例如改为每小时第15分钟）
aws events put-rule \
  --name trading-lambda-hourly-trigger \
  --schedule-expression "cron(15 * * * ? *)" \
  --state ENABLED \
  --region ap-northeast-1
```

### ❌ 错误做法
**不要创建新的EventBridge规则！** 这会导致重复触发。

错误示例：
```bash
# ❌ 不要这样做！会创建重复的触发器
aws events put-rule --name trading-lambda-hourly-NEW ...
aws events put-rule --name trading-lambda-schedule ...
```

## 验证配置

### 检查当前所有规则
```bash
aws events list-rules --region ap-northeast-1
```

**预期结果**: 应该只有一个规则 `trading-lambda-hourly-trigger`

### 检查规则目标
```bash
aws events list-targets-by-rule \
  --rule trading-lambda-hourly-trigger \
  --region ap-northeast-1
```

## 清理多余规则

如果发现有多余的规则，按以下步骤清理：

```bash
# 1. 移除目标
aws events remove-targets \
  --rule <规则名称> \
  --ids "1" \
  --region ap-northeast-1

# 2. 删除规则
aws events delete-rule \
  --name <规则名称> \
  --region ap-northeast-1
```

## 历史问题记录

### 2025年问题
曾经出现过多个EventBridge规则同时存在的问题：
- `trading-lambda-hourly` (触发时间 :45)
- `trading-lambda-hourly-schedule` (触发时间 :25)
- `trading-lambda-hourly-trigger` (触发时间 :10)

这导致Lambda在不同时间点被重复触发，造成混乱。

**解决方案**: 删除了除 `trading-lambda-hourly-trigger` 之外的所有规则。

## 常见的Cron表达式

```
cron(10 * * * ? *)  # 每小时第10分钟
cron(0 * * * ? *)   # 每小时第0分钟（整点）
cron(30 * * * ? *)  # 每小时第30分钟
cron(0 0 * * ? *)   # 每天0点0分
```

注意：EventBridge使用UTC时间，需要考虑时区转换。
