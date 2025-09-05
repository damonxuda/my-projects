import React, { useState, useEffect } from "react";
import { Check, X } from "lucide-react";

const ManualForm = ({
  onSubmit,
  onCancel,
  categories,
  questionTypes,
  papers = [],
  getTeachers = () => [],
  getSemesters = () => [],
}) => {
  const [newQuestion, setNewQuestion] = useState({
    // 试卷信息
    useExistingPaper: false,
    selectedPaperId: "",

    // 新试卷信息
    teacher: "",
    semester: "",
    courseName: "",
    mathCategory: categories[0] || "计算",

    // 题目信息
    questionType: questionTypes[0] || "例题",
    questionNumber: "",
    questionText: "",
    answer: "",
    solutionSteps: "",
  });

  // 获取现有的课程名列表
  const getExistingCourseNames = () => {
    return [...new Set(papers.map((p) => p.course_name))].filter(Boolean);
  };

  const handleSubmit = () => {
    if (!newQuestion.questionText.trim() || !newQuestion.answer.trim()) {
      alert("请输入题目内容和答案！");
      return;
    }

    // 验证必要的标签信息
    if (!newQuestion.useExistingPaper) {
      if (
        !newQuestion.teacher.trim() ||
        !newQuestion.semester.trim() ||
        !newQuestion.courseName.trim()
      ) {
        alert("请填写完整的试卷信息：老师、学期、课程名");
        return;
      }
    } else {
      if (!newQuestion.selectedPaperId) {
        alert("请选择一个现有试卷");
        return;
      }
    }

    let submissionData;

    if (newQuestion.useExistingPaper) {
      // 使用现有试卷
      submissionData = {
        paper_id: newQuestion.selectedPaperId,
        question_type: newQuestion.questionType,
        question_number: newQuestion.questionNumber,
        question_text: newQuestion.questionText,
        answer: newQuestion.solutionSteps
          ? newQuestion.answer + "\n\n解题思路：\n" + newQuestion.solutionSteps
          : newQuestion.answer,
      };
    } else {
      // 创建新试卷和题目
      const paperTitle = `${newQuestion.teacher}${newQuestion.semester}${newQuestion.courseName}`;

      submissionData = {
        // 标记为需要创建新试卷
        createNewPaper: true,
        paperData: {
          title: paperTitle,
          teacher: newQuestion.teacher,
          semester: newQuestion.semester,
          course_name: newQuestion.courseName,
          math_category: newQuestion.mathCategory,
        },
        questionData: {
          question_type: newQuestion.questionType,
          question_number: newQuestion.questionNumber,
          question_text: newQuestion.questionText,
          answer: newQuestion.solutionSteps
            ? newQuestion.answer +
              "\n\n解题思路：\n" +
              newQuestion.solutionSteps
            : newQuestion.answer,
        },
      };
    }

    onSubmit(submissionData);

    // 重置表单
    setNewQuestion({
      useExistingPaper: false,
      selectedPaperId: "",
      teacher: "",
      semester: "",
      courseName: "",
      mathCategory: categories[0] || "计算",
      questionType: questionTypes[0] || "例题",
      questionNumber: "",
      questionText: "",
      answer: "",
      solutionSteps: "",
    });
  };

  return (
    <div className="bg-gray-50 p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        ✏️ 手动添加题目
      </h3>

      {/* 试卷选择方式 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          试卷设置
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="paperChoice"
              checked={newQuestion.useExistingPaper}
              onChange={(e) =>
                setNewQuestion({
                  ...newQuestion,
                  useExistingPaper: e.target.checked,
                })
              }
              className="mr-2"
            />
            关联到现有试卷
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="paperChoice"
              checked={!newQuestion.useExistingPaper}
              onChange={(e) =>
                setNewQuestion({
                  ...newQuestion,
                  useExistingPaper: !e.target.checked,
                })
              }
              className="mr-2"
            />
            创建新试卷
          </label>
        </div>
      </div>

      {/* 现有试卷选择 */}
      {newQuestion.useExistingPaper && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            选择试卷 *
          </label>
          <select
            value={newQuestion.selectedPaperId}
            onChange={(e) =>
              setNewQuestion({
                ...newQuestion,
                selectedPaperId: e.target.value,
              })
            }
            className="w-full p-2 border border-gray-300 rounded-lg"
          >
            <option value="">请选择现有试卷</option>
            {papers.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.title} - {paper.teacher} ({paper.math_category})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 新试卷信息 */}
      {!newQuestion.useExistingPaper && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              老师 *
            </label>
            <select
              value={newQuestion.teacher}
              onChange={(e) =>
                setNewQuestion({ ...newQuestion, teacher: e.target.value })
              }
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              <option value="">选择或输入老师</option>
              {getTeachers().map((teacher) => (
                <option key={teacher} value={teacher}>
                  {teacher}
                </option>
              ))}
            </select>
            {/* 自定义输入 */}
            <input
              type="text"
              value={newQuestion.teacher}
              onChange={(e) =>
                setNewQuestion({ ...newQuestion, teacher: e.target.value })
              }
              placeholder="或直接输入老师姓名"
              className="w-full p-2 border border-gray-300 rounded-lg mt-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              学期 *
            </label>
            <select
              value={newQuestion.semester}
              onChange={(e) =>
                setNewQuestion({ ...newQuestion, semester: e.target.value })
              }
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              <option value="">选择或输入学期</option>
              {getSemesters().map((semester) => (
                <option key={semester} value={semester}>
                  {semester}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newQuestion.semester}
              onChange={(e) =>
                setNewQuestion({ ...newQuestion, semester: e.target.value })
              }
              placeholder="或直接输入学期"
              className="w-full p-2 border border-gray-300 rounded-lg mt-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              课程名 *
            </label>
            <select
              value={newQuestion.courseName}
              onChange={(e) =>
                setNewQuestion({ ...newQuestion, courseName: e.target.value })
              }
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              <option value="">选择或输入课程名</option>
              {getExistingCourseNames().map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newQuestion.courseName}
              onChange={(e) =>
                setNewQuestion({ ...newQuestion, courseName: e.target.value })
              }
              placeholder="或直接输入课程名"
              className="w-full p-2 border border-gray-300 rounded-lg mt-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              数学分类 *
            </label>
            <select
              value={newQuestion.mathCategory}
              onChange={(e) =>
                setNewQuestion({ ...newQuestion, mathCategory: e.target.value })
              }
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* 题目信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            题目类型
          </label>
          <select
            value={newQuestion.questionType}
            onChange={(e) =>
              setNewQuestion({ ...newQuestion, questionType: e.target.value })
            }
            className="w-full p-2 border border-gray-300 rounded-lg"
          >
            {questionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            题号
          </label>
          <input
            type="text"
            value={newQuestion.questionNumber}
            onChange={(e) =>
              setNewQuestion({ ...newQuestion, questionNumber: e.target.value })
            }
            placeholder="例：例1、第1题"
            className="w-full p-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          题目内容 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={newQuestion.questionText}
          onChange={(e) =>
            setNewQuestion({ ...newQuestion, questionText: e.target.value })
          }
          rows={4}
          className="w-full p-2 border border-gray-300 rounded-lg"
          placeholder="输入题目文字..."
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          参考答案 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={newQuestion.answer}
          onChange={(e) =>
            setNewQuestion({ ...newQuestion, answer: e.target.value })
          }
          rows={3}
          className="w-full p-2 border border-gray-300 rounded-lg"
          placeholder="输入参考答案..."
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          解题思路 <span className="text-gray-500">(可选)</span>
        </label>
        <textarea
          value={newQuestion.solutionSteps}
          onChange={(e) =>
            setNewQuestion({ ...newQuestion, solutionSteps: e.target.value })
          }
          rows={4}
          className="w-full p-2 border border-gray-300 rounded-lg"
          placeholder="详细的解题步骤和思路..."
        />
        <p className="text-xs text-gray-500 mt-1">解题思路将附加到答案后面</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={
            !newQuestion.questionText.trim() || !newQuestion.answer.trim()
          }
          className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Check size={16} />
          保存到数据库
        </button>
        <button
          onClick={onCancel}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <X size={16} />
          取消
        </button>
      </div>
    </div>
  );
};

export default ManualForm;
