/**
 * TODO選択状態を管理するクラス
 * 単一選択、複数選択、範囲選択、選択プレビューを担当
 */
class SelectionManager {
    constructor() {
        this.selectedTodoIds = new Set();
        this.lastSelectedTodoId = null;
    }

    /**
     * TODOを選択
     * @param {string} todoId - 選択するTODO ID
     * @param {boolean} isMultiSelect - 複数選択モード
     * @param {boolean} isRangeSelect - 範囲選択モード
     */
    selectTodo(todoId, isMultiSelect = false, isRangeSelect = false) {
        if (isRangeSelect && this.lastSelectedTodoId) {
            // 範囲選択の場合は別メソッドに委譲
            return { type: 'range', startId: this.lastSelectedTodoId, endId: todoId };
        } else if (isMultiSelect) {
            if (this.selectedTodoIds.has(todoId)) {
                this.selectedTodoIds.delete(todoId);
                // 削除した場合、lastSelectedTodoIdをクリア
                if (this.lastSelectedTodoId === todoId) {
                    // 他に選択されているTODOがある場合は、最後に選択されたものを設定
                    const remainingIds = Array.from(this.selectedTodoIds);
                    this.lastSelectedTodoId = remainingIds.length > 0 ? remainingIds[remainingIds.length - 1] : null;
                }
            } else {
                this.selectedTodoIds.add(todoId);
                this.lastSelectedTodoId = todoId;
            }
        } else {
            // 単一選択
            this.selectedTodoIds.clear();
            this.selectedTodoIds.add(todoId);
            this.lastSelectedTodoId = todoId;
        }

        return { type: 'single', selectedIds: Array.from(this.selectedTodoIds) };
    }

    /**
     * TODO範囲選択
     * @param {string} startTodoId - 開始TODO ID
     * @param {string} endTodoId - 終了TODO ID
     * @param {Array} todos - 全TODOリスト（順序決定用）
     */
    selectTodoRange(startTodoId, endTodoId, todos) {
        if (!todos || todos.length === 0) return;

        // TODOリスト内でのインデックスを取得
        const startIndex = todos.findIndex(todo => todo.id === startTodoId);
        const endIndex = todos.findIndex(todo => todo.id === endTodoId);

        if (startIndex === -1 || endIndex === -1) return;

        // 範囲を正規化
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);

        // 範囲内のTODOを選択
        this.selectedTodoIds.clear();
        for (let i = minIndex; i <= maxIndex; i++) {
            this.selectedTodoIds.add(todos[i].id);
        }

        this.lastSelectedTodoId = endTodoId;
        return Array.from(this.selectedTodoIds);
    }

    /**
     * 選択をクリア
     */
    clearSelection() {
        this.selectedTodoIds.clear();
        this.lastSelectedTodoId = null;
    }

    /**
     * TODOが選択されているかチェック
     * @param {string} todoId - チェックするTODO ID
     * @returns {boolean}
     */
    isSelected(todoId) {
        return this.selectedTodoIds.has(todoId);
    }

    /**
     * 選択されたTODO IDの配列を取得
     * @returns {Array<string>}
     */
    getSelectedIds() {
        return Array.from(this.selectedTodoIds);
    }

    /**
     * 選択されたTODOの数を取得
     * @returns {number}
     */
    getSelectedCount() {
        return this.selectedTodoIds.size;
    }

    /**
     * 最後に選択されたTODO IDを取得
     * @returns {string|null}
     */
    getLastSelectedId() {
        return this.lastSelectedTodoId;
    }

    /**
     * 選択されたTODOがあるかチェック
     * @returns {boolean}
     */
    hasSelection() {
        return this.selectedTodoIds.size > 0;
    }

    /**
     * 範囲選択プレビューを表示
     * @param {string} startTodoId - 開始TODO ID
     * @param {string} endTodoId - 終了TODO ID
     * @param {Array} todos - 全TODOリスト
     * @returns {Array<string>} プレビュー対象のTODO ID配列
     */
    getRangePreviewIds(startTodoId, endTodoId, todos) {
        if (!todos || todos.length === 0) return [];

        const startIndex = todos.findIndex(todo => todo.id === startTodoId);
        const endIndex = todos.findIndex(todo => todo.id === endTodoId);

        if (startIndex === -1 || endIndex === -1) return [];

        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);

        const previewIds = [];
        for (let i = minIndex; i <= maxIndex; i++) {
            previewIds.push(todos[i].id);
        }

        return previewIds;
    }

    /**
     * 指定したTODO IDsを選択状態に設定
     * @param {Array<string>} todoIds - 選択するTODO IDの配列
     */
    setSelectedIds(todoIds) {
        this.selectedTodoIds.clear();
        todoIds.forEach(id => this.selectedTodoIds.add(id));
        this.lastSelectedTodoId = todoIds.length > 0 ? todoIds[todoIds.length - 1] : null;
    }

    /**
     * 選択状態をコピー（バックアップ用）
     * @returns {Object} 現在の選択状態
     */
    getSelectionState() {
        return {
            selectedIds: Array.from(this.selectedTodoIds),
            lastSelectedId: this.lastSelectedTodoId
        };
    }

    /**
     * 選択状態を復元
     * @param {Object} state - 復元する選択状態
     */
    restoreSelectionState(state) {
        this.selectedTodoIds.clear();
        if (state.selectedIds) {
            state.selectedIds.forEach(id => this.selectedTodoIds.add(id));
        }
        this.lastSelectedTodoId = state.lastSelectedId || null;
    }

    /**
     * デバッグ用：選択状態を出力
     */
    debugPrintSelection() {
        console.log('Selection state:');
        console.log('  Selected IDs:', Array.from(this.selectedTodoIds));
        console.log('  Last selected:', this.lastSelectedTodoId);
        console.log('  Count:', this.selectedTodoIds.size);
    }
}

module.exports = SelectionManager;