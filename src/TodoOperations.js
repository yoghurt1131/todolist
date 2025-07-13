/**
 * TODO操作機能を管理するクラス
 * TODO の CRUD操作、バリデーション、ビジネスロジックを担当
 */
class TodoOperations {
    constructor(generateIdFn, addToUndoStackFn, saveDataFn) {
        this.generateId = generateIdFn;
        this.addToUndoStack = addToUndoStackFn;
        this.saveData = saveDataFn;
    }

    /**
     * テキストからTODOを作成
     * @param {string} text - TODOのテキスト
     * @param {string} currentListId - 現在のリストID
     * @param {Array} todos - 全TODOリスト（参照）
     * @returns {Object|null} 作成されたTODO、または null
     */
    addTodoFromText(text, currentListId, todos) {
        if (!text || !text.trim()) {
            console.warn('Cannot create todo with empty text');
            return null;
        }

        const todo = {
            id: this.generateId(),
            text: text.trim(),
            completed: false,
            listId: currentListId === 'default' ? null : currentListId,
            createdAt: new Date().toISOString()
        };

        todos.push(todo);

        // Undo履歴に記録
        this.addToUndoStack({
            type: 'addTodo',
            todoId: todo.id
        });

        this.saveData();
        console.log('TODO created:', todo.text);
        return todo;
    }

    /**
     * TODOの完了状態を切り替え
     * @param {string} todoId - TODO ID
     * @param {Array} todos - 全TODOリスト（参照）
     * @returns {Object|null} 更新されたTODO、または null
     */
    toggleTodo(todoId, todos) {
        const todo = todos.find(t => t.id === todoId);
        if (!todo) {
            console.warn('Todo not found for toggle:', todoId);
            return null;
        }

        const previousState = todo.completed;
        todo.completed = !todo.completed;

        // Undo履歴に記録
        this.addToUndoStack({
            type: 'toggleTodo',
            todoId: todo.id,
            previousState: previousState
        });

        this.saveData();
        console.log('TODO toggled:', todo.text, 'completed:', todo.completed);
        return todo;
    }

    /**
     * TODOのテキストを更新
     * @param {string} todoId - TODO ID
     * @param {string} newText - 新しいテキスト
     * @param {Array} todos - 全TODOリスト（参照）
     * @returns {Object|null} 更新されたTODO、または null
     */
    updateTodo(todoId, newText, todos) {
        const todo = todos.find(t => t.id === todoId);
        if (!todo) {
            console.warn('Todo not found for update:', todoId);
            return null;
        }

        if (!newText || !newText.trim()) {
            console.warn('Cannot update todo with empty text');
            return null;
        }

        const previousText = todo.text;
        const trimmedText = newText.trim();
        
        // テキストが実際に変更された場合のみ更新
        if (previousText === trimmedText) {
            console.log('Todo text unchanged, skipping update');
            return todo;
        }

        todo.text = trimmedText;

        // Undo履歴に記録
        this.addToUndoStack({
            type: 'editTodo',
            todoId: todoId,
            previousText: previousText,
            newText: trimmedText
        });

        this.saveData();
        console.log('TODO updated:', previousText, '->', trimmedText);
        return todo;
    }

    /**
     * TODOを削除
     * @param {string} todoId - TODO ID
     * @param {Array} todos - 全TODOリスト（参照）
     * @returns {boolean} 削除が成功したかどうか
     */
    deleteTodo(todoId, todos) {
        const todoToDelete = todos.find(t => t.id === todoId);
        if (!todoToDelete) {
            console.warn('Todo not found for deletion:', todoId);
            return false;
        }

        // Undo履歴に記録（削除前のデータを保存）
        this.addToUndoStack({
            type: 'deleteTodo',
            todoId: todoId,
            todo: { ...todoToDelete } // todoData -> todo に修正
        });

        const initialLength = todos.length;
        const index = todos.findIndex(t => t.id === todoId);
        if (index !== -1) {
            todos.splice(index, 1);
        }

        const deleted = initialLength !== todos.length;
        if (deleted) {
            this.saveData();
            console.log('TODO deleted:', todoToDelete.text);
        }
        return deleted;
    }

    /**
     * 複数のTODOを削除
     * @param {Array<string>} todoIds - 削除するTODO IDの配列
     * @param {Array} todos - 全TODOリスト（参照）
     * @returns {number} 削除されたTODOの数
     */
    deleteMultipleTodos(todoIds, todos) {
        if (!Array.isArray(todoIds) || todoIds.length === 0) {
            return 0;
        }

        let deletedCount = 0;
        const deletedTodos = [];

        // 削除予定のTODOを特定
        todoIds.forEach(todoId => {
            const todo = todos.find(t => t.id === todoId);
            if (todo) {
                deletedTodos.push({ ...todo });
            }
        });

        // 実際に削除
        todoIds.forEach(todoId => {
            const index = todos.findIndex(t => t.id === todoId);
            if (index !== -1) {
                todos.splice(index, 1);
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            // バッチ削除として履歴に記録
            this.addToUndoStack({
                type: 'batchDeleteTodos',
                deletedTodos: deletedTodos
            });

            this.saveData();
            console.log(`${deletedCount} TODOs deleted`);
        }

        return deletedCount;
    }

    /**
     * TODOを他のリストに移動
     * @param {Array<string>} todoIds - 移動するTODO IDの配列
     * @param {string} targetListId - 移動先のリストID
     * @param {Array} todos - 全TODOリスト（参照）
     * @returns {boolean} 移動が成功したかどうか
     */
    moveTodosToList(todoIds, targetListId, todos) {
        if (!Array.isArray(todoIds) || todoIds.length === 0) {
            return false;
        }

        const actualTargetListId = targetListId === 'default' ? null : targetListId;
        let moved = false;
        const originalListIds = {};

        todoIds.forEach(todoId => {
            const todo = todos.find(t => t.id === todoId);
            if (todo && todo.listId !== actualTargetListId) {
                originalListIds[todoId] = todo.listId;
                todo.listId = actualTargetListId;
                moved = true;
            }
        });

        if (moved) {
            // 移動履歴を記録
            this.addToUndoStack({
                type: 'moveTodos',
                todoIds: todoIds,
                targetListId: actualTargetListId,
                originalListIds: originalListIds
            });

            this.saveData();
            console.log(`${todoIds.length} TODOs moved to list:`, targetListId);
        }

        return moved;
    }

    /**
     * TODOを複製
     * @param {string} todoId - 複製するTODO ID
     * @param {Array} todos - 全TODOリスト（参照）
     * @returns {Object|null} 複製されたTODO、または null
     */
    duplicateTodo(todoId, todos) {
        const originalTodo = todos.find(t => t.id === todoId);
        if (!originalTodo) {
            console.warn('Todo not found for duplication:', todoId);
            return null;
        }

        const duplicatedTodo = {
            id: this.generateId(),
            text: originalTodo.text + ' (コピー)',
            completed: false, // 複製時は常に未完了
            listId: originalTodo.listId,
            createdAt: new Date().toISOString()
        };

        todos.push(duplicatedTodo);

        this.addToUndoStack({
            type: 'addTodo',
            todoId: duplicatedTodo.id
        });

        this.saveData();
        console.log('TODO duplicated:', duplicatedTodo.text);
        return duplicatedTodo;
    }

    /**
     * TODOを検索
     * @param {string} query - 検索クエリ
     * @param {Array} todos - 全TODOリスト
     * @param {Object} options - 検索オプション
     * @returns {Array} マッチしたTODOの配列
     */
    searchTodos(query, todos, options = {}) {
        if (!query || !query.trim()) {
            return todos;
        }

        const {
            caseSensitive = false,
            completedOnly = false,
            incompleteOnly = false,
            listId = null
        } = options;

        const searchQuery = caseSensitive ? query.trim() : query.trim().toLowerCase();

        return todos.filter(todo => {
            // テキスト検索
            const todoText = caseSensitive ? todo.text : todo.text.toLowerCase();
            const textMatch = todoText.includes(searchQuery);

            // 完了状態フィルター
            if (completedOnly && !todo.completed) return false;
            if (incompleteOnly && todo.completed) return false;

            // リストフィルター
            if (listId !== null) {
                const todoListId = todo.listId || 'default';
                if (todoListId !== listId) return false;
            }

            return textMatch;
        });
    }

    /**
     * TODOの統計情報を取得
     * @param {Array} todos - 対象のTODOリスト
     * @returns {Object} 統計情報
     */
    getTodoStatistics(todos) {
        const total = todos.length;
        const completed = todos.filter(t => t.completed).length;
        const incomplete = total - completed;

        return {
            total,
            completed,
            incomplete,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }

    /**
     * 指定した期間のTODOを取得
     * @param {Array} todos - 全TODOリスト
     * @param {Date} startDate - 開始日
     * @param {Date} endDate - 終了日
     * @returns {Array} 期間内のTODO配列
     */
    getTodosByDateRange(todos, startDate, endDate) {
        if (!startDate || !endDate) {
            return todos;
        }

        return todos.filter(todo => {
            const createdDate = new Date(todo.createdAt);
            return createdDate >= startDate && createdDate <= endDate;
        });
    }

    /**
     * TODOの有効性を検証
     * @param {Object} todo - 検証するTODO
     * @returns {Object} {isValid: boolean, errors: Array}
     */
    validateTodo(todo) {
        const errors = [];

        if (!todo) {
            errors.push('Todo object is required');
            return { isValid: false, errors };
        }

        if (!todo.id || typeof todo.id !== 'string') {
            errors.push('Todo ID is required and must be a string');
        }

        if (!todo.text || typeof todo.text !== 'string' || !todo.text.trim()) {
            errors.push('Todo text is required and must be non-empty');
        }

        if (typeof todo.completed !== 'boolean') {
            errors.push('Todo completed status must be a boolean');
        }

        if (todo.listId !== null && typeof todo.listId !== 'string') {
            errors.push('Todo listId must be null or a string');
        }

        if (!todo.createdAt || isNaN(new Date(todo.createdAt).getTime())) {
            errors.push('Todo createdAt must be a valid date string');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * デバッグ用：操作統計を出力
     */
    debugPrintOperations() {
        console.log('TodoOperations debug info:');
        console.log('  Functions available:');
        console.log('    - generateId:', typeof this.generateId);
        console.log('    - addToUndoStack:', typeof this.addToUndoStack);
        console.log('    - saveData:', typeof this.saveData);
    }
}

module.exports = TodoOperations;