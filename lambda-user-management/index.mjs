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
        } else {
            // REST API格式 (向后兼容)
            method = event.httpMethod;
            path = event.path || event.pathParameters?.proxy || '';
        }

        console.log(`Processing ${method} ${path}`);

        // 1. CORS预检请求处理
        if (method === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
                },
                body: ''
            };
        }

        // 2. 环境变量检查
        if (!process.env.CLERK_SECRET_KEY) {
            console.error('CLERK_SECRET_KEY not found in environment variables');
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: 'Server configuration error',
                    details: 'Missing CLERK_SECRET_KEY'
                })
            };
        }

        // 3. 权限验证 (暂时注释掉，方便测试)
        // const authHeader = (event.headers && (event.headers.Authorization || event.headers.authorization));
        // if (!authHeader || !authHeader.startsWith('Bearer ')) {
        //     return {
        //         statusCode: 401,
        //         headers: {
        //             'Access-Control-Allow-Origin': '*',
        //             'Content-Type': 'application/json'
        //         },
        //         body: JSON.stringify({ error: 'Missing or invalid authorization header' })
        //     };
        // }

        // 4. 路由处理
        // ✅ 获取所有用户 - 匹配 /user_management 路径
        if (method === 'GET' && (path === '/user_management' || path === '/users' || path === '')) {
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
                        'Access-Control-Allow-Origin': '*',
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
                modules: user.publicMetadata?.authorized_modules || [], // ✅ 修正字段名
                status: user.publicMetadata?.status || 'pending',
                approved_by: user.publicMetadata?.approved_by || null,
                approved_at: user.publicMetadata?.approved_at || null,
                updated_at: user.publicMetadata?.updated_at || null
            }));

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: true,
                    users: formattedUsers,
                    count: formattedUsers.length
                })
            };
        }

        // ✅ 新增：处理POST请求 - 权限分配和撤销
        if (method === 'POST' && (path === '/user_management' || path === '/users' || path === '')) {
            const body = JSON.parse(event.body || '{}');
            const { action, userId, modules, approvedBy, revokedBy } = body;

            console.log('POST request body:', body);

            if (!action || !userId) {
                return {
                    statusCode: 400,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        error: 'Missing required fields',
                        required: ['action', 'userId']
                    })
                };
            }

            // 分配模块权限
            if (action === 'assign_modules') {
                if (!modules || !Array.isArray(modules)) {
                    return {
                        statusCode: 400,
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            error: 'Missing or invalid modules array'
                        })
                    };
                }

                console.log(`Assigning modules ${modules} to user ${userId}`);

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

                return {
                    statusCode: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        success: true,
                        message: `Modules assigned to user ${userId}`,
                        modules: modules
                    })
                };
            }

            // 撤销模块权限
            if (action === 'revoke_modules') {
                console.log(`Revoking all modules from user ${userId}`);

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

                return {
                    statusCode: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        success: true,
                        message: `All modules revoked from user ${userId}`
                    })
                };
            }

            // 未知的action
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: 'Unknown action',
                    supportedActions: ['assign_modules', 'revoke_modules']
                })
            };
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
                        'Access-Control-Allow-Origin': '*',
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
                    authorized_modules: modules, // ✅ 修正字段名
                    status: status,
                    updated_at: new Date().toISOString()
                }
            });

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
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
        return {
            statusCode: 404,
            headers: {
                'Access-Control-Allow-Origin': '*',
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

    } catch (error) {
        console.error('Lambda function error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message
            })
        };
    }
};