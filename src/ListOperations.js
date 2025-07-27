/**
 * リスト操作機能を管理するクラス
 * リストの CRUD操作、バリデーション、リスト関連のビジネスロジックを担当
 */
class ListOperations {
    constructor(generateIdFn, addToUndoStackFn, saveDataFn) {
        this.generateId = generateIdFn;
        this.addToUndoStack = addToUndoStackFn;
        this.saveData = saveDataFn;
    }

    /**
     * 名前からリストを作成
     * @param {string} name - リスト名
     * @param {Array} lists - 全リストリスト（参照）
     * @returns {Object|null} 作成されたリスト、または null
     */
    addListFromName(name, lists) {
        if (!name || !name.trim()) {
            console.warn('Cannot create list with empty name');
            return null;
        }

        const trimmedName = name.trim();

        // 重複チェック
        if (this.isListNameDuplicate(trimmedName, lists)) {
            console.warn('List name already exists:', trimmedName);
            return null;
        }

        const list = {
            id: this.generateId(),
            name: trimmedName,
            createdAt: new Date().toISOString()
        };

        lists.push(list);

        // Undo履歴に記録
        this.addToUndoStack({
            type: 'addList',
            listId: list.id
        });

        this.saveData();
        console.log('List created:', list.name);
        return list;
    }

    /**
     * リスト名を更新
     * @param {string} listId - リストID
     * @param {string} newName - 新しいリスト名
     * @param {Array} lists - 全リストリスト（参照）
     * @returns {Object|null} 更新されたリスト、または null
     */
    updateList(listId, newName, lists) {
        if (listId === 'default') {
            console.warn('Cannot update default list');
            return null;
        }

        const list = lists.find(l => l.id === listId);
        if (!list) {
            console.warn('List not found for update:', listId);
            return null;
        }

        if (!newName || !newName.trim()) {
            console.warn('Cannot update list with empty name');
            return null;
        }

        const trimmedName = newName.trim();
        const previousName = list.name;

        // 名前が変更されていない場合
        if (previousName === trimmedName) {
            console.log('List name unchanged, skipping update');
            return true;
        }

        // 重複チェック（自分以外）
        if (this.isListNameDuplicate(trimmedName, lists, listId)) {
            console.warn('List name already exists:', trimmedName);
            return null;
        }

        list.name = trimmedName;

        // Undo履歴に記録
        this.addToUndoStack({
            type: 'editList',
            listId: listId,
            previousName: previousName,
            newName: trimmedName
        });

        this.saveData();
        console.log('List updated:', previousName, '->', trimmedName);
        return true;
    }

    /**
     * リストを削除
     * @param {string} listId - リストID
     * @param {Array} lists - 全リストリスト（参照）
     * @param {Array} todos - 全TODOリスト（参照）
     * @returns {boolean} 削除が成功したかどうか
     */
    deleteList(listId, lists, todos) {
        if (listId === 'default') {
            console.warn('Cannot delete default list');
            return false;
        }

        const listToDelete = lists.find(l => l.id === listId);
        if (!listToDelete) {
            console.warn('List not found for deletion:', listId);
            return false;
        }

        // リストに属するTODOを取得
        const todosToDelete = todos.filter(t => t.listId === listId);

        // Undo履歴に記録（削除前のデータを保存）
        this.addToUndoStack({
            type: 'deleteList',
            listId: listId,
            list: { ...listToDelete }, // listData -> list に修正
            todos: todosToDelete.map(todo => ({ ...todo })) // deletedTodos -> todos に修正
        });

        const initialListsLength = lists.length;
        const initialTodosLength = todos.length;

        // リストを削除
        const listIndex = lists.findIndex(l => l.id === listId);
        if (listIndex !== -1) {
            lists.splice(listIndex, 1);
        }

        // リストに属するTODOも削除
        for (let i = todos.length - 1; i >= 0; i--) {
            if (todos[i].listId === listId) {
                todos.splice(i, 1);
            }
        }

        const deleted = initialListsLength !== lists.length;
        if (deleted) {
            this.saveData();
            console.log('List deleted:', listToDelete.name, `(${todosToDelete.length} TODOs also deleted)`);
        }

        return deleted;
    }

    /**
     * リスト名の重複をチェック
     * @param {string} name - チェックするリスト名
     * @param {Array} lists - 全リストリスト
     * @param {string} excludeListId - チェックから除外するリストID（更新時）
     * @returns {boolean} 重複しているかどうか
     */
    isListNameDuplicate(name, lists, excludeListId = null) {
        return lists.some(list => 
            list.name.toLowerCase() === name.toLowerCase() && 
            list.id !== excludeListId
        );
    }

    /**
     * リストに属するTODOの数を取得
     * @param {string} listId - リストID
     * @param {Array} todos - 全TODOリスト
     * @returns {Object} {total, completed, incomplete}
     */
    getListTodoCount(listId, todos) {
        const listTodos = listId === 'default' 
            ? todos.filter(t => t.listId === null)
            : todos.filter(t => t.listId === listId);

        const total = listTodos.length;
        const completed = listTodos.filter(t => t.completed).length;
        const incomplete = total - completed;

        return { total, completed, incomplete };
    }

    /**
     * 空のリストを取得
     * @param {Array} lists - 全リストリスト
     * @param {Array} todos - 全TODOリスト
     * @returns {Array} 空のリストの配列
     */
    getEmptyLists(lists, todos) {
        return lists.filter(list => {
            const count = this.getListTodoCount(list.id, todos);
            return count.total === 0;
        });
    }

    /**
     * リストを並び替え
     * @param {Array} lists - 全リストリスト（参照）
     * @param {string} sortBy - ソート基準 ('name' | 'created' | 'todoCount')
     * @param {string} order - ソート順 ('asc' | 'desc')
     * @param {Array} todos - 全TODOリスト（TODOの数でソートする場合）
     */
    sortLists(lists, sortBy = 'name', order = 'asc', todos = []) {
        const multiplier = order === 'asc' ? 1 : -1;

        lists.sort((a, b) => {
            let compareValue = 0;

            switch (sortBy) {
                case 'name':
                    compareValue = a.name.localeCompare(b.name);
                    break;
                case 'created':
                    compareValue = new Date(a.createdAt) - new Date(b.createdAt);
                    break;
                case 'todoCount':
                    const aCount = this.getListTodoCount(a.id, todos).total;
                    const bCount = this.getListTodoCount(b.id, todos).total;
                    compareValue = aCount - bCount;
                    break;
                default:
                    compareValue = a.name.localeCompare(b.name);
            }

            return compareValue * multiplier;
        });

        console.log('Lists sorted by:', sortBy, order);
    }

    /**
     * リストを検索
     * @param {string} query - 検索クエリ
     * @param {Array} lists - 全リストリスト
     * @param {Object} options - 検索オプション
     * @returns {Array} マッチしたリストの配列
     */
    searchLists(query, lists, options = {}) {
        if (!query || !query.trim()) {
            return lists;
        }

        const { caseSensitive = false } = options;
        const searchQuery = caseSensitive ? query.trim() : query.trim().toLowerCase();

        return lists.filter(list => {
            const listName = caseSensitive ? list.name : list.name.toLowerCase();
            return listName.includes(searchQuery);
        });
    }

    /**
     * リストをエクスポート用データに変換
     * @param {string} listId - エクスポートするリストID
     * @param {Array} lists - 全リストリスト
     * @param {Array} todos - 全TODOリスト
     * @returns {Object} エクスポート用データ
     */
    exportList(listId, lists, todos) {
        const list = lists.find(l => l.id === listId);
        if (!list) {
            console.warn('List not found for export:', listId);
            return null;
        }

        const listTodos = this.getListTodoCount(listId, todos);
        const todosData = listId === 'default'
            ? todos.filter(t => t.listId === null)
            : todos.filter(t => t.listId === listId);

        return {
            list: { ...list },
            todos: todosData.map(todo => ({ ...todo })),
            statistics: listTodos,
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * リストをインポート
     * @param {Object} importData - インポートするデータ
     * @param {Array} lists - 全リストリスト（参照）
     * @param {Array} todos - 全TODOリスト（参照）
     * @returns {Object|null} インポートされたリスト、または null
     */
    importList(importData, lists, todos) {
        if (!importData || !importData.list) {
            console.warn('Invalid import data');
            return null;
        }

        const { list: listData, todos: todosData = [] } = importData;

        // 新しいIDを生成
        const newListId = this.generateId();
        let listName = listData.name;

        // 重複する名前の場合は番号を付与
        let counter = 1;
        while (this.isListNameDuplicate(listName, lists)) {
            listName = `${listData.name} (${counter})`;
            counter++;
        }

        const newList = {
            id: newListId,
            name: listName,
            createdAt: new Date().toISOString()
        };

        lists.push(newList);

        // TODOもインポート
        const importedTodos = [];
        todosData.forEach(todoData => {
            const newTodo = {
                id: this.generateId(),
                text: todoData.text,
                completed: todoData.completed || false,
                listId: newListId,
                createdAt: new Date().toISOString()
            };
            todos.push(newTodo);
            importedTodos.push(newTodo);
        });

        this.addToUndoStack({
            type: 'importList',
            listId: newListId,
            todoIds: importedTodos.map(t => t.id)
        });

        this.saveData();
        console.log('List imported:', listName, `(${importedTodos.length} TODOs)`);
        return newList;
    }

    /**
     * リストの有効性を検証
     * @param {Object} list - 検証するリスト
     * @returns {Object} {isValid: boolean, errors: Array}
     */
    validateList(list) {
        const errors = [];

        if (!list) {
            errors.push('List object is required');
            return { isValid: false, errors };
        }

        if (!list.id || typeof list.id !== 'string') {
            errors.push('List ID is required and must be a string');
        }

        if (!list.name || typeof list.name !== 'string' || !list.name.trim()) {
            errors.push('List name is required and must be non-empty');
        }

        if (!list.createdAt || isNaN(new Date(list.createdAt).getTime())) {
            errors.push('List createdAt must be a valid date string');
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
        console.log('ListOperations debug info:');
        console.log('  Functions available:');
        console.log('    - generateId:', typeof this.generateId);
        console.log('    - addToUndoStack:', typeof this.addToUndoStack);
        console.log('    - saveData:', typeof this.saveData);
    }
}

module.exports = ListOperations;