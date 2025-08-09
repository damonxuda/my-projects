// src/utils/markdownParser.js
// Markdown解析引擎 - 专门解析AI生成的题目文档

import { MARKDOWN_PATTERNS, QUESTION_TYPES } from './constants.js';

/**
 * 解析Markdown文档，提取题目信息
 * @param {string} markdownText - Markdown文档内容
 * @param {string[]} baseTags - 基础标签（课程信息）
 * @returns {Object[]} - 解析出的题目数组
 */
export const parseMarkdownQuestions = (markdownText, baseTags = []) => {
  console.log('📖 开始解析Markdown文档');
  console.log('📝 文档长度:', markdownText.length);
  console.log('🏷️ 基础标签:', baseTags);

  if (!markdownText || typeof markdownText !== 'string') {
    console.warn('❌ 输入文档为空或格式错误');
    return [];
  }

  const lines = markdownText.split('\n');
  const questions = [];
  
  let currentQuestion = null;
  let currentSection = 'question'; // question, solution, answer
  let lineNumber = 0;

  console.log(`📄 总行数: ${lines.length}`);

  for (const line of lines) {
    lineNumber++;
    const trimmedLine = line.trim();
    
    // 跳过空行
    if (!trimmedLine) continue;

    // 检查是否是新题目开始
    const questionMatch = matchQuestionPattern(trimmedLine);
    
    if (questionMatch) {
      // 保存上一道题目
      if (currentQuestion && isValidQuestion(currentQuestion)) {
        const processedQuestion = processQuestion(currentQuestion, baseTags);
        questions.push(processedQuestion);
        console.log(`✅ 完成题目: ${processedQuestion.questionType}`);
      }

      // 开始新题目
      console.log(`🆕 发现新题目: ${questionMatch.type} (行 ${lineNumber})`);
      currentQuestion = {
        questionType: questionMatch.type,
        questionText: questionMatch.content || '',
        answer: '',
        solutionSteps: '',
        rawLine: trimmedLine,
        startLine: lineNumber
      };
      currentSection = 'question';
      continue;
    }

    // 如果没有当前题目，跳过这行
    if (!currentQuestion) continue;

    // 检查解题思路标识
    if (isSolutionSection(trimmedLine)) {
      console.log(`💡 进入解题思路部分 (行 ${lineNumber})`);
      currentSection = 'solution';
      continue;
    }

    // 检查答案标识
    const answerMatch = matchAnswerPattern(trimmedLine);
    if (answerMatch) {
      console.log(`✅ 找到答案 (行 ${lineNumber}): ${answerMatch.substring(0, 50)}...`);
      currentQuestion.answer = answerMatch;
      continue;
    }

    // 处理普通内容行
    if (isContentLine(trimmedLine)) {
      processContentLine(currentQuestion, trimmedLine, currentSection);
    }
  }

  // 处理最后一道题目
  if (currentQuestion && isValidQuestion(currentQuestion)) {
    const processedQuestion = processQuestion(currentQuestion, baseTags);
    questions.push(processedQuestion);
    console.log(`✅ 完成最后一题: ${processedQuestion.questionType}`);
  }

  console.log(`🎉 解析完成! 共解析出 ${questions.length} 道题目`);
  return questions;
};

/**
 * 匹配题目模式
 */
const matchQuestionPattern = (line) => {
  for (const pattern of MARKDOWN_PATTERNS.questionPatterns) {
    const match = line.match(pattern);
    if (match) {
      return {
        type: match[1],           // 例1, 习题1等
        content: match[2] || '',  // 题目内容
        fullMatch: match[0]
      };
    }
  }
  return null;
};

/**
 * 匹配答案模式
 */
const matchAnswerPattern = (line) => {
  for (const pattern of MARKDOWN_PATTERNS.answerPatterns) {
    const match = line.match(pattern);
    if (match) {
      return match[1].replace(/\*+/g, '').trim();
    }
  }
  return null;
};

/**
 * 检查是否是解题思路部分
 */
const isSolutionSection = (line) => {
  return MARKDOWN_PATTERNS.solutionKeywords.some(keyword => 
    line.includes(keyword)
  );
};

/**
 * 检查是否是有效的内容行
 */
const isContentLine = (line) => {
  // 排除Markdown标记行
  const excludePatterns = [
    /^#+\s/,           // 标题行
    /^-{3,}$/,         // 分隔线
    /^\*{3,}$/,        // 分隔线
    /^={3,}$/,         // 分隔线
    /^\s*$/            // 空行
  ];

  return !excludePatterns.some(pattern => pattern.test(line)) && 
         line.length > 2;
};

/**
 * 处理内容行
 */
const processContentLine = (question, line, section) => {
  if (section === 'solution') {
    question.solutionSteps += line + '\n';
  } else if (section === 'question') {
    // 如果题目文字为空，这是第一行
    if (!question.questionText || question.questionText.trim() === '') {
      question.questionText = line;
    } else {
      // 否则追加到题目内容（用空格连接）
      question.questionText += ' ' + line;
    }
  }
};

/**
 * 验证题目是否有效
 */
const isValidQuestion = (question) => {
  const hasValidType = QUESTION_TYPES.includes(question.questionType);
  const hasContent = question.questionText && question.questionText.trim().length > 5;
  
  if (!hasValidType) {
    console.warn(`⚠️ 无效的题目类型: ${question.questionType}`);
  }
  
  if (!hasContent) {
    console.warn(`⚠️ 题目内容过短或为空: ${question.questionText}`);
  }
  
  return hasValidType && hasContent;
};

/**
 * 处理题目，添加基础信息
 */
const processQuestion = (rawQuestion, baseTags) => {
  return {
    questionType: rawQuestion.questionType,
    questionText: cleanText(rawQuestion.questionText),
    answer: cleanText(rawQuestion.answer),
    solutionSteps: cleanText(rawQuestion.solutionSteps),
    tags: [...baseTags], // 使用传入的基础标签
    createdAt: new Date().toISOString(),
    metadata: {
      parsedAt: new Date().toISOString(),
      startLine: rawQuestion.startLine,
      originalLength: rawQuestion.questionText.length
    }
  };
};

/**
 * 清理文本内容
 */
const cleanText = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .trim()                          // 去除首尾空格
    .replace(/\*+/g, '')            // 去除Markdown粗体标记
    .replace(/_{2,}/g, '')          // 去除下划线
    .replace(/\s+/g, ' ')           // 合并多个空格
    .replace(/\n\s*\n/g, '\n')      // 合并多个换行
    .trim();
};

/**
 * 验证解析结果
 */
export const validateParseResult = (questions) => {
  const validation = {
    isValid: true,
    totalQuestions: questions.length,
    issues: [],
    statistics: {
      byType: {},
      averageLength: 0,
      withAnswers: 0,
      withSolutions: 0
    }
  };

  let totalLength = 0;

  questions.forEach((question, index) => {
    // 统计题目类型
    validation.statistics.byType[question.questionType] = 
      (validation.statistics.byType[question.questionType] || 0) + 1;

    // 统计长度
    totalLength += question.questionText.length;

    // 统计答案和解题思路
    if (question.answer && question.answer.trim()) {
      validation.statistics.withAnswers++;
    }
    
    if (question.solutionSteps && question.solutionSteps.trim()) {
      validation.statistics.withSolutions++;
    }

    // 检查问题
    if (question.questionText.length < 10) {
      validation.issues.push(`题目 ${index + 1} 内容过短`);
    }
    
    if (!question.answer || !question.answer.trim()) {
      validation.issues.push(`题目 ${index + 1} 缺少答案`);
    }
    
    if (question.tags.length === 0) {
      validation.issues.push(`题目 ${index + 1} 缺少标签`);
    }
  });

  validation.statistics.averageLength = questions.length > 0 
    ? Math.round(totalLength / questions.length) 
    : 0;

  validation.isValid = validation.issues.length === 0;

  return validation;
};

/**
 * 生成解析报告
 */
export const generateParseReport = (questions, originalText) => {
  const validation = validateParseResult(questions);
  
  const report = {
    timestamp: new Date().toISOString(),
    input: {
      originalLength: originalText.length,
      lineCount: originalText.split('\n').length
    },
    output: {
      questionCount: questions.length,
      successRate: questions.length > 0 ? '100%' : '0%'
    },
    validation,
    recommendations: []
  };

  // 生成建议
  if (validation.statistics.withAnswers < questions.length) {
    report.recommendations.push('建议为所有题目添加标准答案');
  }
  
  if (validation.statistics.withSolutions < questions.length * 0.8) {
    report.recommendations.push('建议为更多题目添加解题思路');
  }
  
  if (validation.issues.length > 0) {
    report.recommendations.push('请检查并修复发现的问题');
  }

  return report;
};

/**
 * 导出解析统计
 */
export const getParseStatistics = (questions) => {
  const stats = {
    total: questions.length,
    byType: {},
    byCategory: {},
    quality: {
      withAnswers: 0,
      withSolutions: 0,
      averageTextLength: 0,
      averageAnswerLength: 0
    }
  };

  let totalTextLength = 0;
  let totalAnswerLength = 0;

  questions.forEach(question => {
    // 按类型统计
    stats.byType[question.questionType] = (stats.byType[question.questionType] || 0) + 1;

    // 按分类统计
    const categories = question.tags.filter(tag => 
      ['计算', '计数', '几何', '数论', '应用题', '行程', '组合'].includes(tag)
    );
    categories.forEach(category => {
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });

    // 质量统计
    totalTextLength += question.questionText.length;
    if (question.answer) {
      stats.quality.withAnswers++;
      totalAnswerLength += question.answer.length;
    }
    if (question.solutionSteps && question.solutionSteps.trim()) {
      stats.quality.withSolutions++;
    }
  });

  stats.quality.averageTextLength = questions.length > 0 
    ? Math.round(totalTextLength / questions.length) 
    : 0;
  
  stats.quality.averageAnswerLength = stats.quality.withAnswers > 0 
    ? Math.round(totalAnswerLength / stats.quality.withAnswers)
    : 0;

  return stats;
};

/**
 * 检测重复题目
 */
export const detectDuplicates = (newQuestions, existingQuestions) => {
  const duplicates = [];
  const uniqueQuestions = [];

  newQuestions.forEach((newQ, index) => {
    const isExisting = existingQuestions.some(existingQ => 
      isSimilarQuestion(newQ, existingQ)
    );
    
    const isDuplicateInBatch = uniqueQuestions.some(uniqueQ => 
      isSimilarQuestion(newQ, uniqueQ)
    );

    if (isExisting || isDuplicateInBatch) {
      duplicates.push({
        index,
        question: newQ,
        reason: isExisting ? 'exists_in_database' : 'duplicate_in_batch'
      });
    } else {
      uniqueQuestions.push(newQ);
    }
  });

  return {
    duplicates,
    uniqueQuestions,
    duplicateCount: duplicates.length,
    uniqueCount: uniqueQuestions.length
  };
};

/**
 * 判断两个题目是否相似
 */
const isSimilarQuestion = (q1, q2) => {
  // 简单的相似度检测：比较题目开头30个字符
  const text1 = q1.questionText.substring(0, 30).replace(/\s+/g, '');
  const text2 = q2.questionText.substring(0, 30).replace(/\s+/g, '');
  
  return text1 === text2;
};

/**
 * 预处理Markdown文档
 */
export const preprocessMarkdown = (markdownText) => {
  if (!markdownText || typeof markdownText !== 'string') {
    return '';
  }

  return markdownText
    // 统一换行符
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    
    // 清理多余的空行
    .replace(/\n{3,}/g, '\n\n')
    
    // 统一标题格式
    .replace(/^#+\s*/gm, '## ')
    
    // 清理行首空格
    .replace(/^\s+/gm, '')
    
    // 清理行尾空格
    .replace(/\s+$/gm, '')
    
    .trim();
};

/**
 * 提取文档元信息
 */
export const extractDocumentMeta = (markdownText) => {
  const meta = {
    hasQuestions: false,
    questionCount: 0,
    hasAnswers: false,
    hasSolutions: false,
    estimatedProcessingTime: 0,
    detectedPatterns: []
  };

  if (!markdownText) return meta;

  // 检测题目模式
  MARKDOWN_PATTERNS.questionPatterns.forEach((pattern, index) => {
    const matches = markdownText.match(new RegExp(pattern.source, 'gm'));
    if (matches && matches.length > 0) {
      meta.hasQuestions = true;
      meta.questionCount = Math.max(meta.questionCount, matches.length);
      meta.detectedPatterns.push({
        pattern: index,
        matches: matches.length,
        examples: matches.slice(0, 3)
      });
    }
  });

  // 检测答案
  MARKDOWN_PATTERNS.answerPatterns.forEach(pattern => {
    const matches = markdownText.match(new RegExp(pattern.source, 'gm'));
    if (matches && matches.length > 0) {
      meta.hasAnswers = true;
    }
  });

  // 检测解题思路
  meta.hasSolutions = MARKDOWN_PATTERNS.solutionKeywords.some(keyword => 
    markdownText.includes(keyword)
  );

  // 估算处理时间（毫秒）
  meta.estimatedProcessingTime = Math.max(100, markdownText.length / 100);

  return meta;
};

/**
 * 修复常见的格式问题
 */
export const fixCommonFormatIssues = (markdownText) => {
  return markdownText
    // 修复题目编号格式
    .replace(/例(\d+)[\.．：:]/g, '例$1. ')
    .replace(/习题(\d+)[\.．：:]/g, '习题$1. ')
    
    // 修复答案格式
    .replace(/答案[：:]\s*/g, '答案: ')
    .replace(/最终答案[：:]\s*/g, '最终答案: ')
    
    // 修复标题格式
    .replace(/^([例习]\d+[\.．：:].*)/gm, '## $1')
    
    // 修复解题思路格式
    .replace(/解题思路[：:]?\s*/g, '### 解题思路\n')
    
    // 修复中文标点
    .replace(/，\s*/g, '，')
    .replace(/。\s*/g, '。')
    .replace(/；\s*/g, '；')
    
    // 清理多余空格
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n');
};

/**
 * 智能分段处理
 */
export const intelligentSegmentation = (markdownText) => {
  const segments = [];
  const lines = markdownText.split('\n');
  let currentSegment = [];
  let segmentType = 'unknown';

  lines.forEach(line => {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      if (currentSegment.length > 0) {
        currentSegment.push('');
      }
      return;
    }

    // 检测新的题目段落
    const isQuestionStart = matchQuestionPattern(trimmedLine);
    if (isQuestionStart) {
      // 保存当前段落
      if (currentSegment.length > 0) {
        segments.push({
          type: segmentType,
          content: currentSegment.join('\n'),
          lineCount: currentSegment.length
        });
      }
      
      // 开始新段落
      currentSegment = [trimmedLine];
      segmentType = 'question';
      return;
    }

    // 添加到当前段落
    currentSegment.push(trimmedLine);
  });

  // 保存最后一个段落
  if (currentSegment.length > 0) {
    segments.push({
      type: segmentType,
      content: currentSegment.join('\n'),
      lineCount: currentSegment.length
    });
  }

  return segments;
};