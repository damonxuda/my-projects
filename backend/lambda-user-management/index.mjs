import { createClerkClient } from '@clerk/backend';

export const handler = async (event) => {
    // 初始化Clerk客户端
    const clerkClient = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY
    });
    
    try {
        console.log('Lambda function started');
        console.log('Event:', JSON.stringify(event, null, 2));

        // 检测API类型并获取method和path
        let method, path;
        
        if (event.version === '2.0') {
            // HTTP API格式
            method = event.requestContext.http.method;
            path = event.rawPath;
        } else if (event.requestContext && event.requestContext.http) {
            // Function URL格式
            method = event.requestContext.http.method;
            path = event.rawPath || '/';
        } else {
            // REST API格式 (向后兼容)
            method = event.httpMethod;
            path = event.path || event.pathParameters?.proxy || '';
        }

        console.log(`Processing ${method} ${path}`);

        // 1. CORS预检请求处理 - Function URL会自动处理，直接返回空响应
        if (method === 'OPTIONS') {
            console.log('🔍 [DEBUG] 进入 OPTIONS 处理分支 - 返回空响应，让Function URL处理CORS');
            return {
                statusCode: 200,
                body: ''
            };
        }

        // 2. 环境变量检查
        if (!process.env.CLERK_SECRET_KEY) {
            console.error('CLERK_SECRET_KEY not found in environment variables');
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: 'Server configuration error',
                    details: 'Missing CLERK_SECRET_KEY'
                })
            };
        }

        // 3. 路由处理
        // ✅ 获取所有用户 - 匹配 /user_management 路径
        if (method === 'GET' && (path === '/user_management' || path === '/users' || path === '/' || path === '')) {
            console.log('Fetching users from Clerk...');
            
            const response = await clerkClient.users.getUserList();
            console.log('Clerk API response:', response);
            
            // 处理不同的响应格式
            const users = Array.isArray(response) ? response : (response.data || response);
            console.log(`Found ${Array.isArray(users) ? users.length : 'invalid'} users`);

            if (!Array.isArray(users)) {
                console.error('Users is not an array:', typeof users, users);
                return {
                    statusCode: 500,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        error: 'Invalid response from Clerk API',
                        details: `Expected array, got ${typeof users}`,
                        response: response
                    })
                };
            }

            // 格式化用户数据，包含权限信息
            const formattedUsers = users.map(user => ({
                id: user.id,
                email: user.primaryEmailAddress?.emailAddress || 'No email',
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                createdAt: user.createdAt,
                modules: user.publicMetadata?.authorized_modules || [],
                status: user.publicMetadata?.status || 'pending',
                approved_by: user.publicMetadata?.approved_by || null,
                approved_at: user.publicMetadata?.approved_at || null,
                updated_at: user.publicMetadata?.updated_at || null
            }));

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: true,
                    users: formattedUsers,
                    count: formattedUsers.length
                })
            };
        }

        // ✅ 处理POST请求 - 权限分配和撤销
        if (method === 'POST' && (path === '/user_management' || path === '/users' || path === '/' || path === '')) {
            console.log('🔍 [DEBUG] 进入 POST 处理分支');
            
            const body = JSON.parse(event.body || '{}');
            const { action, userId, modules, approvedBy, revokedBy } = body;

            console.log('🔍 [DEBUG] POST request body:', body);

            if (!action || !userId) {
                const errorResponse = {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        error: 'Missing required fields',
                        required: ['action', 'userId']
                    })
                };
                console.log('🔍 [DEBUG] 400 错误响应:', JSON.stringify(errorResponse, null, 2));
                return errorResponse;
            }

            // 分配模块权限
            if (action === 'assign_modules') {
                if (!modules || !Array.isArray(modules)) {
                    const errorResponse = {
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            error: 'Missing or invalid modules array'
                        })
                    };
                    console.log('🔍 [DEBUG] 模块验证失败响应:', JSON.stringify(errorResponse, null, 2));
                    return errorResponse;
                }

                console.log(`🔍 [DEBUG] Assigning modules ${modules} to user ${userId}`);

                // 获取用户当前信息
                const user = await clerkClient.users.getUser(userId);
                
                // 更新用户元数据
                await clerkClient.users.updateUserMetadata(userId, {
                    publicMetadata: {
                        ...user.publicMetadata,
                        authorized_modules: modules,
                        approved_by: approvedBy,
                        approved_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        status: 'approved'
                    }
                });

                const successResponse = {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        success: true,
                        message: `Modules assigned to user ${userId}`,
                        modules: modules
                    })
                };
                console.log('🔍 [DEBUG] 成功响应:', JSON.stringify(successResponse, null, 2));
                return successResponse;
            }

            // 撤销模块权限
            if (action === 'revoke_modules') {
                console.log(`🔍 [DEBUG] Revoking all modules from user ${userId}`);

                // 获取用户当前信息
                const user = await clerkClient.users.getUser(userId);
                
                // 更新用户元数据 - 清空授权模块
                await clerkClient.users.updateUserMetadata(userId, {
                    publicMetadata: {
                        ...user.publicMetadata,
                        authorized_modules: [], // 清空所有模块
                        revoked_by: revokedBy,
                        revoked_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        status: 'pending'
                    }
                });

                const successResponse = {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        success: true,
                        message: `All modules revoked from user ${userId}`
                    })
                };
                console.log('🔍 [DEBUG] 撤销成功响应:', JSON.stringify(successResponse, null, 2));
                return successResponse;
            }

            // 未知的action
            const unknownActionResponse = {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: 'Unknown action',
                    supportedActions: ['assign_modules', 'revoke_modules']
                })
            };
            console.log('🔍 [DEBUG] 未知操作响应:', JSON.stringify(unknownActionResponse, null, 2));
            return unknownActionResponse;
        }

        // ✅ 保留原有的PUT请求处理（向后兼容）
        if (method === 'PUT' && path.includes('/modules')) {
            // 对于HTTP API，需要从路径中提取userId
            const pathParts = path.split('/');
            const userIdIndex = pathParts.indexOf('users') + 1;
            const userId = pathParts[userIdIndex];
            
            if (!userId) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ error: 'Missing userId parameter' })
                };
            }

            const body = JSON.parse(event.body || '{}');
            const { modules = [], status = 'approved' } = body;

            console.log(`Updating user ${userId} modules:`, modules);

            await clerkClient.users.updateUserMetadata(userId, {
                publicMetadata: {
                    authorized_modules: modules,
                    status: status,
                    updated_at: new Date().toISOString()
                }
            });

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: true,
                    message: `User ${userId} modules updated`,
                    modules: modules
                })
            };
        }

        // 未匹配的路由
        console.log('🔍 [DEBUG] 未匹配的路由:', { method, path });
        const notFoundResponse = {
            statusCode: 404,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                error: 'Endpoint not found',
                method: method,
                path: path,
                availableEndpoints: [
                    'GET /user_management - Get all users',
                    'POST /user_management - Assign/revoke user modules',
                    'PUT /users/{userId}/modules - Update user modules (legacy)'
                ]
            })
        };
        console.log('🔍 [DEBUG] 404 响应:', JSON.stringify(notFoundResponse, null, 2));
        return notFoundResponse;

    } catch (error) {
        console.error('❌ [DEBUG] Lambda function error:', error);
        console.error('❌ [DEBUG] Error stack:', error.stack);
        
        const errorResponse = {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message
            })
        };
        console.log('🔍 [DEBUG] 500 错误响应:', JSON.stringify(errorResponse, null, 2));
        return errorResponse;
    }
};