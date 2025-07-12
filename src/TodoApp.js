const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

class TodoApp {
    constructor(dataPath = null) {
        this.lists = [];
        this.todos = [];
        this.currentListId = 'default';
        this.selectedTodoIds = new Set();
        this.lastSelectedTodoId = null;
        this.clipboardTodos = []; // コピーされたTODOのデータ
        this.dataPath = dataPath; // 初期化時は仮設定
        this.eventListeners = {};

        // Undo機能用の履歴管理
        this.undoStack = [];
        this.maxUndoSize = 50; // 最大50回まで戻せる
    }

    async initializeApp() {
        // IPCでメインプロセスからユーザーデータパスを取得
        await this.setupDataPath();
        
        this.loadData();
        if (typeof document !== 'undefined') {
            this.initializeSidebar();
            this.renderLists();
            this.renderTodos();
            this.bindEvents();
            this.bindResizer();
        }
    }

    async setupDataPath() {
        if (this.dataPath) {
            // 既に設定済みの場合はそれを使用
            return;
        }

        try {
            // IPCでメインプロセスからユーザーデータパスを取得
            const userDataPath = await ipcRenderer.invoke('get-user-data-path');
            this.dataPath = path.join(userDataPath, 'tododata.json');
            
            // アプリ情報も取得してデバッグ出力
            const appInfo = await ipcRenderer.invoke('get-app-info');
            console.log('App info:', appInfo);
            console.log('Data path:', this.dataPath);
            
            // 権限チェック
            this.checkPermissions();
        } catch (error) {
            console.warn('Failed to get user data path via IPC:', error);
            // フォールバック：ホームディレクトリを使用
            this.dataPath = path.join(require('os').homedir(), '.todolist', 'tododata.json');
            console.warn('Using fallback path:', this.dataPath);
        }
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
                this.lists = data.lists || [];
                this.todos = data.todos || [];
            }
        } catch (error) {
            console.error('データの読み込みに失敗:', error);
        }

        if (this.lists.length === 0) {
            this.lists.push({
                id: 'default',
                name: 'すべて',
                createdAt: new Date().toISOString()
            });
        }
    }

    saveData() {
        try {
            const data = {
                lists: this.lists,
                todos: this.todos
            };
            console.log('Saving data to:', this.dataPath);
            console.log('Data to save:', JSON.stringify(data, null, 2));
            
            // ディレクトリが存在するか確認
            const dir = path.dirname(this.dataPath);
            if (!fs.existsSync(dir)) {
                console.log('Creating directory:', dir);
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
            console.log('Data saved successfully');
            
            // 保存後に確認
            if (fs.existsSync(this.dataPath)) {
                console.log('File exists after save');
            } else {
                console.error('File does not exist after save attempt');
            }
        } catch (error) {
            console.error('データの保存に失敗:', error);
            console.error('Error details:', {
                code: error.code,
                path: error.path,
                syscall: error.syscall,
                errno: error.errno
            });
        }
    }

    checkPermissions() {
        try {
            const dir = path.dirname(this.dataPath);
            console.log('Checking permissions for directory:', dir);
            
            // ディレクトリの読み取り権限
            try {
                fs.accessSync(dir, fs.constants.R_OK);
                console.log('Directory read permission: OK');
            } catch (e) {
                console.error('Directory read permission: DENIED');
            }
            
            // ディレクトリの書き込み権限
            try {
                fs.accessSync(dir, fs.constants.W_OK);
                console.log('Directory write permission: OK');
            } catch (e) {
                console.error('Directory write permission: DENIED');
            }
            
            // ファイルが存在する場合の権限チェック
            if (fs.existsSync(this.dataPath)) {
                try {
                    fs.accessSync(this.dataPath, fs.constants.R_OK | fs.constants.W_OK);
                    console.log('File read/write permission: OK');
                } catch (e) {
                    console.error('File read/write permission: DENIED');
                }
            }
        } catch (error) {
            console.error('Permission check failed:', error);
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    addTodoFromText(text) {
        if (!text || !text.trim()) return null;

        const todo = {
            id: this.generateId(),
            text: text.trim(),
            completed: false,
            listId: this.currentListId === 'default' ? null : this.currentListId,
            createdAt: new Date().toISOString()
        };

        this.todos.push(todo);

        // Undo履歴に記録
        this.addToUndoStack({
            type: 'addTodo',
            todoId: todo.id
        });

        this.saveData();
        return todo;
    }

    toggleTodo(todoId) {
        const todo = this.todos.find(t => t.id === todoId);
        if (todo) {
            const previousState = todo.completed;
            todo.completed = !todo.completed;

            // Undo履歴に記録
            this.addToUndoStack({
                type: 'toggleTodo',
                todoId: todo.id,
                previousState: previousState
            });

            this.saveData();
            return todo;
        }
        return null;
    }

    updateTodo(todoId, newText) {
        const todo = this.todos.find(t => t.id === todoId);
        if (todo && newText && newText.trim()) {
            const previousText = todo.text;
            todo.text = newText.trim();

            // Undo履歴に記録（テキストが変更された場合のみ）
            if (previousText !== todo.text) {
                this.addToUndoStack({
                    type: 'editTodo',
                    todoId: todoId,
                    previousText: previousText
                });
            }

            this.saveData();
            return todo;
        }
        return null;
    }

    deleteTodo(todoId) {
        const todoToDelete = this.todos.find(t => t.id === todoId);
        if (!todoToDelete) return false;

        // Undo履歴に記録（削除前のデータを保存）
        this.addToUndoStack({
            type: 'deleteTodo',
            todoId: todoId,
            todoData: { ...todoToDelete }
        });

        const initialLength = this.todos.length;
        this.todos = this.todos.filter(t => t.id !== todoId);
        const deleted = initialLength !== this.todos.length;
        if (deleted) {
            this.saveData();
        }
        return deleted;
    }

    addListFromName(name) {
        if (!name || !name.trim()) return null;

        const list = {
            id: this.generateId(),
            name: name.trim(),
            createdAt: new Date().toISOString()
        };

        this.lists.push(list);

        // Undo履歴に記録
        this.addToUndoStack({
            type: 'addList',
            listId: list.id
        });

        this.saveData();
        return list;
    }

    updateList(listId, newName) {
        const list = this.lists.find(l => l.id === listId);
        if (list && newName && newName.trim() && listId !== 'default') {
            const previousName = list.name;
            list.name = newName.trim();

            // Undo履歴に記録
            this.addToUndoStack({
                type: 'editList',
                listId: listId,
                previousName: previousName
            });

            this.saveData();
            return list;
        }
        return null;
    }

    deleteList(listId) {
        if (listId === 'default') return false;

        const listToDelete = this.lists.find(l => l.id === listId);
        const todosToDelete = this.todos.filter(t => t.listId === listId);

        if (!listToDelete) return false;

        // Undo履歴に記録（削除前のデータを保存）
        this.addToUndoStack({
            type: 'deleteList',
            listId: listId,
            listData: { ...listToDelete },
            deletedTodos: todosToDelete.map(todo => ({ ...todo }))
        });

        const initialListsLength = this.lists.length;
        const initialTodosLength = this.todos.length;

        this.lists = this.lists.filter(l => l.id !== listId);
        this.todos = this.todos.filter(t => t.listId !== listId);

        const deleted = initialListsLength !== this.lists.length;

        if (this.currentListId === listId) {
            this.currentListId = 'default';
        }

        if (deleted) {
            this.saveData();
        }
        return deleted;
    }

    selectList(listId) {
        const listExists = this.lists.find(l => l.id === listId);
        if (listExists) {
            this.currentListId = listId;
            this.clearSelection(); // リスト切り替え時に選択をクリア
            return true;
        }
        return false;
    }

    getTodosForList(listId) {
        if (listId === 'default') {
            return this.todos;
        }
        return this.todos.filter(todo => todo.listId === listId);
    }

    getIncompleteTodosCount(listId) {
        const todos = this.getTodosForList(listId);
        return todos.filter(todo => !todo.completed).length;
    }

    // TODO選択機能
    selectTodo(todoId, isMultiSelect = false, isRangeSelect = false) {
        if (isRangeSelect && this.lastSelectedTodoId) {
            // 範囲選択
            this.selectTodoRange(this.lastSelectedTodoId, todoId);
        } else if (isMultiSelect) {
            // 個別選択（Cmd/Ctrl）
            if (this.selectedTodoIds.has(todoId)) {
                this.selectedTodoIds.delete(todoId);
                // 削除した場合、lastSelectedTodoIdをクリア
                if (this.lastSelectedTodoId === todoId) {
                    this.lastSelectedTodoId = null;
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
    }

    // 範囲選択機能
    selectTodoRange(startTodoId, endTodoId) {
        const currentTodos = this.getTodosForList(this.currentListId);

        // 表示順序でソート（完了状態と作成日時で）
        const sortedTodos = [...currentTodos].sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        const startIndex = sortedTodos.findIndex(todo => todo.id === startTodoId);
        const endIndex = sortedTodos.findIndex(todo => todo.id === endTodoId);

        if (startIndex === -1 || endIndex === -1) return;

        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);

        // 範囲内のすべてのTODOを選択
        for (let i = minIndex; i <= maxIndex; i++) {
            this.selectedTodoIds.add(sortedTodos[i].id);
        }

        this.lastSelectedTodoId = endTodoId;
    }

    clearSelection() {
        this.selectedTodoIds.clear();
        this.lastSelectedTodoId = null;
    }

    isSelected(todoId) {
        return this.selectedTodoIds.has(todoId);
    }

    // TODOを他のリストに移動
    moveTodosToList(todoIds, targetListId) {
        if (targetListId === 'default') {
            targetListId = null; // デフォルトリストはnull
        }

        let moved = false;
        todoIds.forEach(todoId => {
            const todo = this.todos.find(t => t.id === todoId);
            if (todo) {
                todo.listId = targetListId;
                moved = true;
            }
        });

        if (moved) {
            this.saveData();
            this.clearSelection();
        }
        return moved;
    }

    // DOM manipulation methods (only available in browser environment)
    bindEvents() {
        if (typeof document === 'undefined') return;

        const addTodoBtn = document.getElementById('addTodoBtn');
        const addTodoForm = document.getElementById('addTodoForm');
        const todoInput = document.getElementById('todoInput');
        const saveBtn = document.getElementById('saveBtn');
        const cancelBtn = document.getElementById('cancelBtn');

        const newListBtn = document.getElementById('newListBtn');
        const addListBtn = document.getElementById('addListBtn');
        const listModal = document.getElementById('listModal');
        const modalSaveBtn = document.getElementById('modalSaveBtn');
        const modalCancelBtn = document.getElementById('modalCancelBtn');
        const listNameInput = document.getElementById('listNameInput');

        if (addTodoBtn) {
            addTodoBtn.addEventListener('click', () => {
                if (addTodoForm) addTodoForm.classList.remove('hidden');
                if (todoInput) todoInput.focus();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideAddTodoForm();
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.addTodo();
            });
        }

        if (todoInput) {
            todoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addTodo();
                } else if (e.key === 'Escape') {
                    this.hideAddTodoForm();
                }
            });
        }

        if (newListBtn) {
            newListBtn.addEventListener('click', () => {
                this.showListModal();
            });
        }

        if (addListBtn) {
            addListBtn.addEventListener('click', () => {
                this.showListModal();
            });
        }

        if (modalCancelBtn) {
            modalCancelBtn.addEventListener('click', () => {
                this.hideListModal();
            });
        }

        if (modalSaveBtn) {
            modalSaveBtn.addEventListener('click', () => {
                this.addList();
            });
        }

        if (listNameInput) {
            listNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addList();
                } else if (e.key === 'Escape') {
                    this.hideListModal();
                }
            });
        }

        if (listModal) {
            listModal.addEventListener('click', (e) => {
                if (e.target === listModal) {
                    this.hideListModal();
                }
            });
        }
    }

    hideAddTodoForm() {
        if (typeof document === 'undefined') return;
        const addTodoForm = document.getElementById('addTodoForm');
        const todoInput = document.getElementById('todoInput');
        if (addTodoForm) addTodoForm.classList.add('hidden');
        if (todoInput) todoInput.value = '';
    }

    addTodo() {
        if (typeof document === 'undefined') return;
        const todoInput = document.getElementById('todoInput');
        if (!todoInput) return;

        const text = todoInput.value.trim();
        const todo = this.addTodoFromText(text);

        if (todo) {
            this.renderTodos();
            this.renderLists();
            this.hideAddTodoForm();
        }
    }

    showListModal() {
        if (typeof document === 'undefined') return;
        const listModal = document.getElementById('listModal');
        const listNameInput = document.getElementById('listNameInput');
        if (listModal) listModal.classList.remove('hidden');
        if (listNameInput) listNameInput.focus();
    }

    hideListModal() {
        if (typeof document === 'undefined') return;
        const listModal = document.getElementById('listModal');
        const listNameInput = document.getElementById('listNameInput');
        if (listModal) listModal.classList.add('hidden');
        if (listNameInput) listNameInput.value = '';
    }

    addList() {
        if (typeof document === 'undefined') return;
        const listNameInput = document.getElementById('listNameInput');
        if (!listNameInput) return;

        const name = listNameInput.value.trim();
        const list = this.addListFromName(name);

        if (list) {
            this.renderLists();
            this.hideListModal();
        }
    }

    renderLists() {
        if (typeof document === 'undefined') return;
        const listsContainer = document.querySelector('.lists-container');
        if (!listsContainer) return;

        listsContainer.innerHTML = '';

        this.lists.forEach(list => {
            const listItem = document.createElement('div');
            listItem.className = `list-item ${list.id === this.currentListId ? 'active' : ''}`;
            listItem.dataset.listId = list.id;

            const count = this.getIncompleteTodosCount(list.id);

            listItem.innerHTML = `
                <span class="list-name">${list.name}</span>
                <span class="list-count">${count}</span>
            `;

            const listNameElement = listItem.querySelector('.list-name');
            let listClickTimeout = null;

            listItem.addEventListener('click', (e) => {
                // 編集中の場合は何もしない
                if (listNameElement.classList.contains('editing')) {
                    return;
                }

                // リスト名がクリックされた場合の処理
                if (e.target === listNameElement) {
                    // ダブルクリックを待つためのタイムアウト
                    if (listClickTimeout) {
                        clearTimeout(listClickTimeout);
                        listClickTimeout = null;
                        return; // ダブルクリックなので何もしない
                    }

                    listClickTimeout = setTimeout(() => {
                        listClickTimeout = null;
                        // シングルクリックの処理
                        this.selectList(list.id);
                        this.renderLists();
                        this.renderTodos();
                    }, 250);
                } else {
                    // リスト名以外がクリックされた場合は即座に切り替え
                    this.selectList(list.id);
                    this.renderLists();
                    this.renderTodos();
                }
            });

            // リスト名をダブルクリックで編集（デフォルトリスト以外）
            if (list.id !== 'default') {
                listNameElement.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    // シングルクリックのタイムアウトをクリア
                    if (listClickTimeout) {
                        clearTimeout(listClickTimeout);
                        listClickTimeout = null;
                    }

                    this.startEditingList(list.id, listNameElement);
                });
            }

            if (list.id !== 'default') {
                listItem.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (confirm(`「${list.name}」を削除しますか？`)) {
                        this.deleteList(list.id);
                        this.renderLists();
                        this.renderTodos();
                    }
                });
            }

            // ドロップゾーンとしての機能
            listItem.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                listItem.classList.add('drop-target');
            });

            listItem.addEventListener('dragleave', (e) => {
                // 子要素に移動した場合は除外
                if (!listItem.contains(e.relatedTarget)) {
                    listItem.classList.remove('drop-target');
                }
            });

            listItem.addEventListener('drop', (e) => {
                e.preventDefault();
                listItem.classList.remove('drop-target');

                try {
                    const draggedTodoIds = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (draggedTodoIds && draggedTodoIds.length > 0) {
                        this.moveTodosToList(draggedTodoIds, list.id);
                        this.renderTodos();
                        this.renderLists();
                    }
                } catch (error) {
                    console.error('ドロップデータの解析に失敗:', error);
                }
            });

            listsContainer.appendChild(listItem);
        });
    }

    renderTodos() {
        if (typeof document === 'undefined') return;
        const todosContainer = document.getElementById('todosContainer');
        const currentListTitle = document.querySelector('.current-list-title');

        if (currentListTitle) {
            const currentList = this.lists.find(l => l.id === this.currentListId);
            currentListTitle.textContent = currentList ? currentList.name : 'すべて';
        }

        if (!todosContainer) return;

        const todos = this.getTodosForList(this.currentListId);

        if (todos.length === 0) {
            todosContainer.innerHTML = `
                <div class="empty-state">
                    <p>タスクがありません</p>
                    <p class="empty-subtitle">「+ 新規」ボタンでタスクを追加しましょう</p>
                </div>
            `;
            return;
        }

        todosContainer.innerHTML = '';

        todos.sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        todos.forEach(todo => {
            const todoItem = document.createElement('div');
            const isSelected = this.isSelected(todo.id);
            todoItem.className = `todo-item ${todo.completed ? 'completed' : ''} ${isSelected ? 'selected' : ''}`;
            todoItem.draggable = true;
            todoItem.dataset.todoId = todo.id;

            todoItem.innerHTML = `
                <div class="todo-checkbox ${todo.completed ? 'completed' : ''}" data-todo-id="${todo.id}"></div>
                <div class="todo-text" data-todo-id="${todo.id}">${todo.text}</div>
                <div class="todo-actions">
                    <button class="delete-btn" data-todo-id="${todo.id}">削除</button>
                </div>
            `;

            const checkbox = todoItem.querySelector('.todo-checkbox');
            const text = todoItem.querySelector('.todo-text');
            const deleteBtn = todoItem.querySelector('.delete-btn');

            if (checkbox) {
                checkbox.addEventListener('click', () => {
                    this.toggleTodo(todo.id);
                    this.renderTodos();
                    this.renderLists();
                });
            }

            if (text) {
                // シングルクリックで選択
                text.addEventListener('click', (e) => {
                    // 編集中の場合は何もしない
                    if (text.classList.contains('editing')) {
                        return;
                    }

                    e.stopPropagation();
                    const isMultiSelect = e.metaKey || e.ctrlKey;
                    const isRangeSelect = e.shiftKey;

                    this.selectTodo(todo.id, isMultiSelect, isRangeSelect);
                    this.renderTodos();
                });

                // Shift+マウスオーバーで範囲選択プレビュー
                text.addEventListener('mouseenter', (e) => {
                    if (e.shiftKey && this.lastSelectedTodoId && this.lastSelectedTodoId !== todo.id) {
                        this.showRangePreview(this.lastSelectedTodoId, todo.id);
                    }
                });

                text.addEventListener('mouseleave', (e) => {
                    this.hideRangePreview();
                });

                // ダブルクリックで編集モード
                text.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    this.startEditingTodo(todo.id, text);
                });

                // 右クリックでコンテキストメニュー
                text.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // TODOが選択されていない場合は選択する
                    if (!this.isSelected(todo.id)) {
                        this.selectTodo(todo.id, false);
                        this.renderTodos();
                    }

                    this.showContextMenu(e.clientX, e.clientY);
                });
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('このタスクを削除しますか？')) {
                        this.deleteTodo(todo.id);
                        this.renderTodos();
                        this.renderLists();
                    }
                });
            }

            // ドラッグアンドドロップイベント
            todoItem.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';

                // ドラッグ中のTODOを特定
                let draggedTodoIds;
                if (this.isSelected(todo.id)) {
                    // 選択されている場合は、選択されたすべてのTODOをドラッグ
                    draggedTodoIds = Array.from(this.selectedTodoIds);
                } else {
                    // 選択されていない場合は、このTODOのみをドラッグ
                    draggedTodoIds = [todo.id];
                }

                e.dataTransfer.setData('text/plain', JSON.stringify(draggedTodoIds));

                // ドラッグ中の視覚的フィードバック
                todoItem.classList.add('dragging');

                // 複数選択されている場合は、すべての選択アイテムに視覚効果を適用
                if (this.isSelected(todo.id) && this.selectedTodoIds.size > 1) {
                    const allTodoItems = document.querySelectorAll('.todo-item');
                    allTodoItems.forEach(item => {
                        const itemTodoId = item.dataset.todoId;
                        if (this.selectedTodoIds.has(itemTodoId)) {
                            item.classList.add('dragging-group');
                        }
                    });
                }

                setTimeout(() => {
                    todoItem.style.opacity = '0.5';
                }, 0);
            });

            todoItem.addEventListener('dragend', (e) => {
                todoItem.classList.remove('dragging');
                todoItem.style.opacity = '';

                // 複数選択の視覚効果をクリア
                const allTodoItems = document.querySelectorAll('.todo-item');
                allTodoItems.forEach(item => {
                    item.classList.remove('dragging-group');
                });
            });

            todosContainer.appendChild(todoItem);
        });
    }

    // TODO編集機能
    startEditingTodo(todoId, textElement) {
        if (typeof document === 'undefined') return;

        const todo = this.todos.find(t => t.id === todoId);
        if (!todo) return;

        const originalText = todo.text;

        // 編集用input要素を作成
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.value = originalText;

        // 編集モードにする
        textElement.classList.add('editing');
        textElement.innerHTML = '';
        textElement.appendChild(input);

        // フォーカスして全選択
        input.focus();
        input.select();

        // 保存・キャンセル処理
        const saveEdit = () => {
            const newText = input.value.trim();
            if (newText && newText !== originalText) {
                this.updateTodo(todoId, newText);
            }
            this.endEditingTodo(textElement, todo.text);
            this.renderTodos();
            this.renderLists();
        };

        const cancelEdit = () => {
            this.endEditingTodo(textElement, originalText);
        };

        // イベントリスナー
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
    }

    endEditingTodo(textElement, text) {
        if (typeof document === 'undefined' || !textElement) return;

        textElement.classList.remove('editing');
        textElement.innerHTML = text;
    }

    // リスト名編集機能
    startEditingList(listId, nameElement) {
        if (typeof document === 'undefined') return;

        const list = this.lists.find(l => l.id === listId);
        if (!list || listId === 'default') return;

        const originalName = list.name;

        // 編集用input要素を作成
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.value = originalName;

        // 編集モードにする
        nameElement.classList.add('editing');
        nameElement.innerHTML = '';
        nameElement.appendChild(input);

        // フォーカスして全選択
        input.focus();
        input.select();

        // 保存・キャンセル処理
        const saveEdit = () => {
            const newName = input.value.trim();
            if (newName && newName !== originalName) {
                this.updateList(listId, newName);
            }
            this.endEditingList(nameElement, list.name);
            this.renderLists();
        };

        const cancelEdit = () => {
            this.endEditingList(nameElement, originalName);
        };

        // イベントリスナー
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
    }

    endEditingList(nameElement, name) {
        if (typeof document === 'undefined' || !nameElement) return;

        nameElement.classList.remove('editing');
        nameElement.innerHTML = name;
    }

    // サイドバーリサイザー機能
    initializeSidebar() {
        if (typeof document === 'undefined') return;

        const savedWidth = localStorage.getItem('sidebarWidth');
        if (savedWidth) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.style.width = savedWidth + 'px';
            }
        }
    }

    bindResizer() {
        if (typeof document === 'undefined') return;

        const resizer = document.getElementById('resizer');
        const sidebar = document.getElementById('sidebar');

        if (!resizer || !sidebar) return;

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = parseInt(window.getComputedStyle(sidebar).width, 10);

            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const width = startWidth + (e.clientX - startX);
            const minWidth = 200;
            const maxWidth = 400;

            const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, width));
            sidebar.style.width = constrainedWidth + 'px';

            e.preventDefault();
        });

        document.addEventListener('mouseup', () => {
            if (!isResizing) return;

            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            // サイドバー幅を保存
            const currentWidth = parseInt(window.getComputedStyle(sidebar).width, 10);
            localStorage.setItem('sidebarWidth', currentWidth);
        });

        // ダブルクリックでデフォルト幅にリセット
        resizer.addEventListener('dblclick', () => {
            sidebar.style.width = '250px';
            localStorage.setItem('sidebarWidth', 250);
        });

        // コンテキストメニューを閉じる
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        document.addEventListener('contextmenu', (e) => {
            // TODO以外の場所での右クリックはコンテキストメニューを閉じる
            if (!e.target.closest('.todo-text')) {
                this.hideContextMenu();
            }
        });

        // キーボードイベントでShiftキーの状態を監視
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Shift') {
                this.hideRangePreview();
            }
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            // 入力フィールドにフォーカスがある場合は無視
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdKey = isMac ? e.metaKey : e.ctrlKey;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Delete/Backspaceキーで選択されたTODOを削除
                e.preventDefault();
                this.deleteSelectedTodos();
            } else if (cmdKey && e.key === 'c') {
                // Command+C / Ctrl+C でコピー
                e.preventDefault();
                this.copySelectedTodos();
            } else if (cmdKey && e.key === 'v') {
                // Command+V / Ctrl+V でペースト
                e.preventDefault();
                this.pasteClipboardTodos();
            } else if (cmdKey && e.key === 'z') {
                // Command+Z / Ctrl+Z でUndo
                e.preventDefault();
                this.undo();
            }
        });
    }

    // コンテキストメニュー関連メソッド
    showContextMenu(x, y) {
        if (typeof document === 'undefined') return;

        const contextMenu = document.getElementById('todoContextMenu');
        const selectedTodoCount = document.getElementById('selectedTodoCount');
        const contextMenuLists = document.getElementById('contextMenuLists');

        if (!contextMenu || !selectedTodoCount || !contextMenuLists) return;

        // 選択されたTODO数を更新
        selectedTodoCount.textContent = this.selectedTodoIds.size;

        // リスト一覧を生成
        contextMenuLists.innerHTML = '';

        this.lists.forEach(list => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';

            // 現在のリストかどうかチェック
            const selectedTodos = Array.from(this.selectedTodoIds).map(id =>
                this.todos.find(t => t.id === id)
            ).filter(Boolean);

            const isCurrentList = selectedTodos.every(todo => {
                const todoListId = todo.listId || 'default';
                return todoListId === list.id;
            });

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

                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.moveTodosToList(Array.from(this.selectedTodoIds), list.id);
                    this.renderTodos();
                    this.renderLists();
                    this.hideContextMenu();
                });
            }

            contextMenuLists.appendChild(item);
        });

        // メニューを表示
        contextMenu.classList.remove('hidden');

        // 位置を調整
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';

        // 画面からはみ出る場合の調整
        const rect = contextMenu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (rect.right > windowWidth) {
            contextMenu.style.left = (x - rect.width) + 'px';
        }

        if (rect.bottom > windowHeight) {
            contextMenu.style.top = (y - rect.height) + 'px';
        }
    }

    hideContextMenu() {
        if (typeof document === 'undefined') return;

        const contextMenu = document.getElementById('todoContextMenu');
        if (contextMenu) {
            contextMenu.classList.add('hidden');
        }
    }

    // 範囲選択プレビュー機能
    showRangePreview(startTodoId, endTodoId) {
        if (typeof document === 'undefined') return;

        this.hideRangePreview(); // 既存のプレビューをクリア

        const currentTodos = this.getTodosForList(this.currentListId);
        const sortedTodos = [...currentTodos].sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        const startIndex = sortedTodos.findIndex(todo => todo.id === startTodoId);
        const endIndex = sortedTodos.findIndex(todo => todo.id === endTodoId);

        if (startIndex === -1 || endIndex === -1) return;

        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);

        // 範囲内のTODO項目にプレビュークラスを追加
        const allTodoItems = document.querySelectorAll('.todo-item');
        for (let i = minIndex; i <= maxIndex; i++) {
            const todoId = sortedTodos[i].id;
            const todoElement = Array.from(allTodoItems).find(item =>
                item.dataset.todoId === todoId
            );
            if (todoElement) {
                todoElement.classList.add('range-preview');
            }
        }
    }

    hideRangePreview() {
        if (typeof document === 'undefined') return;

        const previewItems = document.querySelectorAll('.range-preview');
        previewItems.forEach(item => {
            item.classList.remove('range-preview');
        });
    }

    // キーボードショートカット機能
    deleteSelectedTodos() {
        if (this.selectedTodoIds.size === 0) return;

        const selectedCount = this.selectedTodoIds.size;
        const message = selectedCount === 1
            ? '選択されたタスクを削除しますか？'
            : `選択された${selectedCount}件のタスクを削除しますか？`;

        if (confirm(message)) {
            const deletedIds = Array.from(this.selectedTodoIds);
            deletedIds.forEach(todoId => {
                this.deleteTodo(todoId);
            });

            this.clearSelection();
            this.renderTodos();
            this.renderLists();
        }
    }

    copySelectedTodos() {
        if (this.selectedTodoIds.size === 0) return;

        // 選択されたTODOのデータを取得
        this.clipboardTodos = Array.from(this.selectedTodoIds)
            .map(todoId => this.todos.find(t => t.id === todoId))
            .filter(Boolean)
            .map(todo => ({
                text: todo.text,
                completed: todo.completed,
                createdAt: todo.createdAt
            }));

        // システムクリップボードにも箇条書き形式でコピー
        this.copyToSystemClipboard();

        console.log(`${this.clipboardTodos.length}件のタスクをコピーしました`);

        // コピー完了の視覚的フィードバック
        this.showCopyNotification(this.clipboardTodos.length);
    }

    copyToSystemClipboard() {
        if (typeof require === 'undefined' || this.clipboardTodos.length === 0) return;

        try {
            const { clipboard } = require('electron');

            // 箇条書き形式でテキストを作成
            const bulletText = this.clipboardTodos
                .map(todo => {
                    const bullet = todo.completed ? '- [x]' : '- [ ] ';
                    return `${bullet} ${todo.text}`;
                })
                .join('\n');

            // システムクリップボードに書き込み
            clipboard.writeText(bulletText);
        } catch (error) {
            console.warn('システムクリップボードへのコピーに失敗:', error);
        }
    }

    pasteClipboardTodos() {
        if (this.clipboardTodos.length === 0) return;

        // クリップボードからTODOを貼り付け
        const newTodos = this.clipboardTodos.map(todoData => {
            const newTodo = {
                id: this.generateId(),
                text: todoData.text,
                completed: todoData.completed,
                listId: this.currentListId === 'default' ? null : this.currentListId,
                createdAt: new Date().toISOString() // 新しい作成日時
            };

            this.todos.push(newTodo);
            return newTodo;
        });

        // Undo履歴に記録（追加されたTODOのIDを保存）
        this.addToUndoStack({
            type: 'pasteTodos',
            addedTodoIds: newTodos.map(todo => todo.id)
        });

        this.saveData();

        // 貼り付けたTODOを選択状態にする
        this.clearSelection();
        newTodos.forEach(todo => {
            this.selectedTodoIds.add(todo.id);
        });
        this.lastSelectedTodoId = newTodos[newTodos.length - 1].id;

        this.renderTodos();
        this.renderLists();

        console.log(`${newTodos.length}件のタスクを貼り付けました`);
    }

    // Undo履歴に操作を記録
    addToUndoStack(action) {
        this.undoStack.push(action);

        // 最大サイズを超えた場合は古い履歴を削除
        if (this.undoStack.length > this.maxUndoSize) {
            this.undoStack.shift();
        }
    }

    // Undo操作の実行
    undo() {
        if (this.undoStack.length === 0) {
            console.log('Undoできる操作がありません');
            return false;
        }

        const action = this.undoStack.pop();
        console.log('Undo実行:', action);

        try {
            switch (action.type) {
                case 'addTodo':
                    // TODOの追加をundo（削除）
                    this.todos = this.todos.filter(todo => todo.id !== action.todoId);
                    break;

                case 'deleteTodo':
                    // TODOの削除をundo（復元）
                    this.todos.push(action.todoData);
                    break;

                case 'toggleTodo':
                    // TODOの完了状態変更をundo
                    const toggleTodo = this.todos.find(todo => todo.id === action.todoId);
                    if (toggleTodo) {
                        toggleTodo.completed = action.previousState;
                    }
                    break;

                case 'editTodo':
                    // TODOの編集をundo
                    const editTodo = this.todos.find(todo => todo.id === action.todoId);
                    if (editTodo) {
                        editTodo.text = action.previousText;
                    }
                    break;

                case 'addList':
                    // リストの追加をundo（削除）
                    this.lists = this.lists.filter(list => list.id !== action.listId);
                    if (this.currentListId === action.listId) {
                        this.currentListId = 'default';
                    }
                    break;

                case 'deleteList':
                    // リストの削除をundo（復元）
                    this.lists.push(action.listData);
                    // 削除されたTODOも復元
                    if (action.deletedTodos) {
                        this.todos.push(...action.deletedTodos);
                    }
                    break;

                case 'editList':
                    // リストの編集をundo
                    const editList = this.lists.find(list => list.id === action.listId);
                    if (editList) {
                        editList.name = action.previousName;
                    }
                    break;

                case 'pasteTodos':
                    // TODOの貼り付けをundo（追加されたTODOを削除）
                    action.addedTodoIds.forEach(id => {
                        this.todos = this.todos.filter(todo => todo.id !== id);
                    });
                    break;

                default:
                    console.warn('未知のUndo操作タイプ:', action.type);
                    return false;
            }

            this.saveData();
            this.renderTodos();
            this.renderLists();
            return true;

        } catch (error) {
            console.error('Undo操作中にエラーが発生:', error);
            return false;
        }
    }

    showCopyNotification(count) {
        if (typeof document === 'undefined') return;

        // 既存の通知があれば削除
        const existingNotification = document.querySelector('.copy-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // 通知要素を作成
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = `${count}件のタスクをコピーしました`;

        // 画面右上に表示
        document.body.appendChild(notification);

        // アニメーション開始
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // 2秒後に自動削除
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 2000);
    }


}

module.exports = TodoApp;