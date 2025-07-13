/**
 * インライン編集機能を管理するクラス
 * ダブルクリック編集、フォーカス管理、編集完了を担当
 */
class InlineEditor {
    constructor() {
        this.editingState = {
            type: null, // 'todo' または 'list'
            id: null,
            originalText: null,
            inputElement: null
        };
        this.clickTimeout = null;
        this.isEditing = false;
    }

    /**
     * TODOのインライン編集を開始
     * @param {string} todoId - 編集するTODO ID
     * @param {string} currentText - 現在のテキスト
     * @param {Function} onComplete - 編集完了時のコールバック
     * @param {Function} onCancel - 編集キャンセル時のコールバック
     */
    startEditingTodo(todoId, currentText, onComplete, onCancel) {
        if (this.isEditing) {
            this.cancelEditing();
        }

        const todoElement = document.querySelector(`[data-todo-id="${todoId}"] .todo-text`);
        if (!todoElement) {
            console.warn('Todo element not found for editing:', todoId);
            return false;
        }

        this._startEditingElement(todoElement, currentText, 'todo', todoId, onComplete, onCancel);
        return true;
    }

    /**
     * リストのインライン編集を開始
     * @param {string} listId - 編集するリスト ID
     * @param {string} currentText - 現在のテキスト
     * @param {Function} onComplete - 編集完了時のコールバック
     * @param {Function} onCancel - 編集キャンセル時のコールバック
     */
    startEditingList(listId, currentText, onComplete, onCancel) {
        if (this.isEditing) {
            this.cancelEditing();
        }

        const listElement = document.querySelector(`[data-list-id="${listId}"] .list-name`);
        if (!listElement) {
            console.warn('List element not found for editing:', listId);
            return false;
        }

        this._startEditingElement(listElement, currentText, 'list', listId, onComplete, onCancel);
        return true;
    }

    /**
     * 共通の編集開始処理
     * @private
     */
    _startEditingElement(element, currentText, type, id, onComplete, onCancel) {
        this.isEditing = true;
        this.editingState = {
            type: type,
            id: id,
            originalText: currentText,
            inputElement: null,
            onComplete: onComplete,
            onCancel: onCancel
        };

        // 既存のテキストを非表示
        element.style.display = 'none';

        // 入力フィールドを作成
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'edit-input';
        
        // リストとTODOで異なるスタイルを適用
        if (type === 'list') {
            input.classList.add('edit-list-input');
        } else {
            input.classList.add('edit-todo-input');
        }

        this.editingState.inputElement = input;

        // 入力フィールドを挿入
        element.parentNode.insertBefore(input, element.nextSibling);

        // イベントリスナーを設定
        this._bindEditingEvents(input);

        // フォーカスして全選択
        input.focus();
        input.select();
    }

    /**
     * 編集用のイベントリスナーを設定
     * @private
     */
    _bindEditingEvents(input) {
        // Enter キーで保存
        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.completeEditing();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelEditing();
            }
        };

        // フォーカスが外れたら保存
        const handleBlur = () => {
            // 短い遅延を入れてクリックイベントとの競合を避ける
            setTimeout(() => {
                if (this.isEditing) {
                    this.completeEditing();
                }
            }, 100);
        };

        input.addEventListener('keydown', handleKeydown);
        input.addEventListener('blur', handleBlur);

        // クリーンアップ用にイベントリスナーを保存
        input._editorEvents = {
            keydown: handleKeydown,
            blur: handleBlur
        };
    }

    /**
     * 編集を完了（保存）
     */
    completeEditing() {
        if (!this.isEditing || !this.editingState.inputElement) {
            return false;
        }

        const newText = this.editingState.inputElement.value.trim();
        const wasChanged = newText !== this.editingState.originalText && newText.length > 0;

        // 編集完了コールバックを実行
        if (wasChanged && this.editingState.onComplete) {
            const result = this.editingState.onComplete(this.editingState.id, newText);
            
            // コールバックが成功した場合、DOM要素のテキストも即座に更新
            if (result !== false) {
                const { type, id } = this.editingState;
                const selector = type === 'todo' 
                    ? `[data-todo-id="${id}"] .todo-text`
                    : `[data-list-id="${id}"] .list-name`;
                const element = document.querySelector(selector);
                if (element) {
                    element.textContent = newText;
                }
            }
        }

        this._cleanupEditing();
        return wasChanged;
    }

    /**
     * 編集をキャンセル
     */
    cancelEditing() {
        if (!this.isEditing) {
            return false;
        }

        // キャンセルコールバックを実行
        if (this.editingState.onCancel) {
            this.editingState.onCancel(this.editingState.id);
        }

        this._cleanupEditing();
        return true;
    }

    /**
     * 編集状態をクリーンアップ
     * @private
     */
    _cleanupEditing() {
        if (!this.isEditing) return;

        const { type, id, inputElement } = this.editingState;

        // 入力フィールドを削除
        if (inputElement && inputElement.parentNode) {
            // イベントリスナーを削除
            if (inputElement._editorEvents) {
                inputElement.removeEventListener('keydown', inputElement._editorEvents.keydown);
                inputElement.removeEventListener('blur', inputElement._editorEvents.blur);
            }
            inputElement.parentNode.removeChild(inputElement);
        }

        // 元のテキスト要素を表示
        const selector = type === 'todo' 
            ? `[data-todo-id="${id}"] .todo-text`
            : `[data-list-id="${id}"] .list-name`;
        const originalElement = document.querySelector(selector);
        if (originalElement) {
            originalElement.style.display = '';
        }

        // 状態をリセット
        this.editingState = {
            type: null,
            id: null,
            originalText: null,
            inputElement: null,
            onComplete: null,
            onCancel: null
        };
        this.isEditing = false;
    }

    /**
     * ダブルクリック検出用のクリックハンドラー
     * DOM再レンダリングとの競合を避けるため、タイムアウトベースで実装
     * @param {string} targetId - クリックされた要素のID
     * @param {string} type - 'todo' または 'list'
     * @param {string} currentText - 現在のテキスト
     * @param {Function} onComplete - 編集完了時のコールバック
     * @param {Function} onCancel - 編集キャンセル時のコールバック
     */
    handleClick(targetId, type, currentText, onComplete, onCancel) {
        if (this.clickTimeout) {
            // ダブルクリック検出
            clearTimeout(this.clickTimeout);
            this.clickTimeout = null;
            
            if (type === 'todo') {
                this.startEditingTodo(targetId, currentText, onComplete, onCancel);
            } else if (type === 'list') {
                this.startEditingList(targetId, currentText, onComplete, onCancel);
            }
            return true;
        } else {
            // 最初のクリック
            this.clickTimeout = setTimeout(() => {
                this.clickTimeout = null;
            }, 300); // 300ms以内の2回目のクリックをダブルクリックとみなす
            return false;
        }
    }

    /**
     * 現在編集中かどうかをチェック
     * @returns {boolean}
     */
    isCurrentlyEditing() {
        return this.isEditing;
    }

    /**
     * 編集中の要素情報を取得
     * @returns {Object|null}
     */
    getCurrentEditingInfo() {
        if (!this.isEditing) return null;
        
        return {
            type: this.editingState.type,
            id: this.editingState.id,
            originalText: this.editingState.originalText
        };
    }

    /**
     * 特定の要素が編集中かチェック
     * @param {string} type - 'todo' または 'list'
     * @param {string} id - 要素のID
     * @returns {boolean}
     */
    isEditingElement(type, id) {
        return this.isEditing && 
               this.editingState.type === type && 
               this.editingState.id === id;
    }

    /**
     * デバッグ用：編集状態を出力
     */
    debugPrintState() {
        console.log('InlineEditor state:');
        console.log('  Is editing:', this.isEditing);
        console.log('  Type:', this.editingState.type);
        console.log('  ID:', this.editingState.id);
        console.log('  Original text:', this.editingState.originalText);
        console.log('  Has timeout:', !!this.clickTimeout);
    }
}

module.exports = InlineEditor;