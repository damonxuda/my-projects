// ================================
// 暑假课程表 - 主应用逻辑
// ================================

// 配置和常量
const CourseTypes = {
  smk: 'SMK英语',
  island: '岛主五竞',
  teacher: '普老师刷题',
  english: '英语YH',
  exercise: '体育锻炼',
  homework: '作业时间',
  art: '艺术课程',
  other: '其他'
};

// 统一数据模型工具
const ScheduleUtils = {
  generateUUID() {
    return crypto.randomUUID();
  },

  createNew(date, start_time, end_time, course_name, course_type, note = '') {
    return {
      id: this.generateUUID(),
      date,
      start_time,
      end_time,
      course_name,
      course_type,
      category: '学科辅导',
      note,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'github_app'
    };
  },

  formatTimeDisplay(start_time, end_time) {
    return `${start_time}-${end_time}`;
  },

  calculateDuration(start_time, end_time) {
    const start = new Date(`2000-01-01T${start_time}:00`);
    const end = new Date(`2000-01-01T${end_time}:00`);
    return (end - start) / (1000 * 60 * 60);
  },

  sortByTime(schedules) {
    return [...schedules].sort((a, b) => {
      const timeA = new Date(`2000-01-01T${a.start_time}:00`);
      const timeB = new Date(`2000-01-01T${b.start_time}:00`);
      return timeA - timeB;
    });
  },

  validate(schedule) {
    const errors = [];
    
    if (!schedule.course_name || schedule.course_name.trim() === '') {
      errors.push('课程名称不能为空');
    }
    
    if (!schedule.start_time || !schedule.end_time) {
      errors.push('开始时间和结束时间不能为空');
    }
    
    if (schedule.start_time && schedule.end_time) {
      try {
        const start = new Date(`2000-01-01T${schedule.start_time}:00`);
        const end = new Date(`2000-01-01T${schedule.end_time}:00`);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          errors.push('时间格式无效');
        } else if (start >= end) {
          errors.push('结束时间必须晚于开始时间');
        }
      } catch (e) {
        errors.push('时间格式无效');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  },

  toDisplayFormat(schedule) {
    return {
      id: schedule.id,
      time: this.formatTimeDisplay(schedule.start_time, schedule.end_time),
      course: schedule.course_name,
      type: schedule.course_type,
      category: schedule.category,
      note: schedule.note || ''
    };
  }
};

// 数据库操作管理器
const DatabaseManager = {
  async loadAllSchedules() {
    try {
      console.log('从Supabase加载统一格式数据...');
      
      const { data, error } = await window.supabase
        .from('schedules')
        .select('*')
        .order('date')
        .order('start_time');
        
      if (error) {
        console.error('从Supabase加载数据失败:', error);
        return { success: false, error: error.message };
      }

      console.log('从Supabase加载了', data?.length || 0, '条课程记录');
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('加载Supabase数据异常:', error);
      return { success: false, error: error.message };
    }
  },

  async saveSchedule(schedule) {
    try {
      const { data, error } = await window.supabase
        .from('schedules')
        .insert(schedule)
        .select()
        .single();
        
      if (error) {
        console.error('保存到Supabase失败:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data };
    } catch (error) {
      console.error('保存课程异常:', error);
      return { success: false, error: error.message };
    }
  },

  async updateSchedule(id, updates) {
    try {
      const { data, error } = await window.supabase
        .from('schedules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        console.error('更新Supabase失败:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data };
    } catch (error) {
      console.error('更新课程异常:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteSchedule(id) {
    try {
      const { error } = await window.supabase
        .from('schedules')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('删除Supabase数据失败:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('删除课程异常:', error);
      return { success: false, error: error.message };
    }
  },

  setupRealtimeListeners(onUpdate) {
    try {
      const subscription = window.supabase
        .channel('schedule-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'schedules'
        }, (payload) => {
          console.log('实时数据更新:', payload);
          if (onUpdate) {
            onUpdate(payload);
          }
        })
        .subscribe();

      console.log('Supabase实时监听已启动');
      return subscription;
    } catch (error) {
      console.error('设置实时监听失败:', error);
      return null;
    }
  }
};

// 课程管理器
const ScheduleManager = {
  schedules: {},
  realtimeSubscription: null,
  
  async init() {
    if (window.useSupabase && window.supabase) {
      await this.loadFromDatabase();
      this.setupRealtimeSync();
    } else {
      this.loadFromLocal();
    }
  },

  async loadFromDatabase() {
    const result = await DatabaseManager.loadAllSchedules();
    
    if (result.success) {
      this.schedules = {};
      result.data.forEach(schedule => {
        const dateStr = schedule.date;
        if (!this.schedules[dateStr]) {
          this.schedules[dateStr] = [];
        }
        this.schedules[dateStr].push(schedule);
      });
    } else {
      console.error('数据库加载失败');
      this.schedules = {};
    }
  },

  setupRealtimeSync() {
    this.realtimeSubscription = DatabaseManager.setupRealtimeListeners((payload) => {
      this.handleRealtimeUpdate(payload);
    });
  },

  handleRealtimeUpdate(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'INSERT' && newRecord) {
      const dateStr = newRecord.date;
      if (!this.schedules[dateStr]) {
        this.schedules[dateStr] = [];
      }
      this.schedules[dateStr].push(newRecord);
      this.schedules[dateStr] = ScheduleUtils.sortByTime(this.schedules[dateStr]);
    } else if (eventType === 'UPDATE' && newRecord) {
      const dateStr = newRecord.date;
      if (this.schedules[dateStr]) {
        const index = this.schedules[dateStr].findIndex(s => s.id === newRecord.id);
        if (index !== -1) {
          this.schedules[dateStr][index] = newRecord;
          this.schedules[dateStr] = ScheduleUtils.sortByTime(this.schedules[dateStr]);
        }
      }
    } else if (eventType === 'DELETE' && oldRecord) {
      const dateStr = oldRecord.date;
      if (this.schedules[dateStr]) {
        this.schedules[dateStr] = this.schedules[dateStr].filter(s => s.id !== oldRecord.id);
      }
    }
    
    if (typeof UIManager !== 'undefined' && UIManager.updateDisplay) {
      UIManager.updateDisplay();
    }
  },

  loadFromLocal() {
    try {
      const saved = localStorage.getItem('scheduleData_unified_backup');
      if (saved) {
        this.schedules = JSON.parse(saved);
      } else {
        this.schedules = {};
      }
    } catch (error) {
      console.error('从localStorage加载失败:', error);
      this.schedules = {};
    }
  },

  saveToLocal() {
    try {
      localStorage.setItem('scheduleData_unified_backup', JSON.stringify(this.schedules));
    } catch (error) {
      console.error('保存到localStorage失败:', error);
    }
  },

  getScheduleByDate(dateStr) {
    const schedules = this.schedules[dateStr] || [];
    return ScheduleUtils.sortByTime(schedules);
  },

  getDisplayScheduleByDate(dateStr) {
    const schedules = this.getScheduleByDate(dateStr);
    return schedules.map(schedule => ScheduleUtils.toDisplayFormat(schedule));
  },

  async addCourse(dateStr, courseData) {
    try {
      const validation = ScheduleUtils.validate(courseData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      const newSchedule = ScheduleUtils.createNew(
        dateStr,
        courseData.start_time,
        courseData.end_time,
        courseData.course_name,
        courseData.course_type,
        courseData.note || ''
      );

      if (window.useSupabase && window.supabase) {
        const result = await DatabaseManager.saveSchedule(newSchedule);
        if (!result.success) {
          throw new Error(result.error);
        }
        if (!this.schedules[dateStr]) {
          this.schedules[dateStr] = [];
        }
        this.schedules[dateStr].push(newSchedule);
        this.schedules[dateStr] = ScheduleUtils.sortByTime(this.schedules[dateStr]);
      } else {
        if (!this.schedules[dateStr]) {
          this.schedules[dateStr] = [];
        }
        this.schedules[dateStr].push(newSchedule);
        this.schedules[dateStr] = ScheduleUtils.sortByTime(this.schedules[dateStr]);
        this.saveToLocal();
      }

      return { success: true, data: newSchedule };
    } catch (error) {
      console.error('添加课程失败:', error);
      return { success: false, error: error.message };
    }
  },

  async updateCourse(courseId, updates) {
    try {
      let originalSchedule = null;
      let dateStr = null;
      
      for (const date in this.schedules) {
        const schedule = this.schedules[date].find(s => s.id === courseId);
        if (schedule) {
          originalSchedule = schedule;
          dateStr = date;
          break;
        }
      }

      if (!originalSchedule) {
        throw new Error('课程不存在');
      }

      const updatedSchedule = {
        ...originalSchedule,
        ...updates,
        updated_at: new Date().toISOString()
      };

      const validation = ScheduleUtils.validate(updatedSchedule);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      if (window.useSupabase && window.supabase) {
        const result = await DatabaseManager.updateSchedule(courseId, updatedSchedule);
        if (!result.success) {
          throw new Error(result.error);
        }
        const index = this.schedules[dateStr].findIndex(s => s.id === courseId);
        this.schedules[dateStr][index] = updatedSchedule;
        this.schedules[dateStr] = ScheduleUtils.sortByTime(this.schedules[dateStr]);
      } else {
        const index = this.schedules[dateStr].findIndex(s => s.id === courseId);
        this.schedules[dateStr][index] = updatedSchedule;
        this.schedules[dateStr] = ScheduleUtils.sortByTime(this.schedules[dateStr]);
        this.saveToLocal();
      }

      return { success: true, data: updatedSchedule };
    } catch (error) {
      console.error('更新课程失败:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteCourse(courseId) {
    try {
      let dateStr = null;
      let courseIndex = -1;
      
      for (const date in this.schedules) {
        const index = this.schedules[date].findIndex(s => s.id === courseId);
        if (index !== -1) {
          dateStr = date;
          courseIndex = index;
          break;
        }
      }

      if (courseIndex === -1) {
        throw new Error('课程不存在');
      }

      if (window.useSupabase && window.supabase) {
        const result = await DatabaseManager.deleteSchedule(courseId);
        if (!result.success) {
          throw new Error(result.error);
        }
        this.schedules[dateStr].splice(courseIndex, 1);
      } else {
        this.schedules[dateStr].splice(courseIndex, 1);
        this.saveToLocal();
      }

      return { success: true };
    } catch (error) {
      console.error('删除课程失败:', error);
      return { success: false, error: error.message };
    }
  },

  cleanup() {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }
  }
};

// UI管理器
const UIManager = {
  currentDate: new Date(),

  formatDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  },

  formatDisplayDate(date) {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    return `${year}年${month}月${day}日 ${weekday}`;
  },

  updateDisplay() {
    const dateStr = this.formatDate(this.currentDate);
    const displayStr = this.formatDisplayDate(this.currentDate);
    const todayStr = this.formatDisplayDate(new Date());

    document.getElementById("currentDate").innerHTML = todayStr;
    document.getElementById("displayDate").innerHTML = displayStr;

    const courses = ScheduleManager.getDisplayScheduleByDate(dateStr);
    const scheduleContent = document.getElementById("scheduleContent");

    if (courses.length === 0) {
      scheduleContent.innerHTML = '<div class="no-courses">🎉 今天没有安排课程，可以好好休息哦！</div>';
    } else {
      let html = "";
      courses.forEach(course => {
        html += `<div class="course-item course-${course.type}">
                  <div class="course-time">${course.time}</div>
                  <div class="course-name">${course.course}</div>
                </div>`;
      });
      scheduleContent.innerHTML = html;
    }

    this.updateStats(courses);
  },

  updateStats(courses) {
    document.getElementById("totalCourses").innerHTML = courses.length;

    let totalHours = 0;
    courses.forEach(course => {
      const timeMatch = course.time.match(/(\d+):(\d+)-(\d+):(\d+)/);
      if (timeMatch) {
        const startHour = parseInt(timeMatch[1]);
        const startMin = parseInt(timeMatch[2]);
        const endHour = parseInt(timeMatch[3]);
        const endMin = parseInt(timeMatch[4]);
        const hours = (endHour * 60 + endMin - startHour * 60 - startMin) / 60;
        totalHours += hours;
      }
    });
    
    document.getElementById("courseHours").innerHTML = totalHours.toFixed(1);

    const categories = [...new Set(courses.map(c => c.category || "学科辅导"))];
    document.getElementById("categoryCount").innerHTML = categories.length;
  },

  changeDate(days) {
    this.currentDate.setDate(this.currentDate.getDate() + days);
    this.updateDisplay();
  },

  bindEvents() {
    document.getElementById('prevBtn')?.addEventListener('click', () => this.changeDate(-1));
    document.getElementById('nextBtn')?.addEventListener('click', () => this.changeDate(1));
  },

  showSuccess(message) {
    alert('✅ ' + message);
  },

  showError(message) {
    alert('❌ ' + message);
  },

  showConfirm(message) {
    return confirm('❓ ' + message);
  }
};

// 编辑器管理器
const EditorManager = {
  currentEditingId: null,
  isOpen: false,

  openEditor(date) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const dateStr = date || `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    document.getElementById('editDate').value = dateStr;
    document.getElementById('editorOverlay').style.display = 'flex';
    this.isOpen = true;
    
    this.loadDateCourses();
    this.clearForm();
  },

  closeEditor() {
    document.getElementById('editorOverlay').style.display = 'none';
    this.isOpen = false;
    this.clearForm();
  },

  loadDateCourses() {
    const dateStr = document.getElementById('editDate').value;
    if (!dateStr) return;

    const courses = ScheduleManager.getDisplayScheduleByDate(dateStr);
    let courseListHtml = '';

    if (courses.length === 0) {
      courseListHtml = '<div style="text-align: center; color: #666; padding: 20px;">📅 当前日期没有安排课程</div>';
    } else {
      courses.forEach(course => {
        courseListHtml += 
          `<div class="course-item-edit">
            <div class="course-info">
              <div class="course-time-edit">${course.time}</div>
              <div class="course-name-edit">${course.course}</div>
            </div>
            <div class="course-actions">
              <button class="btn-small btn-edit" onclick="handleEditCourse('${course.id}')">编辑</button>
              <button class="btn-small btn-delete" onclick="handleDeleteCourse('${course.id}')">删除</button>
            </div>
          </div>`;
      });
    }

    document.getElementById('courseList').innerHTML = courseListHtml;
  },

  setQuickTime(startTime, endTime) {
    document.getElementById('startTime').value = startTime;
    document.getElementById('endTime').value = endTime;
  },

  clearForm() {
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
    document.getElementById('courseName').value = '';
    document.getElementById('courseType').value = 'smk';
    document.getElementById('courseNote').value = '';
    document.getElementById('saveBtn').innerHTML = '➕ 添加课程';
    this.currentEditingId = null;
  },

  editCourse(courseId) {
    let targetSchedule = null;
    
    for (const date in ScheduleManager.schedules) {
      const schedule = ScheduleManager.schedules[date].find(s => s.id === courseId);
      if (schedule) {
        targetSchedule = schedule;
        break;
      }
    }
    
    if (!targetSchedule) {
      UIManager.showError('课程不存在');
      return;
    }

    document.getElementById('startTime').value = targetSchedule.start_time;
    document.getElementById('endTime').value = targetSchedule.end_time;
    document.getElementById('courseName').value = targetSchedule.course_name;
    document.getElementById('courseType').value = targetSchedule.course_type;
    document.getElementById('courseNote').value = targetSchedule.note || '';
    document.getElementById('saveBtn').innerHTML = '✅ 更新课程';

    this.currentEditingId = courseId;
  },

  async deleteCourse(courseId) {
    if (!UIManager.showConfirm('确定要删除这门课程吗？')) return;

    try {
      const result = await ScheduleManager.deleteCourse(courseId);
      
      if (result.success) {
        this.loadDateCourses();
        UIManager.updateDisplay();
        UIManager.showSuccess('课程删除成功！');
      } else {
        UIManager.showError('删除失败: ' + result.error);
      }
    } catch (error) {
      UIManager.showError('删除失败: ' + error.message);
    }
  },

  async saveCourse() {
    const dateStr = document.getElementById('editDate').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const courseName = document.getElementById('courseName').value.trim();
    const courseType = document.getElementById('courseType').value;
    const courseNote = document.getElementById('courseNote').value.trim();

    if (!dateStr) {
      UIManager.showError('请选择日期');
      return;
    }

    if (!startTime || !endTime) {
      UIManager.showError('请选择开始时间和结束时间');
      return;
    }

    if (!courseName) {
      UIManager.showError('请输入课程名称');
      return;
    }

    if (startTime >= endTime) {
      UIManager.showError('结束时间必须晚于开始时间');
      return;
    }

    const courseData = {
      start_time: startTime,
      end_time: endTime,
      course_name: courseName,
      course_type: courseType,
      note: courseNote
    };

    try {
      let result;
      if (this.currentEditingId) {
        result = await ScheduleManager.updateCourse(this.currentEditingId, courseData);
        if (result.success) {
          UIManager.showSuccess('课程更新成功！');
        }
      } else {
        result = await ScheduleManager.addCourse(dateStr, courseData);
        if (result.success) {
          UIManager.showSuccess('课程添加成功！');
        }
      }

      if (result.success) {
        this.loadDateCourses();
        this.clearForm();
        UIManager.updateDisplay();
      } else {
        UIManager.showError('保存失败: ' + result.error);
      }
    } catch (error) {
      UIManager.showError('保存失败: ' + error.message);
    }
  }
};

// 全局事件处理函数
function handleEditClick() {
  EditorManager.openEditor();
}

function handleCloseEditor() {
  EditorManager.closeEditor();
}

function handleLoadDateCourses() {
  EditorManager.loadDateCourses();
}

function handleSetQuickTime(start, end) {
  EditorManager.setQuickTime(start, end);
}

function handleEditCourse(courseId) {
  EditorManager.editCourse(courseId);
}

function handleDeleteCourse(courseId) {
  EditorManager.deleteCourse(courseId);
}

function handleSaveCourse() {
  EditorManager.saveCourse();
}

// 应用初始化
async function initApp() {
  console.log('🚀 初始化应用 - 使用统一数据模型');
  
  try {
    await ScheduleManager.init();
    UIManager.updateDisplay();
    UIManager.bindEvents();
    console.log('✅ 应用初始化完成');
  } catch (error) {
    console.error('❌ 应用初始化失败:', error);
    UIManager.showError('应用初始化失败: ' + error.message);
  }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.useSupabase) {
      initApp();
    }
  });
} else {
  if (!window.useSupabase) {
    initApp();
  }
}

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  ScheduleManager.cleanup();
});
