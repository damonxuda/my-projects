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
      // 使用DatabaseService的addQuestion方法，传入用户信息
      const result = await db.addQuestion(question, user);
      if (!result.success) throw new Error(result.error);
      
      setQuestions([...questions, result.data]);
      setShowAddForm(false);
      alert('题目添加成功并保存到数据库！');
    } catch (error) {
      console.error('添加失败:', error);
      
      if (error.message.includes('未通过审批')) {
        alert('您的账户正在审核中，暂无权限添加题目。请等待管理员批准。');
      } else if (error.message.includes('未登录')) {
        alert('请先登录再添加题目。');
      } else {
        alert('添加失败：' + error.message);
      }
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

      // 逐个添加题目，确保权限检查
      for (const question of questionsToImport) {
        try {
          const result = await db.addQuestion(question, user);
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
      
      if (error.message.includes('未通过审批')) {
        alert('您的账户正在审核中，暂无权限导入题目。请等待管理员批准。');
      } else if (error.message.includes('未登录')) {
        alert('请先登录再导入题目。');
      } else {
        alert('导入失败：' + error.message);
      }
    }
  };

  // 检查用户权限
  const canAddQuestions = () => {
    return user && user.emailAddresses && user.emailAddresses.length > 0;
  };

  return (
    <div>
      {/* 权限提示 */}
      {!canAddQuestions() && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            🔒 <strong>权限提示：</strong>您需要登录并通过管理员审批后才能添加或导入题目。
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
      
      {/* 用户状态信息 */}
      {user && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            👤 <strong>当前用户：</strong>{user.emailAddresses?.[0]?.emailAddress}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            所有题目操作都会记录您的身份信息以确保数据安全。
          </p>
        </div>
      )}
    </div>
  );
};

export default QuestionInput;