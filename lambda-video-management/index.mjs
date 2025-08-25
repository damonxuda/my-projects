import { clerkClient } from '@clerk/clerk-sdk-node';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'ap-northeast-1' });
const VIDEO_BUCKET = process.env.VIDEO_BUCKET_NAME;

export const handler = async (event) => {
    // 简化CORS处理 - 不设置CORS headers，让Function URL处理
    const corsHeaders = {};

    // 处理OPTIONS预检请求
    if (event.requestContext.http.method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        console.log('=== Lambda函数开始执行 ===');
        console.log('Request path:', event.requestContext.http.path);
        console.log('Request method:', event.requestContext.http.method);
        
        // 环境变量检查
        if (!process.env.CLERK_SECRET_KEY) {
            console.error('CLERK_SECRET_KEY not found in environment variables');
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    error: 'Server configuration error',
                    details: 'Missing CLERK_SECRET_KEY'
                })
            };
        }
        
        // 验证Clerk token并检查videos模块权限
        const authHeader = event.headers.authorization || event.headers.Authorization;
        console.log('Authorization header:', authHeader ? `Bearer ${authHeader.substring(7, 20)}...` : 'Missing');
        
        if (!authHeader?.startsWith('Bearer ')) {
            console.log('❌ Authorization header缺失或格式错误');
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Missing authorization' })
            };
        }

        const token = authHeader.split(' ')[1];
        console.log('Token前20字符:', token.substring(0, 20) + '...');
        
        const user = await verifyTokenAndCheckAccess(token);
        
        if (!user) {
            console.log('❌ 用户权限验证失败');
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Access denied' })
            };
        }

        console.log('✅ 用户权限验证成功:', user.id);

        // 路由处理
        const path = event.requestContext.http.path;
        const method = event.requestContext.http.method;
        
        console.log('路由匹配 - Path:', path, 'Method:', method);

        if (method === 'GET' && path === '/videos/list') {
            return await listVideos(corsHeaders);
        } else if (method === 'GET' && path.startsWith('/videos/url/')) {
            const videoKey = decodeURIComponent(path.replace('/videos/url/', ''));
            return await getVideoUrl(videoKey, corsHeaders);
        }

        console.log('❌ 路由不匹配');
        return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Not found' })
        };

    } catch (error) {
        console.error('❌ Lambda函数执行错误:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Internal server error', details: error.message })
        };
    }
};

async function verifyTokenAndCheckAccess(token) {
    try {
        console.log('--- 开始验证Token ---');
        
        // 使用旧版Clerk验证逻辑，添加超时控制
        console.log('步骤1: 验证token...');
        const sessionToken = await Promise.race([
            clerkClient.verifyToken(token),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Token verification timeout')), 10000)
            )
        ]);
        console.log('✅ Token验证成功, sessionToken.sub:', sessionToken.sub);
        
        console.log('步骤2: 获取用户信息...');
        const user = await Promise.race([
            clerkClient.users.getUser(sessionToken.sub),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Get user timeout')), 10000)
            )
        ]);
        console.log('✅ 获取用户成功:', {
            id: user.id,
            emailAddress: user.emailAddresses?.[0]?.emailAddress,
            metadataKeys: Object.keys(user.publicMetadata || {})
        });
        
        console.log('步骤3: 检查用户权限...');
        // 检查用户是否有videos模块权限
        const authorizedModules = user.publicMetadata?.authorized_modules || [];
        const status = user.publicMetadata?.status;
        
        console.log('用户权限检查:');
        console.log('- authorized_modules:', JSON.stringify(authorizedModules));
        console.log('- status:', status);
        console.log('- 是否包含videos权限:', authorizedModules.includes('videos'));
        console.log('- 状态是否approved:', status === 'approved');
        
        const hasAccess = authorizedModules.includes('videos') && status === 'approved';
        
        console.log('最终权限结果:', hasAccess ? '✅ 有权限' : '❌ 无权限');
        
        return hasAccess ? user : null;
    } catch (error) {
        console.error('❌ Token verification failed:', error);
        console.error('错误类型:', error.name);
        console.error('错误消息:', error.message);
        
        // 如果是超时错误，返回特殊处理
        if (error.message.includes('timeout')) {
            console.error('⏰ 请求超时 - 可能需要增加Lambda超时时间');
        }
        
        return null;
    }
}

// 🔧 修复：支持多种视频格式
function isVideoFile(filename) {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'];
    const lowerFilename = filename.toLowerCase();
    return videoExtensions.some(ext => lowerFilename.endsWith(ext));
}

async function listVideos(corsHeaders) {
    try {
        console.log('--- 开始获取视频列表 ---');
        console.log('VIDEO_BUCKET:', VIDEO_BUCKET);
        
        const command = new ListObjectsV2Command({
            Bucket: VIDEO_BUCKET,
            Prefix: 'videos/'
        });
        
        const response = await s3Client.send(command);
        console.log('S3响应:', response.Contents?.length || 0, '个对象');
        
        // 🔧 修复：使用新的isVideoFile函数支持多种格式
        const videos = response.Contents?.filter(item => {
            const filename = item.Key.split('/').pop();
            const isVideo = isVideoFile(filename);
            const hasSize = item.Size > 0;
            
            // 添加调试日志
            console.log(`文件检查: ${filename} | 是否视频: ${isVideo} | 有大小: ${hasSize}`);
            
            return isVideo && hasSize;
        }) || [];

        console.log('过滤后的视频:', videos.length, '个');
        console.log('视频文件列表:', videos.map(v => v.Key.split('/').pop()));

        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(videos)
        };
    } catch (error) {
        console.error('❌ 获取视频列表失败:', error);
        throw new Error(`Failed to list videos: ${error.message}`);
    }
}

async function getVideoUrl(videoKey, corsHeaders) {
    try {
        console.log('--- 生成视频URL ---');
        console.log('videoKey:', videoKey);
        
        const command = new GetObjectCommand({
            Bucket: VIDEO_BUCKET,
            Key: videoKey
        });
        
        const signedUrl = await getSignedUrl(s3Client, command, { 
            expiresIn: 3600 // 1小时有效期
        });

        console.log('✅ 预签名URL生成成功');

        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                url: signedUrl,
                expiresAt: Date.now() + 3600000
            })
        };
    } catch (error) {
        console.error('❌ 生成视频URL失败:', error);
        throw new Error(`Failed to generate video URL: ${error.message}`);
    }
}