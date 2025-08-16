// 认证相关从auth-clerk导入
import { ClerkAuthProvider, useAuth, ModuleAccessGuard, UserManagement, UserProfile } from '../../auth-clerk/src';

import React, { useState, useEffect } from 'react';
import { Star, Edit2, Database, Github, User, Users, Eye, EyeOff } from 'lucide-react';
import QuestionInput from './components/QuestionInput/index.js';
import db from './services/DatabaseService.js';

// 练习题目组件
const PracticeQuestion = ({ question, index, onRate, getAverageScore, isMarkedWrong }) => {
  const [showAnswer, setShowAnswer] = useState(false);

  const renderStars = (score) => {
    return Array.from({length: 5}, (_, i) => (
      <Star 
        key={i} 
        size={16} 
        className={i < score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} 
      />
    ));
  };

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
              第{index}题
            </span>
            {question.question_number && (
              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                {question.question_number}
              </span>
            )}
            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
              {question.question_type}
            </span>
            {question.papers && (
              <>
                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs">
                  {question.papers.teacher}
                </span>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                  {question.papers.math_category}
                </span>
              </>
            )}
          </div>
          {question.papers && (
            <div className="text-sm text-gray-600 mb-2">
              📚 {question.papers.title}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {renderStars(Math.round(getAverageScore(question.id)))}
          <span className="text-sm text-gray-500 ml-1">({getAverageScore(question.id)})</span>
        </div>
      </div>
      
      <div className="mb-4">
        <h4 className="font-medium text-gray-900 mb-2">题目：</h4>
        <p className="text-gray-700 whitespace-pre-line">{question.question_text}</p>
      </div>
      
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="font-medium text-gray-900">答案：</h4>
          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className="flex items-center gap-1 text-blue-500 hover:text-blue-600 text-sm px-2 py-1 border border-blue-300 rounded"
          >
            {showAnswer ? <EyeOff size={16} /> : <Eye size={16} />}
            {showAnswer ? '隐藏答案' : '显示答案'}
          </button>
        </div>
        {showAnswer && (
          <div className="bg-gray-50 p-3 rounded border">
            <p className="text-gray-700 whitespace-pre-line">{question.answer}</p>
          </div>
        )}
      </div>
      
      <div className="flex gap-2 pt-4 border-t border-gray-100">
        <span className="text-sm text-gray-500">熟悉度评分：</span>
        {[1,2,3,4,5].map(score => (
          <button
            key={score}
            onClick={() => onRate(score, false)}
            className="text-yellow-400 hover:text-yellow-500 flex items-center"
            title={`${score}星熟练度`}
          >
            <Star size={20} />
            <span className="text-xs ml-1">{score}</span>
          </button>
        ))}
        <button
          onClick={() => onRate(1, true)}
          className="ml-4 text-red-500 hover:text-red-600 text-sm px-2 py-1 border border-red-300 rounded"
        >
          ❌ 标记错题
        </button>
      </div>
    </div>
  );
};

const QuizApp = () => {
  const [activeTab, setActiveTab] = useState('input');
  const [questions, setQuestions] = useState([]);
  const [papers, setPapers] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState(null);
  
  // 认证状态 - 使用Clerk
  const { user, isSignedIn, isAdmin, loading: authLoading } = useAuth();
  
  // 筛选状态
  const [filters, setFilters] = useState({
    teacher: '',
    semester: '',
    category: '',
    paperId: '',
    masteryLevel: '',
    courseName: ''
  });

  // 分类和配置
  const mathCategories = ['计算', '计数', '几何', '数论', '应用题', '行程', '组合'];

  // 初始化数据加载
  useEffect(() => {
    const initializeSystem = async () => {
      if (!isSignedIn || authLoading || !user) return;
      
      try {
        // 初始化数据库连接
        await db.initializeSupabase();
        
        // 并行加载所有数据
        const [questionsResult, papersResult, attemptsResult] = await Promise.all([
          db.getQuestions(),
          db.getPapers(),
          db.getAttempts({ userId: user.id })
        ]);
        
        if (!questionsResult.success || !papersResult.success || !attemptsResult.success) {
          throw new Error('数据加载失败');
        }
        
        setQuestions(questionsResult.data || []);
        setPapers(papersResult.data || []);
        setAttempts(attemptsResult.data || []);
      } catch (error) {
        console.error('系统初始化失败:', error);
        alert('系统初始化失败，请联系管理员。');
      } finally {
        setLoading(false);
        
        // 普通用户自动切换到可访问的选项卡
        if (!isAdmin && (activeTab === 'input' || activeTab === 'deploy' || activeTab === 'users')) {
          setActiveTab('browse');
        }
      }
    };
    
    initializeSystem();
  }, [isSignedIn, authLoading, user, isAdmin, activeTab]);

  // 学习记录操作
  const addAttempt = async (questionId, score, isWrong = false) => {
    const attempt = {
      questionId,
      userId: user.id,
      masteryScore: score,
      isMarkedWrong: isWrong
    };
    
    try {
      const result = await db.recordAttempt(attempt);
      if (!result.success) throw new Error(result.error);
      
      setAttempts([...attempts, result.data]);
      alert(`已记录 ${score} 星评分${isWrong ? '并标记为错题' : ''}！`);
    } catch (error) {
      console.error('记录学习失败:', error);
      alert('记录学习失败，请重试。');
    }
  };

  const updateQuestion = async (id, updates) => {
    try {
      const result = await db.updateQuestion(id, updates);
      if (!result.success) throw new Error(result.error);
      
      // 重新加载题目列表
      const questionsResult = await db.getQuestions();
      if (questionsResult.success) {
        setQuestions(questionsResult.data || []);
      }
      
      setEditingQuestion(null);
      alert('题目更新成功！');
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败，请检查网络连接。');
    }
  };

  // 获取题目的答题记录
  const getQuestionAttempts = (questionId) => {
    return attempts.filter(a => a.question_id === questionId);
  };

  // 计算题目平均分
  const getAverageScore = (questionId) => {
    const questionAttempts = getQuestionAttempts(questionId);
    if (questionAttempts.length === 0) return 0;
    return (questionAttempts.reduce((sum, a) => sum + a.mastery_score, 0) / questionAttempts.length).toFixed(1);
  };

  // 检查是否标记为错题
  const isMarkedWrong = (questionId) => {
    return attempts.some(a => a.question_id === questionId && a.is_marked_wrong);
  };

  // 筛选题目
  const filteredQuestions = questions.filter(q => {
    const paper = q.papers;
    if (!paper) return false;
    
    return (!filters.teacher || paper.teacher === filters.teacher) &&
           (!filters.semester || paper.semester === filters.semester) &&
           (!filters.category || paper.math_category === filters.category) &&
           (!filters.paperId || q.paper_id === filters.paperId) &&
           (!filters.courseName || paper.course_name === filters.courseName) &&
           (!filters.masteryLevel || 
            (filters.masteryLevel === 'unfamiliar' && getAverageScore(q.id) <= 2) ||
            (filters.masteryLevel === 'familiar' && getAverageScore(q.id) >= 4) ||
            (filters.masteryLevel === 'wrong' && isMarkedWrong(q.id)));
  });

  // 获取所有老师列表
  const getTeachers = () => {
    return [...new Set(papers.map(p => p.teacher))].filter(Boolean);
  };

  // 获取所有学期列表
  const getSemesters = () => {
    return [...new Set(papers.map(p => p.semester))].filter(Boolean);
  };

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
    <div className="bg-green-50 p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
        <Github size={20} />
        ✅ 系统已完成数据库升级
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white p-4 rounded border">
          <h4 className="font-medium text-gray-800 mb-3">📋 新数据库结构</h4>
          <div className="space-y-2 text-sm">
            {Object.entries({
              'papers表（试卷）': papers.length,
              'questions表（题目）': questions.length,
              'attempts表（练习记录）': attempts.length,
              'Clerk认证系统': '正常',
              'API接口统一': '完成'
            }).map(([item, status]) => (
              <div key={item} className="flex items-center justify-between">
                <span className="text-gray-700">{item}</span>
                <span className="text-green-600 font-medium">{status}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white p-4 rounded border">
          <h4 className="font-medium text-gray-800 mb-3">🔗 数据库连接状态</h4>
          <div className="text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Database size={16} className="text-green-500" />
              <span>模式: {db.getConnectionStatus().mode}</span>
            </div>
            <div className="text-gray-600 space-y-1">
              <p>• 状态: {db.getConnectionStatus().status}</p>
              <p>• 试卷数量: {papers.length}</p>
              <p>• 题目数量: {questions.length}</p>
              <p>• 学习记录: {attempts.length}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded border">
        <h4 className="font-medium text-gray-800 mb-3">🎯 升级完成</h4>
        <div className="text-sm text-gray-700 space-y-2">
          <p><strong>✅ 已完成:</strong></p>
          <ul className="ml-4 space-y-1">
            <li>• 数据库表结构重建：试卷+题目两层架构</li>
            <li>• 支持批量导入Markdown格式试卷</li>
            <li>• 支持按试卷、老师、分类、学期筛选</li>
            <li>• 完善的练习记录和熟练度追踪</li>
          </ul>
          <p className="text-green-600 mt-2">🚀 系统功能完整，可投入生产使用</p>
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
              <h1 className="text-xl font-bold text-gray-900">小学奥数题库系统</h1>
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
            {/* 录入题目 - 只有管理员可见 */}
            {isAdmin && (
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
            )}
            
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
            
            {/* 系统状态 - 只有管理员可见 */}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('deploy')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'deploy' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🚀 系统状态
              </button>
            )}
            
            {/* 用户管理 - 只有管理员可见 */}
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
                {/* 清空数据按钮 - 只有管理员可见 */}
                {isAdmin && (
                  <button
                    onClick={async () => {
                      if (!window.confirm('确定要清空所有数据吗？此操作不可撤销！')) return;
                      
                      try {
                        const result = await db.clearAll();
                        if (!result.success) throw new Error(result.error);
                        
                        setQuestions([]);
                        setPapers([]);
                        setAttempts([]);
                        alert('已清空所有数据！');
                      } catch (error) {
                        console.error('清空数据失败:', error);
                        alert('清空数据失败，请重试。');
                      }
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    🗑️ 清空数据
                  </button>
                )}
              </div>

              {/* QuestionInput 组件 */}
              <QuestionInput 
                questions={questions}
                setQuestions={setQuestions}
                db={db}
                user={user}
              />

              {/* 数据库统计 */}
              {(questions.length > 0 || papers.length > 0) && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">📊 数据库统计</h3>
                    <div className="flex gap-4 text-sm">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded">
                        📚 试卷: {papers.length}
                      </span>
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded">
                        💾 题目: {questions.length}
                      </span>
                      <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded">
                        📝 练习记录: {attempts.length}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 按分类统计 */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">📈 按分类统计：</h4>
                      <div className="space-y-2">
                        {mathCategories.map(category => {
                          const count = papers.filter(p => p.math_category === category).length;
                          return count > 0 ? (
                            <div key={category} className="flex justify-between text-sm">
                              <span>{category}:</span>
                              <span className="text-blue-600">{count}套试卷</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                    
                    {/* 按老师统计 */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">👨‍🏫 按老师统计：</h4>
                      <div className="space-y-2">
                        {getTeachers().map(teacher => {
                          const paperCount = papers.filter(p => p.teacher === teacher).length;
                          const questionCount = questions.filter(q => q.papers?.teacher === teacher).length;
                          return (
                            <div key={teacher} className="text-sm">
                              <div className="flex justify-between">
                                <span>{teacher}:</span>
                                <span className="text-blue-600">{paperCount}套试卷 / {questionCount}道题</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg mt-4">
                    <h4 className="font-medium text-green-800 mb-2">✅ 数据库连接状态</h4>
                    <div className="text-sm text-green-700">
                      <p>• 已连接到{db.getConnectionStatus().mode}数据库</p>
                      <p>• 状态: {db.getConnectionStatus().status}</p>
                      <p>• 支持试卷+题目两层架构，批量导入功能正常</p>
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
                    {getTeachers().map(teacher => (
                      <option key={teacher} value={teacher}>{teacher}</option>
                    ))}
                  </select>
                  <select
                    value={filters.semester}
                    onChange={(e) => setFilters({...filters, semester: e.target.value})}
                    className="p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">所有学期</option>
                    {getSemesters().map(semester => (
                      <option key={semester} value={semester}>{semester}</option>
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
                    value={filters.paperId}
                    onChange={(e) => setFilters({...filters, paperId: e.target.value})}
                    className="p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">所有试卷</option>
                    {papers.map(paper => (
                      <option key={paper.id} value={paper.id}>
                        {paper.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filters.masteryLevel}
                    onChange={(e) => setFilters({...filters, masteryLevel: e.target.value})}
                    className="p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">所有熟练度</option>
                    <option value="wrong">错题</option>
                    <option value="unfamiliar">不熟练(≤2星)</option>
                    <option value="familiar">熟练(≥4星)</option>
                  </select>
                  <button
                    onClick={() => setFilters({teacher: '', semester: '', category: '', paperId: '', masteryLevel: ''})}
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
                            {q.question_type}
                          </span>
                          {q.question_number && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              {q.question_number}
                            </span>
                          )}
                          {q.papers && (
                            <>
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                {q.papers.math_category}
                              </span>
                              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                                {q.papers.teacher}
                              </span>
                              {q.papers.semester && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                  {q.papers.semester}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        {q.papers && (
                          <div className="text-sm text-gray-600 mb-2">
                            📚 {q.papers.title}
                          </div>
                        )}
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
                      <p className="text-gray-700 whitespace-pre-line">{q.question_text}</p>
                    </div>
                    
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">答案：</h4>
                      <p className="text-gray-700 whitespace-pre-line">{q.answer}</p>
                    </div>
                    
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
                    {questions.length === 0 ? '数据库中还没有题目，去添加第一套试卷吧！' : '没有符合条件的题目'}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'practice' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🎯 练习模式</h2>
              
              {/* 练习条件筛选 */}
              <div className="bg-white p-6 rounded-lg border mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 选择练习范围</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">老师</label>
                    <select
                      value={filters.teacher}
                      onChange={(e) => setFilters({...filters, teacher: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">全部老师</option>
                      {getTeachers().map(teacher => (
                        <option key={teacher} value={teacher}>{teacher}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">学期</label>
                    <select
                      value={filters.semester}
                      onChange={(e) => setFilters({...filters, semester: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">全部学期</option>
                      {getSemesters().map(semester => (
                        <option key={semester} value={semester}>{semester}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                    <select
                      value={filters.category}
                      onChange={(e) => setFilters({...filters, category: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">全部分类</option>
                      {mathCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">课程名</label>
                    <select
                      value={filters.courseName || ''}
                      onChange={(e) => setFilters({...filters, courseName: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">全部课程</option>
                      {[...new Set(papers.map(p => p.course_name))].filter(Boolean).map(course => (
                        <option key={course} value={course}>{course}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters({teacher: '', semester: '', category: '', paperId: '', masteryLevel: '', courseName: ''})}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
                  >
                    清除条件
                  </button>
                  <div className="text-sm text-gray-600 py-2">
                    当前匹配: <span className="font-bold text-blue-600">{filteredQuestions.length}</span> 道题目
                  </div>
                </div>
              </div>

              {/* 练习统计 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-red-800 mb-2">❌ 错题复习</h3>
                  <p className="text-red-600 mb-4">复习已标记的错题</p>
                  <p className="text-2xl font-bold text-red-800">
                    {attempts.filter(a => a.is_marked_wrong).length}
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
                  <h3 className="text-lg font-semibold text-green-800 mb-2">🎲 当前范围</h3>
                  <p className="text-green-600 mb-4">根据筛选条件</p>
                  <p className="text-2xl font-bold text-green-800">
                    {filteredQuestions.length}
                  </p>
                  <p className="text-sm text-green-600">道题目可练习</p>
                </div>
              </div>

              {/* 练习题目列表 */}
              {filteredQuestions.length > 0 && (
                <div className="bg-white rounded-lg border">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">🎯 开始练习</h3>
                    <p className="text-sm text-gray-600">共 {filteredQuestions.length} 道题目</p>
                  </div>
                  <div className="p-6 space-y-4">
                    {filteredQuestions.slice(0, 20).map((q, index) => (
                      <PracticeQuestion 
                        key={q.id} 
                        question={q} 
                        index={index + 1}
                        onRate={(score, isWrong) => addAttempt(q.id, score, isWrong)}
                        getAverageScore={getAverageScore}
                        isMarkedWrong={isMarkedWrong}
                      />
                    ))}
                    {filteredQuestions.length > 20 && (
                      <div className="text-center py-4 text-gray-500">
                        显示前20道题目，共{filteredQuestions.length}道。调整筛选条件可缩小范围。
                      </div>
                    )}
                  </div>
                </div>
              )}

              {filteredQuestions.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p>没有符合条件的题目</p>
                  <p className="text-sm mt-2">请调整筛选条件或添加更多题目到题库</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'deploy' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🚀 系统状态</h2>
              {renderDeploymentPanel()}
              
              <div className="bg-white p-6 rounded-lg border mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 新数据库表结构</h3>
                <div className="bg-gray-100 p-4 rounded font-mono text-sm overflow-x-auto">
                  <div className="mb-4">
                    <p className="font-bold text-blue-600">-- papers表 (试卷表)</p>
                    <p>CREATE TABLE papers (</p>
                    <p>&nbsp;&nbsp;id UUID PRIMARY KEY DEFAULT gen_random_uuid(),</p>
                    <p>&nbsp;&nbsp;title TEXT NOT NULL,</p>
                    <p>&nbsp;&nbsp;teacher TEXT NOT NULL,</p>
                    <p>&nbsp;&nbsp;semester TEXT NOT NULL,</p>
                    <p>&nbsp;&nbsp;course_name TEXT NOT NULL,</p>
                    <p>&nbsp;&nbsp;math_category TEXT NOT NULL,</p>
                    <p>&nbsp;&nbsp;created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()</p>
                    <p>);</p>
                  </div>
                  <div className="mb-4">
                    <p className="font-bold text-green-600">-- questions表 (题目表)</p>
                    <p>CREATE TABLE questions (</p>
                    <p>&nbsp;&nbsp;id UUID PRIMARY KEY DEFAULT gen_random_uuid(),</p>
                    <p>&nbsp;&nbsp;paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,</p>
                    <p>&nbsp;&nbsp;question_type TEXT NOT NULL,</p>
                    <p>&nbsp;&nbsp;question_number TEXT,</p>
                    <p>&nbsp;&nbsp;question_text TEXT NOT NULL,</p>
                    <p>&nbsp;&nbsp;answer TEXT NOT NULL,</p>
                    <p>&nbsp;&nbsp;created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()</p>
                    <p>);</p>
                  </div>
                  <div className="mb-4">
                    <p className="font-bold text-purple-600">-- attempts表 (练习记录表)</p>
                    <p>CREATE TABLE attempts (</p>
                    <p>&nbsp;&nbsp;id BIGSERIAL PRIMARY KEY,</p>
                    <p>&nbsp;&nbsp;question_id UUID REFERENCES questions(id) ON DELETE CASCADE,</p>
                    <p>&nbsp;&nbsp;user_id TEXT,</p>
                    <p>&nbsp;&nbsp;mastery_score INTEGER CHECK (mastery_score &gt;= 1 AND mastery_score &lt;= 5),</p>
                    <p>&nbsp;&nbsp;is_marked_wrong BOOLEAN DEFAULT FALSE,</p>
                    <p>&nbsp;&nbsp;created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()</p>
                    <p>);</p>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">✅ 数据库升级完成</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• 试卷+题目两层架构，支持按试卷组织题目</li>
                    <li>• 支持Markdown格式批量导入功能</li>
                    <li>• 完善的练习记录和熟练度追踪</li>
                    <li>• 支持多维度筛选：老师、分类、学期、试卷</li>
                    <li>• 级联删除确保数据一致性</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">🎯 当前状态</h4>
                <p className="text-blue-700 text-sm">
                  系统数据库结构升级完成，前端代码已适配新表结构。
                  支持试卷级录入、批量导入、多维度筛选等功能，可以投入生产使用。
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
      <ModuleAccessGuard module="quiz">
        <QuizApp />
      </ModuleAccessGuard>
    </ClerkAuthProvider>
  );
};

export default App;