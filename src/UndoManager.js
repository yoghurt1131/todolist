/**
 * Undo/Redo機能を管理するクラス
 * アクション履歴の管理と操作の取り消しを担当
 */
class UndoManager {
    constructor(maxSize = 50) {
        this.undoStack = [];
        this.maxSize = maxSize;
    }

    /**
     * アクションを履歴に追加
     * @param {Object} action - 実行されたアクション
     */
    addAction(action) {
        // 必要なプロパティが含まれているかチェック
        if (!action || !action.type) {
            console.warn('Invalid action provided to UndoManager:', action);
            return;
        }

        this.undoStack.push(action);

        // 最大サイズを超えた場合、古いアクションを削除
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }

        console.log('Added action to undo stack:', action.type, `(${this.undoStack.length}/${this.maxSize})`);
    }

    /**
     * 最後のアクションを取り消す
     * @param {Object} operations - { todoOps, listOps } - 操作を実行するためのオブジェクト
     * @returns {boolean} - 取り消しが成功したかどうか
     */
    undo(operations) {
        if (this.undoStack.length === 0) {
            console.log('No actions to undo');
            return false;
        }

        const action = this.undoStack.pop();
        console.log('Undoing action:', action.type);

        try {
            switch (action.type) {
                case 'addTodo':
                    this._undoAddTodo(action, operations.todoOps);
                    break;

                case 'deleteTodo':
                    this._undoDeleteTodo(action, operations.todoOps);
                    break;

                case 'toggleTodo':
                    this._undoToggleTodo(action, operations.todoOps);
                    break;

                case 'editTodo':
                    this._undoEditTodo(action, operations.todoOps);
                    break;

                case 'addList':
                    this._undoAddList(action, operations.listOps);
                    break;

                case 'deleteList':
                    this._undoDeleteList(action, operations.listOps);
                    break;

                case 'editList':
                    this._undoEditList(action, operations.listOps);
                    break;

                case 'moveTodos':
                    this._undoMoveTodos(action, operations.todoOps);
                    break;

                case 'reorderTodos':
                    this._undoReorderTodos(action, operations.todoOps);
                    break;

                case 'updateTodoOrder':
                    this._undoUpdateTodoOrder(action, operations.todoOps);
                    break;

                case 'batchDeleteTodos':
                    this._undoBatchDeleteTodos(action, operations.todoOps);
                    break;

                default:
                    console.warn('Unknown action type for undo:', action.type);
                    // 未知のアクションタイプの場合、履歴に戻す
                    this.undoStack.push(action);
                    return false;
            }

            return true;
        } catch (error) {
            console.error('Error during undo operation:', error);
            // エラーが発生した場合、アクションを履歴に戻す
            this.undoStack.push(action);
            return false;
        }
    }

    /**
     * TODO追加の取り消し
     */
    _undoAddTodo(action, todoOps) {
        if (action.todoId && todoOps.deleteTodoById) {
            todoOps.deleteTodoById(action.todoId);
        }
    }

    /**
     * TODO削除の取り消し
     */
    _undoDeleteTodo(action, todoOps) {
        if (action.todo && todoOps.restoreTodo) {
            todoOps.restoreTodo(action.todo);
        }
    }

    /**
     * TODO完了状態変更の取り消し
     */
    _undoToggleTodo(action, todoOps) {
        if (action.todoId && todoOps.toggleTodoById) {
            todoOps.toggleTodoById(action.todoId);
        }
    }

    /**
     * TODO編集の取り消し
     */
    _undoEditTodo(action, todoOps) {
        if (action.todoId && action.previousText && todoOps.updateTodoById) {
            todoOps.updateTodoById(action.todoId, action.previousText);
        }
    }

    /**
     * リスト追加の取り消し
     */
    _undoAddList(action, listOps) {
        if (action.listId && listOps.deleteListById) {
            listOps.deleteListById(action.listId);
        }
    }

    /**
     * リスト削除の取り消し
     */
    _undoDeleteList(action, listOps) {
        if (action.list && action.todos && listOps.restoreList) {
            listOps.restoreList(action.list, action.todos);
        }
    }

    /**
     * リスト編集の取り消し
     */
    _undoEditList(action, listOps) {
        if (action.listId && action.previousName && listOps.updateListById) {
            listOps.updateListById(action.listId, action.previousName);
        }
    }

    /**
     * TODO移動の取り消し
     */
    _undoMoveTodos(action, todoOps) {
        if (action.todoIds && action.originalListId && todoOps.moveTodosToListById) {
            todoOps.moveTodosToListById(action.todoIds, action.originalListId);
        }
    }

    /**
     * 取り消し可能なアクションがあるかチェック
     * @returns {boolean}
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * 履歴をクリア
     */
    clear() {
        this.undoStack = [];
        console.log('Undo history cleared');
    }

    /**
     * 現在の履歴数を取得
     * @returns {number}
     */
    getHistoryCount() {
        return this.undoStack.length;
    }

    /**
     * 最後のアクションのタイプを取得（取り消し前に確認用）
     * @returns {string|null}
     */
    getLastActionType() {
        if (this.undoStack.length === 0) {
            return null;
        }
        return this.undoStack[this.undoStack.length - 1].type;
    }

    /**
     * TODO並び替えの取り消し
     */
    _undoReorderTodos(action, todoOps) {
        if (action.todoIds && action.originalOrders && todoOps.restoreTodoOrders) {
            todoOps.restoreTodoOrders(action.todoIds, action.originalOrders);
        }
    }

    /**
     * TODO順序更新の取り消し
     */
    _undoUpdateTodoOrder(action, todoOps) {
        if (action.todoId && action.originalOrder !== undefined && todoOps.updateTodoOrderById) {
            todoOps.updateTodoOrderById(action.todoId, action.originalOrder);
        }
    }

    /**
     * バッチ削除の取り消し
     */
    _undoBatchDeleteTodos(action, todoOps) {
        if (action.deletedTodos && todoOps.restoreMultipleTodos) {
            todoOps.restoreMultipleTodos(action.deletedTodos);
        }
    }

    /**
     * デバッグ用：履歴の内容を表示
     */
    debugPrintHistory() {
        console.log('Undo history:');
        this.undoStack.forEach((action, index) => {
            console.log(`  ${index + 1}. ${action.type}`, action);
        });
    }
}

module.exports = UndoManager;