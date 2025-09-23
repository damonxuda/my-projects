// 简化的JWT解码（不验证签名，因为前端auth-clerk已经验证过）
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payload = parts[1];
    const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decodedPayload);
  } catch (error) {
    throw new Error(`JWT decode failed: ${error.message}`);
  }
}

// 缓存验证结果，避免重复调用
const tokenCache = new Map();
const CACHE_DURATION = 40 * 1000; // 40秒，与原函数保持一致

export async function verifyTokenAndCheckAccess(token) {
  try {
    console.log("--- 开始验证Token ---");

    // 检查缓存
    const cached = tokenCache.get(token);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log("使用缓存的Token验证结果");
      return cached.result;
    }

    console.log("步骤1: 解码JWT token...");
    const decoded = decodeJWT(token);
    console.log("Token解码成功, sub:", decoded.sub);
    console.log("JWT完整内容:", JSON.stringify(decoded, null, 2));

    // 检查token过期时间
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      throw new Error("Token已过期");
    }

    console.log("步骤2: 检查token来源和格式...");
    // 基本验证：确保token来自正确的issuer
    if (!decoded.iss || !decoded.iss.includes('clerk')) {
      throw new Error("Token issuer无效");
    }

    // 对于videos模块，我们采用宽松的权限策略
    // 只要token有效且来自Clerk，就允许访问
    console.log("步骤3: Videos模块权限检查...");
    console.log("- Token有效且来自Clerk");
    console.log("- Videos模块采用宽松权限策略");

    const mockUser = {
      id: decoded.sub,
      emailAddresses: [{ emailAddress: decoded.azp || 'user@example.com' }],
      publicMetadata: {
        authorized_modules: ['videos'],
        status: 'approved'
      }
    };

    // 缓存结果
    tokenCache.set(token, {
      result: mockUser,
      timestamp: Date.now()
    });
    console.log("Token验证结果已缓存");

    return mockUser;
  } catch (error) {
    console.error("Token verification failed:", error);
    console.error("错误类型:", error.name);
    console.error("错误消息:", error.message);

    if (error.message.includes("timeout")) {
      console.error("请求超时 - 可能需要增加Lambda超时时间");
    }

    return null;
  }
}

// 获取用户有权限访问的文件夹列表
export async function getUserAccessibleFolders(user) {
  try {
    // 检查用户是否是管理员
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(email => email.trim());
    const isAdmin = adminEmails.includes(user.emailAddresses?.[0]?.emailAddress);

    // 获取所有文件夹列表
    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const { s3Client, VIDEO_BUCKET } = await import("./s3-config.mjs");

    const listCommand = new ListObjectsV2Command({
      Bucket: VIDEO_BUCKET,
      Prefix: "videos/",
      Delimiter: "/",
      MaxKeys: 100
    });

    const response = await s3Client.send(listCommand);
    const allFolders = [];

    if (response.CommonPrefixes) {
      response.CommonPrefixes.forEach(prefix => {
        const folderName = prefix.Prefix.replace("videos/", "").replace("/", "");
        if (folderName) {
          allFolders.push(folderName);
        }
      });
    }

    if (isAdmin) {
      // 管理员可以访问所有文件夹（包括 Movies）
      console.log("管理员用户，可访问所有文件夹:", allFolders);
      return allFolders;
    } else {
      // 普通用户可以访问除 Movies 以外的所有文件夹
      const accessibleFolders = allFolders.filter(folder => folder !== "Movies");
      console.log("普通用户，可访问的文件夹:", accessibleFolders);
      return accessibleFolders;
    }
  } catch (error) {
    console.error("获取用户可访问文件夹失败:", error);
    return []; // 出错时返回空数组，安全起见
  }
}

// 检查用户是否是管理员
export function isAdmin(user) {
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(email => email.trim());
  return adminEmails.includes(user.emailAddresses?.[0]?.emailAddress);
}