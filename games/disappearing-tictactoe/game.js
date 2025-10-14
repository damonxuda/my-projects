// 游戏状态
const GameState = {
    board: Array(9).fill(null), // 棋盘状态
    currentPlayer: 'X', // 当前玩家
    gameMode: null, // 'ai' 或 'pvp'
    difficulty: null, // 'easy', 'medium', 'hard'
    gameOver: false,
    winner: null,
    playerXMoves: [], // X玩家的走法历史
    playerOMoves: [], // O玩家的走法历史
    MAX_MOVES_PER_PLAYER: 3 // 每个玩家最多保持3个棋子
};

// 获胜组合
const WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // 横向
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // 纵向
    [0, 4, 8], [2, 4, 6] // 斜向
];

// DOM元素
const elements = {
    modeSelection: document.getElementById('modeSelection'),
    difficultySelection: document.getElementById('difficultySelection'),
    gameArea: document.getElementById('gameArea'),
    board: document.getElementById('board'),
    cells: document.querySelectorAll('.cell'),
    turnIndicator: document.getElementById('turnIndicator'),
    turnText: document.getElementById('turnText'),
    playerXInfo: document.getElementById('playerXInfo'),
    playerOInfo: document.getElementById('playerOInfo'),
    playerOName: document.getElementById('playerOName'),
    playerXMoves: document.getElementById('playerXMoves'),
    playerOMoves: document.getElementById('playerOMoves'),
    resultModal: document.getElementById('resultModal'),
    resultIcon: document.getElementById('resultIcon'),
    resultMessage: document.getElementById('resultMessage'),
    dropdownMenu: document.getElementById('dropdownMenu'),
    rulesModal: document.getElementById('rulesModal'),
    aboutModal: document.getElementById('aboutModal')
};

// 初始化游戏
function init() {
    setupEventListeners();
}

// 设置事件监听
function setupEventListeners() {
    // 模式选择
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => selectMode(btn.dataset.mode));
    });

    // 难度选择
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => selectDifficulty(btn.dataset.difficulty));
    });

    // 返回模式选择
    document.getElementById('backToModeBtn').addEventListener('click', () => {
        elements.difficultySelection.style.display = 'none';
        elements.modeSelection.style.display = 'block';
    });

    // 棋盘点击
    elements.cells.forEach(cell => {
        cell.addEventListener('click', () => handleCellClick(parseInt(cell.dataset.index)));
    });

    // 控制按钮
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.getElementById('backToSelectionBtn').addEventListener('click', backToSelection);
    document.getElementById('playAgainBtn').addEventListener('click', () => {
        elements.resultModal.classList.remove('show');
        restartGame();
    });
    document.getElementById('backToMenuBtn').addEventListener('click', () => {
        elements.resultModal.classList.remove('show');
        backToSelection();
    });

    // 菜单按钮
    document.getElementById('menuBtn').addEventListener('click', toggleMenu);
    document.getElementById('rulesBtn').addEventListener('click', (e) => {
        e.preventDefault();
        elements.dropdownMenu.style.display = 'none';
        elements.rulesModal.classList.add('show');
    });
    document.getElementById('aboutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        elements.dropdownMenu.style.display = 'none';
        elements.aboutModal.classList.add('show');
    });

    // 关闭模态框
    document.getElementById('closeRulesBtn').addEventListener('click', () => {
        elements.rulesModal.classList.remove('show');
    });
    document.getElementById('closeAboutBtn').addEventListener('click', () => {
        elements.aboutModal.classList.remove('show');
    });

    // 点击模态框外部关闭
    [elements.rulesModal, elements.aboutModal, elements.resultModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });

    // 点击其他地方关闭菜单
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-btn') && !e.target.closest('.dropdown-menu')) {
            elements.dropdownMenu.style.display = 'none';
        }
    });
}

// 切换菜单
function toggleMenu() {
    const menu = elements.dropdownMenu;
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// 选择游戏模式
function selectMode(mode) {
    GameState.gameMode = mode;

    if (mode === 'ai') {
        elements.modeSelection.style.display = 'none';
        elements.difficultySelection.style.display = 'block';
    } else {
        elements.modeSelection.style.display = 'none';
        startGame();
    }
}

// 选择难度
function selectDifficulty(difficulty) {
    GameState.difficulty = difficulty;
    elements.difficultySelection.style.display = 'none';
    startGame();
}

// 开始游戏
function startGame() {
    // 更新玩家O的名称
    if (GameState.gameMode === 'ai') {
        elements.playerOName.textContent = 'AI 对手';
    } else {
        elements.playerOName.textContent = '玩家 O';
    }

    elements.gameArea.style.display = 'block';
    resetGameState();
    updateUI();
}

// 重置游戏状态
function resetGameState() {
    GameState.board = Array(9).fill(null);
    GameState.currentPlayer = 'X';
    GameState.gameOver = false;
    GameState.winner = null;
    GameState.playerXMoves = [];
    GameState.playerOMoves = [];

    elements.cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('filled', 'oldest', 'winning');
    });
}

// 处理格子点击
function handleCellClick(index) {
    // 游戏结束或格子已被占用
    if (GameState.gameOver || GameState.board[index] !== null) {
        return;
    }

    // AI模式下，O是AI，不能点击
    if (GameState.gameMode === 'ai' && GameState.currentPlayer === 'O') {
        return;
    }

    makeMove(index);
}

// 执行走法
function makeMove(index) {
    const player = GameState.currentPlayer;
    const moves = player === 'X' ? GameState.playerXMoves : GameState.playerOMoves;

    // 如果已经有3个棋子，移除最早的
    if (moves.length >= GameState.MAX_MOVES_PER_PLAYER) {
        const oldestMove = moves.shift();
        GameState.board[oldestMove] = null;
        const oldestCell = elements.cells[oldestMove];
        oldestCell.classList.add('oldest');

        setTimeout(() => {
            oldestCell.textContent = '';
            oldestCell.classList.remove('filled', 'oldest');
        }, 500);
    }

    // 放置新棋子
    GameState.board[index] = player;
    moves.push(index);

    const cell = elements.cells[index];
    cell.textContent = player === 'X' ? '❌' : '⭕';
    cell.classList.add('filled');

    // 检查获胜
    if (checkWinner()) {
        GameState.gameOver = true;
        GameState.winner = player;
        highlightWinningCombination();
        setTimeout(() => showResult(), 800);
        return;
    }

    // 检查平局（实际上消失井字棋很难平局）
    // if (GameState.playerXMoves.length >= 3 && GameState.playerOMoves.length >= 3) {
    //     const emptyCount = GameState.board.filter(cell => cell === null).length;
    //     if (emptyCount === 3) { // 棋盘上正好6个棋子
    //         // 这里可以添加平局判断逻辑，但消失井字棋通常不会平局
    //     }
    // }

    // 切换玩家
    GameState.currentPlayer = player === 'X' ? 'O' : 'X';
    updateUI();

    // AI走棋
    if (GameState.gameMode === 'ai' && GameState.currentPlayer === 'O' && !GameState.gameOver) {
        setTimeout(() => {
            aiMove();
        }, 500);
    }
}

// AI走棋
function aiMove() {
    let move;

    switch (GameState.difficulty) {
        case 'easy':
            move = getRandomMove();
            break;
        case 'medium':
            move = getMediumMove();
            break;
        case 'hard':
            move = getBestMove();
            break;
    }

    if (move !== -1) {
        makeMove(move);
    }
}

// 简单AI：随机走法
function getRandomMove() {
    const availableMoves = getAvailableMoves();
    if (availableMoves.length === 0) return -1;
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

// 中等AI：有一定策略
function getMediumMove() {
    // 30%概率使用最佳走法，70%随机
    if (Math.random() < 0.3) {
        return getBestMove();
    }
    return getRandomMove();
}

// 困难AI：Minimax算法
function getBestMove() {
    let bestScore = -Infinity;
    let bestMove = -1;
    const availableMoves = getAvailableMoves();

    for (let move of availableMoves) {
        const score = evaluateMove(move);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove !== -1 ? bestMove : getRandomMove();
}

// 评估走法
function evaluateMove(move) {
    // 创建临时状态
    const tempBoard = [...GameState.board];
    const tempOMoves = [...GameState.playerOMoves];
    const tempXMoves = [...GameState.playerXMoves];

    // 模拟O走这步
    if (tempOMoves.length >= GameState.MAX_MOVES_PER_PLAYER) {
        const oldestMove = tempOMoves.shift();
        tempBoard[oldestMove] = null;
    }
    tempBoard[move] = 'O';
    tempOMoves.push(move);

    let score = 0;

    // 检查是否能赢
    if (checkWinnerForBoard(tempBoard, 'O')) {
        return 100;
    }

    // 检查对手下一步是否能赢，需要阻止
    for (let i = 0; i < 9; i++) {
        if (tempBoard[i] === null) {
            const testBoard = [...tempBoard];
            const testXMoves = [...tempXMoves];

            if (testXMoves.length >= GameState.MAX_MOVES_PER_PLAYER) {
                const oldestMove = testXMoves.shift();
                testBoard[oldestMove] = null;
            }
            testBoard[i] = 'X';

            if (checkWinnerForBoard(testBoard, 'X')) {
                score += 50; // 防守重要
            }
        }
    }

    // 中心位置价值高
    if (move === 4) {
        score += 10;
    }

    // 角落位置
    if ([0, 2, 6, 8].includes(move)) {
        score += 5;
    }

    // 检查能形成的威胁线
    for (let combo of WINNING_COMBINATIONS) {
        const oCount = combo.filter(i => tempBoard[i] === 'O').length;
        const xCount = combo.filter(i => tempBoard[i] === 'X').length;
        const nullCount = combo.filter(i => tempBoard[i] === null).length;

        if (oCount === 2 && nullCount === 1) {
            score += 30; // 形成双威胁
        }
        if (xCount === 2 && nullCount === 1 && oCount === 0) {
            score += 25; // 阻止对手形成威胁
        }
    }

    return score;
}

// 获取可用走法
function getAvailableMoves() {
    const moves = [];
    for (let i = 0; i < 9; i++) {
        if (GameState.board[i] === null) {
            moves.push(i);
        }
    }
    return moves;
}

// 检查获胜
function checkWinner() {
    return checkWinnerForBoard(GameState.board, GameState.currentPlayer);
}

// 检查指定棋盘和玩家是否获胜
function checkWinnerForBoard(board, player) {
    return WINNING_COMBINATIONS.some(combo => {
        return combo.every(index => board[index] === player);
    });
}

// 高亮获胜组合
function highlightWinningCombination() {
    for (let combo of WINNING_COMBINATIONS) {
        if (combo.every(index => GameState.board[index] === GameState.currentPlayer)) {
            combo.forEach(index => {
                elements.cells[index].classList.add('winning');
            });
            break;
        }
    }
}

// 更新UI
function updateUI() {
    // 更新回合指示器
    elements.turnText.textContent = `轮到 ${GameState.currentPlayer === 'X' ? '❌' : '⭕'} 走棋`;

    // 更新玩家信息高亮
    if (GameState.currentPlayer === 'X') {
        elements.playerXInfo.classList.add('active');
        elements.playerOInfo.classList.remove('active');
    } else {
        elements.playerXInfo.classList.remove('active');
        elements.playerOInfo.classList.add('active');
    }

    // 更新剩余步数
    const xRemaining = GameState.MAX_MOVES_PER_PLAYER - GameState.playerXMoves.length;
    const oRemaining = GameState.MAX_MOVES_PER_PLAYER - GameState.playerOMoves.length;
    elements.playerXMoves.textContent = `剩余: ${xRemaining}步`;
    elements.playerOMoves.textContent = `剩余: ${oRemaining}步`;
}

// 显示结果
function showResult() {
    let icon, message;

    if (GameState.winner === 'X') {
        icon = '🎉';
        message = '恭喜！玩家 X 获胜！';
    } else if (GameState.winner === 'O') {
        if (GameState.gameMode === 'ai') {
            icon = '🤖';
            message = 'AI 对手获胜！再接再厉！';
        } else {
            icon = '🎊';
            message = '恭喜！玩家 O 获胜！';
        }
    } else {
        icon = '🤝';
        message = '平局！';
    }

    elements.resultIcon.textContent = icon;
    elements.resultMessage.textContent = message;
    elements.resultModal.classList.add('show');
}

// 重新开始游戏
function restartGame() {
    resetGameState();
    updateUI();
}

// 返回选择界面
function backToSelection() {
    elements.gameArea.style.display = 'none';
    elements.modeSelection.style.display = 'block';
    GameState.gameMode = null;
    GameState.difficulty = null;
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', init);
