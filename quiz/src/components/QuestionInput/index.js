import React, { useState } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import ImportForm from './ImportForm';
import ManualForm from './ManualForm';

// 临时常量定义（之后从 constants.js 导入）
const MATH_CATEGORIES = ['计算', '计数', '几何', '数论', '应用题', '行程', '组合'];
const CATEGORIES = ['行程', '组合', '数论', '几何', '计算', '应用题', '逻辑推理', '计数', '其他'];
const QUESTION_TYPES = ['例1', '例2', '例3', '例4', '例5', '习题1', '习题2', '习题3', '习题4', '习题5'];

const QuestionInput = ({ questions, setQuestions, db, addDebugInfo, showDebug }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);

  const handleQuestionAdded = async (question) => {
    try {
      const { data, error } = await db.insertQuestion(question);
      if (error) throw error;
      
      setQuestions([...questions, data]);
      setShowAddForm(false);
      alert('题目添加成功并保存到数据库！');
      
      if (showDebug && addDebugInfo) {
        addDebugInfo(`手动添加题目: ${question.questionType}`);
      }
    } catch (error) {
      console.error('添加失败:', error);
      alert('添加失败，请检查数据库连接');
    }
  };

  const handleQuestionsImported = (newQuestions) => {
    setQuestions([...questions, ...newQuestions]);
    setShowImportForm(false);
    
    if (showDebug && addDebugInfo) {
      addDebugInfo(`批量导入 ${newQuestions.length} 道题目`);
    }
  };

  return (
    <div>
      {/* 操作按钮 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowImportForm(!showImportForm)}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <BookOpen size={20} />
          智能导入
        </button>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={20} />
          手动添加
        </button>
      </div>

      {/* 智能导入表单 */}
      {showImportForm && (
        <ImportForm
          onQuestionsImported={handleQuestionsImported}
          onCancel={() => setShowImportForm(false)}
          existingQuestions={questions}
          db={db}
          addDebugInfo={addDebugInfo}
          mathCategories={MATH_CATEGORIES}
        />
      )}

      {/* 手动添加表单 */}
      {showAddForm && (
        <ManualForm
          onSubmit={handleQuestionAdded}
          onCancel={() => setShowAddForm(false)}
          categories={CATEGORIES}
          questionTypes={QUESTION_TYPES}
        />
      )}
    </div>
  );
};

export default QuestionInput;