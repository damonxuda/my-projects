import React, { useState } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import ImportForm from './ImportForm';
import ManualForm from './ManualForm';

// 临时常量定义（之后从 constants.js 导入）
const MATH_CATEGORIES = ['计算', '计数', '几何', '数论', '应用题', '行程', '组合'];
const CATEGORIES = ['行程', '组合', '数论', '几何', '计算', '应用题', '逻辑推理', '计数', '其他'];
const QUESTION_TYPES = ['例1', '例2', '例3', '例4', '例5', '习题1', '习题2', '习题3', '习题4', '习题5'];

const QuestionInput = ({ questions, setQuestions, db, user }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);

  const handleQuestionAdded = async (question) => {
    if (!user) {
      alert('请先登录再添加题目');
      return;
    }

    try {
      // 简化版：不传递用户信息，直接调用数据库
      const result = await db.addQuestion(question);
      if (!result.success) throw new Error(result.error);
      
      setQuestions([...questions, result.data]);
      setShowAddForm(false);
      alert('题目添加成功并保存到数据库！');
    } catch (error) {
      console.error('添加失败:', error);
      alert('添加失败：' + error.message);
    }
  };

  const handleQuestionsImported = async (questionsToImport) => {
    if (!user) {
      alert('请先登录再导入题目');
      return;
    }

    try {
      const successfulImports = [];
      const failedImports = [];

      // 简化版：直接添加题目，无权限检查
      for (const question of questionsToImport) {
        try {
          const result = await db.addQuestion(question);
          if (result.success) {
            successfulImports.push(result.data);
          } else {
            failedImports.push({ question, error: result.error });
          }
        } catch (error) {
          failedImports.push({ question, error: error.message });
        }
      }

      if (successfulImports.length > 0) {
        setQuestions([...questions, ...successfulImports]);
        setShowImportForm(false);
        
        if (failedImports.length > 0) {
          alert(`成功导入 ${successfulImports.length} 道题目，${failedImports.length} 道题目导入失败。`);
        } else {
          alert(`成功导入 ${successfulImports.length} 道题目！`);
        }
      } else {
        throw new Error('所有题目导入失败');
      }
    } catch (error) {
      console.error('批量导入失败:', error);
      alert('导入失败：' + error.message);
    }
  };

  // 简化的权限检查 - 只需要登录
  const canAddQuestions = () => {
    return user && user.emailAddresses && user.emailAddresses.length > 0;
  };

  return (
    <div>
      {/* 简化的权限提示 */}
      {!canAddQuestions() && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            🔒 <strong>权限提示：</strong>请先登录后再添加或导入题目。
          </p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowImportForm(!showImportForm)}
          disabled={!canAddQuestions()}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            canAddQuestions()
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <BookOpen size={20} />
          智能导入
        </button>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={!canAddQuestions()}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            canAddQuestions()
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Plus size={20} />
          手动添加
        </button>
      </div>

      {/* 智能导入表单 */}
      {showImportForm && canAddQuestions() && (
        <ImportForm
          onQuestionsImported={handleQuestionsImported}
          onCancel={() => setShowImportForm(false)}
          existingQuestions={questions}
          db={db}
          user={user}
          mathCategories={MATH_CATEGORIES}
        />
      )}

      {/* 手动添加表单 */}
      {showAddForm && canAddQuestions() && (
        <ManualForm
          onSubmit={handleQuestionAdded}
          onCancel={() => setShowAddForm(false)}
          categories={CATEGORIES}
          questionTypes={QUESTION_TYPES}
        />
      )}
      
      {/* 简化的用户状态信息 */}
      {user && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            ✅ <strong>已登录：</strong>{user.emailAddresses?.[0]?.emailAddress}
          </p>
          <p className="text-xs text-green-600 mt-1">
            您可以添加和导入题目到题库。
          </p>
        </div>
      )}
    </div>
  );
};

export default QuestionInput;