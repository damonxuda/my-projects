import { useAuth, UserProfile } from "../../../auth-clerk/src";
import React, { useState, useEffect } from "react";
import { User } from "lucide-react";
import db from "../services/DatabaseService.js";
import { MarkdownParser } from "../services/MarkdownParser";
import AdminSection from "./AdminSection";
import BrowseSection from "./BrowseSection";
import PracticeSection from "./PracticeSection";

const QuizMain = () => {
  const [activeTab, setActiveTab] = useState("input");
  const [questions, setQuestions] = useState([]);
  const [papers, setPapers] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 认证状态 - 使用Clerk
  const { user, isSignedIn, isAdmin, loading: authLoading, getCachedToken } = useAuth();

  // 跨模块导航功能 - 使用Clerk官方SSO机制
  const handleCrossModuleNavigation = (targetUrl) => {
    // 直接跳转，卫星应用会自动同步认证状态
    console.log('🚀 跨模块跳转 (Clerk SSO):', targetUrl);
    window.location.href = targetUrl;
  };

  // 筛选状态
  const [filters, setFilters] = useState({
    teacher: "",
    semester: "",
    category: "",
    paperId: "",
    masteryLevel: "",
    courseName: "",
  });

  // SSO入口：检测跨模块认证token并解析
  useEffect(() => {
    const handleCrossModuleAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('session');

      // 🔍 详细的URL参数调试
      console.log('🔍 Quiz当前URL:', window.location.href);
      console.log('🔍 URL查询字符串:', window.location.search);
      console.log('🔍 URLSearchParams对象:', urlParams.toString());
      console.log('🔍 所有URL参数:', Object.fromEntries(urlParams));
      console.log('🔍 session参数值:', sessionToken);

      if (sessionToken) {
        console.log('🔗 Quiz检测到跨模块认证token，处理中...');
        console.log('🔍 Token长度:', sessionToken.length);
        console.log('🔍 Token前50个字符:', sessionToken.substring(0, 50));

        try {
          // 🔥 手动解析JWT token并设置localStorage (Clerk官方推荐的跨应用认证方案)
          const tokenParts = sessionToken.split('.');
          console.log('🔍 Token分段数量:', tokenParts.length);

          if (tokenParts.length === 3) {
            console.log('🔍 Header长度:', tokenParts[0].length);
            console.log('🔍 Payload长度:', tokenParts[1].length);
            console.log('🔍 Signature长度:', tokenParts[2].length);

            const payload = JSON.parse(atob(tokenParts[1]));
            console.log('🔄 Quiz: 解析JWT token并设置localStorage');
            console.log('🔍 解析后的payload:', payload);

            const clerkData = {
              user: {
                id: payload.sub,
                emailAddresses: [{ emailAddress: payload.email || 'user@crossmodule.auth' }],
                firstName: payload.given_name || 'Cross',
                lastName: payload.family_name || 'Module'
              },
              session: {
                id: payload.sid,
                status: 'active'
              }
            };

            localStorage.setItem('__clerk_environment', JSON.stringify(clerkData));
            console.log('✅ Quiz localStorage设置完成，即将刷新页面');

            setTimeout(() => {
              window.location.reload();
            }, 100);
          }
        } catch (error) {
          console.error('❌ Quiz JWT解析失败:', error);
        }

        // 清理URL参数，避免token暴露
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    };

    handleCrossModuleAuth();
  }, []); // 只在组件挂载时执行一次

  // 分类和配置
  const mathCategories = [
    "计算",
    "计数",
    "几何",
    "数论",
    "应用题",
    "行程",
    "组合",
    "综合",
  ];

  // 初始化数据加载
  useEffect(() => {
    const initializeSystem = async () => {
      if (!isSignedIn || authLoading || !user) return;

      try {
        // 初始化数据库连接
        await db.initializeSupabase();

        // 添加这行调试代码
        await db.debugDatabaseState();

        // 并行加载所有数据
        const [questionsResult, papersResult, attemptsResult] =
          await Promise.all([
            db.getQuestions(),
            db.getPapers(),
            db.getAttempts({ userId: user.id }),
          ]);

        if (
          !questionsResult.success ||
          !papersResult.success ||
          !attemptsResult.success
        ) {
          throw new Error("数据加载失败");
        }

        setQuestions(questionsResult.data || []);
        setPapers(papersResult.data || []);
        setAttempts(attemptsResult.data || []);
      } catch (error) {
        console.error("系统初始化失败:", error);
        alert("系统初始化失败，请联系管理员。");
      } finally {
        setLoading(false);

        // 普通用户自动切换到可访问的选项卡
        if (!isAdmin && (activeTab === "input" || activeTab === "deploy")) {
          setActiveTab("browse");
        }
      }
    };

    initializeSystem();
  }, [isSignedIn, authLoading, user, isAdmin, activeTab]);

  // 学习记录操作
  const addAttempt = async (questionId, score) => {
    const attempt = {
      questionId,
      userId: user.id,
      masteryScore: score,
      isMarkedWrong: false,
    };

    try {
      const result = await db.recordAttempt(attempt);
      if (!result.success) throw new Error(result.error);

      setAttempts([...attempts, result.data]);
      alert(`已记录 ${score} 星评分！`);
    } catch (error) {
      console.error("记录学习失败:", error);
      alert("记录学习失败，请重试。");
    }
  };

  // 切换错题状态
  const toggleWrongQuestion = async (questionId) => {
    const currentlyWrong = isMarkedWrong(questionId);
    try {
      const attempt = {
        questionId,
        userId: user.id,
        masteryScore: null, // 错题切换不记录分数
        isMarkedWrong: !currentlyWrong,
      };

      const result = await db.recordAttempt(attempt);
      if (!result.success) throw new Error(result.error);

      setAttempts([...attempts, result.data]);
      alert(`已${currentlyWrong ? "取消" : "标记为"}错题！`);
    } catch (error) {
      console.error("标记错题失败:", error);
      alert("标记错题失败，请重试。");
    }
  };

  // 获取当前用户对题目的最新评分
  const getCurrentScore = (questionId) => {
    const userAttempts = attempts
      .filter(
        (a) =>
          a.question_id === questionId &&
          a.user_id === user.id &&
          a.mastery_score > 0
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return userAttempts.length > 0 ? userAttempts[0].mastery_score : 0;
  };

  // 检查当前用户是否标记为错题
  const isMarkedWrong = (questionId) => {
    const userAttempts = attempts
      .filter((a) => a.question_id === questionId && a.user_id === user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return userAttempts.length > 0 ? userAttempts[0].is_marked_wrong : false;
  };

  // 获取所有老师列表
  const getTeachers = () => {
    return [...new Set(papers.map((p) => p.teacher))].filter(Boolean);
  };

  // 获取所有学期列表
  const getSemesters = () => {
    return [...new Set(papers.map((p) => p.semester))].filter(Boolean);
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">正在加载题库系统...</p>
        </div>
      </div>
    );
  }

  const handleManualQuestionSubmit = async (questionData) => {
    try {
      // 创建 MarkdownParser 实例来处理 LaTeX 内容
      const parser = new MarkdownParser();
      
      // 如果是创建新试卷的情况
      if (questionData.createNewPaper) {
        // 处理题目文本中的 LaTeX
        const processedQuestionText = await parser.processLatexTags(
          questionData.questionData.question_text
        );
        const processedAnswer = await parser.processLatexTags(
          questionData.questionData.answer
        );
        
        // 更新处理后的内容
        questionData.questionData.question_text = processedQuestionText;
        questionData.questionData.answer = processedAnswer;
      } else {
        // 使用现有试卷的情况
        const processedQuestionText = await parser.processLatexTags(
          questionData.question_text
        );
        const processedAnswer = await parser.processLatexTags(
          questionData.answer
        );
        
        // 更新处理后的内容
        questionData.question_text = processedQuestionText;
        questionData.answer = processedAnswer;
      }
      
      const result = await db.addQuestion(questionData);
      if (!result.success) throw new Error(result.error);

      // 重新加载题目列表
      const questionsResult = await db.getQuestions();
      if (questionsResult.success) {
        setQuestions(questionsResult.data || []);
      }

      alert("单题添加成功！");
    } catch (error) {
      console.error("单题添加失败:", error);
      alert("添加失败：" + error.message);
    }
  };

  // 共享的props对象
  const sharedProps = {
    questions,
    setQuestions,
    papers,
    attempts,
    setAttempts,
    filters,
    setFilters,
    mathCategories,
    addAttempt,
    toggleWrongQuestion,
    getCurrentScore,
    isMarkedWrong,
    getTeachers,
    getSemesters,
    user,
    isAdmin,
    db,
    handleManualQuestionSubmit,
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg">
        {/* 优化后的顶部用户信息栏 */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">题库系统</h1>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User size={16} />
                <span>
                  {user?.emailAddresses?.[0]?.emailAddress || user?.firstName}
                </span>
                {isAdmin && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    管理员
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* 回首页按钮 */}
              <button
                onClick={() => handleCrossModuleNavigation("/")}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors"
              >
                🏠 首页
              </button>
              {/* 右上角登出按钮 */}
              <UserProfile showWelcome={false} afterSignOutUrl="/" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-600">请先登录以访问题库系统</p>
          </div>
        </div>

        {/* 导航栏 */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {/* 录入题目 - 只有管理员可见 */}
            {isAdmin && (
              <button
                onClick={() => setActiveTab("input")}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === "input"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                录入题目
              </button>
            )}

            <button
              onClick={() => setActiveTab("browse")}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === "browse"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              浏览题库 ({questions.length})
            </button>

            <button
              onClick={() => setActiveTab("practice")}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === "practice"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              练习模式
            </button>

            {/* 系统状态 - 只有管理员可见 */}
            {isAdmin && (
              <button
                onClick={() => setActiveTab("deploy")}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === "deploy"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                🚀 系统状态
              </button>
            )}
          </nav>
        </div>

        {/* 内容区域 */}
        <div className="p-6">
          {/* 管理员功能 */}
          {isAdmin && (activeTab === "input" || activeTab === "deploy") && (
            <AdminSection activeTab={activeTab} {...sharedProps} />
          )}

          {/* 浏览功能 */}
          {activeTab === "browse" && <BrowseSection {...sharedProps} />}

          {/* 练习功能 */}
          {activeTab === "practice" && <PracticeSection {...sharedProps} />}
        </div>
      </div>
    </div>
  );
};

export default QuizMain;
