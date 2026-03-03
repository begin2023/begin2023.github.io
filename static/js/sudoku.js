/**
 * 数独游戏
 */

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.masterGain = null;
    }

    init() {
        if (this.audioContext) return;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.audioContext.destination);
    }

    playTone(frequency, duration, type = 'sine', volume = 0.5, delay = 0) {
        if (!this.enabled || !this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.masterGain);

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime + delay);
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime + delay);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + delay + duration);

        oscillator.start(this.audioContext.currentTime + delay);
        oscillator.stop(this.audioContext.currentTime + delay + duration);
    }

    playSuccess(level = 1) {
        this.init();

        switch(level) {
            case 1: // 单个数字正确
                this.playTone(523.25, 0.15, 'sine', 0.4); // C5
                break;
            case 2: // 行/列/宫完成
                this.playTone(523.25, 0.15, 'sine', 0.5); // C5
                this.playTone(659.25, 0.15, 'sine', 0.5, 0.1); // E5
                this.playTone(783.99, 0.3, 'sine', 0.5, 0.2); // G5
                break;
            case 3: // 游戏胜利
                this.playTone(523.25, 0.2, 'sine', 0.6); // C5
                this.playTone(659.25, 0.2, 'sine', 0.6, 0.1); // E5
                this.playTone(783.99, 0.2, 'sine', 0.6, 0.2); // G5
                this.playTone(1046.50, 0.4, 'sine', 0.6, 0.3); // C6
                break;
        }
    }

    playError() {
        this.init();

        this.playTone(200, 0.1, 'sawtooth', 0.5);
        this.playTone(150, 0.2, 'sawtooth', 0.4, 0.05);
    }

    playHint() {
        this.init();

        this.playTone(880, 0.1, 'sine', 0.3); // A5
        this.playTone(988, 0.15, 'sine', 0.3, 0.1); // B5
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

class SudokuGame {
    constructor() {
        this.board = [];
        this.solution = [];
        this.initialBoard = [];
        this.selectedCell = null;
        this.notesMode = false;
        this.notes = Array(81).fill(null).map(() => new Set());
        this.history = [];
        this.hintsLeft = 3;
        this.mistakes = 0;
        this.maxMistakes = 3;
        this.timer = 0;
        this.timerInterval = null;
        this.difficulty = 'easy';
        this.gameMode = 'classic'; // classic 或 killer
        this.gameOver = false;
        this.hintLevel = 0;
        this.currentHintCell = null;
        this.soundManager = new SoundManager();
        this.completedRows = new Set();
        this.completedCols = new Set();
        this.completedBoxes = new Set();
        this.hintCells = new Set();
        this.cages = []; // 杀手数独的笼子

        this.difficultySettings = {
            easy: { remove: 35, hints: 5 },
            medium: { remove: 45, hints: 4 },
            hard: { remove: 52, hints: 3 },
            expert: { remove: 58, hints: 2 }
        };

        this.difficultyNames = {
            easy: '简单',
            medium: '中等',
            hard: '困难',
            expert: '专家'
        };
        
        // 杀手数独的颜色配置（用于区分不同笼子）
        this.cageColors = [
            'rgba(255, 99, 132, 0.05)',
            'rgba(54, 162, 235, 0.05)',
            'rgba(255, 206, 86, 0.05)',
            'rgba(75, 192, 192, 0.05)',
            'rgba(153, 102, 255, 0.05)',
            'rgba(255, 159, 64, 0.05)',
            'rgba(199, 199, 199, 0.05)',
            'rgba(83, 102, 255, 0.05)',
            'rgba(255, 99, 255, 0.05)'
        ];

        this.init();
    }

    init() {
        this.createBoard();
        this.bindEvents();
        this.newGame();
    }

    createBoard() {
        const board = document.getElementById('sudokuBoard');
        if (!board) return;
        board.innerHTML = '';

        for (let i = 0; i < 81; i++) {
            const cell = document.createElement('div');
            cell.className = 'sudoku-cell';
            cell.dataset.index = i;
            board.appendChild(cell);
        }
    }

    bindEvents() {
        const board = document.getElementById('sudokuBoard');
        if (!board) return;

        board.addEventListener('click', (e) => {
            const cell = e.target.closest('.sudoku-cell');
            if (cell) {
                this.selectCell(parseInt(cell.dataset.index));
            }
        });

        document.querySelectorAll('.num-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const num = parseInt(btn.dataset.num);
                this.inputNumber(num);
            });
        });

        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.difficulty = btn.dataset.difficulty;
                this.newGame();
            });
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.gameMode = btn.dataset.mode;
                this.newGame();
            });
        });

        const newGameBtn = document.getElementById('newGameBtn');
        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => this.newGame());
        }

        const playAgainBtn = document.getElementById('playAgainBtn');
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => {
                document.getElementById('victoryModal').classList.remove('show');
                this.newGame();
            });
        }

        const hintBtn = document.getElementById('hintBtn');
        if (hintBtn) {
            hintBtn.addEventListener('click', () => this.showHint());
        }

        const markCandidatesBtn = document.getElementById('markCandidatesBtn');
        if (markCandidatesBtn) {
            markCandidatesBtn.addEventListener('click', () => this.markAllCandidates());
        }

        const hintClose = document.getElementById('hintClose');
        if (hintClose) {
            hintClose.addEventListener('click', () => this.closeHint());
        }

        const showMoreHint = document.getElementById('showMoreHint');
        if (showMoreHint) {
            showMoreHint.addEventListener('click', () => this.showMoreHint());
        }

        const notesBtn = document.getElementById('notesBtn');
        if (notesBtn) {
            notesBtn.addEventListener('click', () => {
                this.notesMode = !this.notesMode;
                notesBtn.classList.toggle('active', this.notesMode);
            });
        }

        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undo());
        }

        const soundBtn = document.getElementById('soundBtn');
        const soundIcon = document.getElementById('soundIcon');
        if (soundBtn && soundIcon) {
            soundBtn.addEventListener('click', () => {
                const enabled = this.soundManager.toggle();
                soundIcon.textContent = enabled ? '🔊' : '🔇';
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key >= '1' && e.key <= '9') {
                this.inputNumber(parseInt(e.key));
            } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
                this.inputNumber(0);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
                       e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                this.moveSelection(e.key);
                e.preventDefault();
            }
        });
    }

    newGame() {
        this.gameOver = false;
        this.mistakes = 0;
        this.hintsLeft = this.difficultySettings[this.difficulty].hints;
        this.notes = Array(81).fill(null).map(() => new Set());
        this.history = [];
        this.hintLevel = 0;
        this.currentHintCell = null;
        this.completedRows.clear();
        this.completedCols.clear();
        this.completedBoxes.clear();
        this.hintCells.clear();
        this.cages = [];

        if (this.gameMode === 'killer') {
            this.generateKillerPuzzle();
        } else {
            this.generateClassicPuzzle();
        }
        this.updateCandidateButtonState();
        this.renderBoard();
        this.updateStats();
        this.startTimer();
    }

    updateCandidateButtonState() {
        const markCandidatesBtn = document.getElementById('markCandidatesBtn');
        if (!markCandidatesBtn) return;

        const isClassic = this.gameMode === 'classic';
        markCandidatesBtn.disabled = !isClassic;
        markCandidatesBtn.title = isClassic ? '标记所有空格的候选数字' : '仅经典模式可用';
    }

    generateClassicPuzzle() {
        this.solution = this.generateSolution();
        this.board = [...this.solution];
        this.initialBoard = [...this.solution];

        const removeCount = this.difficultySettings[this.difficulty].remove;
        const positions = Array.from({ length: 81 }, (_, i) => i);
        this.shuffle(positions);

        let removed = 0;
        for (let i = 0; i < 81 && removed < removeCount; i++) {
            const pos = positions[i];
            const backup = this.board[pos];

            this.board[pos] = 0;

            if (!this.hasUniqueSolution(this.board)) {
                this.board[pos] = backup;
            } else {
                this.initialBoard[pos] = 0;
                removed++;
            }
        }
    }

    generateKillerPuzzle() {
        // 生成杀手数独
        if (this.difficulty === 'expert') {
            // 专家模式：不预填任何数字，纯靠笼子约束推理
            // 反复生成笼子布局直到找到有唯一解的
            for (let attempt = 0; attempt < 50; attempt++) {
                this.solution = this.generateSolution();
                this.generateRandomCages('expert');

                // 验证空盘 + 笼子约束是否有唯一解
                const testBoard = Array(81).fill(0);
                if (this.hasUniqueSolutionKiller(testBoard)) {
                    this.board = Array(81).fill(0);
                    this.initialBoard = Array(81).fill(0);
                    return;
                }
            }
            // 兜底：如果多次尝试都找不到纯笼子唯一解，降级为少量提示
            this.board = Array(81).fill(0);
            this.initialBoard = Array(81).fill(0);
            const positions = Array.from({ length: 81 }, (_, i) => i);
            this.shuffle(positions);
            for (let i = 0; i < positions.length; i++) {
                const pos = positions[i];
                this.board[pos] = this.solution[pos];
                this.initialBoard[pos] = this.solution[pos];
                if (this.hasUniqueSolutionKiller(this.board)) {
                    return;
                }
            }
            return;
        }

        // 非专家模式：从满盘逐个移除数字并验证唯一解
        this.solution = this.generateSolution();
        this.board = [...this.solution];
        this.initialBoard = [...this.solution];
        this.generateRandomCages();

        const killerRemoveCount = {
            easy: 48,
            medium: 56,
            hard: 64
        };

        const removeCount = killerRemoveCount[this.difficulty] || 48;
        const positions = Array.from({ length: 81 }, (_, i) => i);
        this.shuffle(positions);

        let removed = 0;
        for (let i = 0; i < 81 && removed < removeCount; i++) {
            const pos = positions[i];
            const backup = this.board[pos];

            this.board[pos] = 0;

            if (!this.hasUniqueSolutionKiller(this.board)) {
                this.board[pos] = backup;
            } else {
                this.initialBoard[pos] = 0;
                removed++;
            }
        }
    }

    generateRandomCages(mode) {
        this.cages = [];
        const visited = new Set();

        // 专家模式使用更小的笼子以提供更强约束
        const sizeWeights = mode === 'expert'
            ? [1, 1, 2, 2, 2, 2, 3, 3, 3, 4]
            : [1, 2, 2, 2, 3, 3, 3, 4, 4, 5];

        // 遍历所有格子，确保每个格子都被分配到笼子
        for (let i = 0; i < 81; i++) {
            if (visited.has(i)) continue;

            const cageCells = [i];
            visited.add(i);

            // 随机决定该笼子的大小 (1-5格)
            // 权重控制：更倾向于 2, 3, 4 格
            const targetSize = this.weightedRandom(sizeWeights);
            
            // 尝试扩张笼子
            let attempts = 0;
            while (cageCells.length < targetSize && attempts < 10) {
                // 寻找所有已选格子周围的未分配邻居
                const candidates = new Set();
                for (const cellIdx of cageCells) {
                    const neighbors = this.getNeighbors(cellIdx);
                    for (const n of neighbors) {
                        if (!visited.has(n)) {
                            // 关键规则：笼子内数字不能重复
                            // 检查 n 的值是否已经存在于当前 cageCells 对应的解中
                            const val = this.solution[n];
                            const isDuplicate = cageCells.some(c => this.solution[c] === val);
                            
                            if (!isDuplicate) {
                                candidates.add(n);
                            }
                        }
                    }
                }

                if (candidates.size === 0) break;

                // 随机选择一个邻居加入笼子
                const candidatesArray = Array.from(candidates);
                const nextCell = candidatesArray[Math.floor(Math.random() * candidatesArray.length)];
                
                cageCells.push(nextCell);
                visited.add(nextCell);
                attempts++;
            }

            // 计算笼子总和
            const sum = cageCells.reduce((acc, idx) => acc + this.solution[idx], 0);
            
            // 记录笼子
            this.cages.push({
                cells: cageCells.sort((a, b) => a - b),
                sum: sum,
                colorIndex: Math.floor(Math.random() * this.cageColors.length) // 随机颜色索引
            });
        }
    }

    getNeighbors(index) {
        const neighbors = [];
        const row = Math.floor(index / 9);
        const col = index % 9;

        // 上
        if (row > 0) neighbors.push(index - 9);
        // 下
        if (row < 8) neighbors.push(index + 9);
        // 左
        if (col > 0) neighbors.push(index - 1);
        // 右
        if (col < 8) neighbors.push(index + 1);

        return neighbors;
    }

    weightedRandom(items) {
        return items[Math.floor(Math.random() * items.length)];
    }

    hasUniqueSolutionKiller(board) {
        // 使用 MRV 启发式和节点限制的唯一解检查，适用于杀手数独
        this._solveNodeCount = 0;
        this._solveNodeLimit = 50000;
        return this.countSolutionsKiller(board) === 1;
    }

    countSolutionsKiller(board, limit = 2) {
        if (this._solveNodeCount >= this._solveNodeLimit) return limit;
        this._solveNodeCount++;

        // MRV 启发式：选择候选数最少的空格
        let bestIdx = -1;
        let bestCount = 10;
        for (let i = 0; i < 81; i++) {
            if (board[i] !== 0) continue;
            const row = Math.floor(i / 9);
            const col = i % 9;
            let count = 0;
            for (let num = 1; num <= 9; num++) {
                if (this.isValidPlacement(board, row, col, num)) count++;
            }
            if (count === 0) return 0; // 死路
            if (count < bestCount) {
                bestCount = count;
                bestIdx = i;
                if (count === 1) break; // 只有一个候选，直接用
            }
        }

        if (bestIdx === -1) return 1; // 所有格子已填满

        const row = Math.floor(bestIdx / 9);
        const col = bestIdx % 9;
        let solutions = 0;
        for (let num = 1; num <= 9; num++) {
            if (this.isValidPlacement(board, row, col, num)) {
                board[bestIdx] = num;
                solutions += this.countSolutionsKiller(board, limit - solutions);
                board[bestIdx] = 0;
                if (solutions >= limit) return solutions;
            }
        }
        return solutions;
    }

    generateSolution() {
        const board = Array(81).fill(0);
        this.solveSudoku(board);
        return board;
    }

    solveSudoku(board) {
        const empty = board.indexOf(0);
        if (empty === -1) return true;

        const row = Math.floor(empty / 9);
        const col = empty % 9;
        const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        this.shuffle(nums);

        for (const num of nums) {
            if (this.isValidPlacement(board, row, col, num)) {
                board[empty] = num;
                if (this.solveSudoku(board)) return true;
                board[empty] = 0;
            }
        }
        return false;
    }

    isValidPlacement(board, row, col, num) {
        // 1. 基础数独规则检查
        // 检查行
        for (let c = 0; c < 9; c++) {
            if (board[row * 9 + c] === num) return false;
        }

        // 检查列
        for (let r = 0; r < 9; r++) {
            if (board[r * 9 + col] === num) return false;
        }

        // 检查宫格
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if (board[r * 9 + c] === num) return false;
            }
        }

        // 2. 杀手数独特定规则检查
        // 注意：这里我们只做"软检查"（不阻止用户填入，除非是生成过程），
        // 或者做"硬检查"（阻止非法填入）。通常数独游戏允许用户填错，但会提示错误。
        // 此函数主要用于 generateSolution 和 solveSudoku，必须严格遵守规则。
        // 对于用户输入 validation，通常在 inputNumber 中处理。
        
        if (this.gameMode === 'killer' && this.cages.length > 0) {
            const cellIndex = row * 9 + col;
            const cage = this.findCage(cellIndex);

            if (cage) {
                // 规则1：笼子内数字不重复
                for (const cellIdx of cage.cells) {
                    // 注意：这里是在检查放入 num 是否合法，board[cellIndex] 此时应该是 0 或旧值
                    // 我们只关心笼子里的 *其他* 格子
                    if (cellIdx !== cellIndex && board[cellIdx] === num) {
                        return false;
                    }
                }

                // 规则2：笼子总和检查
                // 在求解过程中，我们只能检查当前填入的数是否会导致总和溢出
                // 或者如果笼子已满，总和是否严格相等
                let currentSum = 0;
                let filledCount = 0;
                
                for (const cellIdx of cage.cells) {
                    if (cellIdx === cellIndex) continue; // 跳过当前位置
                    const val = board[cellIdx];
                    if (val !== 0) {
                        currentSum += val;
                        filledCount++;
                    }
                }

                // 检查溢出
                if (currentSum + num > cage.sum) {
                    return false;
                }
                
                // 如果填入这个数后笼子满了，检查总和是否相等
                if (filledCount + 1 === cage.cells.length) {
                    if (currentSum + num !== cage.sum) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    findCage(cellIndex) {
        for (const cage of this.cages) {
            if (cage.cells.includes(cellIndex)) {
                return cage;
            }
        }
        return null;
    }

    hasUniqueSolution(board) {
        return this.countSolutions(board) === 1;
    }

    countSolutions(board, limit = 2) {
        const empty = board.indexOf(0);
        if (empty === -1) return 1;

        const row = Math.floor(empty / 9);
        const col = empty % 9;

        let count = 0;
        for (let num = 1; num <= 9; num++) {
            if (this.isValidPlacement(board, row, col, num)) {
                board[empty] = num;
                count += this.countSolutions(board, limit - count);
                board[empty] = 0;
                if (count >= limit) return count;
            }
        }
        return count;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    selectCell(index) {
        if (this.gameOver) return;
        this.selectedCell = index;
        this.renderBoard();
    }

    moveSelection(direction) {
        if (this.selectedCell === null) {
            this.selectCell(0);
            return;
        }

        let newIndex = this.selectedCell;
        const row = Math.floor(this.selectedCell / 9);
        const col = this.selectedCell % 9;

        switch (direction) {
            case 'ArrowUp': if (row > 0) newIndex = (row - 1) * 9 + col; break;
            case 'ArrowDown': if (row < 8) newIndex = (row + 1) * 9 + col; break;
            case 'ArrowLeft': if (col > 0) newIndex = row * 9 + (col - 1); break;
            case 'ArrowRight': if (col < 8) newIndex = row * 9 + (col + 1); break;
        }

        this.selectCell(newIndex);
    }

    inputNumber(num) {
        if (this.gameOver || this.selectedCell === null) return;
        if (this.initialBoard[this.selectedCell] !== 0) return;

        this.history.push({
            index: this.selectedCell,
            value: this.board[this.selectedCell],
            notes: new Set(this.notes[this.selectedCell])
        });

        if (this.notesMode && num !== 0) {
            if (this.notes[this.selectedCell].has(num)) {
                this.notes[this.selectedCell].delete(num);
            } else {
                this.notes[this.selectedCell].add(num);
            }
            this.board[this.selectedCell] = 0;
        } else {
            this.notes[this.selectedCell].clear();

        if (num === 0) {
                this.board[this.selectedCell] = 0;
            } else {
                // 验证输入
                // 在杀手数独模式下，不仅要检查是否匹配 solution（最终答案），
                // 还可以添加逻辑来提示违反了笼子规则（可选）
                // 这里保持简单的逻辑：直接对比 solution。
                
                this.board[this.selectedCell] = num;

                if (num !== this.solution[this.selectedCell]) {
                    this.mistakes++;
                    this.updateStats();

                    const cells = document.querySelectorAll('.sudoku-cell');
                    const cell = cells[this.selectedCell];

                    // 播放错误音效
                    this.soundManager.playError();

                    // 添加更明显的错误提示效果
                    cell.classList.add('error');

                    // 检查是否违反了杀手数独规则并给出具体提示（可选增强）
                    if (this.gameMode === 'killer') {
                         // 可以在这里加一些 log 或者 toast 提示为什么错了，例如 "总和超出"
                    }

                    // 显示错误动画后，清空错误输入
                    setTimeout(() => {
                        cell.classList.remove('error');
                        cell.classList.add('error-clear');
                        this.board[this.selectedCell] = 0;
                        setTimeout(() => {
                            cell.classList.remove('error-clear');
                            this.renderBoard();
                        }, 300);
                    }, 800);

                    if (this.mistakes >= this.maxMistakes) {
                        this.endGame(false);
                        return;
                    }
                } else {
                    // 正确填入
                    this.removeRelatedNotes(this.selectedCell, num);

                    // 检测是否有行/列/宫完成
                    const completionLevel = this.checkCompletion(this.selectedCell);
                    this.soundManager.playSuccess(completionLevel);
                    this.showCompletionEffect(this.selectedCell, completionLevel);
                }
            }
        }

        this.renderBoard();
        this.checkWin();
    }

    removeRelatedNotes(index, num) {
        const row = Math.floor(index / 9);
        const col = index % 9;
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;

        for (let c = 0; c < 9; c++) {
            this.notes[row * 9 + c].delete(num);
        }

        for (let r = 0; r < 9; r++) {
            this.notes[r * 9 + col].delete(num);
        }

        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                this.notes[r * 9 + c].delete(num);
            }
        }
    }

    markAllCandidates() {
        if (this.gameOver || this.gameMode !== 'classic') return;

        for (let i = 0; i < 81; i++) {
            if (this.board[i] === 0) {
                const correctCandidates = new Set(this.getCandidates(i));

                if (this.notes[i].size === 0) {
                    // 该格还没有笔记时，直接补全候选数
                    this.notes[i] = correctCandidates;
                } else {
                    // 该格已有笔记时，只删掉错误候选，保留玩家正确填写的候选
                    for (const note of Array.from(this.notes[i])) {
                        if (!correctCandidates.has(note)) {
                            this.notes[i].delete(note);
                        }
                    }
                }
            } else {
                this.notes[i].clear();
            }
        }

        this.soundManager.playHint();
        this.renderBoard();
    }

    undo() {
        if (this.history.length === 0 || this.gameOver) return;

        const last = this.history.pop();
        this.board[last.index] = last.value;
        this.notes[last.index] = last.notes;
        this.renderBoard();
    }

    checkCompletion(index) {
        const row = Math.floor(index / 9);
        const col = index % 9;
        const boxIndex = Math.floor(row / 3) * 3 + Math.floor(col / 3);

        let level = 1; // 默认单个正确

        // 检查行是否完成
        let rowComplete = true;
        for (let c = 0; c < 9; c++) {
            if (this.board[row * 9 + c] === 0) {
                rowComplete = false;
                break;
            }
        }

        if (rowComplete && !this.completedRows.has(row)) {
            this.completedRows.add(row);
            level = 2;
        }

        // 检查列是否完成
        let colComplete = true;
        for (let r = 0; r < 9; r++) {
            if (this.board[r * 9 + col] === 0) {
                colComplete = false;
                break;
            }
        }

        if (colComplete && !this.completedCols.has(col)) {
            this.completedCols.add(col);
            level = 2;
        }

        // 检查宫格是否完成
        let boxComplete = true;
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if (this.board[r * 9 + c] === 0) {
                    boxComplete = false;
                    break;
                }
            }
            if (!boxComplete) break;
        }

        if (boxComplete && !this.completedBoxes.has(boxIndex)) {
            this.completedBoxes.add(boxIndex);
            level = 2;
        }

        return level;
    }

    showCompletionEffect(index, level) {
        const row = Math.floor(index / 9);
        const col = index % 9;
        const boxIndex = Math.floor(row / 3) * 3 + Math.floor(col / 3);

        const cells = document.querySelectorAll('.sudoku-cell');
        const cellsToHighlight = [];

        if (level === 1) {
            // 单个数字正确 - 轻微闪烁
            cells[index].classList.add('success-pulse');
            setTimeout(() => cells[index].classList.remove('success-pulse'), 400);
        } else {
            // 行/列/宫完成
            // 高亮完成的行
            for (let c = 0; c < 9; c++) {
                const idx = row * 9 + c;
                if (this.completedRows.has(row)) {
                    cells[idx].classList.add('row-complete');
                    cellsToHighlight.push(idx);
                }
            }

            // 高亮完成的列
            for (let r = 0; r < 9; r++) {
                const idx = r * 9 + col;
                if (this.completedCols.has(col)) {
                    cells[idx].classList.add('col-complete');
                    cellsToHighlight.push(idx);
                }
            }

            // 高亮完成的宫格
            const boxRow = Math.floor(row / 3) * 3;
            const boxCol = Math.floor(col / 3) * 3;
            for (let r = boxRow; r < boxRow + 3; r++) {
                for (let c = boxCol; c < boxCol + 3; c++) {
                    const idx = r * 9 + c;
                    if (this.completedBoxes.has(boxIndex)) {
                        cells[idx].classList.add('box-complete');
                        cellsToHighlight.push(idx);
                    }
                }
            }

            // 移除特效
            setTimeout(() => {
                cellsToHighlight.forEach(idx => {
                    cells[idx].classList.remove('row-complete', 'col-complete', 'box-complete');
                });
            }, 2200);
        }
    }

    showHint() {
        if (this.hintsLeft <= 0 || this.gameOver) return;

        // 播放提示音效
        this.soundManager.playHint();

        const emptyCells = [];
        for (let i = 0; i < 81; i++) {
            if (this.board[i] === 0) {
                emptyCells.push(i);
            }
        }

        if (emptyCells.length === 0) return;

        const hintInfo = this.findHintableCell(emptyCells);

        if (hintInfo) {
            this.currentHintCell = hintInfo.cell;
            this.hintLevel = 0;
            this.displayHint(hintInfo);
        }
    }

    findHintableCell(emptyCells) {
        // 策略1：裸单（Naked Single）- 某格只有一个候选数
        for (const cell of emptyCells) {
            const row = Math.floor(cell / 9);
            const col = cell % 9;
            const candidates = this.getCandidates(cell);

            if (candidates.length === 1) {
                return { cell, type: 'naked_single', value: candidates[0], row, col, candidates };
            }
        }

        // 策略2：隐性单（Hidden Single）- 某数在行/列/宫中只能放在一个位置
        for (const cell of emptyCells) {
            const row = Math.floor(cell / 9);
            const col = cell % 9;
            const candidates = this.getCandidates(cell);

            for (const num of candidates) {
                if (this.isHiddenSingleInRow(row, col, num)) {
                    return { cell, type: 'hidden_single_row', value: num, row, col, candidates };
                }
                if (this.isHiddenSingleInCol(row, col, num)) {
                    return { cell, type: 'hidden_single_col', value: num, row, col, candidates };
                }
                if (this.isHiddenSingleInBox(row, col, num)) {
                    return { cell, type: 'hidden_single_box', value: num, row, col, candidates };
                }
            }
        }

        // 策略3（杀手数独）：笼子最后一格 - 笼子只剩一个空格，和值直接确定
        if (this.gameMode === 'killer') {
            for (const cell of emptyCells) {
                const cage = this.findCage(cell);
                if (!cage) continue;

                const emptyCellsInCage = cage.cells.filter(idx => this.board[idx] === 0);
                if (emptyCellsInCage.length === 1 && emptyCellsInCage[0] === cell) {
                    const filledSum = cage.cells.reduce((s, idx) => s + this.board[idx], 0);
                    const value = cage.sum - filledSum;
                    const row = Math.floor(cell / 9);
                    const col = cell % 9;
                    return { cell, type: 'cage_last_cell', value, row, col, candidates: this.getCandidates(cell), cage };
                }
            }

            // 策略4（杀手数独）：笼子隐性单 - 某数在笼子内只能放在一个位置
            for (const cell of emptyCells) {
                const cage = this.findCage(cell);
                if (!cage) continue;
                const row = Math.floor(cell / 9);
                const col = cell % 9;
                const candidates = this.getCandidates(cell);

                for (const num of candidates) {
                    let onlyPlace = true;
                    for (const otherIdx of cage.cells) {
                        if (otherIdx === cell || this.board[otherIdx] !== 0) continue;
                        const otherRow = Math.floor(otherIdx / 9);
                        const otherCol = otherIdx % 9;
                        if (this.isValidPlacement(this.board, otherRow, otherCol, num)) {
                            onlyPlace = false;
                            break;
                        }
                    }
                    if (onlyPlace) {
                        return { cell, type: 'cage_hidden_single', value: num, row, col, candidates, cage };
                    }
                }
            }

            // 策略5（杀手数独）：笼子和值约束 - 笼子剩余格的和值组合只有一种可能
            for (const cell of emptyCells) {
                const cage = this.findCage(cell);
                if (!cage) continue;

                const emptyCellsInCage = cage.cells.filter(idx => this.board[idx] === 0);
                if (emptyCellsInCage.length < 2 || emptyCellsInCage.length > 4) continue;

                const filledSum = cage.cells.reduce((s, idx) => s + this.board[idx], 0);
                const remainingSum = cage.sum - filledSum;
                const usedInCage = new Set(cage.cells.filter(idx => this.board[idx] !== 0).map(idx => this.board[idx]));

                // 获取每个空格的候选数
                const cellCandidates = emptyCellsInCage.map(idx => ({
                    idx,
                    candidates: this.getCandidates(idx)
                }));

                // 枚举所有合法组合
                const validCombos = [];
                this.findCageCombinations(cellCandidates, 0, [], 0, remainingSum, usedInCage, validCombos);

                // 检查目标格在所有合法组合中是否值唯一
                const cellPos = emptyCellsInCage.indexOf(cell);
                if (cellPos === -1) continue;

                const possibleValues = new Set(validCombos.map(combo => combo[cellPos]));
                if (possibleValues.size === 1) {
                    const value = [...possibleValues][0];
                    const row = Math.floor(cell / 9);
                    const col = cell % 9;
                    return { cell, type: 'cage_sum_constraint', value, row, col, candidates: this.getCandidates(cell), cage, remainingSum, emptyCount: emptyCellsInCage.length };
                }
            }
        }

        // 兜底：选候选数最少的格子，仍然给出推理提示而非直接揭示
        let bestCell = emptyCells[0];
        let bestCount = 10;
        for (const cell of emptyCells) {
            const c = this.getCandidates(cell).length;
            if (c > 0 && c < bestCount) {
                bestCount = c;
                bestCell = cell;
            }
        }
        const row = Math.floor(bestCell / 9);
        const col = bestCell % 9;
        return {
            cell: bestCell,
            type: 'general',
            value: this.solution[bestCell],
            row,
            col,
            candidates: this.getCandidates(bestCell)
        };
    }

    findCageCombinations(cellCandidates, index, current, currentSum, targetSum, usedNums, results) {
        if (index === cellCandidates.length) {
            if (currentSum === targetSum) {
                results.push([...current]);
            }
            return;
        }
        if (currentSum >= targetSum) return;
        if (results.length >= 100) return; // 防止组合爆炸

        for (const num of cellCandidates[index].candidates) {
            if (usedNums.has(num)) continue;
            if (current.includes(num)) continue;
            if (currentSum + num > targetSum) continue;

            current.push(num);
            usedNums.add(num);
            this.findCageCombinations(cellCandidates, index + 1, current, currentSum + num, targetSum, usedNums, results);
            usedNums.delete(num);
            current.pop();
        }
    }

    getCandidates(index) {
        const row = Math.floor(index / 9);
        const col = index % 9;
        const candidates = [];

        for (let num = 1; num <= 9; num++) {
            if (this.isValidPlacement(this.board, row, col, num)) {
                candidates.push(num);
            }
        }

        return candidates;
    }

    isHiddenSingleInRow(row, col, num) {
        for (let c = 0; c < 9; c++) {
            if (c !== col && this.board[row * 9 + c] === 0) {
                if (this.isValidPlacement(this.board, row, c, num)) {
                    return false;
                }
            }
        }
        return true;
    }

    isHiddenSingleInCol(row, col, num) {
        for (let r = 0; r < 9; r++) {
            if (r !== row && this.board[r * 9 + col] === 0) {
                if (this.isValidPlacement(this.board, r, col, num)) {
                    return false;
                }
            }
        }
        return true;
    }

    isHiddenSingleInBox(row, col, num) {
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;

        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if ((r !== row || c !== col) && this.board[r * 9 + c] === 0) {
                    if (this.isValidPlacement(this.board, r, c, num)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    displayHint(hintInfo) {
        const panel = document.getElementById('hintPanel');
        const body = document.getElementById('hintBody');
        const moreBtn = document.getElementById('showMoreHint');

        this.highlightHintCell(hintInfo.cell);

        let html = '';
        const rowNum = hintInfo.row + 1;
        const colNum = hintInfo.col + 1;
        const boxNum = Math.floor(hintInfo.row / 3) * 3 + Math.floor(hintInfo.col / 3) + 1;

        // 通用位置提示
        html += `<div class="hint-step">
            <span class="hint-step-number">1</span>
            <span class="hint-step-text">
                观察第 <span class="hint-highlight-text">${rowNum}</span> 行第 <span class="hint-highlight-text">${colNum}</span> 列的格子（第 ${boxNum} 宫）
            </span>
        </div>`;

        // 杀手数独特有提示逻辑
        let killerHint = '';
        if (this.gameMode === 'killer') {
            const cage = this.findCage(hintInfo.cell);
            if (cage) {
                // 计算笼子当前状态
                let currentSum = 0;
                let filledCount = 0;
                let unknownCells = 0;
                const cageValues = [];
                
                for (const cellIdx of cage.cells) {
                    const val = this.board[cellIdx];
                    if (val !== 0) {
                        currentSum += val;
                        filledCount++;
                        cageValues.push(val);
                    } else {
                        unknownCells++;
                    }
                }
                
                const remainingSum = cage.sum - currentSum;

                killerHint = `<div class="hint-step">
                    <span class="hint-step-number">💡</span>
                    <span class="hint-step-text">
                        <strong>杀手笼子线索：</strong><br>
                        该笼子目标和为 <span class="hint-highlight-text">${cage.sum}</span>。<br>
                        ${filledCount > 0 ? `已填数字和为 ${currentSum}，` : ''}
                        剩余 ${unknownCells} 格需要凑出 <span class="hint-highlight-text">${remainingSum}</span>。
                    </span>
                </div>`;
            }
        }

        if (this.hintLevel >= 1) {
            // 在第二阶段提示中插入杀手数独线索
            if (killerHint) {
                html += killerHint;
            }

            if (hintInfo.type === 'naked_single') {
                html += `<div class="hint-step">
                    <span class="hint-step-number">2</span>
                    <span class="hint-step-text">
                        分析这个格子所在的行、列和宫格，排除已有的数字后，只剩下 <span class="hint-highlight-text">一个</span> 可能的数字
                    </span>
                </div>`;
            } else if (hintInfo.type === 'hidden_single_row') {
                html += `<div class="hint-step">
                    <span class="hint-step-number">2</span>
                    <span class="hint-step-text">
                        在第 <span class="hint-highlight-text">${rowNum}</span> 行中，有一个数字只能填在这个位置
                    </span>
                </div>`;
            } else if (hintInfo.type === 'hidden_single_col') {
                html += `<div class="hint-step">
                    <span class="hint-step-number">2</span>
                    <span class="hint-step-text">
                        在第 <span class="hint-highlight-text">${colNum}</span> 列中，有一个数字只能填在这个位置
                    </span>
                </div>`;
            } else if (hintInfo.type === 'hidden_single_box') {
                html += `<div class="hint-step">
                    <span class="hint-step-number">2</span>
                    <span class="hint-step-text">
                        在第 <span class="hint-highlight-text">${boxNum}</span> 宫中，有一个数字只能填在这个位置
                    </span>
                </div>`;
            } else if (hintInfo.type === 'cage_last_cell') {
                html += `<div class="hint-step">
                    <span class="hint-step-number">2</span>
                    <span class="hint-step-text">
                        这个笼子只剩最后一个空格，用目标和减去已填数字即可得出答案
                    </span>
                </div>`;
            } else if (hintInfo.type === 'cage_hidden_single') {
                html += `<div class="hint-step">
                    <span class="hint-step-number">2</span>
                    <span class="hint-step-text">
                        在这个笼子中，数字 <span class="hint-highlight-text">${hintInfo.value}</span> 只能填在这个位置（其他空格因行/列/宫约束无法放置）
                    </span>
                </div>`;
            } else if (hintInfo.type === 'cage_sum_constraint') {
                html += `<div class="hint-step">
                    <span class="hint-step-number">2</span>
                    <span class="hint-step-text">
                        这个笼子剩余 <span class="hint-highlight-text">${hintInfo.emptyCount}</span> 格需要凑出 <span class="hint-highlight-text">${hintInfo.remainingSum}</span>，结合行列宫约束，这个格子只能填 <span class="hint-highlight-text">${hintInfo.value}</span>
                    </span>
                </div>`;
            } else {
                html += `<div class="hint-step">
                    <span class="hint-step-number">2</span>
                    <span class="hint-step-text">
                        这个格子的候选数字有：<span class="hint-highlight-text">${hintInfo.candidates.join(', ')}</span>
                    </span>
                </div>`;
            }
        }

        if (this.hintLevel >= 2) {
            html += `<div class="hint-step">
                <span class="hint-step-number">3</span>
                <span class="hint-step-text">
                    答案是 <span class="hint-highlight-text">${hintInfo.value}</span>
                </span>
            </div>`;

            // 自动填入答案
            this.board[hintInfo.cell] = hintInfo.value;
            this.notes[hintInfo.cell].clear();
            this.hintCells.add(hintInfo.cell); // 标记为提示填入

            // 检测完成并播放音效/特效
            const completionLevel = this.checkCompletion(hintInfo.cell);
            this.soundManager.playSuccess(completionLevel);
            this.showCompletionEffect(hintInfo.cell, completionLevel);

            this.renderBoard();
            this.checkWin();

            this.hintsLeft--;
            this.updateStats();
            moreBtn.disabled = true;
            moreBtn.textContent = '已显示答案';
        } else {
            moreBtn.disabled = false;
            moreBtn.textContent = '显示更多提示';
        }

        body.innerHTML = html;
        panel.classList.add('show');
    }

    showMoreHint() {
        if (this.hintLevel < 2 && this.currentHintCell !== null) {
            this.hintLevel++;
            const hintInfo = this.findHintableCell([this.currentHintCell]);
            if (hintInfo) {
                this.displayHint(hintInfo);
            }
        }
    }

    highlightHintCell(index) {
        const cells = document.querySelectorAll('.sudoku-cell');
        cells.forEach(cell => {
            cell.classList.remove('hint-highlight', 'hint-target');
        });

        cells[index].classList.add('hint-target');

        const row = Math.floor(index / 9);
        const col = index % 9;
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;

        for (let c = 0; c < 9; c++) {
            if (c !== col) cells[row * 9 + c].classList.add('hint-highlight');
        }

        for (let r = 0; r < 9; r++) {
            if (r !== row) cells[r * 9 + col].classList.add('hint-highlight');
        }

        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if (r !== row || c !== col) {
                    cells[r * 9 + c].classList.add('hint-highlight');
                }
            }
        }
    }

    closeHint() {
        document.getElementById('hintPanel').classList.remove('show');
        const cells = document.querySelectorAll('.sudoku-cell');
        cells.forEach(cell => {
            cell.classList.remove('hint-highlight', 'hint-target');
        });
        this.renderBoard();
    }

    renderCages(cells) {
        // 移除所有笼子相关的 class 和元素
        cells.forEach(cell => {
            cell.classList.remove('cage-top', 'cage-bottom', 'cage-left', 'cage-right');
            cell.style.backgroundColor = ''; // 清除背景色
            const cageSum = cell.querySelector('.cage-sum');
            if (cageSum) cageSum.remove();
        });

        // 为每个笼子添加边框、背景色和总和数字
        for (const cage of this.cages) {
            // 获取背景色
            const bgColor = this.cageColors[cage.colorIndex % this.cageColors.length];
            
            // 找到渲染数字的位置：通常是左上角（最小索引）
            const firstCell = cage.cells[0]; // 之前已经排序过

            // 添加总和数字到第一个格子
            const sumEl = document.createElement('span');
            sumEl.className = 'cage-sum';
            sumEl.textContent = cage.sum;
            cells[firstCell].appendChild(sumEl);

            const cageCellSet = new Set(cage.cells);

            for (const cellIdx of cage.cells) {
                const cell = cells[cellIdx];
                const row = Math.floor(cellIdx / 9);
                const col = cellIdx % 9;
                
                // 设置背景色 (如果需要)
                // cell.style.backgroundColor = bgColor; 

                // 严格判断四个方向的边框
                // 上：如果上方格子不在笼子内（或是边界），则添加上边框
                if (row === 0 || !cageCellSet.has(cellIdx - 9)) {
                    cell.classList.add('cage-top');
                }
                // 下
                if (row === 8 || !cageCellSet.has(cellIdx + 9)) {
                    cell.classList.add('cage-bottom');
                }
                // 左
                if (col === 0 || !cageCellSet.has(cellIdx - 1)) {
                    cell.classList.add('cage-left');
                }
                // 右
                if (col === 8 || !cageCellSet.has(cellIdx + 1)) {
                    cell.classList.add('cage-right');
                }
            }
        }
    }

    renderBoard() {
        const cells = document.querySelectorAll('.sudoku-cell');
        if (cells.length === 0) return;

        const selectedNum = this.selectedCell !== null ? this.board[this.selectedCell] : null;

        cells.forEach((cell, index) => {
            const value = this.board[index];
            const isGiven = this.initialBoard[index] !== 0;
            const isHint = this.hintCells.has(index);

            cell.className = 'sudoku-cell';

            if (isGiven) {
                cell.classList.add('given');
            } else if (isHint) {
                cell.classList.add('hint-input');
            } else if (value !== 0) {
                cell.classList.add('user-input');
            }

            if (index === this.selectedCell) {
                cell.classList.add('selected');
            }

            if (this.selectedCell !== null) {
                const selRow = Math.floor(this.selectedCell / 9);
                const selCol = this.selectedCell % 9;
                const curRow = Math.floor(index / 9);
                const curCol = index % 9;
                const selBox = Math.floor(selRow / 3) * 3 + Math.floor(selCol / 3);
                const curBox = Math.floor(curRow / 3) * 3 + Math.floor(curCol / 3);

                if (curRow === selRow || curCol === selCol || curBox === selBox) {
                    if (index !== this.selectedCell) {
                        cell.classList.add('highlighted');
                    }
                }

                if (selectedNum !== 0 && value === selectedNum && index !== this.selectedCell) {
                    cell.classList.add('same-number');
                }
            }

            if (value !== 0) {
                cell.textContent = value;
            } else if (this.notes[index].size > 0) {
                cell.innerHTML = '<div class="notes">' +
                    [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n =>
                        `<span class="note">${this.notes[index].has(n) ? n : ''}</span>`
                    ).join('') +
                    '</div>';
            } else {
                cell.innerHTML = '&nbsp;'; // 使用不间断空格占位，确保空格子有正确尺寸
            }
        });

        this.updateNumberPad();

        // 绘制杀手数独笼子（必须在内容填充后绘制，否则数字和会被覆盖）
        if (this.gameMode === 'killer') {
            this.renderCages(cells);
        }
    }

    updateNumberPad() {
        const counts = Array(10).fill(0);
        for (const num of this.board) {
            if (num !== 0) counts[num]++;
        }

        document.querySelectorAll('.num-btn').forEach(btn => {
            const num = parseInt(btn.dataset.num);
            if (num !== 0 && counts[num] >= 9) {
                btn.classList.add('disabled');
            } else {
                btn.classList.remove('disabled');
            }
        });
    }

    updateStats() {
        const hintsEl = document.getElementById('hintsLeft');
        const mistakesEl = document.getElementById('mistakes');
        if (hintsEl) hintsEl.textContent = this.hintsLeft;
        if (mistakesEl) mistakesEl.textContent = `${this.mistakes}/${this.maxMistakes}`;
    }

    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        this.timer = 0;
        this.updateTimerDisplay();

        this.timerInterval = setInterval(() => {
            if (!this.gameOver) {
                this.timer++;
                this.updateTimerDisplay();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const timerEl = document.getElementById('timer');
        if (!timerEl) return;
        const minutes = Math.floor(this.timer / 60);
        const seconds = this.timer % 60;
        timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    checkWin() {
        if (this.gameMode === 'killer') {
            // 杀手数独检查
            // 检查是否所有格子都已填入
            if (this.board.some(val => val === 0)) return;

            // 检查每个笼子的总和是否正确，且不重复
            for (const cage of this.cages) {
                const sum = cage.cells.reduce((s, idx) => s + this.board[idx], 0);
                if (sum !== cage.sum) return;
                
                const values = cage.cells.map(idx => this.board[idx]);
                const uniqueValues = new Set(values);
                if (uniqueValues.size !== values.length) return;
            }

            // 检查数独基本规则
            if (!this.isSudokuValid(this.board)) return;

            this.endGame(true);
        } else {
            // 标准数独检查
            if (this.board.every((val, idx) => val === this.solution[idx])) {
                this.endGame(true);
            }
        }
    }

    isSudokuValid(board) {
        // 检查行
        for (let row = 0; row < 9; row++) {
            const seen = new Set();
            for (let col = 0; col < 9; col++) {
                const val = board[row * 9 + col];
                if (val !== 0) {
                    if (seen.has(val)) return false;
                    seen.add(val);
                }
            }
        }

        // 检查列
        for (let col = 0; col < 9; col++) {
            const seen = new Set();
            for (let row = 0; row < 9; row++) {
                const val = board[row * 9 + col];
                if (val !== 0) {
                    if (seen.has(val)) return false;
                    seen.add(val);
                }
            }
        }

        // 检查宫格
        for (let boxRow = 0; boxRow < 9; boxRow += 3) {
            for (let boxCol = 0; boxCol < 9; boxCol += 3) {
                const seen = new Set();
                for (let r = boxRow; r < boxRow + 3; r++) {
                    for (let c = boxCol; c < boxCol + 3; c++) {
                        const val = board[r * 9 + c];
                        if (val !== 0) {
                            if (seen.has(val)) return false;
                            seen.add(val);
                        }
                    }
                }
            }
        }

        return true;
    }

    endGame(won) {
        this.gameOver = true;
        clearInterval(this.timerInterval);

        if (won) {
            // 播放胜利音效
            this.soundManager.playSuccess(3);

            // 触发全局胜利特效
            this.triggerVictoryEffect();

            const finalTime = document.getElementById('finalTime');
            const finalDiff = document.getElementById('finalDifficulty');
            const timer = document.getElementById('timer');
            if (finalTime && timer) finalTime.textContent = timer.textContent;
            if (finalDiff) finalDiff.textContent = this.difficultyNames[this.difficulty];
            document.getElementById('victoryModal').classList.add('show');
        } else {
            alert('游戏结束！错误次数已达上限。');
            this.newGame();
        }
    }

    triggerVictoryEffect() {
        const cells = document.querySelectorAll('.sudoku-cell');
        cells.forEach((cell, index) => {
            setTimeout(() => {
                cell.classList.add('victory-cell');
            }, index * 20);
        });

        // 移除特效
        setTimeout(() => {
            cells.forEach(cell => {
                cell.classList.remove('victory-cell');
            });
        }, 2000);

        // 创建彩带特效
        this.createConfetti();
    }

    createConfetti() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96e6a1', '#dda0dd', '#f7dc6f'];
        const confettiCount = 100;

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.top = '-10px';
            confetti.style.width = Math.random() * 10 + 5 + 'px';
            confetti.style.height = confetti.style.width;
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = Math.random() * 2 + 2 + 's';
            confetti.style.animationDelay = Math.random() * 0.5 + 's';

            document.body.appendChild(confetti);

            setTimeout(() => {
                confetti.remove();
            }, 3500);
        }
    }
}

// 启动游戏
document.addEventListener('DOMContentLoaded', () => {
    new SudokuGame();
});
