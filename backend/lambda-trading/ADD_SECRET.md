# ⚠️ 需要添加GitHub Secret: SUPABASE_SERVICE_ROLE_KEY

## 问题

Lambda部署失败，因为缺少 `SUPABASE_SERVICE_ROLE_KEY`

当前错误：
```
Variables={GEMINI_API_KEY=***,SUPABASE_URL=,SUPABASE_SERVICE_ROLE_KEY=}
```

## 为什么需要SERVICE_ROLE_KEY而不是ANON_KEY？

| 密钥类型 | 用途 | 权限 | 是否公开 |
|---------|------|------|---------|
| **ANON_KEY** | 前端React应用 | 受RLS限制 | ✅ 可以公开 |
| **SERVICE_ROLE_KEY** | 后端Lambda/Edge Functions | 完全权限，绕过RLS | ❌ 必须保密 |

Lambda需要写入数据库，必须使用SERVICE_ROLE_KEY。

---

## 如何获取SERVICE_ROLE_KEY

### 步骤1：访问Supabase Dashboard

https://supabase.com/dashboard/project/qeedsnqbudbogqpcerqb/settings/api

### 步骤2：找到service_role密钥

在"Project API keys"部分，找到：

```
service_role
secret
[显示按钮] ●●●●●●●●●●●●●●
```

点击**"显示"**按钮（眼睛图标），复制整个密钥。

⚠️ **注意**：这不是`anon`/`public`密钥！

### 步骤3：添加到GitHub Secrets

1. 访问：https://github.com/damonxuda/my-projects/settings/secrets/actions
2. 点击 **"New repository secret"**
3. 填写：
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Secret**: (粘贴从步骤2复制的service_role密钥)
4. 点击 **"Add secret"**

---

## 验证

添加Secret后，重新运行失败的workflow：

https://github.com/damonxuda/my-projects/actions

应该看到：
```
✅ TRADING_LAMBDA deployed successfully!
```

---

## 当前GitHub Secrets清单

| Secret名称 | 值来源 | 状态 |
|-----------|-------|------|
| `GEMINI_API_KEY` | Google AI Studio | ✅ 已配置 |
| `REACT_APP_SUPABASE_URL` | Supabase Dashboard | ✅ 已配置 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → service_role key | ❌ **需要添加** |
