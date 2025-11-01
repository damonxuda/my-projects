# 修复Lambda部署权限问题

## 问题

GitHub Actions部署失败，错误信息：
```
User: arn:aws:iam::730335478220:user/github-actions-s3 is not authorized to perform: lambda:UpdateFunctionCode
```

## 原因

`github-actions-s3` IAM用户只有S3权限，缺少Lambda操作权限。

---

## 解决方案A：给现有用户添加Lambda权限（推荐）

### 步骤1：登录AWS Console

访问：https://console.aws.amazon.com/iam/

### 步骤2：找到IAM用户

1. 左侧菜单：Users
2. 搜索：`github-actions-s3`
3. 点击用户名进入详情页

### 步骤3：添加Lambda策略

#### 方法1：使用自定义策略（最小权限）

1. 点击"Add permissions" → "Attach policies directly"
2. 点击"Create policy"
3. 切换到"JSON"标签
4. 粘贴以下策略内容：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LambdaDeploymentPermissions",
      "Effect": "Allow",
      "Action": [
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration"
      ],
      "Resource": "arn:aws:lambda:ap-northeast-1:730335478220:function:TRADING_LAMBDA"
    }
  ]
}
```

5. 点击"Next"
6. 策略名称：`TradingLambdaDeploymentPolicy`
7. 点击"Create policy"
8. 回到用户页面，刷新策略列表
9. 搜索并选中 `TradingLambdaDeploymentPolicy`
10. 点击"Add permissions"

#### 方法2：使用AWS托管策略（更简单但权限更大）

1. 点击"Add permissions" → "Attach policies directly"
2. 搜索并选择：`AWSLambda_FullAccess`
3. 点击"Add permissions"

⚠️ 注意：方法2给予了所有Lambda的完全权限，方法1更安全。

### 步骤4：验证

重新运行GitHub Actions workflow：
https://github.com/damonxuda/my-projects/actions

---

## 解决方案B：创建Lambda专用IAM用户

如果不想修改现有的`github-actions-s3`用户，可以创建新用户。

### 步骤1：创建新IAM用户

1. IAM Console → Users → Create user
2. 用户名：`github-actions-lambda`
3. 不要选择"Provide user access to the AWS Management Console"
4. 点击"Next"

### 步骤2：附加策略

选择"Attach policies directly"，添加：
- `AWSLambda_FullAccess`（或使用上面的自定义策略）
- 点击"Create user"

### 步骤3：创建Access Key

1. 点击新创建的用户
2. "Security credentials"标签
3. "Create access key"
4. 选择"Application running outside AWS"
5. 复制 Access Key ID 和 Secret Access Key

### 步骤4：更新GitHub Secrets

访问：https://github.com/damonxuda/my-projects/settings/secrets/actions

**选项A：替换现有secrets**（会影响S3部署）
- 更新 `AWS_ACCESS_KEY_ID`
- 更新 `AWS_SECRET_ACCESS_KEY`

**选项B：创建Lambda专用secrets**（推荐）
- 新建 `AWS_LAMBDA_ACCESS_KEY_ID`
- 新建 `AWS_LAMBDA_SECRET_ACCESS_KEY`
- 修改 `.github/workflows/deploy-lambda.yml` 中的 `deploy-trading` job，使用新的secrets

---

## 推荐方案

**我推荐使用解决方案A方法1**：

1. 最小权限原则
2. 不需要创建新用户
3. 不影响现有S3部署
4. 只需要几分钟

执行完后，重新运行失败的workflow即可！

---

## 验证部署成功

部署成功后，你应该看到：

```
✅ TRADING_LAMBDA deployed successfully!
```

然后可以测试Lambda：

```bash
aws lambda invoke \
  --function-name TRADING_LAMBDA \
  --region ap-northeast-1 \
  response.json

cat response.json
```
