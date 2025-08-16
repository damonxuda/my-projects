import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Upload } from 'lucide-react';

// 常量定义
const MATH_CATEGORIES = ['计算', '计数', '几何', '数论', '应用题', '行程', '组合'];
const QUESTION_TYPES = ['例题', '习题'];

const QuestionInput = ({ questions, setQuestions, db, user }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [papers, setPapers] = useState([]);

  // 试卷表单状态
  const [paperForm, setPaperForm] = useState({
    title: '',
    teacher: '',
    semester: '',
    courseName: '',
    mathCategory: ''
  });

  // 单题表单状态
  const [questionForm, setQuestionForm] = useState({
    paperId: '',
    questionType: '例题',
    questionNumber: '',
    questionText: '',
    answer: ''
  });

  // 批量导入状态
  const [batchForm, setBatchForm] = useState({
    teacher: '',
    semester: '',
    courseName: '',
    mathCategory: '',
    markdownText: ''
  });

  // 自动生成试卷标题
  const generatePaperTitle = (teacher, semester, courseName, mathCategory) => {
    const parts = [teacher, semester, courseName].filter(Boolean);
    if (parts.length === 0) {
      return `${mathCategory}练习题`;
    }
    return parts.join('');
  };

  // 加载试卷列表
  useEffect(() => {
    const loadPapers = async () => {
      try {
        const result = await db.getPapers();
        if (result.success) {
          setPapers(result.data || []);
        }
      } catch (error) {
        console.error('加载试卷列表失败:', error);
      }
    };
    
    if (user) {
      loadPapers();
    }
  }, [db, user]);

  // 单题添加
  const handleSingleQuestionSubmit = async (e) => {
    e.preventDefault();
    
    if (!questionForm.paperId) {
      alert('请选择试卷');
      return;
    }

    try {
      const result = await db.addQuestion({
        paperId: questionForm.paperId,
        questionType: questionForm.questionType,
        questionNumber: questionForm.questionNumber,
        questionText: questionForm.questionText,
        answer: questionForm.answer
      });

      if (!result.success) throw new Error(result.error);
      
      // 重新加载题目列表
      const questionsResult = await db.getQuestions();
      if (questionsResult.success) {
        setQuestions(questionsResult.data || []);
      }
      
      setQuestionForm({
        paperId: '',
        questionType: '例题',
        questionNumber: '',
        questionText: '',
        answer: ''
      });
      setShowAddForm(false);
      alert('题目添加成功！');
    } catch (error) {
      console.error('添加失败:', error);
      alert('添加失败：' + error.message);
    }
  };

  // 试卷+题目批量添加
  const handleBatchImport = async (e) => {
    e.preventDefault();
    
    if (!batchForm.teacher || !batchForm.semester || !batchForm.courseName || !batchForm.mathCategory || !batchForm.markdownText) {
      alert('请填写所有必填项：老师、学期、课程名、数学分类和题目内容');
      return;
    }

    try {
      // 自动生成试卷标题
      const title = generatePaperTitle(batchForm.teacher, batchForm.semester, batchForm.courseName, batchForm.mathCategory);
      
      // 解析Markdown格式的题目
      const parseResult = db.parseMarkdownQuestions(batchForm.markdownText);
      if (!parseResult.success) throw new Error(parseResult.error);
      
      const questions = parseResult.data;
      if (questions.length === 0) {
        throw new Error('没有解析到有效的题目，请检查格式');
      }

      // 添加试卷和题目
      const result = await db.addPaperWithQuestions(
        {
          title: title,
          teacher: batchForm.teacher,
          semester: batchForm.semester,
          courseName: batchForm.courseName,
          mathCategory: batchForm.mathCategory
        },
        questions
      );

      if (!result.success) throw new Error(result.error);

      // 更新界面数据
      setPapers([...papers, result.data.paper]);
      
      const questionsResult = await db.getQuestions();
      if (questionsResult.success) {
        setQuestions(questionsResult.data || []);
      }

      setBatchForm({
        teacher: '',
        semester: '',
        courseName: '',
        mathCategory: '',
        markdownText: ''
      });
      setShowBatchImport(false);
      
      const { questions: successQuestions, failed: failedQuestions } = result.data;
      if (failedQuestions.length > 0) {
        alert(`试卷"${title}"创建成功！成功导入 ${successQuestions.length} 道题目，${failedQuestions.length} 道题目导入失败。`);
      } else {
        alert(`试卷"${title}"创建成功！成功导入 ${successQuestions.length} 道题目！`);
      }
    } catch (error) {
      console.error('批量导入失败:', error);
      alert('导入失败：' + error.message);
    }
  };

  // 权限检查
  const canAddQuestions = () => {
    return user && user.emailAddresses && user.emailAddresses.length > 0;
  };

  return (
    <div>
      {/* 权限提示 */}
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
          onClick={() => setShowBatchImport(!showBatchImport)}
          disabled={!canAddQuestions()}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            canAddQuestions()
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Upload size={20} />
          批量导入试卷
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
          添加单题
        </button>
      </div>

      {/* 批量导入表单 */}
      {showBatchImport && canAddQuestions() && (
        <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">📝 批量导入试卷和题目</h3>
          <form onSubmit={handleBatchImport}>
            {/* 试卷信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  老师 *
                </label>
                <input
                  type="text"
                  value={batchForm.teacher}
                  onChange={(e) => setBatchForm({...batchForm, teacher: e.target.value})}
                  placeholder="请输入老师姓名"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  学期 *
                </label>
                <input
                  type="text"
                  value={batchForm.semester}
                  onChange={(e) => setBatchForm({...batchForm, semester: e.target.value})}
                  placeholder="请输入学期"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  课程名 *
                </label>
                <input
                  type="text"
                  value={batchForm.courseName}
                  onChange={(e) => setBatchForm({...batchForm, courseName: e.target.value})}
                  placeholder="请输入课程名"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  数学分类 *
                </label>
                <select
                  value={batchForm.mathCategory}
                  onChange={(e) => setBatchForm({...batchForm, mathCategory: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">请选择分类</option>
                  {MATH_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 题目内容 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                题目内容（Claude预处理的标准MD格式）*
              </label>
              <textarea
                value={batchForm.markdownText}
                onChange={(e) => setBatchForm({...batchForm, markdownText: e.target.value})}
                placeholder={`请粘贴Claude预处理的标准MD格式题目：

【例1】
这里是第一道例题的题目内容...

答案：这里是第一道题的答案

---

【第1题】
这里是第一道习题的题目内容...

答案：这里是答案

---

【例2】
第二道例题...

答案：答案内容`}
                className="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm"
                rows={12}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 请粘贴已由Claude预处理的标准MD格式，系统将自动解析【】题号、题目内容和答案
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
              >
                批量导入
              </button>
              <button
                type="button"
                onClick={() => setShowBatchImport(false)}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 单题添加表单 */}
      {showAddForm && canAddQuestions() && (
        <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">➕ 添加单道题目</h3>
          <form onSubmit={handleSingleQuestionSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  选择试卷 *
                </label>
                <select
                  value={questionForm.paperId}
                  onChange={(e) => setQuestionForm({...questionForm, paperId: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">请选择试卷</option>
                  {papers.map(paper => (
                    <option key={paper.id} value={paper.id}>
                      {paper.title} - {paper.teacher} ({paper.math_category})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  题目类型 *
                </label>
                <select
                  value={questionForm.questionType}
                  onChange={(e) => setQuestionForm({...questionForm, questionType: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  {QUESTION_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  题号
                </label>
                <input
                  type="text"
                  value={questionForm.questionNumber}
                  onChange={(e) => setQuestionForm({...questionForm, questionNumber: e.target.value})}
                  placeholder="例：例1、第1题"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  题目内容 *
                </label>
                <textarea
                  value={questionForm.questionText}
                  onChange={(e) => setQuestionForm({...questionForm, questionText: e.target.value})}
                  placeholder="请输入题目内容..."
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  rows={4}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  答案 *
                </label>
                <textarea
                  value={questionForm.answer}
                  onChange={(e) => setQuestionForm({...questionForm, answer: e.target.value})}
                  placeholder="请输入答案..."
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  rows={3}
                  required
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                添加题目
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 试卷列表 */}
      {papers.length > 0 && (
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-medium text-gray-800 mb-3">📚 现有试卷列表</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {papers.map(paper => (
              <div key={paper.id} className="p-3 bg-gray-50 rounded border">
                <div className="font-medium text-sm">{paper.title}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {paper.teacher} • {paper.math_category} • {paper.semester}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 用户状态信息 */}
      {user && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            ✅ <strong>已登录：</strong>{user.emailAddresses?.[0]?.emailAddress}
          </p>
          <p className="text-xs text-green-600 mt-1">
            您可以添加试卷和题目到题库。
          </p>
        </div>
      )}
    </div>
  );
};

export default QuestionInput;