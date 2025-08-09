// src/utils/constants.js
// 系统常量配置

// 奥数七大分类
export const MATH_CATEGORIES = [
  '计算', '计数', '几何', '数论', '应用题', '行程', '组合'
];

// 所有分类（包括其他）
export const ALL_CATEGORIES = [
  '行程', '组合', '数论', '几何', '计算', '应用题', '逻辑推理', '计数', '其他'
];

// 题目类型
export const QUESTION_TYPES = [
  '例1', '例2', '例3', '例4', '例5', 
  '习题1', '习题2', '习题3', '习题4', '习题5'
];

// 老师列表
export const TEACHERS = [
  '岛主', '普老师', '张老师', '李老师'
];

// 学期配置
export const SEMESTERS = [
  '四上', '四下', '四暑', '四寒',
  '五上', '五下', '五暑', '五寒', '五竞',
  '六上', '六下', '六暑', '六寒', '六竞'
];

// 熟练度等级
export const MASTERY_LEVELS = [
  { key: 'wrong', label: '错题', color: 'red' },
  { key: 'unfamiliar', label: '不熟练', color: 'yellow' },
  { key: 'average', label: '一般', color: 'blue' },
  { key: 'familiar', label: '熟练', color: 'green' }
];

// 熟练度标签
export const MASTERY_TAGS = ['错题', '不熟练', '一般', '熟练'];

// 星级评分配置
export const STAR_RATINGS = [
  { score: 1, label: '很不熟练', description: '完全不会做' },
  { score: 2, label: '不熟练', description: '需要很多提示' },
  { score: 3, label: '一般', description: '能独立完成但有困难' },
  { score: 4, label: '熟练', description: '能够独立快速完成' },
  { score: 5, label: '非常熟练', description: '完全掌握，可以举一反三' }
];

// 筛选器配置
export const FILTER_OPTIONS = {
  masteryLevel: [
    { value: '', label: '所有熟悉度' },
    { value: 'unfamiliar', label: '不熟悉 (≤2星)' },
    { value: 'average', label: '一般 (3星)' },
    { value: 'familiar', label: '熟悉 (≥4星)' },
    { value: 'wrong', label: '错题' }
  ],
  masteryTag: [
    { value: '', label: '所有熟练度' },
    { value: '错题', label: '错题' },
    { value: '不熟练', label: '不熟练' },
    { value: '一般', label: '一般' },
    { value: '熟练', label: '熟练' }
  ]
};

// 练习模式配置
export const PRACTICE_MODES = [
  {
    key: 'errorReview',
    title: '错题复习',
    description: '复习已标记的错题',
    icon: '❌',
    color: 'red'
  },
  {
    key: 'weakSpots',
    title: '不熟悉题目',
    description: '评分1-2星的题目',
    icon: '⭐',
    color: 'yellow'
  },
  {
    key: 'randomPractice',
    title: '随机练习',
    description: '从题库中随机抽取',
    icon: '🎲',
    color: 'green'
  }
];

// 标签样式映射
export const TAG_STYLES = {
  // 熟练度标签
  mastery: {
    '错题': 'bg-red-100 text-red-800 border-red-200',
    '不熟练': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    '一般': 'bg-blue-100 text-blue-800 border-blue-200',
    '熟练': 'bg-green-100 text-green-800 border-green-200'
  },
  
  // 分类标签
  category: {
    '计数': 'bg-purple-100 text-purple-800 border-purple-200',
    '组合': 'bg-purple-100 text-purple-800 border-purple-200',
    '几何': 'bg-purple-100 text-purple-800 border-purple-200',
    '数论': 'bg-purple-100 text-purple-800 border-purple-200',
    '应用题': 'bg-purple-100 text-purple-800 border-purple-200',
    '行程': 'bg-purple-100 text-purple-800 border-purple-200',
    '计算': 'bg-purple-100 text-purple-800 border-purple-200'
  },
  
  // 默认样式
  default: {
    teacher: 'bg-orange-100 text-orange-800 border-orange-200',
    semester: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    lesson: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    questionType: 'bg-blue-100 text-blue-600 border-blue-200',
    generic: 'bg-gray-100 text-gray-600 border-gray-200'
  }
};

// Markdown解析配置
export const MARKDOWN_PATTERNS = {
  // 题目识别模式
  questionPatterns: [
    /^##\s*(例\d+)\.\s*(.+)$/,           // ## 例1. 题目内容
    /^##\s*(例\d+)[:：]\s*(.+)$/,        // ## 例1: 题目内容
    /^##\s*(例\d+)\s+(.+)$/,             // ## 例1 题目内容
    /^\*\*(例\d+)\.\s*(.+)\*\*$/,        // **例1. 题目内容**
    /^(例\d+)\.\s*(.+)$/,                // 例1. 题目内容
    /^##\s*(习题\d+)\.\s*(.+)$/,         // ## 习题1. 题目内容
    /^(习题\d+)\.\s*(.+)$/               // 习题1. 题目内容
  ],
  
  // 答案识别模式
  answerPatterns: [
    /答案[：:]\s*(.+)/,                   // 答案: 内容
    /\*\*最终答案[：:]\s*(.+?)\*\*/,      // **最终答案: 内容**
    /最终答案[：:]\s*(.+)/                // 最终答案: 内容
  ],
  
  // 解题思路标识
  solutionKeywords: ['解题思路', '### 解题思路', '解析', '分析']
};

// 系统配置
export const SYSTEM_CONFIG = {
  // 数据库配置
  database: {
    maxRetries: 3,
    timeout: 10000,
    batchSize: 50
  },
  
  // UI配置
  ui: {
    itemsPerPage: 20,
    maxTagsDisplay: 8,
    maxTextPreview: 100,
    animationDuration: 300
  },
  
  // 调试配置
  debug: {
    enabled: process.env.NODE_ENV === 'development',
    maxLogEntries: 50,
    verboseLogging: false
  },
  
  // 导入配置
  import: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedFormats: ['txt', 'md', 'markdown'],
    maxQuestionsPerImport: 100
  }
};

// 验证规则
export const VALIDATION_RULES = {
  question: {
    questionText: {
      minLength: 5,
      maxLength: 2000,
      required: true
    },
    answer: {
      minLength: 1,
      maxLength: 1000,
      required: true
    },
    solutionSteps: {
      maxLength: 5000,
      required: false
    },
    tags: {
      minCount: 1,
      maxCount: 10,
      required: true
    }
  },
  
  attempt: {
    masteryScore: {
      min: 1,
      max: 5,
      required: true
    }
  }
};

// 错误消息
export const ERROR_MESSAGES = {
  network: '网络连接失败，请检查网络设置',
  database: '数据库操作失败，请稍后重试',
  validation: '输入数据格式不正确',
  notFound: '找不到指定的数据',
  permission: '权限不足，无法执行此操作',
  timeout: '操作超时，请稍后重试',
  import: {
    fileTooBig: '文件大小超过限制',
    formatError: '文件格式不支持',
    parseError: '文件解析失败',
    noQuestions: '未找到有效的题目内容'
  }
};

// 成功消息
export const SUCCESS_MESSAGES = {
  questionAdded: '题目添加成功！',
  questionUpdated: '题目更新成功！',
  questionDeleted: '题目删除成功！',
  questionsImported: (count) => `成功导入 ${count} 道题目！`,
  attemptRecorded: '学习记录保存成功！',
  dataCleared: '数据清空成功！'
};

// 部署配置
export const DEPLOYMENT_CONFIG = {
  environments: {
    development: {
      supabaseUrl: 'http://localhost:3000',
      debug: true
    },
    production: {
      supabaseUrl: process.env.REACT_APP_SUPABASE_URL,
      debug: false
    }
  },
  
  checklist: [
    { key: 'codeOptimized', label: '代码优化完成', required: true },
    { key: 'environmentVars', label: '环境变量配置', required: true },
    { key: 'supabaseConfigured', label: 'Supabase配置', required: true },
    { key: 'githubReady', label: 'GitHub准备', required: true },
    { key: 'deploymentTested', label: '部署测试', required: true }
  ]
};

// 统计配置
export const STATISTICS_CONFIG = {
  charts: {
    colors: {
      primary: '#3B82F6',
      secondary: '#10B981',
      accent: '#F59E0B',
      danger: '#EF4444'
    }
  },
  
  metrics: [
    { key: 'totalQuestions', label: '总题目数', icon: '📚' },
    { key: 'totalAttempts', label: '练习次数', icon: '⭐' },
    { key: 'errorCount', label: '错题数量', icon: '❌' },
    { key: 'masteryRate', label: '掌握率', icon: '🎯' }
  ]
};