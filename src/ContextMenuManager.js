/**
 * コンテキストメニュー機能を管理するクラス
 * 右クリックメニューの表示、位置調整、リスト移動操作を担当
 */
class ContextMenuManager {
    constructor() {
        this.isVisible = false;
        this.currentPosition = { x: 0, y: 0 };
    }

    /**
     * コンテキストメニューを表示
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {Array} selectedTodoIds - 選択されたTODO IDの配列
     * @param {Array} todos - 全TODOリスト
     * @param {Array} lists - 全リストリスト
     * @param {Function} onMoveToList - リスト移動時のコールバック
     */
    showContextMenu(x, y, selectedTodoIds, todos, lists, onMoveToList) {
        if (typeof document === 'undefined') return false;

        const contextMenu = document.getElementById('todoContextMenu');
        const selectedTodoCount = document.getElementById('selectedTodoCount');
        const contextMenuLists = document.getElementById('contextMenuLists');

        if (!contextMenu || !selectedTodoCount || !contextMenuLists) {
            console.warn('Context menu elements not found');
            return false;
        }

        // 選択されたTODO数を更新
        selectedTodoCount.textContent = selectedTodoIds.length;

        // リスト一覧を生成
        this._generateListItems(contextMenuLists, selectedTodoIds, todos, lists, onMoveToList);

        // メニューを表示
        contextMenu.classList.remove('hidden');
        this.isVisible = true;

        // 位置を設定
        this._positionMenu(contextMenu, x, y);

        return true;
    }

    /**
     * コンテキストメニューを非表示
     */
    hideContextMenu() {
        if (typeof document === 'undefined') return false;

        const contextMenu = document.getElementById('todoContextMenu');
        if (contextMenu) {
            contextMenu.classList.add('hidden');
            this.isVisible = false;
            return true;
        }
        return false;
    }

    /**
     * コンテキストメニューが表示されているかチェック
     * @returns {boolean}
     */
    isContextMenuVisible() {
        return this.isVisible;
    }

    /**
     * リストアイテムを生成
     * @private
     */
    _generateListItems(contextMenuLists, selectedTodoIds, todos, lists, onMoveToList) {
        contextMenuLists.innerHTML = '';

        // 選択されたTODOのデータを取得
        const selectedTodos = selectedTodoIds
            .map(id => todos.find(t => t.id === id))
            .filter(Boolean);

        lists.forEach(list => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';

            // 現在のリストかどうかチェック
            const isCurrentList = this._isCurrentList(selectedTodos, list.id);

            if (isCurrentList) {
                item.classList.add('current');
                item.innerHTML = `
                    <span>📍</span>
                    <span>${list.name} (現在のリスト)</span>
                `;
            } else {
                item.innerHTML = `
                    <span>📂</span>
                    <span>${list.name}</span>
                `;

                // クリックイベントを追加
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (onMoveToList) {
                        onMoveToList(selectedTodoIds, list.id);
                    }
                    this.hideContextMenu();
                });
            }

            contextMenuLists.appendChild(item);
        });
    }

    /**
     * 現在のリストかどうかをチェック
     * @private
     */
    _isCurrentList(selectedTodos, listId) {
        return selectedTodos.every(todo => {
            const todoListId = todo.listId || 'default';
            return todoListId === listId;
        });
    }

    /**
     * メニューの位置を調整
     * @private
     */
    _positionMenu(contextMenu, x, y) {
        // 初期位置を設定
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';

        this.currentPosition = { x, y };

        // 画面からはみ出る場合の調整
        requestAnimationFrame(() => {
            const rect = contextMenu.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            let adjustedX = x;
            let adjustedY = y;

            // 右端からはみ出る場合は左側に表示
            if (rect.right > windowWidth) {
                adjustedX = x - rect.width;
                contextMenu.style.left = Math.max(0, adjustedX) + 'px';
            }

            // 下端からはみ出る場合は上側に表示
            if (rect.bottom > windowHeight) {
                adjustedY = y - rect.height;
                contextMenu.style.top = Math.max(0, adjustedY) + 'px';
            }

            this.currentPosition = { x: adjustedX, y: adjustedY };
        });
    }

    /**
     * イベントリスナーをバインド
     * @param {Function} onHide - メニューを隠す際のコールバック
     */
    bindEvents(onHide) {
        if (typeof document === 'undefined') return;

        // ドキュメントクリックでメニューを隠す
        document.addEventListener('click', (e) => {
            if (this.isVisible) {
                const contextMenu = document.getElementById('todoContextMenu');
                if (contextMenu && !contextMenu.contains(e.target)) {
                    this.hideContextMenu();
                    if (onHide) onHide();
                }
            }
        });

        // コンテキストメニューイベントを処理
        document.addEventListener('contextmenu', (e) => {
            // TODOリスト以外でのコンテキストメニューを無効化
            if (!e.target.closest('.todo-item')) {
                this.hideContextMenu();
                if (onHide) onHide();
            }
        });

        // Escapeキーでメニューを隠す
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hideContextMenu();
                if (onHide) onHide();
            }
        });
    }

    /**
     * 指定した座標がメニュー内かチェック
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @returns {boolean}
     */
    isPointInMenu(x, y) {
        if (!this.isVisible || typeof document === 'undefined') return false;

        const contextMenu = document.getElementById('todoContextMenu');
        if (!contextMenu) return false;

        const rect = contextMenu.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    /**
     * メニューの現在位置を取得
     * @returns {Object} {x, y}座標
     */
    getCurrentPosition() {
        return { ...this.currentPosition };
    }

    /**
     * 選択されたTODOの数に基づいてメニューテキストを更新
     * @param {number} count - 選択されたTODO数
     */
    updateSelectedCount(count) {
        if (typeof document === 'undefined') return;

        const selectedTodoCount = document.getElementById('selectedTodoCount');
        if (selectedTodoCount) {
            selectedTodoCount.textContent = count;
        }
    }

    /**
     * メニュー内の特定のリストアイテムを無効化/有効化
     * @param {string} listId - リストID
     * @param {boolean} disabled - 無効化するかどうか
     */
    setListItemDisabled(listId, disabled) {
        if (typeof document === 'undefined') return;

        const contextMenuLists = document.getElementById('contextMenuLists');
        if (!contextMenuLists) return;

        const listItems = contextMenuLists.querySelectorAll('.context-menu-item');
        listItems.forEach((item, index) => {
            // リストのインデックスでマッチング（簡易実装）
            if (disabled) {
                item.classList.add('disabled');
                item.style.pointerEvents = 'none';
                item.style.opacity = '0.5';
            } else {
                item.classList.remove('disabled');
                item.style.pointerEvents = '';
                item.style.opacity = '';
            }
        });
    }

    /**
     * メニューにカスタムアクションを追加
     * @param {string} text - アクション名
     * @param {string} icon - アイコン
     * @param {Function} onClick - クリックハンドラー
     */
    addCustomAction(text, icon, onClick) {
        if (typeof document === 'undefined') return;

        const contextMenuLists = document.getElementById('contextMenuLists');
        if (!contextMenuLists) return;

        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';

        const item = document.createElement('div');
        item.className = 'context-menu-item context-menu-action';
        item.innerHTML = `
            <span>${icon}</span>
            <span>${text}</span>
        `;

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onClick) onClick();
            this.hideContextMenu();
        });

        contextMenuLists.appendChild(separator);
        contextMenuLists.appendChild(item);
    }

    /**
     * デバッグ用：メニューの状態を出力
     */
    debugPrintState() {
        console.log('ContextMenuManager state:');
        console.log('  Is visible:', this.isVisible);
        console.log('  Position:', this.currentPosition);
        
        if (typeof document !== 'undefined') {
            const contextMenu = document.getElementById('todoContextMenu');
            console.log('  DOM element exists:', !!contextMenu);
            if (contextMenu) {
                console.log('  CSS classes:', contextMenu.className);
                console.log('  Style display:', contextMenu.style.display);
            }
        }
    }
}

module.exports = ContextMenuManager;