import React, { useState } from 'react';
import { Star, Edit2, Eye, EyeOff } from 'lucide-react';
import QuestionPrintController from './QuestionPrintController';

// 安全的HTML渲染函数
const renderSafeHTML = (htmlContent) => {
  // 简单的净化：移除script标签和事件处理器
  let cleanContent = htmlContent
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
  
  return { __html: cleanContent };
};

// 练习题目组件
const PracticeQuestion = ({ question, index, onRate, onToggleWrong, getCurrentScore, isMarkedWrong, isAdmin }) => {
  const [showAnswer, setShowAnswer] = useState(false);

  // 渲染可点击的评分星星
  const renderClickableStars = (currentScore) => {
    return (
      <div className="flex items-center gap-1">
        {Array.from({length: 5}, (_, i) => (
          <button
            key={i}
            onClick={() => onRate(i + 1)}
            className="text-yellow-400 hover:text-yellow-500 transition-colors"
            title={`${i + 1}星熟练度`}
          >
            <Star 
              size={18} 
              className={i < currentScore ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-300'} 
            />
          </button>
        ))}
        <span className="text-sm text-gray-500 ml-2">({currentScore}星)</span>
      </div>
    );
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
            {isMarkedWrong(question.id) && (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                错题
              </span>
            )}
          </div>
          {question.papers && (
            <div className="text-sm text-gray-600 mb-2">
              📚 {question.papers.title}
            </div>
          )}
        </div>
        {/* 右上角：点击评分星星 + 显示当前评分 */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              className="text-gray-500 hover:text-blue-500 p-1"
              title="管理员编辑"
            >
              <Edit2 size={16} />
            </button>
          )}
          {renderClickableStars(getCurrentScore(question.id))}
        </div>
      </div>
      
      <div className="mb-4">
        <h4 className="font-medium text-gray-900 mb-2">题目：</h4>
        <div 
          className="text-gray-700 whitespace-pre-line"
          dangerouslySetInnerHTML={renderSafeHTML(question.question_text)}
        />
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
            <div 
              className="text-gray-700 whitespace-pre-line"
              dangerouslySetInnerHTML={renderSafeHTML(question.answer)}
            />
          </div>
        )}
      </div>
      
      {/* 左下角：只保留错题标记按钮 */}
      <div className="flex gap-2 pt-4 border-t border-gray-100">
        <button
          onClick={() => onToggleWrong()}
          className={`px-3 py-1 text-sm border rounded ${
            isMarkedWrong(question.id)
              ? 'bg-red-50 text-red-600 border-red-300 hover:bg-red-100'
              : 'text-red-500 hover:text-red-600 border-red-300 hover:bg-red-50'
          }`}
        >
          ❌ {isMarkedWrong(question.id) ? '取消错题' : '标记错题'}
        </button>
      </div>
    </div>
  );
};

const PracticeSection = ({
  questions,
  papers,
  filters,
  setFilters,
  mathCategories,
  addAttempt,
  toggleWrongQuestion,
  getCurrentScore,
  isMarkedWrong,
  getTeachers,
  getSemesters,
  isAdmin
}) => {
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
            (filters.masteryLevel === 'unfamiliar' && getCurrentScore(q.id) > 0 && getCurrentScore(q.id) <= 2) ||
            (filters.masteryLevel === 'familiar' && getCurrentScore(q.id) >= 4) ||
            (filters.masteryLevel === 'wrong' && isMarkedWrong(q.id)));
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">🎯 练习模式</h2>
      
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

      {filteredQuestions.length > 0 && (
        <QuestionPrintController 
          questions={filteredQuestions}
          filterInfo={{
            teacher: filters.teacher,
            mathCategory: filters.category,
            courseName: filters.courseName,
            semester: filters.semester
          }}
        />
      )}

      <div className="space-y-6">
        {filteredQuestions.map((question, index) => (
          <PracticeQuestion
            key={question.id}
            question={question}
            index={index + 1}
            onRate={(score) => addAttempt(question.id, score)}
            onToggleWrong={() => toggleWrongQuestion(question.id)}
            getCurrentScore={getCurrentScore}
            isMarkedWrong={isMarkedWrong}
            isAdmin={isAdmin}
          />
        ))}
        
        {filteredQuestions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {questions.length === 0 ? '数据库中还没有题目，去添加第一套试卷吧！' : '没有符合条件的题目'}
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticeSection;