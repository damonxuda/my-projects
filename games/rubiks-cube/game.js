// 魔方新手训练营 - 主游戏逻辑

class RubiksCubeGame {
  constructor() {
    this.tutorial = new TutorialManager();
    this.cubePlayer = null;
    this.init();
  }

  async init() {
    // 等待 twisty-player 加载完成
    await this.initCubePlayer();

    // 绑定按钮事件
    this.bindEvents();

    // 渲染初始界面
    this.renderUI();

    // 渲染关卡列表
    this.renderLevelList();

    // 更新统计信息
    this.updateStats();

    console.log('🎮 魔方训练营初始化完成！');
  }

  async initCubePlayer() {
    this.cubePlayer = document.getElementById('cube');

    // 等待组件加载
    await new Promise(resolve => {
      if (this.cubePlayer) {
        resolve();
      } else {
        setTimeout(resolve, 100);
      }
    });
  }

  bindEvents() {
    // 开始按钮
    document.getElementById('startBtn').addEventListener('click', () => {
      this.hideStartButton();
      this.renderUI();
    });

    // 下一步
    document.getElementById('nextBtn').addEventListener('click', () => {
      if (this.tutorial.nextStep()) {
        this.renderUI();
      }
    });

    // 上一步
    document.getElementById('prevBtn').addEventListener('click', () => {
      if (this.tutorial.prevStep()) {
        this.renderUI();
      }
    });

    // 完成本关
    document.getElementById('completeBtn').addEventListener('click', () => {
      this.completeCurrentLevel();
    });

    // 演示公式
    document.getElementById('executeBtn').addEventListener('click', () => {
      this.executeFormula();
    });

    // 重置魔方
    document.getElementById('resetBtn').addEventListener('click', () => {
      this.resetCube();
    });

    // 随机打乱
    document.getElementById('scrambleBtn').addEventListener('click', () => {
      this.scrambleCube();
    });

    // 弹窗按钮
    document.getElementById('continueBtn').addEventListener('click', () => {
      this.hideModal();
      if (this.tutorial.nextLevel()) {
        this.renderUI();
        this.renderLevelList();
      }
    });

    document.getElementById('closeModalBtn').addEventListener('click', () => {
      this.hideModal();
    });
  }

  renderUI() {
    const level = this.tutorial.getCurrentLevel();
    const step = this.tutorial.getCurrentStep();

    // 更新关卡标题
    document.getElementById('currentLevel').textContent = level.title;
    document.getElementById('levelProgress').textContent =
      `${this.tutorial.currentLevel + 1}/${LEVELS.length}`;

    // 更新进度条
    const progressPercent = this.tutorial.getProgressPercent();
    document.getElementById('progressFill').style.width = `${progressPercent}%`;

    // 更新教学内容
    document.getElementById('tutorialTitle').textContent = step.title;
    document.getElementById('tutorialContent').innerHTML = step.content;

    // 更新任务说明
    document.getElementById('stepDescription').textContent = step.task;

    // 更新提示
    if (step.hint) {
      document.getElementById('hintBox').style.display = 'block';
      document.getElementById('hintText').textContent = step.hint;
    } else {
      document.getElementById('hintBox').style.display = 'none';
    }

    // 更新公式显示
    if (step.formula) {
      document.getElementById('formulaDisplay').style.display = 'block';
      document.getElementById('formulaText').textContent = step.formula;
    } else {
      document.getElementById('formulaDisplay').style.display = 'none';
    }

    // 更新按钮状态
    this.updateButtons();

    // 应用打乱
    if (step.scramble) {
      this.applyScrambletoCube(step.scramble);
    }
  }

  updateButtons() {
    const hasPrev = this.tutorial.hasPrevStep();
    const hasNext = this.tutorial.hasNextStep();

    document.getElementById('prevBtn').style.display = hasPrev ? 'block' : 'none';
    document.getElementById('nextBtn').style.display = hasNext ? 'block' : 'none';
    document.getElementById('completeBtn').style.display = !hasNext ? 'block' : 'none';
  }

  hideStartButton() {
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('prevBtn').style.display = 'block';
    document.getElementById('nextBtn').style.display = 'block';
  }

  async executeFormula() {
    const step = this.tutorial.getCurrentStep();
    if (!step.formula) return;

    try {
      // 执行公式动画
      this.cubePlayer.alg = step.formula;
      await this.cubePlayer.experimentalGetPlayer().play();

      this.tutorial.incrementPractice();
      this.updateStats();
    } catch (e) {
      console.error('执行公式失败:', e);
    }
  }

  resetCube() {
    try {
      this.cubePlayer.alg = '';
      const step = this.tutorial.getCurrentStep();
      if (step.scramble) {
        this.applyScrambletoCube(step.scramble);
      }
    } catch (e) {
      console.error('重置魔方失败:', e);
    }
  }

  scrambleCube() {
    // 生成随机打乱
    const moves = ['R', 'L', 'U', 'D', 'F', 'B'];
    const modifiers = ['', '\'', '2'];
    let scramble = '';
    let lastMove = '';

    for (let i = 0; i < 20; i++) {
      let move = moves[Math.floor(Math.random() * moves.length)];
      // 避免连续相同的面
      while (move === lastMove) {
        move = moves[Math.floor(Math.random() * moves.length)];
      }
      lastMove = move;

      const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
      scramble += move + modifier + ' ';
    }

    this.applyScrambletoCube(scramble.trim());
    this.tutorial.incrementPractice();
    this.updateStats();
  }

  applyScrambletoCube(scramble) {
    try {
      this.cubePlayer.alg = scramble;
    } catch (e) {
      console.error('应用打乱失败:', e);
    }
  }

  completeCurrentLevel() {
    this.tutorial.completeLevel();

    const level = this.tutorial.getCurrentLevel();
    const isLastLevel = this.tutorial.currentLevel === LEVELS.length - 1;

    // 显示完成弹窗
    if (isLastLevel) {
      document.getElementById('completeMessage').textContent =
        '🎉 恭喜你完成所有关卡！你已经学会还原魔方了！现在可以多多练习提高速度。';
      document.getElementById('continueBtn').textContent = '回到第一关';
    } else {
      document.getElementById('completeMessage').textContent =
        `太棒了！你完成了 ${level.title}！继续加油！`;
      document.getElementById('continueBtn').textContent = '继续下一关 ➡️';
    }

    this.showModal();
    this.renderLevelList();
    this.updateStats();
  }

  showModal() {
    document.getElementById('completeModal').style.display = 'flex';
  }

  hideModal() {
    document.getElementById('completeModal').style.display = 'none';
  }

  renderLevelList() {
    const levelList = document.getElementById('levelList');
    levelList.innerHTML = '';

    LEVELS.forEach((level, index) => {
      const item = document.createElement('div');
      item.className = 'level-item';

      // 判断状态
      if (this.tutorial.isLevelCompleted(index)) {
        item.classList.add('completed');
      } else if (index === this.tutorial.currentLevel) {
        item.classList.add('active');
      } else if (!this.tutorial.isLevelUnlocked(index)) {
        item.classList.add('locked');
      }

      item.innerHTML = `
        <div>${level.title}</div>
        <small>${level.description}</small>
      `;

      // 点击跳转
      if (this.tutorial.isLevelUnlocked(index)) {
        item.addEventListener('click', () => {
          this.tutorial.goToLevel(index);
          this.renderUI();
          this.renderLevelList();
        });
      }

      levelList.appendChild(item);
    });
  }

  updateStats() {
    const completed = this.tutorial.completedLevels.size;
    document.getElementById('completedLevels').textContent = `${completed}/${LEVELS.length}`;
    document.getElementById('studyTime').textContent = `${this.tutorial.getStudyTime()}分钟`;
    document.getElementById('practiceCount').textContent = `${this.tutorial.stats.practiceCount}次`;
  }
}

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
  // 等待一小段时间确保 twisty-player 完全加载
  setTimeout(() => {
    window.game = new RubiksCubeGame();
  }, 500);
});
