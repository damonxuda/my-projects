import { clerkClient } from '@clerk/clerk-sdk-node';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'ap-northeast-1' });
const VIDEO_BUCKET = process.env.VIDEO_BUCKET_NAME;

export const handler = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': 'https://damonxuda.site',
        'Access-Control-Allow-Headers': 'content-type, authorization',
        'Access-Control-Allow-Methods': 'GET, POST'
    };

    try {
        // 验证Clerk token并检查videos模块权限
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Missing authorization' })
            };
        }

        const token = authHeader.split(' ')[1];
        const user = await verifyTokenAndCheckAccess(token);
        
        if (!user) {
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Access denied' })
            };
        }

        // 路由处理
        const path = event.requestContext.http.path;
        const method = event.requestContext.http.method;

        if (method === 'GET' && path === '/videos/list') {
            return await listVideos(corsHeaders);
        } else if (method === 'GET' && path.startsWith('/videos/url/')) {
            const videoKey = decodeURIComponent(path.replace('/videos/url/', ''));
            return await getVideoUrl(videoKey, corsHeaders);
        }

        return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Not found' })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

async function verifyTokenAndCheckAccess(token) {
    try {
        // 使用你现有的Clerk验证逻辑
        const sessionToken = await clerkClient.verifyToken(token);
        const user = await clerkClient.users.getUser(sessionToken.sub);
        
        // 检查用户是否有videos模块权限
        const authorizedModules = user.publicMetadata?.authorized_modules || [];
        const hasAccess = authorizedModules.includes('videos') && 
                         user.publicMetadata?.status === 'approved';
        
        return hasAccess ? user : null;
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

async function listVideos(corsHeaders) {
    try {
        const command = new ListObjectsV2Command({
            Bucket: VIDEO_BUCKET,
            Prefix: 'videos/'
        });
        
        const response = await s3Client.send(command);
        const videos = response.Contents?.filter(item => 
            item.Key.toLowerCase().endsWith('.mp4') && item.Size > 0
        ) || [];

        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(videos)
        };
    } catch (error) {
        throw new Error(`Failed to list videos: ${error.message}`);
    }
}

async function getVideoUrl(videoKey, corsHeaders) {
    try {
        const command = new GetObjectCommand({
            Bucket: VIDEO_BUCKET,
            Key: videoKey
        });
        
        const signedUrl = await getSignedUrl(s3Client, command, { 
            expiresIn: 3600 // 1小时有效期
        });

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
        throw new Error(`Failed to generate video URL: ${error.message}`);
    }
}