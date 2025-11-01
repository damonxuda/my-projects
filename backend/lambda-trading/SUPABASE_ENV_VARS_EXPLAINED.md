# Supabase 环境变量完整梳理

## 📋 四个环境变量的完整说明

### 1️⃣ REACT_APP_SUPABASE_URL

**用途**: 前端React应用（浏览器环境）
**值**: `https://qeedsnqbudbogqpcerqb.supabase.co`
**状态**: ✅ 已配置在GitHub Secrets

**使用位置**:
- Games（所有游戏页面）
- Quiz（题库系统）
- Schedule（课程表）
- Backend/supabase/client.js（前端通用客户端）

**示例代码**:
```javascript
// quiz/src/services/DatabaseService.js:27
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
```

**部署时**: 在GitHub Actions中通过环境变量注入到前端build

---

### 2️⃣ REACT_APP_SUPABASE_ANON_KEY

**用途**: 前端React应用的匿名密钥（公开密钥，受RLS保护）
**值**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`（在代码中已硬编码）
**状态**: ✅ 已配置在GitHub Secrets
**安全性**: ✅ 可以公开，受Row Level Security (RLS) 保护

**使用位置**: 与REACT_APP_SUPABASE_URL相同的所有前端代码

**重要说明**:
- ⚠️ **不是SERVICE_ROLE_KEY**
- ✅ 只有前端用，权限受限
- ✅ 可以直接写在HTML中（已经这么做了）

---

### 3️⃣ SUPABASE_ACCESS_TOKEN

**用途**: **Supabase CLI认证token**（用于GitHub Actions部署Edge Functions）
**值**: 从Supabase Dashboard生成的Personal Access Token
**状态**: ✅ 已配置在GitHub Secrets

**使用位置**:
**仅用于CI/CD**，不在代码中使用！

```yaml
# .github/workflows/deploy-supabase.yml:34
env:
  SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
run: |
  supabase functions deploy "trading-api" --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
```

**如何获取**:
1. 访问 https://supabase.com/dashboard/account/tokens
2. 生成Personal Access Token
3. 添加到GitHub Secrets

**作用**: 让GitHub Actions有权限部署Edge Functions到你的Supabase项目

---

### 4️⃣ SUPABASE_PROJECT_REF

**用途**: Supabase项目ID（用于CLI指定部署目标）
**值**: `qeedsnqbudbogqpcerqb`（从URL中提取）
**状态**: ✅ 已配置在GitHub Secrets

**使用位置**:
**仅用于CI/CD**，不在代码中使用！

```yaml
# .github/workflows/deploy-supabase.yml:45
supabase functions deploy "$func_name" --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
```

**如何获取**:
从Supabase URL中提取：
```
https://qeedsnqbudbogqpcerqb.supabase.co
         ^^^^^^^^^^^^^^^^^^^
         这就是PROJECT_REF
```

**作用**: 告诉Supabase CLI要部署到哪个项目

---

## 🔑 还缺少的环境变量：SUPABASE_SERVICE_ROLE_KEY

### 为什么需要它？

| 环境 | 使用的密钥 | 权限级别 |
|------|----------|---------|
| **前端** (浏览器) | ANON_KEY | 受RLS限制，安全 |
| **Edge Functions** (Supabase) | 自动注入SERVICE_ROLE_KEY | 完全权限 |
| **Lambda** (AWS) | ❌ **缺失！** | 需要手动配置 |

### 区别对比

| 密钥类型 | 用途 | 权限 | 是否公开 | 在哪里 |
|---------|------|------|---------|--------|
| **ANON_KEY** | 前端浏览器 | 受RLS保护 | ✅ 可公开 | GitHub Secrets: `REACT_APP_SUPABASE_ANON_KEY` |
| **SERVICE_ROLE_KEY** | 后端服务 | 完全权限 | ❌ 必须保密 | GitHub Secrets: **需要添加** |

### 如何获取SERVICE_ROLE_KEY

1. 访问 https://supabase.com/dashboard/project/qeedsnqbudbogqpcerqb/settings/api
2. 找到"Project API keys"部分
3. 找到 **service_role** 密钥（⚠️ 不是anon密钥）
4. 点击"显示"并复制
5. 添加到GitHub Secrets:
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: (粘贴密钥)

---

## 📊 环境变量使用矩阵

| 环境变量 | 前端代码 | Edge Functions | GitHub Actions | Lambda |
|---------|---------|---------------|----------------|--------|
| `REACT_APP_SUPABASE_URL` | ✅ | ❌ | ✅ (构建时注入) | ❌ |
| `REACT_APP_SUPABASE_ANON_KEY` | ✅ | ❌ | ✅ (构建时注入) | ❌ |
| `SUPABASE_ACCESS_TOKEN` | ❌ | ❌ | ✅ (CLI认证) | ❌ |
| `SUPABASE_PROJECT_REF` | ❌ | ❌ | ✅ (CLI参数) | ❌ |
| `SUPABASE_URL` | ❌ | ✅ (自动注入) | ❌ | ✅ (需手动配置) |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | ✅ (自动注入) | ❌ | ✅ (需手动配置) |

---

## 🎯 你的怀疑是对的吗？

**你的怀疑**: SERVICE_ROLE_KEY可能是后面2个中的一个

**答案**: ❌ **不是**

- `SUPABASE_ACCESS_TOKEN` = CLI认证token（Personal Access Token）
- `SUPABASE_PROJECT_REF` = 项目ID字符串
- `SUPABASE_SERVICE_ROLE_KEY` = **完全不同的密钥**，需要单独获取

这3个是**完全独立**的东西：
1. **ACCESS_TOKEN**: 证明你是Supabase账号的主人（用于CLI）
2. **PROJECT_REF**: 项目标识符（像门牌号）
3. **SERVICE_ROLE_KEY**: 数据库完全权限密钥（像万能钥匙）

---

## ✅ 解决方案

Lambda需要的两个环境变量：

```bash
# Lambda环境变量（在GitHub Secrets中配置）
SUPABASE_URL = REACT_APP_SUPABASE_URL的值
SUPABASE_SERVICE_ROLE_KEY = 从Supabase Dashboard → Settings → API → service_role获取
```

**当前状态**:
- ✅ `SUPABASE_URL` - 已在workflow中映射为 `REACT_APP_SUPABASE_URL`
- ❌ `SUPABASE_SERVICE_ROLE_KEY` - **需要添加到GitHub Secrets**

---

## 📝 总结

你的4个Supabase环境变量：

1. ✅ `REACT_APP_SUPABASE_URL` - 前端用的URL
2. ✅ `REACT_APP_SUPABASE_ANON_KEY` - 前端用的公开密钥
3. ✅ `SUPABASE_ACCESS_TOKEN` - CI/CD用的CLI认证（不在代码中）
4. ✅ `SUPABASE_PROJECT_REF` - CI/CD用的项目ID（不在代码中）

Lambda还需要的（新增）：

5. ❌ `SUPABASE_SERVICE_ROLE_KEY` - Lambda用的完全权限密钥（**需要添加**）
