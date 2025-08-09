// src/utils/tagParser.js
// 智能标签解析工具

import { MATH_CATEGORIES, QUESTION_TYPES } from './constants.js';

/**
 * 智能解析课程标签
 * @param {string} input - 输入的课程信息，如"岛主五竞暑第13讲计数综合二"
 * @returns {string[]} - 解析出的标签数组
 */
export const parseLabels = (input) => {
  console.log('🏷️ 开始解析标签:', input);
  
  if (!input || typeof input !== 'string') {
    console.warn('输入为空或格式错误');
    return [];
  }

  const tags = [];
  const normalizedInput = input.trim();

  // 1. 解析老师/机构
  const teacher = parseTeacher(normalizedInput);
  if (teacher) tags.push(teacher);

  // 2. 解析学期
  const semester = parseSemester(normalizedInput);
  if (semester) tags.push(semester);

  // 3. 解析讲次
  const lesson = parseLesson(normalizedInput);
  if (lesson) tags.push(lesson);

  // 4. 解析课程名称
  const courseName = parseCourseName(normalizedInput);
  if (courseName) tags.push(courseName);

  // 5. 智能推断分类
  const category = inferCategory(normalizedInput);
  if (category) tags.push(category);

  console.log('✅ 解析结果:', tags);
  return tags;
};

/**
 * 解析老师信息
 */
const parseTeacher = (input) => {
  if (input.includes('岛主')) return '岛主';
  if (input.includes('普老师')) return '普老师';
  if (input.includes('张老师')) return '张老师';
  if (input.includes('李老师')) return '李老师';
  
  // 默认返回岛主
  return '岛主';
};

/**
 * 解析学期信息
 */
const parseSemester = (input) => {
  // 匹配模式：四竞暑、五上、六下等
  const semesterPattern = /(四|五|六)(竞|上|下|暑|寒)/g;
  const matches = input.match(semesterPattern);
  
  if (matches && matches.length > 0) {
    return matches[0]; // 返回第一个匹配的学期
  }

  // 更灵活的匹配
  if (input.includes('四年级')) {
    if (input.includes('暑')) return '四暑';
    if (input.includes('寒')) return '四寒';
    if (input.includes('上')) return '四上';
    if (input.includes('下')) return '四下';
    if (input.includes('竞')) return '四竞';
  }
  
  if (input.includes('五年级')) {
    if (input.includes('暑')) return '五暑';
    if (input.includes('寒')) return '五寒';
    if (input.includes('上')) return '五上';
    if (input.includes('下')) return '五下';
    if (input.includes('竞')) return '五竞';
  }

  // 默认返回五竞暑
  return '五竞暑';
};

/**
 * 解析讲次信息
 */
const parseLesson = (input) => {
  // 匹配"第X讲"或"X讲"格式
  const lessonPatterns = [
    /第(\d+)讲/,           // 第13讲
    /第(十?\d*)讲/,        // 第十三讲
    /(\d+)讲/,             // 13讲
    /第(\d+)节/,           // 第13节
    /lesson\s*(\d+)/i      // lesson 13
  ];

  for (const pattern of lessonPatterns) {
    const match = input.match(pattern);
    if (match) {
      let num = match[1];
      
      // 处理中文数字转换
      num = convertChineseNumber(num);
      
      const lessonNum = parseInt(num);
      if (!isNaN(lessonNum) && lessonNum > 0) {
        return `第${lessonNum}讲`;
      }
    }
  }

  // 如果没有找到讲次，默认返回第1讲
  return '第1讲';
};

/**
 * 解析课程名称
 */
const parseCourseName = (input) => {
  // 匹配"第X讲"后面的内容
  const titlePattern = /第\d+讲\s*([^，,\s]+)/;
  const match = input.match(titlePattern);
  
  if (match && match[1]) {
    const title = match[1].trim();
    if (title.length > 0 && title.length < 20) { // 合理的标题长度
      return title;
    }
  }

  // 尝试匹配已知的课程模式
  const knownPatterns = [
    /(计数[^，,]*)/,
    /(组合[^，,]*)/,
    /(几何[^，,]*)/,
    /(数论[^，,]*)/,
    /(行程[^，,]*)/,
    /(应用题[^，,]*)/,
    /(计算[^，,]*)/,
    /(逻辑[^，,]*)/
  ];

  for (const pattern of knownPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
};

/**
 * 智能推断数学分类
 */
const inferCategory = (input) => {
  const categoryKeywords = {
    '计数': ['计数', '排列', '组合', '枚举', '分类计数'],
    '组合': ['组合', '排列组合', '搭配'],
    '几何': ['几何', '图形', '面积', '周长', '体积', '角度', '三角形', '正方形', '圆'],
    '数论': ['数论', '质数', '因数', '倍数', '整除', '余数', '奇偶'],
    '行程': ['行程', '速度', '时间', '距离', '相遇', '追及', '火车'],
    '应用题': ['应用', '实际问题', '生活', '购买', '年龄'],
    '计算': ['计算', '运算', '加减乘除', '分数', '小数', '百分数']
  };

  // 按优先级检查关键词
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => input.includes(keyword))) {
      return category;
    }
  }

  return null;
};

/**
 * 中文数字转阿拉伯数字
 */
const convertChineseNumber = (chineseNum) => {
  if (!chineseNum || typeof chineseNum !== 'string') return chineseNum;

  const chineseMap = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '零': 0
  };

  // 如果已经是数字，直接返回
  if (/^\d+$/.test(chineseNum)) {
    return chineseNum;
  }

  // 处理"十"开头的数字，如"十三"
  if (chineseNum.startsWith('十')) {
    if (chineseNum === '十') return '10';
    const remaining = chineseNum.substring(1);
    const digit = chineseMap[remaining];
    return digit ? String(10 + digit) : chineseNum;
  }

  // 处理"X十Y"格式，如"一十三"
  if (chineseNum.includes('十')) {
    const parts = chineseNum.split('十');
    const tens = chineseMap[parts[0]] || 1;
    const ones = parts[1] ? (chineseMap[parts[1]] || 0) : 0;
    return String(tens * 10 + ones);
  }

  // 单个中文数字
  const arabicNum = chineseMap[chineseNum];
  return arabicNum ? String(arabicNum) : chineseNum;
};

/**
 * 验证标签的有效性
 */
export const validateTags = (tags) => {
  if (!Array.isArray(tags)) return false;
  
  const validationRules = {
    hasTeacher: tags.some(tag => ['岛主', '普老师', '张老师', '李老师'].includes(tag)),
    hasSemester: tags.some(tag => /^(四|五|六)(竞|上|下|暑|寒)$/.test(tag)),
    hasLesson: tags.some(tag => /^第\d+讲$/.test(tag)),
    hasCategory: tags.some(tag => MATH_CATEGORIES.includes(tag))
  };

  return {
    isValid: Object.values(validationRules).every(Boolean),
    details: validationRules,
    suggestions: generateTagSuggestions(tags, validationRules)
  };
};

/**
 * 生成标签建议
 */
const generateTagSuggestions = (tags, validationRules) => {
  const suggestions = [];

  if (!validationRules.hasTeacher) {
    suggestions.push('建议添加老师标签：岛主、普老师等');
  }
  
  if (!validationRules.hasSemester) {
    suggestions.push('建议添加学期标签：五竞暑、四上等');
  }
  
  if (!validationRules.hasLesson) {
    suggestions.push('建议添加讲次标签：第13讲等');
  }
  
  if (!validationRules.hasCategory) {
    suggestions.push('建议添加分类标签：计数、几何、行程等');
  }

  return suggestions;
};

/**
 * 标签排序 - 按照推荐顺序排列
 */
export const sortTags = (tags) => {
  const order = {
    teacher: 1,    // 老师
    semester: 2,   // 学期  
    lesson: 3,     // 讲次
    title: 4,      // 课程名称
    category: 5,   // 分类
    mastery: 6     // 熟练度
  };

  return tags.sort((a, b) => {
    const typeA = getTagType(a);
    const typeB = getTagType(b);
    return (order[typeA] || 99) - (order[typeB] || 99);
  });
};

/**
 * 获取标签类型
 */
const getTagType = (tag) => {
  if (['岛主', '普老师', '张老师', '李老师'].includes(tag)) return 'teacher';
  if (/^(四|五|六)(竞|上|下|暑|寒)$/.test(tag)) return 'semester';
  if (/^第\d+讲$/.test(tag)) return 'lesson';
  if (MATH_CATEGORIES.includes(tag)) return 'category';
  if (['错题', '不熟练', '一般', '熟练'].includes(tag)) return 'mastery';
  return 'title';
};

/**
 * 标签去重和清理
 */
export const cleanTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  
  // 去重、去空、去特殊字符
  const cleaned = tags
    .filter(tag => tag && typeof tag === 'string')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .filter((tag, index, arr) => arr.indexOf(tag) === index); // 去重

  return sortTags(cleaned);
};

/**
 * 合并标签（用于更新题目标签时）
 */
export const mergeTags = (existingTags, newTags) => {
  const existing = Array.isArray(existingTags) ? existingTags : [];
  const additional = Array.isArray(newTags) ? newTags : [];
  
  // 移除旧的熟练度标签，保留其他标签
  const filteredExisting = existing.filter(tag => 
    !['错题', '不熟练', '一般', '熟练'].includes(tag)
  );
  
  return cleanTags([...filteredExisting, ...additional]);
};

/**
 * 从标签中提取特定信息
 */
export const extractFromTags = (tags) => {
  const info = {
    teacher: null,
    semester: null,
    lesson: null,
    lessonNumber: null,
    category: null,
    masteryLevel: null
  };

  if (!Array.isArray(tags)) return info;

  tags.forEach(tag => {
    if (['岛主', '普老师', '张老师', '李老师'].includes(tag)) {
      info.teacher = tag;
    } else if (/^(四|五|六)(竞|上|下|暑|寒)$/.test(tag)) {
      info.semester = tag;
    } else if (/^第(\d+)讲$/.test(tag)) {
      info.lesson = tag;
      const match = tag.match(/^第(\d+)讲$/);
      info.lessonNumber = match ? parseInt(match[1]) : null;
    } else if (MATH_CATEGORIES.includes(tag)) {
      info.category = tag;
    } else if (['错题', '不熟练', '一般', '熟练'].includes(tag)) {
      info.masteryLevel = tag;
    }
  });

  return info;
};

/**
 * 生成标签的显示样式类名
 */
export const getTagStyle = (tag) => {
  const styles = {
    // 熟练度标签
    '错题': 'bg-red-100 text-red-800',
    '不熟练': 'bg-yellow-100 text-yellow-800', 
    '一般': 'bg-blue-100 text-blue-800',
    '熟练': 'bg-green-100 text-green-800',
    
    // 分类标签
    '计数': 'bg-purple-100 text-purple-800',
    '组合': 'bg-purple-100 text-purple-800',
    '几何': 'bg-purple-100 text-purple-800',
    '数论': 'bg-purple-100 text-purple-800',
    '应用题': 'bg-purple-100 text-purple-800',
    '行程': 'bg-purple-100 text-purple-800',
    '计算': 'bg-purple-100 text-purple-800'
  };

  // 检查特定样式
  if (styles[tag]) return styles[tag];
  
  // 按模式匹配
  if (/^第\d+讲$/.test(tag)) return 'bg-indigo-100 text-indigo-800';
  if (['岛主', '普老师', '张老师', '李老师'].includes(tag)) return 'bg-orange-100 text-orange-800';
  if (/^(四|五|六)(竞|上|下|暑|寒)$/.test(tag)) return 'bg-cyan-100 text-cyan-800';
  
  // 默认样式
  return 'bg-gray-100 text-gray-600';
};