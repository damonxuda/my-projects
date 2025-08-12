// 公共服务从shared导入
import { createSupabaseClientFromEnv } from '../../shared/supabase';

// 认证相关从auth-clerk导入
import { ClerkAuthProvider, useAuth, SignedIn, SignedOut, SignInButton, UserProfile } from 'auth-clerk';

//其余保持不变
import React, { useState, useEffect } from 'react';
import { Star, Edit2, Database, Github, User, Users } from 'lucide-react';
import QuestionInput from './components/QuestionInput/index.js';
import db from './services/DatabaseService.js';
import UserManagement from './components/admin/UserManagement';

const supabaseClient = createSupabaseClientFromEnv();

const QuizApp = () => {
  const [activeTab, setActiveTab] = useState('input');
  const [questions, setQuestions] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState(null);
  
  // 认证状态 - 使用Clerk
  const { user, isSignedIn, isAdmin, loading: authLoading } = useAuth();
  
  // 部署状态
  const [deploymentStatus, setDeploymentStatus] = useState({
    database: 'mock',
    ready: false,
    checklist: {
      codeOptimized: true,
      environmentVars: false,
      supabaseConfigured: false,
      githubReady: false,
      deploymentTested: false
    }
  });
  
  // 筛选状态
  const [filters, setFilters] = useState({
    teacher: '',
    semester: '',
    category: '',
    masteryLevel: '',
    lessonNumber: '',
    masteryTag: ''
  });

  // 分类和配置
  const mathCategories = ['计算', '计数', '几何', '数论', '应用题', '行程', '组合'];
  const categories = ['行程', '组合', '数论', '几何', '计算', '应用题', '逻辑推理', '计数', '其他'];

  // 初始化数据加载
  useEffect(() => {
    const initializeSystem = async () => {
      if (!isSignedIn || authLoading || !user) return;
      
      try {
        // 初始化数据库连接
        await db.initializeSupabase();
        
        // 加载数据（传入Clerk用户信息进行权限验证）
        const { data: questionsData, error: questionsError } = await db.selectQuestions(user);
        const { data: attemptsData, error: attemptsError } = await db.selectAttempts(user);
        
        if (questionsError || attemptsError) {
          throw new Error('数据加载失败: ' + (questionsError || attemptsError));
        }
        
        setQuestions(questionsData || []);
        setAttempts(attemptsData || []);
      } catch (error) {
        console.error('系统初始化失败:', error);
        // 如果是权限问题，显示特定错误信息
        if (error.message.includes('未通过审批')) {
          alert('您的账户正在审核中，请等待管理员批准后再访问题库内容。');
        } else {
          alert('系统初始化失败，请联系管理员。');
        }
      } finally {
        setLoading(false);
      }
    };
    
    initializeSystem();
  }, [isSignedIn, authLoading, user]);

  // 学习记录操作
  const addAttempt = async (questionId, score, isWrong = false) => {
    const attempt = {
      questionId,
      masteryScore: score,
      isMarkedWrong: isWrong,
      attemptedAt: new Date().toISOString()
    };
    
    try {
      const { data, error } = await db.insertAttempt(attempt, user);
      if (error) throw new Error(error);
      
      setAttempts([...attempts, data]);
      updateQuestionMasteryTag(questionId, score, isWrong);
    } catch (error) {
      console.error('记录学习失败:', error);
      if (error.message.includes('未通过审批')) {
        alert('您的账户正在审核中，无法记录学习数据。');
      } else {
        alert('记录学习失败，请重试。');
      }
    }
  };

  const updateQuestion = async (id, updates) => {
    try {
      const { data, error } = await db.updateQuestion(id, updates, user);
      if (error) throw new Error(error);
      
      setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
      setEditingQuestion(null);
      alert('题目更新成功！');
    } catch (error) {
      console.error('更新失败:', error);
      if (error.message.includes('未通过审批')) {
        alert('您没有权限修改题目。');
      } else {
        alert('更新失败，请检查网络连接。');
      }
    }
  };

  const deleteQuestion = async (id) => {
    if (!window.confirm('确定要删除这道题目吗？')) return;
    
    try {
      const { error } = await db.deleteQuestion(id, user);
      if (error) throw new Error(error);
      
      setQuestions(questions.filter(q => q.id !== id));
      setAttempts(attempts.filter(a => a.questionId !== id));
      alert('题目删除成功！');
    } catch (error) {
      console.error('删除失败:', error);
      if (error.message.includes('未通过审批')) {
        alert('您没有权限删除题目。');
      } else {
        alert('删除失败，请检查网络连接。');
      }
    }
  };

  const updateQuestionMasteryTag = (questionId, score, isWrong) => {
    const avgScore = getNewAverageScore(questionId, score);
    let masteryTag = '';
    
    if (isWrong) {
      masteryTag = '错题';
    } else if (avgScore >= 4) {
      masteryTag = '熟练';
    } else if (avgScore >= 3) {
      masteryTag = '一般';
    } else {
      masteryTag = '不熟练';
    }

    const question = questions.find(q => q.id === questionId);
    if (question) {
      const newTags = question.tags.filter(tag => 
        !['错题', '熟练', '一般', '不熟练'].includes(tag)
      );
      newTags.push(masteryTag);
      
      updateQuestion(questionId, { tags: newTags });
    }
  };

  const getNewAverageScore = (questionId, newScore) => {
    const existingAttempts = attempts.filter(a => a.questionId === questionId);
    const totalScore = existingAttempts.reduce((sum, a) => sum + a.masteryScore, 0) + newScore;
    return totalScore / (existingAttempts.length + 1);
  };

  const getQuestionAttempts = (questionId) => {
    return attempts.filter(a => a.questionId === questionId);
  };

  const getAverageScore = (questionId) => {
    const questionAttempts = getQuestionAttempts(questionId);
    if (questionAttempts.length === 0) return 0;
    return (questionAttempts.reduce((sum, a) => sum + a.masteryScore, 0) / questionAttempts.length).toFixed(1);
  };

  const isMarkedWrong = (questionId) => {
    return attempts.some(a => a.questionId === questionId && a.isMarkedWrong);
  };

  const filteredQuestions = questions.filter(q => {
    return (!filters.teacher || q.tags.some(tag => tag.includes(filters.teacher))) &&
           (!filters.semester || q.tags.some(tag => tag.includes(filters.semester))) &&
           (!filters.category || q.tags.some(tag => tag === filters.category)) &&
           (!filters.lessonNumber || q.tags.some(tag => tag.includes(`第${filters.lessonNumber}讲`))) &&
           (!filters.masteryTag || q.tags.some(tag => tag === filters.masteryTag)) &&
           (!filters.masteryLevel || 
            (filters.masteryLevel === 'unfamiliar' && getAverageScore(q.id) <= 2) ||
            (filters.masteryLevel === 'familiar' && getAverageScore(q.id) >= 4) ||
            (filters.masteryLevel === 'wrong' && isMarkedWrong(q.id)));
  });

  const renderStars = (score) => {
    return Array.from({length: 5}, (_, i) => (
      <Star 
        key={i} 
        size={16} 
        className={i < score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} 
      />
    ));
  };

  // 部署检查面板
  const renderDeploymentPanel = () => (
    <div className="bg-blue-50 p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
        <Github size={20} />
        🚀 部署准备检查
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white p-4 rounded border">
          <h4 className="font-medium text-gray-800 mb-3">📋 部署检查清单</h4>
          <div className="space-y-2 text-sm">
            {Object.entries({
              '代码优化完成': deploymentStatus.checklist.codeOptimized,
              '环境变量配置': deploymentStatus.checklist.environmentVars,
              'Supabase配置': deploymentStatus.checklist.supabaseConfigured,
              'GitHub准备': deploymentStatus.checklist.githubReady,
              '部署测试': deploymentStatus.checklist.deploymentTested
            }).map(([item, status]) => (
              <div key={item} className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full ${status ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                <span className={status ? 'text-green-700' : 'text-gray-600'}>{item}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white p-4 rounded border">
          <h4 className="font-medium text-gray-800 mb-3">🔗 数据库连接状态</h4>
          <div className="text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Database size={16} className="text-blue-500" />
              <span>模式: {db.getConnectionStatus().mode}</span>
            </div>
            <div className="text-gray-600">
              <p>• 当前使用: {db.getConnectionStatus().status}</p>
              <p>• 题目数量: {questions.length}</p>
              <p>• 学习记录: {attempts.length}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded border mb-4">
        <h4 className="font-medium text-gray-800 mb-3">📦 生产环境配置</h4>
        <div className="text-sm text-gray-700 space-y-2">
          <p><strong>环境变量设置:</strong></p>
          <div className="bg-gray-100 p-3 rounded font-mono text-xs">
            <p>REACT_APP_SUPABASE_URL=your-supabase-project-url</p>
            <p>REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key</p>
            <p>REACT_APP_CLERK_PUBLISHABLE_KEY=your-clerk-key</p>
            <p>NODE_ENV=production</p>
          </div>
          <p className="text-orange-600 mt-2">⚠️ 部署前需要配置Supabase和Clerk环境变量</p>
        </div>
      </div>
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">正在加载...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg">
        {/* 顶部用户信息栏 */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">题库管理系统</h1>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User size={16} />
                <span>{user?.emailAddresses?.[0]?.emailAddress || user?.firstName}</span>
                {isAdmin && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">管理员</span>
                )}
              </div>
            </div>
            <UserProfile showWelcome={false} afterSignOutUrl="/" />
          </div>
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('input')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'input' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              录入题目
            </button>
            <button
              onClick={() => setActiveTab('browse')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'browse' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              浏览题库 ({questions.length})
            </button>
            <button
              onClick={() => setActiveTab('practice')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'practice' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              练习模式
            </button>
            <button
              onClick={() => setActiveTab('deploy')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'deploy' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🚀 部署
            </button>
            {/* 管理员才能看到用户管理 */}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'users' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users size={16} className="inline mr-1" />
                用户管理
              </button>
            )}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'input' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">录入新题目</h2>
                <button
                  onClick={async () => {
                    try {
                      const { error } = await db.clearAll(user);
                      if (error) throw new Error(error);
                      
                      setQuestions([]);
                      setAttempts([]);
                      alert('已清空所有数据！');
                    } catch (error) {
                      console.error('清空数据失败:', error);
                      if (error.message.includes('未通过审批')) {
                        alert('您没有权限清空数据。');
                      } else {
                        alert('清空数据失败，请重试。');
                      }
                    }
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  🗑️ 清空数据
                </button>
              </div>

              {/* QuestionInput 组件 */}
              <QuestionInput 
                questions={questions}
                setQuestions={setQuestions}
                db={db}
                user={user}
              />

              {/* 数据库统计 */}
              {questions.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">📊 数据库统计</h3>
                    <div className="flex gap-4 text-sm">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded">
                        💾 总题目: {questions.length}
                      </span>
                      {questions.length > 0 && (
                        <>
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded">
                            🧮 计数类: {questions.filter(q => q.tags?.includes('计数')).length}
                          </span>
                          {Array.from(new Set(questions.flatMap(q => 
                            q.tags?.filter(tag => tag.includes('第') && tag.includes('讲')) || []
                          ))).slice(0, 3).map(lesson => (
                            <span key={lesson} className="bg-purple-100 text-purple-800 px-3 py-1 rounded">
                              📖 {lesson}: {questions.filter(q => q.tags?.includes(lesson)).length}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <h4 className="font-medium mb-2">📈 按讲次分组统计：</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      {Array.from(new Set(questions.flatMap(q => 
                        q.tags?.filter(tag => tag.includes('第') && tag.includes('讲')) || []
                      ))).sort().map(lesson => (
                        <div key={lesson} className="bg-white px-3 py-2 rounded border">
                          <span className="font-medium">{lesson}:</span>
                          <span className="ml-1 text-blue-600">
                            {questions.filter(q => q.tags?.includes(lesson)).length}题
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-4">
                    <h4 className="font-medium text-green-800 mb-2">✅ 数据库连接状态</h4>
                    <div className="text-sm text-green-700">
                      <p>• 已连接到{db.getConnectionStatus().mode}数据库</p>
                      <p>• 状态: {db.getConnectionStatus().status}</p>
                      <p>• 数据持久化保存，支持实时增删改查操作</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'browse' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">📚 题库浏览</h2>
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={filters.teacher}
                    onChange={(e) => setFilters({...filters, teacher: e.target.value})}
                    className="p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">所有老师</option>
                    <option value="岛主">岛主</option>
                    <option value="普老师">普老师</option>
                  </select>
                  <select
                    value={filters.lessonNumber}
                    onChange={(e) => setFilters({...filters, lessonNumber: e.target.value})}
                    className="p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">所有讲次</option>
                    {Array.from(new Set(questions.flatMap(q => 
                      q.tags?.filter(tag => tag.includes('第') && tag.includes('讲'))
                        ?.map(tag => tag.match(/第(\d+)讲/)?.[1])
                        ?.filter(Boolean) || []
                    ))).sort((a, b) => parseInt(a) - parseInt(b)).map(num => (
                      <option key={num} value={num}>第{num}讲</option>
                    ))}
                  </select>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters({...filters, category: e.target.value})}
                    className="p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">所有分类</option>
                    {mathCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <select
                    value={filters.masteryTag}
                    onChange={(e) => setFilters({...filters, masteryTag: e.target.value})}
                    className="p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">所有熟练度</option>
                    <option value="错题">错题</option>
                    <option value="不熟练">不熟练</option>
                    <option value="一般">一般</option>
                    <option value="熟练">熟练</option>
                  </select>
                  <button
                    onClick={() => setFilters({teacher: '', semester: '', category: '', masteryLevel: '', lessonNumber: '', masteryTag: ''})}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
                  >
                    清除筛选
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {filteredQuestions.map(q => (
                  <div key={q.id} className="bg-white border border-gray-200 p-6 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded font-medium">
                            {q.questionType}
                          </span>
                          {q.tags?.map((tag, index) => (
                            <span
                              key={index}
                              className={`text-xs px-2 py-1 rounded ${
                                tag === '错题' ? 'bg-red-100 text-red-800' :
                                tag === '不熟练' ? 'bg-yellow-100 text-yellow-800' :
                                tag === '一般' ? 'bg-blue-100 text-blue-800' :
                                tag === '熟练' ? 'bg-green-100 text-green-800' :
                                mathCategories.includes(tag) ? 'bg-purple-100 text-purple-800' :
                                tag.includes('第') && tag.includes('讲') ? 'bg-indigo-100 text-indigo-800' :
                                'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {tag}
                            </span>
                          )) || []}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingQuestion(editingQuestion === q.id ? null : q.id)}
                          className="text-gray-500 hover:text-blue-500"
                        >
                          <Edit2 size={16} />
                        </button>
                        <div className="flex items-center gap-1">
                          {renderStars(Math.round(getAverageScore(q.id)))}
                          <span className="text-sm text-gray-500 ml-1">({getAverageScore(q.id)})</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">题目：</h4>
                      <p className="text-gray-700">{q.questionText}</p>
                    </div>
                    
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">答案：</h4>
                      <p className="text-gray-700">{q.answer}</p>
                    </div>
                    
                    {q.solutionSteps && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">解题思路：</h4>
                        <p className="text-gray-700 whitespace-pre-line">{q.solutionSteps}</p>
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-4 border-t border-gray-100">
                      <span className="text-sm text-gray-500">熟悉度评分：</span>
                      {[1,2,3,4,5].map(score => (
                        <button
                          key={score}
                          onClick={() => addAttempt(q.id, score)}
                          className="text-yellow-400 hover:text-yellow-500 flex items-center"
                          title={`${score}星熟练度`}
                        >
                          <Star size={20} />
                          <span className="text-xs ml-1">{score}</span>
                        </button>
                      ))}
                      <button
                        onClick={() => addAttempt(q.id, 1, true)}
                        className="ml-4 text-red-500 hover:text-red-600 text-sm px-2 py-1 border border-red-300 rounded"
                      >
                        ❌ 标记错题
                      </button>
                    </div>
                  </div>
                ))}
                
                {filteredQuestions.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    {questions.length === 0 ? '数据库中还没有题目，去添加第一道题吧！' : '没有符合条件的题目'}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'practice' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🎯 练习模式</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-red-800 mb-2">❌ 错题复习</h3>
                  <p className="text-red-600 mb-4">复习已标记的错题</p>
                  <p className="text-2xl font-bold text-red-800">
                    {attempts.filter(a => a.isMarkedWrong).length}
                  </p>
                  <p className="text-sm text-red-600">道错题</p>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-yellow-800 mb-2">⭐ 不熟悉题目</h3>
                  <p className="text-yellow-600 mb-4">评分1-2星的题目</p>
                  <p className="text-2xl font-bold text-yellow-800">
                    {questions.filter(q => getAverageScore(q.id) <= 2 && getAverageScore(q.id) > 0).length}
                  </p>
                  <p className="text-sm text-yellow-600">道题目</p>
                </div>
                
                <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-green-800 mb-2">🎲 随机练习</h3>
                  <p className="text-green-600 mb-4">从题库中随机抽取</p>
                  <p className="text-2xl font-bold text-green-800">
                    {questions.length}
                  </p>
                  <p className="text-sm text-green-600">道题目可选</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'deploy' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🚀 部署准备</h2>
              {renderDeploymentPanel()}
              
              <div className="bg-white p-6 rounded-lg border mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Supabase数据表设计</h3>
                <div className="bg-gray-100 p-4 rounded font-mono text-sm overflow-x-auto">
                  <div className="mb-4">
                    <p className="font-bold text-blue-600">-- questions表</p>
                    <p>CREATE TABLE questions (</p>
                    <p>&nbsp;&nbsp;id BIGSERIAL PRIMARY KEY,</p>
                    <p>&nbsp;&nbsp;question_type VARCHAR(20) NOT NULL,</p>
                    <p>&nbsp;&nbsp;question_text TEXT NOT NULL,</p>
                    <p>&nbsp;&nbsp;answer TEXT,</p>
                    <p>&nbsp;&nbsp;solution_steps TEXT,</p>
                    <p>&nbsp;&nbsp;tags TEXT[] DEFAULT ARRAY[]::TEXT[],</p>
                    <p>&nbsp;&nbsp;created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),</p>
                    <p>&nbsp;&nbsp;updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()</p>
                    <p>);</p>
                  </div>
                  <div className="mb-4">
                    <p className="font-bold text-green-600">-- attempts表</p>
                    <p>CREATE TABLE attempts (</p>
                    <p>&nbsp;&nbsp;id BIGSERIAL PRIMARY KEY,</p>
                    <p>&nbsp;&nbsp;question_id BIGINT REFERENCES questions(id) ON DELETE CASCADE,</p>
                    <p>&nbsp;&nbsp;mastery_score INTEGER CHECK (mastery_score &gt;= 1 AND mastery_score &lt;= 5),</p>
                    <p>&nbsp;&nbsp;is_marked_wrong BOOLEAN DEFAULT FALSE,</p>
                    <p>&nbsp;&nbsp;created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()</p>
                    <p>);</p>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">📝 下一步操作指南：</h4>
                  <ol className="text-sm text-blue-700 space-y-1">
                    <li>1. 创建Supabase项目并执行上述SQL创建表</li>
                    <li>2. 配置环境变量到部署平台</li>
                    <li>3. 修改DatabaseService切换到真实Supabase客户端</li>
                    <li>4. 测试数据迁移和API调用</li>
                    <li>5. 部署到生产环境</li>
                  </ol>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">⚠️ 当前状态</h4>
                <p className="text-yellow-700 text-sm">
                  系统已完成认证迁移到Clerk，使用Mock数据库运行。需要配置真实Supabase数据库后即可投入生产使用。
                  所有核心功能已验证完成，包括智能导入、标签管理、熟练度跟踪等。
                </p>
              </div>
            </div>
          )}

          {/* 用户管理 - 只有管理员能看到 */}
          {activeTab === 'users' && isAdmin && (
            <UserManagement />
          )}
        </div>
      </div>
    </div>
  );
};

// 主应用组件 - 包装Clerk认证
const App = () => {
  return (
    <ClerkAuthProvider publishableKey={process.env.REACT_APP_CLERK_PUBLISHABLE_KEY}>
      <SignedOut>
        <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center mb-6">小学奥数题库管理系统</h1>
          <p className="text-gray-600 text-center mb-6">请登录以使用系统功能</p>
          <div className="flex justify-center">
            <SignInButton mode="modal">
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium">
                登录
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>
      
      <SignedIn>
        <QuizApp />
      </SignedIn>
    </ClerkAuthProvider>
  );
};

export default App;