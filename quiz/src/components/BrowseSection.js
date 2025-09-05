import React, { useState, useEffect } from "react";
import { Star, Edit2, Trash2 } from "lucide-react";
import { MarkdownParser } from "../services/MarkdownParser";

// 安全的HTML渲染函数
const renderSafeHTML = (htmlContent) => {
  // 简单的净化：移除script标签和事件处理器
  let cleanContent = htmlContent
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "");

  return { __html: cleanContent };
};

const BrowseSection = ({
  questions,
  setQuestions,
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
  isAdmin,
  db,
}) => {
  const [editingQuestion, setEditingQuestion] = useState(null);

  useEffect(() => {
    const loadKaTexForDisplay = async () => {
      try {
        const parser = new MarkdownParser();
        await parser.loadKaTeX();

        if (window.renderMathInElement) {
          window.renderMathInElement(document.body, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
            ],
          });
        }
      } catch (error) {
        console.warn("LaTeX显示初始化失败:", error);
      }
    };

    loadKaTexForDisplay();
  }, [questions]);

  // 更新题目
  const updateQuestion = async (id, updates) => {
    try {
      const result = await db.updateQuestion(id, updates);
      if (!result.success) throw new Error(result.error);

      // 重新加载题目列表
      const questionsResult = await db.getQuestions();
      if (questionsResult.success) {
        setQuestions(questionsResult.data || []);
      }

      setEditingQuestion(null);
      alert("题目更新成功！");
    } catch (error) {
      console.error("更新失败:", error);
      alert("更新失败，请检查网络连接。");
    }
  };

  // 筛选题目
  const filteredQuestions = questions.filter((q) => {
    const paper = q.papers;
    if (!paper) return false;

    return (
      (!filters.teacher || paper.teacher === filters.teacher) &&
      (!filters.semester || paper.semester === filters.semester) &&
      (!filters.category || paper.math_category === filters.category) &&
      (!filters.paperId || q.paper_id === filters.paperId) &&
      (!filters.courseName || paper.course_name === filters.courseName) &&
      (!filters.masteryLevel ||
        (filters.masteryLevel === "unfamiliar" &&
          getCurrentScore(q.id) > 0 &&
          getCurrentScore(q.id) <= 2) ||
        (filters.masteryLevel === "familiar" && getCurrentScore(q.id) >= 4) ||
        (filters.masteryLevel === "wrong" && isMarkedWrong(q.id)))
    );
  });

  // 渲染可点击的评分星星（用于浏览模式）
  const renderClickableStars = (questionId, currentScore) => {
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <button
            key={i}
            onClick={() => addAttempt(questionId, i + 1)}
            className="text-yellow-400 hover:text-yellow-500 transition-colors"
            title={`${i + 1}星熟练度`}
          >
            <Star
              size={16}
              className={
                i < currentScore
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300 hover:text-yellow-300"
              }
            />
          </button>
        ))}
        <span className="text-sm text-gray-500 ml-2">({currentScore}星)</span>
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">📚 题库浏览</h2>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filters.teacher}
            onChange={(e) =>
              setFilters({ ...filters, teacher: e.target.value })
            }
            className="p-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">所有老师</option>
            {getTeachers().map((teacher) => (
              <option key={teacher} value={teacher}>
                {teacher}
              </option>
            ))}
          </select>
          <select
            value={filters.semester}
            onChange={(e) =>
              setFilters({ ...filters, semester: e.target.value })
            }
            className="p-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">所有学期</option>
            {getSemesters().map((semester) => (
              <option key={semester} value={semester}>
                {semester}
              </option>
            ))}
          </select>
          <select
            value={filters.category}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value })
            }
            className="p-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">所有分类</option>
            {mathCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={filters.paperId}
            onChange={(e) =>
              setFilters({ ...filters, paperId: e.target.value })
            }
            className="p-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">所有试卷</option>
            {papers
              .filter((paper) => {
                return (
                  (!filters.teacher || paper.teacher === filters.teacher) &&
                  (!filters.semester || paper.semester === filters.semester) &&
                  (!filters.category || paper.math_category === filters.category) &&
                  (!filters.courseName || paper.course_name === filters.courseName)
                );
              })
              .map((paper) => (
                <option key={paper.id} value={paper.id}>
                  {paper.title}
                </option>
              ))}
          </select>
          <select
            value={filters.masteryLevel}
            onChange={(e) =>
              setFilters({ ...filters, masteryLevel: e.target.value })
            }
            className="p-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">所有熟练度</option>
            <option value="wrong">错题</option>
            <option value="unfamiliar">不熟悉(≤2星)</option>
            <option value="familiar">熟练(≥4星)</option>
          </select>
          <button
            onClick={() => {
              // 应用当前筛选条件（目前是实时筛选，所以这里暂时不需要额外操作）
              alert("筛选已应用！共找到 " + filteredQuestions.length + " 道题目");
            }}
            className="px-3 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 border border-blue-500 rounded-lg"
          >
            确认筛选
          </button>
          <button
            onClick={() =>
              setFilters({
                teacher: "",
                semester: "",
                category: "",
                paperId: "",
                masteryLevel: "",
                courseName: "",
              })
            }
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
          >
            清除筛选
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredQuestions.map((q) => (
          <div
            key={q.id}
            className="bg-white border border-gray-200 p-6 rounded-lg"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {q.question_number && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded font-medium">
                      {q.question_number}
                    </span>
                  )}
                  {q.papers && (
                    <>
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        {q.papers.math_category}
                      </span>
                      <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                        {q.papers.teacher}
                      </span>
                      {q.papers.semester && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          {q.papers.semester}
                        </span>
                      )}
                    </>
                  )}
                  {isMarkedWrong(q.id) && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                      错题
                    </span>
                  )}
                </div>
                {q.papers && (
                  <div className="text-sm text-gray-600 mb-2">
                    📚 {q.papers.title}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <>
                    <button
                      onClick={() => {
                        console.log("编辑按钮被点击了！");
                        console.log("Question ID:", q.id);
                        console.log("isAdmin:", isAdmin);
                        console.log(
                          "Current editingQuestion:",
                          editingQuestion
                        );
                        setEditingQuestion(
                          editingQuestion === q.id ? null : q.id
                        );
                      }}
                      className="text-gray-500 hover:text-blue-500 p-1"
                      title="管理员编辑题目"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={async () => {
                        if (
                          !window.confirm(
                            "确定要删除这道题目吗？此操作不可撤销！"
                          )
                        )
                          return;

                        try {
                          const result = await db.deleteQuestion(q.id);
                          if (!result.success) throw new Error(result.error);

                          const questionsResult = await db.getQuestions();
                          if (questionsResult.success) {
                            setQuestions(questionsResult.data || []);
                          }
                          alert("题目删除成功！");
                        } catch (error) {
                          console.error("删除失败:", error);
                          alert("删除失败：" + error.message);
                        }
                      }}
                      className="text-gray-500 hover:text-red-500 p-1"
                      title="管理员删除题目"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                {renderClickableStars(q.id, getCurrentScore(q.id))}
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">题目：</h4>
              <div
                className="text-gray-700 whitespace-pre-line"
                dangerouslySetInnerHTML={renderSafeHTML(q.question_text)}
              />
            </div>

            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">答案：</h4>
              <div
                className="text-gray-700 whitespace-pre-line"
                dangerouslySetInnerHTML={renderSafeHTML(q.answer)}
              />
            </div>

            {editingQuestion === q.id && isAdmin && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <h5 className="font-medium text-gray-900 mb-3">编辑题目</h5>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      题号
                    </label>
                    <input
                      type="text"
                      defaultValue={q.question_number || ""}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                      placeholder="例：例1、第1题、习题3"
                      id={`number-${q.id}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      题目内容
                    </label>
                    <textarea
                      defaultValue={q.question_text}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                      rows={3}
                      id={`text-${q.id}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      答案
                    </label>
                    <textarea
                      defaultValue={q.answer}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                      rows={3}
                      id={`answer-${q.id}`}
                    />
                  </div>
                  
                  {/* 试卷信息编辑 */}
                  <div className="border-t pt-3 mt-3">
                    <h6 className="font-medium text-gray-900 mb-2">试卷信息编辑</h6>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          老师
                        </label>
                        <input
                          type="text"
                          defaultValue={q.papers?.teacher || ""}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          id={`teacher-${q.id}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          学期
                        </label>
                        <input
                          type="text"
                          defaultValue={q.papers?.semester || ""}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          id={`semester-${q.id}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          课程名
                        </label>
                        <input
                          type="text"
                          defaultValue={q.papers?.course_name || ""}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          id={`courseName-${q.id}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          数学分类
                        </label>
                        <select
                          defaultValue={q.papers?.math_category || ""}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          id={`mathCategory-${q.id}`}
                        >
                          {mathCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const number = document.getElementById(
                            `number-${q.id}`
                          ).value;
                          const text = document.getElementById(
                            `text-${q.id}`
                          ).value;
                          const answer = document.getElementById(
                            `answer-${q.id}`
                          ).value;
                          
                          // 获取试卷信息
                          const teacher = document.getElementById(
                            `teacher-${q.id}`
                          ).value;
                          const semester = document.getElementById(
                            `semester-${q.id}`
                          ).value;
                          const courseName = document.getElementById(
                            `courseName-${q.id}`
                          ).value;
                          const mathCategory = document.getElementById(
                            `mathCategory-${q.id}`
                          ).value;

                          if (!text.trim() || !answer.trim()) {
                            alert("题目内容和答案不能为空");
                            return;
                          }

                          if (!teacher.trim() || !semester.trim() || !courseName.trim()) {
                            alert("试卷信息（老师、学期、课程名）不能为空");
                            return;
                          }

                          console.log('准备更新题目:', {
                            questionId: q.id,
                            number, text, answer
                          });

                          // 更新题目信息
                          await updateQuestion(q.id, {
                            question_number: number,
                            question_text: text,
                            answer: answer,
                          });
                          
                          console.log('题目更新成功，准备更新试卷:', {
                            paperId: q.papers?.id,
                            teacher, semester, courseName, mathCategory
                          });
                          
                          // 智能试卷管理逻辑
                          if (q.papers) {
                            // 查找是否已存在相同标签的试卷（排除当前试卷）
                            const existingPaperResult = await db.findExistingPaper(
                              teacher.trim(),
                              semester.trim(), 
                              courseName.trim(),
                              mathCategory,
                              q.papers.id // 排除当前试卷
                            );
                            
                            if (!existingPaperResult.success) {
                              throw new Error('查找试卷失败: ' + existingPaperResult.error);
                            }
                            
                            if (existingPaperResult.data.length > 0) {
                              // 存在相同标签的试卷，将题目移动过去
                              const existingPaper = existingPaperResult.data[0];
                              console.log('发现已存在试卷，将题目移动到:', existingPaper);
                              
                              // 直接调用数据库方法移动题目并更新内容
                              const moveResult = await db.updateQuestion(q.id, {
                                question_number: number,
                                question_text: text,
                                answer: answer,
                                paper_id: existingPaper.id  // 移动到已存在试卷
                              });
                              
                              console.log('移动题目的结果:', moveResult);
                              
                              if (!moveResult.success) {
                                throw new Error('移动题目失败: ' + moveResult.error);
                              }
                              
                              console.log('题目已移动到已存在试卷:', existingPaper.title);
                            } else {
                              // 不存在相同标签试卷，更新当前试卷
                              const generatedTitle = `${teacher.trim()}${semester.trim()}${courseName.trim()}`;
                              console.log('更新当前试卷标签，生成标题:', generatedTitle);
                              
                              const paperResult = await db.updatePaper(q.papers.id, {
                                title: generatedTitle,
                                teacher: teacher.trim(),
                                semester: semester.trim(),
                                course_name: courseName.trim(),
                                math_category: mathCategory,
                              });
                              
                              if (!paperResult.success) {
                                throw new Error('更新试卷信息失败: ' + paperResult.error);
                              }
                              
                              console.log('试卷信息更新成功');
                            }
                          }
                          
                          console.log('所有更新完成，重新加载题目列表');
                          
                          // 重新加载题目列表以显示更新后的试卷信息
                          const questionsResult = await db.getQuestions();
                          if (questionsResult.success) {
                            setQuestions(questionsResult.data);
                            console.log('题目列表已重新加载');
                          }
                          
                          // 退出编辑模式
                          setEditingQuestion(null);
                        } catch (error) {
                          console.error('更新过程中发生错误:', error);
                          alert('更新失败: ' + error.message);
                          return;
                        }
                      }}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingQuestion(null)}
                      className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t border-gray-100">
              <button
                onClick={() => toggleWrongQuestion(q.id)}
                className={`px-3 py-1 text-sm border rounded ${
                  isMarkedWrong(q.id)
                    ? "bg-red-50 text-red-600 border-red-300 hover:bg-red-100"
                    : "text-red-500 hover:text-red-600 border-red-300 hover:bg-red-50"
                }`}
              >
                ❌ {isMarkedWrong(q.id) ? "取消错题" : "标记错题"}
              </button>
            </div>
          </div>
        ))}

        {filteredQuestions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {questions.length === 0
              ? "数据库中还没有题目，去添加第一套试卷吧！"
              : "没有符合条件的题目"}
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowseSection;
