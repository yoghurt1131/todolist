/**
 * クリップボード機能を管理するクラス
 * TODO のコピー、ペースト、システムクリップボードとの連携を担当
 */
class ClipboardManager {
    constructor() {
        this.clipboardTodos = []; // コピーされたTODOのデータ
    }

    /**
     * 選択されたTODOをクリップボードにコピー
     * @param {Array<string>} selectedTodoIds - 選択されたTODO IDの配列
     * @param {Array} todos - 全TODOリスト
     * @param {Function} onNotify - 通知表示用コールバック
     */
    copyTodos(selectedTodoIds, todos, onNotify) {
        if (!selectedTodoIds || selectedTodoIds.length === 0) {
            console.warn('No todos selected for copy');
            return false;
        }

        // 選択されたTODOのデータを取得
        this.clipboardTodos = selectedTodoIds
            .map(id => todos.find(todo => todo.id === id))
            .filter(todo => todo !== undefined)
            .map(todo => ({
                text: todo.text,
                completed: todo.completed,
                listId: todo.listId,
                createdAt: todo.createdAt
            }));

        console.log(`${this.clipboardTodos.length}件のタスクをコピーしました`);

        // 通知を表示
        if (onNotify) {
            onNotify(this.clipboardTodos.length);
        }

        return true;
    }

    /**
     * システムクリップボードにテキストとして出力
     * ブラウザ環境とElectron環境の両方に対応
     */
    copyToSystemClipboard() {
        if (typeof require === 'undefined' || this.clipboardTodos.length === 0) {
            console.warn('Cannot copy to system clipboard: no todos or not in Electron environment');
            return false;
        }

        try {
            const { clipboard } = require('electron');
            
            // マークダウン形式でテキストを生成
            const bulletText = this.clipboardTodos
                .map(todo => {
                    const prefix = todo.completed ? '- [x]' : '- [ ]';
                    return `${prefix} ${todo.text}`;
                })
                .join('\n');

            clipboard.writeText(bulletText);
            console.log('TODOリストをシステムクリップボードにコピーしました');
            return true;
        } catch (error) {
            console.error('システムクリップボードへのコピーに失敗しました:', error);
            return false;
        }
    }

    /**
     * クリップボードからTODOを貼り付け
     * @param {string} currentListId - 貼り付け先のリストID
     * @param {Function} generateId - ID生成関数
     * @returns {Array} 作成された新しいTODOの配列
     */
    pasteTodos(currentListId, generateId) {
        if (this.clipboardTodos.length === 0) {
            console.warn('No todos in clipboard to paste');
            return [];
        }

        // 新しいTODOを作成
        const newTodos = this.clipboardTodos.map(todoData => {
            const newTodo = {
                id: generateId(),
                text: todoData.text,
                completed: false, // 貼り付け時は常に未完了状態
                listId: currentListId === 'default' ? null : currentListId,
                createdAt: new Date().toISOString()
            };
            return newTodo;
        });

        console.log(`${newTodos.length}件のタスクを貼り付けました`);
        return newTodos;
    }

    /**
     * クリップボードの内容をクリア
     */
    clearClipboard() {
        const wasEmpty = this.clipboardTodos.length === 0;
        this.clipboardTodos = [];
        
        if (!wasEmpty) {
            console.log('クリップボードをクリアしました');
        }
        
        return !wasEmpty;
    }

    /**
     * クリップボードが空かどうかをチェック
     * @returns {boolean}
     */
    isEmpty() {
        return this.clipboardTodos.length === 0;
    }

    /**
     * クリップボード内のTODO数を取得
     * @returns {number}
     */
    getCount() {
        return this.clipboardTodos.length;
    }

    /**
     * クリップボード内のTODOデータを取得（読み取り専用）
     * @returns {Array} クリップボード内のTODOデータのコピー
     */
    getClipboardData() {
        return this.clipboardTodos.map(todo => ({ ...todo }));
    }

    /**
     * 指定されたTODOがクリップボードに含まれているかチェック
     * @param {string} todoText - チェックするTODOのテキスト
     * @returns {boolean}
     */
    containsTodo(todoText) {
        return this.clipboardTodos.some(todo => todo.text === todoText);
    }

    /**
     * クリップボードの内容をマークダウン形式で取得
     * @returns {string} マークダウン形式のテキスト
     */
    toMarkdown() {
        if (this.clipboardTodos.length === 0) {
            return '';
        }

        return this.clipboardTodos
            .map(todo => {
                const prefix = todo.completed ? '- [x]' : '- [ ]';
                return `${prefix} ${todo.text}`;
            })
            .join('\n');
    }

    /**
     * クリップボードの内容をプレーンテキスト形式で取得
     * @returns {string} プレーンテキスト形式
     */
    toPlainText() {
        if (this.clipboardTodos.length === 0) {
            return '';
        }

        return this.clipboardTodos
            .map(todo => {
                const prefix = todo.completed ? '✓' : '○';
                return `${prefix} ${todo.text}`;
            })
            .join('\n');
    }

    /**
     * 外部データからクリップボードを設定
     * @param {Array} todos - 設定するTODOデータの配列
     */
    setClipboardData(todos) {
        if (!Array.isArray(todos)) {
            console.warn('Invalid data provided to setClipboardData');
            return false;
        }

        this.clipboardTodos = todos.map(todo => ({
            text: todo.text || '',
            completed: Boolean(todo.completed),
            listId: todo.listId || null,
            createdAt: todo.createdAt || new Date().toISOString()
        }));

        console.log(`クリップボードに${this.clipboardTodos.length}件のTODOを設定しました`);
        return true;
    }

    /**
     * クリップボードの統計情報を取得
     * @returns {Object} 統計情報
     */
    getStatistics() {
        const completed = this.clipboardTodos.filter(todo => todo.completed).length;
        const incomplete = this.clipboardTodos.length - completed;

        return {
            total: this.clipboardTodos.length,
            completed: completed,
            incomplete: incomplete,
            completionRate: this.clipboardTodos.length > 0 
                ? Math.round((completed / this.clipboardTodos.length) * 100) 
                : 0
        };
    }

    /**
     * 重複するTODOを除去
     * @param {string} duplicateStrategy - 'first' | 'last' | 'merge'
     */
    removeDuplicates(duplicateStrategy = 'first') {
        if (this.clipboardTodos.length <= 1) return;

        const seen = new Set();
        const unique = [];

        this.clipboardTodos.forEach(todo => {
            if (!seen.has(todo.text)) {
                seen.add(todo.text);
                unique.push(todo);
            } else if (duplicateStrategy === 'last') {
                // 既存を削除して最新を追加
                const index = unique.findIndex(u => u.text === todo.text);
                if (index !== -1) {
                    unique[index] = todo;
                }
            } else if (duplicateStrategy === 'merge') {
                // 完了状態をマージ
                const existing = unique.find(u => u.text === todo.text);
                if (existing) {
                    existing.completed = existing.completed || todo.completed;
                }
            }
        });

        const originalCount = this.clipboardTodos.length;
        this.clipboardTodos = unique;
        
        console.log(`重複除去: ${originalCount}件 → ${this.clipboardTodos.length}件`);
    }

    /**
     * デバッグ用：クリップボードの内容を出力
     */
    debugPrintClipboard() {
        console.log('Clipboard state:');
        console.log('  Count:', this.clipboardTodos.length);
        this.clipboardTodos.forEach((todo, index) => {
            console.log(`  ${index + 1}. ${todo.completed ? '[✓]' : '[ ]'} ${todo.text}`);
        });
    }
}

module.exports = ClipboardManager;