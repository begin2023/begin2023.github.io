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
        this.renderBoard();
        this.updateStats();
        this.startTimer();
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
        // 1. 先生成完整解
        this.solution = this.generateSolution();
        this.board = Array(81).fill(0);
        this.initialBoard = Array(81).fill(0);

        // 2. 生成笼子布局
        this.generateCages();

        // 3. 根据笼子总和挖空，确保唯一解
        this.fillKillerBoard();
    }

    generateCages() {
        // 生成杀手数独的笼子
        this.cages = [];
        const used = new Set();
        const cageLayouts = [
            // 简单的2-3格子笼子模式
            [[0, 1], [3, 4], [0, 3], [1, 4]],
            [[0, 1, 2], [0, 3, 6], [0, 1, 3, 4]],
        ];

        // 使用预定义的笼子布局，确保合理
        this.createStandardCages();
    }

    createStandardCages() {
        // 标准杀手数独笼子布局
        // 每个宫格内有2-4个笼子
        this.cages = [];

        const boxCageLayouts = [
            // 每个3x3宫格内的笼子模式
            [
                { cells: [0, 1, 3, 4], sum: 0 }, // 宫格左上2x2
                { cells: [2, 5], sum: 0 },           // 右上两格
                { cells: [6, 7], sum: 0 },           // 左下两格
                { cells: [8], sum: 0 }              // 右下单格
            ],
            [
                { cells: [0, 1], sum: 0 },
                { cells: [2, 3], sum: 0 },
                { cells: [4, 5, 6], sum: 0 },
                { cells: [7, 8], sum: 0 }
            ]
        ];

        // 为每个3x3宫格生成笼子
        for (let box = 0; box < 9; box++) {
            const layout = boxCageLayouts[box % 2];
            const boxRow = Math.floor(box / 3) * 3;
            const boxCol = (box % 3) * 3;

            for (const cage of layout) {
                const globalCells = cage.cells.map(local => {
                    const localRow = Math.floor(local / 3);
                    const localCol = local % 3;
                    return (boxRow + localRow) * 9 + (boxCol + localCol);
                });

                this.cages.push({
                    cells: globalCells,
                    sum: 0
                });
            }
        }

        // 计算每个笼子的总和（基于完整解）
        for (const cage of this.cages) {
            cage.sum = cage.cells.reduce((sum, idx) => sum + this.solution[idx], 0);
        }
    }

    fillKillerBoard() {
        // 根据难度决定挖空多少个格子
        const fillCount = {
            easy: 30,
            medium: 38,
            hard: 44,
            expert: 50
        }[this.difficulty];

        // 随机选择要保留的格子位置
        const positions = Array.from({ length: 81 }, (_, i) => i);
        this.shuffle(positions);

        // 填入指定数量的格子
        for (let i = 0; i < fillCount; i++) {
            const pos = positions[i];
            this.board[pos] = this.solution[pos];
            this.initialBoard[pos] = this.solution[pos];
        }

        // 验证唯一解
        if (!this.hasUniqueSolution(this.board)) {
            // 如果不唯一，尝试调整
            this.adjustForUniqueSolution(fillCount);
        }
    }

    adjustForUniqueSolution(fillCount) {
        // 通过调整来确保唯一解
        const emptyCells = this.board.map((val, idx) => val === 0 ? idx : -1).filter(i => i !== -1);

        // 尝试添加更多提示
        let attempts = 0;
        while (!this.hasUniqueSolution(this.board) && attempts < 20) {
            const randomEmpty = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            if (this.board[randomEmpty] === 0) {
                this.board[randomEmpty] = this.solution[randomEmpty];
                this.initialBoard[randomEmpty] = this.solution[randomEmpty];
            }
            attempts++;
        }
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
        for (let c = 0; c < 9; c++) {
            if (board[row * 9 + c] === num) return false;
        }

        for (let r = 0; r < 9; r++) {
            if (board[r * 9 + col] === num) return false;
        }

        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if (board[r * 9 + c] === num) return false;
            }
        }

        return true;
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
        for (const cell of emptyCells) {
            const row = Math.floor(cell / 9);
            const col = cell % 9;
            const candidates = this.getCandidates(cell);

            if (candidates.length === 1) {
                return { cell, type: 'naked_single', value: candidates[0], row, col, candidates };
            }
        }

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

        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const row = Math.floor(randomCell / 9);
        const col = randomCell % 9;
        return {
            cell: randomCell,
            type: 'general',
            value: this.solution[randomCell],
            row,
            col,
            candidates: this.getCandidates(randomCell)
        };
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

        html += `<div class="hint-step">
            <span class="hint-step-number">1</span>
            <span class="hint-step-text">
                观察第 <span class="hint-highlight-text">${rowNum}</span> 行第 <span class="hint-highlight-text">${colNum}</span> 列的格子（第 ${boxNum} 宫）
            </span>
        </div>`;

        if (this.hintLevel >= 1) {
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
        // 移除所有笼子相关的 class
        cells.forEach(cell => {
            cell.classList.remove('cage-top', 'cage-bottom', 'cage-left', 'cage-right');
            const cageSum = cell.querySelector('.cage-sum');
            if (cageSum) cageSum.remove();
        });

        // 为每个笼子添加边框和总和数字
        for (const cage of this.cages) {
            const firstCell = cage.cells[0];

            // 添加总和数字到第一个格子
            const sumEl = document.createElement('span');
            sumEl.className = 'cage-sum';
            sumEl.textContent = cage.sum;
            cells[firstCell].appendChild(sumEl);

            // 添加笼子边框
            const rows = new Set(cage.cells.map(c => Math.floor(c / 9)));
            const cols = new Set(cage.cells.map(c => c % 9));
            const minRow = Math.min(...rows);
            const maxRow = Math.max(...rows);
            const minCol = Math.min(...cols);
            const maxCol = Math.max(...cols);

            for (const cellIdx of cage.cells) {
                const row = Math.floor(cellIdx / 9);
                const col = cellIdx % 9;

                if (row === minRow && !cage.cells.includes(cellIdx - 9)) {
                    cells[cellIdx].classList.add('cage-top');
                }
                if (row === maxRow && !cage.cells.includes(cellIdx + 9)) {
                    cells[cellIdx].classList.add('cage-bottom');
                }
                if (col === minCol && !cage.cells.includes(cellIdx - 1)) {
                    cells[cellIdx].classList.add('cage-left');
                }
                if (col === maxCol && !cage.cells.includes(cellIdx + 1)) {
                    cells[cellIdx].classList.add('cage-right');
                }
            }
        }
    }

    renderBoard() {
        const cells = document.querySelectorAll('.sudoku-cell');
        if (cells.length === 0) return;

        const selectedNum = this.selectedCell !== null ? this.board[this.selectedCell] : null;

        // 绘制杀手数独笼子
        if (this.gameMode === 'killer') {
            this.renderCages(cells);
        }

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
                cell.textContent = '';
            }
        });

        this.updateNumberPad();
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

            // 检查每个笼子的总和是否正确
            for (const cage of this.cages) {
                const sum = cage.cells.reduce((s, idx) => s + this.board[idx], 0);
                if (sum !== cage.sum) return;
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
