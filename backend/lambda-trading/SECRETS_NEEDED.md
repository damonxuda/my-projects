# GitHub Secrets 配置清单

## 需要配置的Secrets

访问：https://github.com/damonxuda/my-projects/settings/secrets/actions

---

## 1. Gemini API密钥

| Secret名称 | 值 | 状态 |
|-----------|-----|------|
| `GEMINI_API_KEY` | `AIzaSyBQ9_zDUreNKYY9Lixxq3cW1J0AFWObsXU` | ✅ 已配置 |

---

## 2. Supabase配置（Lambda用）

### 获取SERVICE_ROLE_KEY

1. 访问：https://supabase.com/dashboard/project/qeedsnqbudbogqpcerqb/settings/api
2. 找到"Project API keys"部分
3. 复制 **service_role** key（⚠️ 不是anon/public key）

### 需要添加的Secrets

| Secret名称 | 值 | 获取方式 | 状态 |
|-----------|-----|---------|------|
| `SUPABASE_URL` | `https://qeedsnqbudbogqpcerqb.supabase.co` | Supabase Dashboard | ❓ 待确认 |
| `SUPABASE_SERVICE_ROLE_KEY` | (从Supabase获取) | Supabase Dashboard → Settings → API → service_role key | ❓ 待确认 |

**⚠️ 重要**：
- `SUPABASE_SERVICE_ROLE_KEY` ≠ `REACT_APP_SUPABASE_ANON_KEY`
- SERVICE_ROLE_KEY 有完全权限，必须保密
- ANON_KEY 只有前端用，受RLS保护

---

## 3. AWS权限配置

### 当前状态

| Secret名称 | 用途 | 状态 |
|-----------|-----|------|
| `AWS_ACCESS_KEY_ID` | S3部署 | ✅ 已配置 |
| `AWS_SECRET_ACCESS_KEY` | S3部署 | ✅ 已配置 |
| `AWS_REGION` | AWS区域 | ✅ 已配置（ap-northeast-1） |

### 问题

现有IAM用户 `github-actions-s3` 缺少Lambda权限。

### 解决方案

参考：[FIX_PERMISSIONS.md](./FIX_PERMISSIONS.md)

推荐：给 `github-actions-s3` 用户添加Lambda权限策略。

---

## 4. 其他Supabase Secrets（已配置，用于其他服务）

| Secret名称 | 用途 | 状态 |
|-----------|-----|------|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI部署Edge Functions | ✅ 已配置 |
| `SUPABASE_PROJECT_REF` | Supabase项目ID | ✅ 已配置 |
| `REACT_APP_SUPABASE_URL` | 前端React应用 | ✅ 已配置 |
| `REACT_APP_SUPABASE_ANON_KEY` | 前端React应用（公开密钥） | ✅ 已配置 |

---

## 配置步骤总结

### [ ] 步骤1：配置Supabase SERVICE_ROLE_KEY

1. 访问 Supabase Dashboard
2. Settings → API → service_role key
3. 复制密钥
4. 添加到GitHub Secrets：
   - 名称：`SUPABASE_SERVICE_ROLE_KEY`
   - 值：（粘贴密钥）

### [ ] 步骤2：配置SUPABASE_URL（如果不存在）

1. 添加到GitHub Secrets：
   - 名称：`SUPABASE_URL`
   - 值：`https://qeedsnqbudbogqpcerqb.supabase.co`

### [ ] 步骤3：修复AWS Lambda权限

参考 [FIX_PERMISSIONS.md](./FIX_PERMISSIONS.md)

### [ ] 步骤4：重新运行GitHub Actions

访问：https://github.com/damonxuda/my-projects/actions

点击失败的workflow → "Re-run all jobs"

---

## 验证

配置完成后，所有secrets应该显示：

```
✅ GEMINI_API_KEY
✅ SUPABASE_URL
✅ SUPABASE_SERVICE_ROLE_KEY
✅ AWS_ACCESS_KEY_ID (已有Lambda权限)
✅ AWS_SECRET_ACCESS_KEY
✅ AWS_REGION
```

然后Lambda部署应该成功！
