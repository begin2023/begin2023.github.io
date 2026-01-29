/**
 * 数独游戏
 */

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
        this.gameOver = false;
        this.hintLevel = 0;
        this.currentHintCell = null;

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

        this.generatePuzzle();
        this.renderBoard();
        this.updateStats();
        this.startTimer();
    }

    generatePuzzle() {
        this.solution = this.generateSolution();
        this.board = [...this.solution];
        this.initialBoard = [...this.solution];

        const removeCount = this.difficultySettings[this.difficulty].remove;
        const positions = Array.from({ length: 81 }, (_, i) => i);
        this.shuffle(positions);

        for (let i = 0; i < removeCount; i++) {
            this.board[positions[i]] = 0;
            this.initialBoard[positions[i]] = 0;
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
                    cells[this.selectedCell].classList.add('error');
                    setTimeout(() => {
                        cells[this.selectedCell].classList.remove('error');
                    }, 500);

                    if (this.mistakes >= this.maxMistakes) {
                        this.endGame(false);
                        return;
                    }
                } else {
                    this.removeRelatedNotes(this.selectedCell, num);
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

    showHint() {
        if (this.hintsLeft <= 0 || this.gameOver) return;

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

    renderBoard() {
        const cells = document.querySelectorAll('.sudoku-cell');
        if (cells.length === 0) return;

        const selectedNum = this.selectedCell !== null ? this.board[this.selectedCell] : null;

        cells.forEach((cell, index) => {
            const value = this.board[index];
            const isGiven = this.initialBoard[index] !== 0;

            cell.className = 'sudoku-cell';

            if (isGiven) {
                cell.classList.add('given');
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
        if (this.board.every((val, idx) => val === this.solution[idx])) {
            this.endGame(true);
        }
    }

    endGame(won) {
        this.gameOver = true;
        clearInterval(this.timerInterval);

        if (won) {
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
}

// 启动游戏
document.addEventListener('DOMContentLoaded', () => {
    new SudokuGame();
});
