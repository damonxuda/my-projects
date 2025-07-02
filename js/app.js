// ================================
// 暑假课程表 - 主应用逻辑 (修复版)
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
    reading: '阅读时间'
};

const Categories = {
    '学科辅导': ['smk', 'island', 'teacher', 'english'],
    '体育锻炼': ['exercise'],
    '作业时间': ['homework'], 
    '艺术课程': ['art'],
    '阅读时间': ['reading']
};

// ================================
// 数据管理器
// ================================
class DataManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.tableName = 'courses';
    }

    // 获取所有课程
    async getAllCourses() {
        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('*')
                .order('date, start_time');
                
            if (error) throw error;
            
            // 数据清理和去重
            return this.cleanAndDeduplicateData(data || []);
        } catch (error) {
            console.error('获取课程失败:', error);
            throw error;
        }
    }

    // 数据清理和去重
    cleanAndDeduplicateData(courses) {
        const seen = new Set();
        return courses.filter(course => {
            // 创建唯一标识
            const key = `${course.date}-${course.start_time}-${course.end_time}-${course.course_name}`;
            if (seen.has(key)) {
                console.log('发现重复数据，已过滤:', course);
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // 添加课程
    async addCourse(courseData) {
        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .insert([{
                    ...courseData,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    created_by: 'github_app'
                }])
                .select();
                
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('添加课程失败:', error);
            throw error;
        }
    }

    // 删除课程
    async deleteCourse(id) {
        try {
            const { error } = await this.supabase
                .from(this.tableName)
                .delete()
                .eq('id', id);
                
            if (error) throw error;
        } catch (error) {
            console.error('删除课程失败:', error);
            throw error;
        }
    }

    // 更新课程
    async updateCourse(id, courseData) {
        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .update({
                    ...courseData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select();
                
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('更新课程失败:', error);
            throw error;
        }
    }
}

// ================================
// 工具类
// ================================
class ScheduleUtils {
    // 格式化时间显示 (修复：去掉秒)
    static formatTimeDisplay(start_time, end_time) {
        const formatTime = (time) => {
            if (!time) return '';
            // 去掉秒，只保留 HH:MM
            if (time.includes(':')) {
                const parts = time.split(':');
                return `${parts[0]}:${parts[1]}`;
            }
            return time;
        };
        return `${formatTime(start_time)}-${formatTime(end_time)}`;
    }

    // 验证时间格式
    static validateTime(time) {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    }

    // 计算两个时间之间的小时数 (修复：防止负数)
    static calculateHours(start_time, end_time) {
        if (!start_time || !end_time) return 0;
        
        try {
            const [startHour, startMin] = start_time.split(':').map(Number);
            const [endHour, endMin] = end_time.split(':').map(Number);
            
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            
            // 确保结果为正数
            const diffMinutes = Math.max(0, endMinutes - startMinutes);
            return diffMinutes / 60;
        } catch (error) {
            console.error('时间计算错误:', error);
            return 0;
        }
    }

    // 获取课程类别
    static getCourseCategory(courseType) {
        for (const [category, types] of Object.entries(Categories)) {
            if (types.includes(courseType)) {
                return category;
            }
        }
        return '学科辅导'; // 默认类别
    }

    // 格式化日期
    static formatDate(date) {
        if (!date) return '';
        return new Date(date).toLocaleDateString('zh-CN');
    }
}

// ================================
// UI管理器
// ================================
class UIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentEditId = null;
    }

    // 初始化UI
    init() {
        this.bindEvents();
        this.populateCourseTypes();
        this.loadAndDisplayCourses();
    }

    // 绑定事件
    bindEvents() {
        // 添加课程按钮
        document.getElementById('addCourseBtn').addEventListener('click', () => {
            this.showAddCourseForm();
        });

        // 表单提交
        document.getElementById('courseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // 取消按钮
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideForm();
        });

        // 刷新按钮
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadAndDisplayCourses();
        });
    }

    // 填充课程类型选项
    populateCourseTypes() {
        const select = document.getElementById('courseType');
        select.innerHTML = '';
        
        Object.entries(CourseTypes).forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
        });
    }

    // 显示添加课程表单
    showAddCourseForm() {
        this.currentEditId = null;
        document.getElementById('formTitle').textContent = '添加新课程';
        document.getElementById('submitBtn').textContent = '添加课程';
        document.getElementById('courseForm').reset();
        
        // 设置默认日期为今天
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('courseDate').value = today;
        
        document.getElementById('formContainer').style.display = 'block';
    }

    // 显示编辑课程表单
    showEditCourseForm(course) {
        this.currentEditId = course.id;
        document.getElementById('formTitle').textContent = '编辑课程';
        document.getElementById('submitBtn').textContent = '更新课程';
        
        // 填充表单数据
        document.getElementById('courseDate').value = course.date;
        document.getElementById('startTime').value = course.start_time;
        document.getElementById('endTime').value = course.end_time;
        document.getElementById('courseName').value = course.course_name;
        document.getElementById('courseType').value = course.course_type;
        document.getElementById('courseNote').value = course.note || '';
        
        document.getElementById('formContainer').style.display = 'block';
    }

    // 隐藏表单
    hideForm() {
        document.getElementById('formContainer').style.display = 'none';
        this.currentEditId = null;
    }

    // 处理表单提交
    async handleFormSubmit() {
        try {
            const formData = this.getFormData();
            
            if (!this.validateFormData(formData)) {
                return;
            }

            const courseData = {
                date: formData.date,
                start_time: formData.startTime,
                end_time: formData.endTime,
                course_name: formData.courseName,
                course_type: formData.courseType,
                category: ScheduleUtils.getCourseCategory(formData.courseType),
                note: formData.note
            };

            if (this.currentEditId) {
                // 更新课程
                await this.dataManager.updateCourse(this.currentEditId, courseData);
                this.showMessage('课程更新成功！', 'success');
            } else {
                // 添加课程
                await this.dataManager.addCourse(courseData);
                this.showMessage('课程添加成功！', 'success');
            }

            this.hideForm();
            this.loadAndDisplayCourses();
        } catch (error) {
            console.error('表单提交错误:', error);
            this.showMessage('操作失败：' + error.message, 'error');
        }
    }

    // 获取表单数据
    getFormData() {
        return {
            date: document.getElementById('courseDate').value,
            startTime: document.getElementById('startTime').value,
            endTime: document.getElementById('endTime').value,
            courseName: document.getElementById('courseName').value,
            courseType: document.getElementById('courseType').value,
            note: document.getElementById('courseNote').value
        };
    }

    // 验证表单数据
    validateFormData(data) {
        if (!data.date || !data.startTime || !data.endTime || !data.courseName) {
            this.showMessage('请填写所有必填字段', 'error');
            return false;
        }

        if (!ScheduleUtils.validateTime(data.startTime) || !ScheduleUtils.validateTime(data.endTime)) {
            this.showMessage('时间格式不正确，请使用 HH:MM 格式', 'error');
            return false;
        }

        if (data.startTime >= data.endTime) {
            this.showMessage('结束时间必须晚于开始时间', 'error');
            return false;
        }

        return true;
    }

    // 加载并显示课程
    async loadAndDisplayCourses() {
        try {
            document.getElementById('loadingIndicator').style.display = 'block';
            
            const courses = await this.dataManager.getAllCourses();
            this.displayCourses(courses);
            this.updateStats(courses);
            
        } catch (error) {
            console.error('加载课程失败:', error);
            this.showMessage('加载课程失败：' + error.message, 'error');
        } finally {
            document.getElementById('loadingIndicator').style.display = 'none';
        }
    }

    // 显示课程列表
    displayCourses(courses) {
        const container = document.getElementById('coursesContainer');
        
        if (!courses || courses.length === 0) {
            container.innerHTML = '<div class="no-courses">暂无课程安排</div>';
            return;
        }

        // 按日期分组
        const groupedCourses = this.groupCoursesByDate(courses);
        
        container.innerHTML = '';
        Object.entries(groupedCourses).forEach(([date, dateCourses]) => {
            const dateSection = this.createDateSection(date, dateCourses);
            container.appendChild(dateSection);
        });
    }

    // 按日期分组课程
    groupCoursesByDate(courses) {
        return courses.reduce((groups, course) => {
            const date = course.date;
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(course);
            return groups;
        }, {});
    }

    // 创建日期区块
    createDateSection(date, courses) {
        const section = document.createElement('div');
        section.className = 'date-section';
        
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.textContent = ScheduleUtils.formatDate(date);
        
        const coursesList = document.createElement('div');
        coursesList.className = 'courses-list';
        
        courses.forEach(course => {
            const courseCard = this.createCourseCard(course);
            coursesList.appendChild(courseCard);
        });
        
        section.appendChild(dateHeader);
        section.appendChild(coursesList);
        
        return section;
    }

    // 创建课程卡片
    createCourseCard(course) {
        const card = document.createElement('div');
        card.className = 'course-card';
        
        const timeDisplay = ScheduleUtils.formatTimeDisplay(course.start_time, course.end_time);
        const hours = ScheduleUtils.calculateHours(course.start_time, course.end_time);
        
        card.innerHTML = `
            <div class="course-main">
                <div class="course-time">${timeDisplay}</div>
                <div class="course-name">${course.course_name}</div>
                <div class="course-meta">
                    <span class="course-type">${CourseTypes[course.course_type] || course.course_type}</span>
                    <span class="course-hours">${hours.toFixed(1)}小时</span>
                </div>
                ${course.note ? `<div class="course-note">${course.note}</div>` : ''}
            </div>
            <div class="course-actions">
                <button class="edit-btn" onclick="uiManager.showEditCourseForm(${JSON.stringify(course).replace(/"/g, '&quot;')})">编辑</button>
                <button class="delete-btn" onclick="uiManager.deleteCourse('${course.id}')">删除</button>
            </div>
        `;
        
        return card;
    }

    // 删除课程
    async deleteCourse(id) {
        if (!confirm('确定要删除这门课程吗？')) {
            return;
        }

        try {
            await this.dataManager.deleteCourse(id);
            this.showMessage('课程删除成功！', 'success');
            this.loadAndDisplayCourses();
        } catch (error) {
            console.error('删除课程失败:', error);
            this.showMessage('删除失败：' + error.message, 'error');
        }
    }

    // 更新统计信息 (修复：统计计算)
    updateStats(courses) {
        // 总课程数
        document.getElementById("totalCourses").textContent = courses.length;

        // 总学时 (修复算法)
        let totalHours = 0;
        courses.forEach(course => {
            const hours = ScheduleUtils.calculateHours(course.start_time, course.end_time);
            totalHours += hours;
        });
        
        document.getElementById("courseHours").textContent = Math.max(0, totalHours).toFixed(1);
        
        // 课程类别数
        const categories = [...new Set(courses.map(c => c.category || "学科辅导"))];
        document.getElementById("categoryCount").textContent = categories.length;
    }

    // 显示消息
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        
        // 添加到页面
        document.body.appendChild(messageEl);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 3000);
    }
}

// ================================
// 应用初始化
// ================================
let dataManager, uiManager;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 检查Supabase配置
        if (!window.supabaseUrl || !window.supabaseKey) {
            throw new Error('Supabase配置缺失，请检查config.js文件');
        }

        // 初始化Supabase客户端
        const supabase = window.supabase.createClient(window.supabaseUrl, window.supabaseKey);
        
        // 初始化管理器
        dataManager = new DataManager(supabase);
        uiManager = new UIManager(dataManager);
        
        // 初始化UI
        uiManager.init();
        
        console.log('应用初始化成功');
        
    } catch (error) {
        console.error('应用初始化失败:', error);
        document.body.innerHTML = `
            <div class="error-container">
                <h2>应用启动失败</h2>
                <p>${error.message}</p>
                <p>请检查配置并刷新页面重试</p>
            </div>
        `;
    }
});

// 导出到全局作用域 (供模板使用)
window.uiManager = uiManager;
