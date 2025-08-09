# 统一认证模块 (@my/auth)

这是一个基于 Supabase 的 React 认证模块，支持多项目复用。

## 特性

- 🔐 完整的用户认证流程（注册、登录、登出）
- 👤 用户档案管理
- 🛡️ 基于角色的权限控制
- 🔄 自动用户状态同步
- 📧 邮箱验证和密码重置
- 🎯 路由保护组件
- 🔧 灵活的配置选项

## 安装使用

### 1. 创建项目结构

```
MY-PROJECTS/
├── auth/              # 本认证模块
└── your-app/          # 你的应用项目
```

### 2. 在你的项目中使用

#### 安装依赖

```bash
npm install @supabase/supabase-js
```

#### 配置环境变量

创建 `.env` 文件：

```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### 基本使用示例

```jsx
// App.js
import { AuthProvider } from "../auth/src";
import { createSupabaseClientFromEnv } from "../auth/src";

const supabaseClient = createSupabaseClientFromEnv();

function App() {
  return (
    <AuthProvider
      supabaseClient={supabaseClient}
      redirectTo="http://localhost:3000/reset-password"
    >
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
```

#### 在组件中使用认证

```jsx
// LoginPage.js
import { useAuth } from "../auth/src";

function LoginPage() {
  const { signIn, loading } = useAuth();

  const handleLogin = async (email, password) => {
    const { error } = await signIn(email, password);
    if (error) {
      console.error("登录失败:", error);
    }
  };

  return <form onSubmit={handleSubmit}>{/* 登录表单 */}</form>;
}
```

#### 保护路由

```jsx
import { AuthGuard } from "../auth/src";

function ProtectedPage() {
  return (
    <AuthGuard
      requireApproval={true}
      requireAdmin={false}
      fallback={<LoginForm />}
    >
      <h1>这是受保护的页面</h1>
    </AuthGuard>
  );
}
```

## API 参考

### AuthProvider Props

| 参数             | 类型      | 必需 | 描述                |
| ---------------- | --------- | ---- | ------------------- |
| `supabaseClient` | object    | ✅   | Supabase 客户端实例 |
| `redirectTo`     | string    | ❌   | 密码重置重定向 URL  |
| `children`       | ReactNode | ✅   | 子组件              |

### useAuth Hook

```jsx
const {
  user, // 当前用户对象
  userProfile, // 用户档案信息
  loading, // 加载状态
  signUp, // 注册函数
  signIn, // 登录函数
  signOut, // 登出函数
  resetPassword, // 重置密码函数
  isUserApproved, // 检查用户是否已审批
  isAdmin, // 检查用户是否为管理员
} = useAuth();
```

### AuthGuard Props

| 参数               | 类型      | 默认值   | 描述               |
| ------------------ | --------- | -------- | ------------------ |
| `requireApproval`  | boolean   | `true`   | 是否需要管理员审批 |
| `requireAdmin`     | boolean   | `false`  | 是否需要管理员权限 |
| `fallback`         | ReactNode | 登录提示 | 未认证时显示的组件 |
| `loadingComponent` | ReactNode | 加载提示 | 加载时显示的组件   |

## 数据库要求

需要在 Supabase 中创建 `user_profiles` 表：

```sql
CREATE TABLE user_profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE,
  email text,
  status text DEFAULT 'pending',
  role text DEFAULT 'user',
  requested_at timestamp with time zone DEFAULT now(),
  approved_at timestamp with time zone,
  PRIMARY KEY (id)
);

-- 启用 RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "Allow authenticated users access" ON user_profiles
FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

## 工具函数

```jsx
import {
  isValidEmail, // 验证邮箱格式
  validatePassword, // 验证密码强度
  formatAuthError, // 格式化错误消息
  hasPermission, // 检查用户权限
} from "../auth/src";
```

## 开发说明

这个模块设计为可复用的认证解决方案，可以在多个项目中使用相同的认证逻辑和用户数据库。

### 优势

- 📦 **模块化**：独立的认证逻辑，易于维护
- 🔄 **可复用**：多个项目共享相同的认证系统
- 🛠️ **灵活配置**：支持不同的 Supabase 项目和配置
- 🎨 **UI 无关**：不包含具体的 UI 组件，可以配合任何 UI 库使用
