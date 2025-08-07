const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');
const DataManager = require('./DataManager');
const UndoManager = require('./UndoManager');
const SelectionManager = require('./SelectionManager');
const InlineEditor = require('./InlineEditor');
const ClipboardManager = require('./ClipboardManager');
const ContextMenuManager = require('./ContextMenuManager');
const TodoOperations = require('./TodoOperations');
const ListOperations = require('./ListOperations');

class TodoApp {
    constructor(dataPath = null) {
        this.lists = [];
        this.todos = [];
        this.currentListId = 'default';
        this.eventListeners = {};

        // モジュール化されたコンポーネント
        this.dataManager = new DataManager(dataPath);
        this.undoManager = new UndoManager(50);
        this.selectionManager = new SelectionManager();
        this.inlineEditor = new InlineEditor();
        this.clipboardManager = new ClipboardManager();
        this.contextMenuManager = new ContextMenuManager();
        this.todoOperations = new TodoOperations(
            () => this.generateId(),
            (action) => this.addToUndoStack(action),
            () => this.saveData()
        );
        this.listOperations = new ListOperations(
            () => this.generateId(),
            (action) => this.addToUndoStack(action),
            () => this.saveData()
        );
    }

    async initializeApp() {
        // DataManagerでデータパスをセットアップ
        await this.dataManager.setupDataPath();
        
        this.loadData();
        if (typeof document !== 'undefined') {
            this.initializeSidebar();
            this.renderLists();
            this.renderTodos();
            this.bindEvents();
            this.bindResizer();
        }
    }

    loadData() {
        const data = this.dataManager.loadData();
        this.lists = data.lists;
        this.todos = data.todos;
    }

    saveData() {
        const data = {
            lists: this.lists,
            todos: this.todos
        };
        this.dataManager.saveData(data);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    addTodoFromText(text) {
        return this.todoOperations.addTodoFromText(text, this.currentListId, this.todos);
    }

    toggleTodo(todoId) {
        return this.todoOperations.toggleTodo(todoId, this.todos);
    }

    updateTodo(todoId, newText) {
        return this.todoOperations.updateTodo(todoId, newText, this.todos);
    }

    deleteTodo(todoId) {
        return this.todoOperations.deleteTodo(todoId, this.todos);
    }

    addListFromName(name) {
        return this.listOperations.addListFromName(name, this.lists);
    }

    updateList(listId, newName) {
        return this.listOperations.updateList(listId, newName, this.lists);
    }

    deleteList(listId) {
        const result = this.listOperations.deleteList(listId, this.lists, this.todos);
        
        // 削除されたリストが現在のリストの場合、デフォルトに戻す
        if (result && this.currentListId === listId) {
            this.currentListId = 'default';
        }
        
        return result;
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

    getTodosForCurrentList() {
        return this.getTodosForList(this.currentListId);
    }

    getFilteredTodos() {
        const todos = this.getTodosForList(this.currentListId);
        
        // renderTodosと同じソートロジックを適用
        todos.sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            // order値でソート（nullの場合はcreatedAtフォールバック）
            const orderA = a.order !== undefined ? a.order : new Date(a.createdAt).getTime();
            const orderB = b.order !== undefined ? b.order : new Date(b.createdAt).getTime();
            return orderA - orderB;
        });
        
        return todos;
    }

    getIncompleteTodosCount(listId) {
        const todos = this.getTodosForList(listId);
        return todos.filter(todo => !todo.completed).length;
    }

    // TODO選択機能
    selectTodo(todoId, isMultiSelect = false, isRangeSelect = false) {
        const result = this.selectionManager.selectTodo(todoId, isMultiSelect, isRangeSelect);
        
        if (result.type === 'range') {
            const currentTodos = this.getTodosForCurrentList();
            this.selectionManager.selectTodoRange(result.startId, result.endId, currentTodos);
        }
        
        this.renderTodos();
    }

    // 範囲選択機能
    selectTodoRange(startTodoId, endTodoId) {
        const currentTodos = this.getTodosForCurrentList();
        this.selectionManager.selectTodoRange(startTodoId, endTodoId, currentTodos);
        this.renderTodos();
    }

    clearSelection() {
        this.selectionManager.clearSelection();
        this.renderTodos();
    }

    isSelected(todoId) {
        return this.selectionManager.isSelected(todoId);
    }

    // TODOを他のリストに移動
    moveTodosToList(todoIds, targetListId) {
        const moved = this.todoOperations.moveTodosToList(todoIds, targetListId, this.todos);
        if (moved) {
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
        
        // 編集中のTODOがある場合は再レンダリングを避ける
        const editingElement = document.querySelector('.todo-text.editing');
        if (editingElement) {
            console.log('Skipping render: todo is being edited');
            return;
        }
        
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
            // order値でソート（nullの場合はcreatedAtフォールバック）
            const orderA = a.order !== undefined ? a.order : new Date(a.createdAt).getTime();
            const orderB = b.order !== undefined ? b.order : new Date(b.createdAt).getTime();
            return orderA - orderB;
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
                // クリックイベント（シングル/ダブルクリックを区別）
                text.addEventListener('click', (e) => {
                    // 編集中の場合は何もしない
                    if (this.inlineEditor.isEditingElement('todo', todo.id)) {
                        return;
                    }

                    e.stopPropagation();

                    // InlineEditorでダブルクリック検出
                    const isDoubleClick = this.inlineEditor.handleClick(
                        todo.id, 
                        'todo', 
                        todo.text,
                        (todoId, newText) => {
                            const success = this.updateTodo(todoId, newText);
                            if (success) {
                                this.renderTodos();
                            }
                            return success;
                        },
                        (todoId) => this.renderTodos()
                    );

                    if (!isDoubleClick) {
                        // シングルクリック処理
                        setTimeout(() => {
                            if (!this.inlineEditor.isCurrentlyEditing()) {
                                const isMultiSelect = e.metaKey || e.ctrlKey;
                                const isRangeSelect = e.shiftKey;
                                this.selectTodo(todo.id, isMultiSelect, isRangeSelect);
                                this.renderTodos();
                            }
                        }, 250);
                    }
                });

                // マウスオーバーで選択（フォーカス選択）
                text.addEventListener('mouseenter', (e) => {
                    const lastSelectedId = this.selectionManager.getLastSelectedId();
                    
                    // Shift+マウスオーバーで範囲選択プレビュー
                    if (e.shiftKey && lastSelectedId && lastSelectedId !== todo.id) {
                        this.showRangePreview(lastSelectedId, todo.id);
                    } else {
                        // 通常のマウスオーバーで選択（複数選択は維持しない）
                        this.selectTodo(todo.id, false, false);
                        this.renderTodos();
                    }
                });

                text.addEventListener('mouseleave', (e) => {
                    this.hideRangePreview();
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
                    draggedTodoIds = this.selectionManager.getSelectedIds();
                } else {
                    // 選択されていない場合は、このTODOのみをドラッグ
                    draggedTodoIds = [todo.id];
                }

                e.dataTransfer.setData('text/plain', JSON.stringify(draggedTodoIds));

                // ドラッグ中の視覚的フィードバック
                todoItem.classList.add('dragging');

                // 複数選択されている場合は、すべての選択アイテムに視覚効果を適用
                if (this.isSelected(todo.id) && this.selectionManager.getSelectedCount() > 1) {
                    const allTodoItems = document.querySelectorAll('.todo-item');
                    allTodoItems.forEach(item => {
                        const itemTodoId = item.dataset.todoId;
                        if (this.selectionManager.isSelected(itemTodoId)) {
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

            // Individual todo item drag events are handled at container level
            // Keep only dragstart and dragend for individual items

            todosContainer.appendChild(todoItem);
        });

        // コンテナレベルのドラッグイベント処理（重複を避けるため一度だけ設定）
        if (!todosContainer.hasAttribute('data-drag-events-bound')) {
            todosContainer.setAttribute('data-drag-events-bound', 'true');
            
            todosContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                // ドロップ位置の視覚的フィードバック
                const afterElement = this.getDragAfterElement(todosContainer, e.clientY);
                this.showDropIndicator(todosContainer, afterElement);
            });

            todosContainer.addEventListener('dragleave', (e) => {
                // コンテナ外に完全に出た場合のみインジケーターを隠す
                const rect = todosContainer.getBoundingClientRect();
                if (e.clientX < rect.left || e.clientX > rect.right || 
                    e.clientY < rect.top || e.clientY > rect.bottom) {
                    this.hideDropIndicator();
                }
            });

            todosContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                this.hideDropIndicator();

                try {
                    const draggedTodoIds = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (draggedTodoIds && draggedTodoIds.length > 0) {
                        const afterElement = this.getDragAfterElement(todosContainer, e.clientY);
                        let targetTodoId = null;
                        
                        if (afterElement) {
                            targetTodoId = afterElement.dataset.todoId;
                        }
                        
                        this.reorderTodosInList(draggedTodoIds, targetTodoId);
                        this.renderTodos();
                        this.renderLists();
                    }
                } catch (error) {
                    console.error('ドロップデータの解析に失敗:', error);
                }
            });
        }
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

        // TODOsコンテナからマウスが離れた時の処理
        const todosContainer = document.querySelector('.todos-container');
        if (todosContainer) {
            todosContainer.addEventListener('mouseleave', (e) => {
                // TODOsエリア外に出た場合、選択をクリア（任意）
                // この動作が不要な場合はコメントアウト
                // this.selectionManager.clearSelection();
                // this.renderTodos();
            });
        }

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
        this.contextMenuManager.showContextMenu(
            x, y, 
            this.selectionManager.getSelectedIds(),
            this.todos,
            this.lists,
            (todoIds, listId) => {
                this.moveTodosToList(todoIds, listId);
                this.renderTodos();
                this.renderLists();
            }
        );
    }

    hideContextMenu() {
        this.contextMenuManager.hideContextMenu();
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
        const selectedIds = this.selectionManager.getSelectedIds();
        if (selectedIds.length === 0) return;

        const message = selectedIds.length === 1
            ? '選択されたタスクを削除しますか？'
            : `選択された${selectedIds.length}件のタスクを削除しますか？`;

        if (confirm(message)) {
            const deletedCount = this.todoOperations.deleteMultipleTodos(selectedIds, this.todos);
            
            if (deletedCount > 0) {
                this.clearSelection();
                this.renderTodos();
                this.renderLists();
            }
        }
    }

    copySelectedTodos() {
        const selectedIds = this.selectionManager.getSelectedIds();
        
        const success = this.clipboardManager.copyTodos(
            selectedIds, 
            this.todos, 
            (count) => this.showCopyNotification(count)
        );
        
        if (success) {
            this.clipboardManager.copyToSystemClipboard();
        }
    }

    pasteClipboardTodos() {
        // まず内部クリップボードからの貼り付けを試行
        let newTodos = this.clipboardManager.pasteTodos(this.currentListId, () => this.generateId());
        
        // 内部クリップボードが空の場合、システムクリップボードから読み取り
        if (newTodos.length === 0) {
            newTodos = this.clipboardManager.pasteFromSystemClipboard(this.currentListId, () => this.generateId());
        }

        if (newTodos.length === 0) {
            console.log('貼り付け可能なコンテンツがありません');
            return;
        }

        // TodoAppの配列に追加してorder値を設定
        newTodos.forEach(todo => {
            if (todo.order === undefined) {
                todo.order = this.todoOperations.getNextOrderValue(this.todos, this.currentListId);
            }
            this.todos.push(todo);
        });

        // Undo履歴に記録
        this.addToUndoStack({
            type: 'pasteTodos',
            addedTodoIds: newTodos.map(todo => todo.id)
        });

        this.saveData();

        // 貼り付けたTODOを選択状態にする
        this.selectionManager.clearSelection();
        this.selectionManager.setSelectedIds(newTodos.map(todo => todo.id));

        this.renderTodos();
        this.renderLists();

        console.log(`${newTodos.length}件のタスクを貼り付けました`);
    }

    // Undo履歴に操作を記録
    addToUndoStack(action) {
        this.undoManager.addAction(action);
    }

    // Undo操作の実行
    undo() {
        // UndoManagerでTODO操作とリスト操作を分離する必要があるため、
        // 一時的に現在の実装を維持し、操作メソッドをラッパーとして提供
        const operations = {
            todoOps: {
                deleteTodoById: (todoId) => {
                    this.todos = this.todos.filter(todo => todo.id !== todoId);
                },
                restoreTodo: (todo) => {
                    this.todos.push(todo);
                },
                toggleTodoById: (todoId) => {
                    const todo = this.todos.find(t => t.id === todoId);
                    if (todo) {
                        todo.completed = !todo.completed;
                    }
                },
                updateTodoById: (todoId, newText) => {
                    const todo = this.todos.find(t => t.id === todoId);
                    if (todo) {
                        todo.text = newText;
                    }
                },
                moveTodosToListById: (todoIds, targetListId) => {
                    todoIds.forEach(todoId => {
                        const todo = this.todos.find(t => t.id === todoId);
                        if (todo) {
                            todo.listId = targetListId === 'default' ? null : targetListId;
                        }
                    });
                },
                restoreTodoOrders: (todoIds, originalOrders) => {
                    todoIds.forEach(todoId => {
                        const todo = this.todos.find(t => t.id === todoId);
                        if (todo && originalOrders[todoId] !== undefined) {
                            todo.order = originalOrders[todoId];
                        }
                    });
                },
                updateTodoOrderById: (todoId, newOrder) => {
                    const todo = this.todos.find(t => t.id === todoId);
                    if (todo) {
                        todo.order = newOrder;
                    }
                },
                restoreMultipleTodos: (deletedTodos) => {
                    this.todos.push(...deletedTodos);
                },
                deleteMultipleTodosByIds: (todoIds) => {
                    todoIds.forEach(todoId => {
                        const index = this.todos.findIndex(t => t.id === todoId);
                        if (index !== -1) {
                            this.todos.splice(index, 1);
                        }
                    });
                }
            },
            listOps: {
                deleteListById: (listId) => {
                    this.lists = this.lists.filter(list => list.id !== listId);
                    if (this.currentListId === listId) {
                        this.currentListId = 'default';
                    }
                },
                restoreList: (list, todos) => {
                    this.lists.push(list);
                    if (todos) {
                        this.todos.push(...todos);
                    }
                },
                updateListById: (listId, newName) => {
                    const list = this.lists.find(l => l.id === listId);
                    if (list) {
                        list.name = newName;
                    }
                }
            }
        };

        const success = this.undoManager.undo(operations);
        
        if (success) {
            this.saveData();
            this.renderTodos();
            this.renderLists();
        }
        
        return success;
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

    // Backward compatibility methods for inline editing
    startEditingTodo(todoId, element) {
        const todo = this.todos.find(t => t.id === todoId);
        if (!todo || !element) return false;
        
        return this.inlineEditor.startEditingTodo(
            todoId,
            todo.text,
            (newText) => this.updateTodo(todoId, newText),
            () => {}
        );
    }

    endEditingTodo(element, text) {
        if (!element || !text) return false;
        // This method is handled internally by InlineEditor
        return true;
    }

    startEditingList(listId, element) {
        const list = this.lists.find(l => l.id === listId);
        if (!list || !element) return false;
        
        return this.inlineEditor.startEditingList(
            listId,
            list.name,
            (newName) => {
                const success = this.updateList(listId, newName);
                if (success) {
                    this.renderSidebar();
                }
                return success;
            },
            () => {}
        );
    }

    endEditingList(element, text) {
        if (!element || !text) return false;
        // This method is handled internally by InlineEditor
        return true;
    }

    // ドラッグ&ドロップ並び替え用ヘルパーメソッド

    /**
     * ドロップ位置を判定する
     * @param {HTMLElement} container - TODOコンテナ
     * @param {number} y - マウスのY座標
     * @returns {HTMLElement|null} ドロップ後の要素
     */
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.todo-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * ドロップインジケーターを表示
     * @param {HTMLElement} container - TODOコンテナ
     * @param {HTMLElement|null} afterElement - インジケーターを表示する要素
     */
    showDropIndicator(container, afterElement) {
        this.hideDropIndicator(); // 既存のインジケーターを削除

        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';

        if (afterElement) {
            container.insertBefore(indicator, afterElement);
        } else {
            container.appendChild(indicator);
        }
    }

    /**
     * ドロップインジケーターを隠す
     */
    hideDropIndicator() {
        const indicator = document.querySelector('.drop-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    /**
     * 同じリスト内でのTODO並び替え
     * @param {Array<string>} draggedTodoIds - ドラッグされたTODO IDの配列
     * @param {string} targetTodoId - ドロップ先のTODO ID
     */
    reorderTodosInList(draggedTodoIds, targetTodoId) {
        if (!draggedTodoIds || draggedTodoIds.length === 0) {
            return;
        }
        
        // targetTodoId は null（末尾への移動）でも有効

        // ドラッグされたTODOが1つの場合とターゲットが同じ場合は何もしない
        if (draggedTodoIds.length === 1 && draggedTodoIds[0] === targetTodoId) {
            return;
        }

        // 現在のリストのTODOを取得
        const currentListTodos = this.getFilteredTodos();
        
        // ターゲットTODOのインデックスを取得
        let targetIndex;
        if (targetTodoId === null) {
            // null の場合は末尾に追加
            targetIndex = currentListTodos.length;
        } else {
            targetIndex = currentListTodos.findIndex(todo => todo.id === targetTodoId);
            if (targetIndex === -1) {
                console.warn('Target todo not found in current list:', targetTodoId);
                return;
            }
        }

        // ドラッグされたTODOを除外した新しい配列を作成
        const remainingTodos = currentListTodos.filter(todo => !draggedTodoIds.includes(todo.id));
        
        // ドラッグされたTODOオブジェクトを取得
        const draggedTodos = draggedTodoIds.map(id => 
            currentListTodos.find(todo => todo.id === id)
        ).filter(todo => todo !== undefined);

        // 新しい順序でTODO IDの配列を作成
        const newOrderTodoIds = [];
        
        if (targetTodoId === null) {
            // 末尾に追加する場合
            remainingTodos.forEach(todo => {
                newOrderTodoIds.push(todo.id);
            });
            // ドラッグされたTODOを末尾に追加
            draggedTodos.forEach(todo => {
                newOrderTodoIds.push(todo.id);
            });
        } else {
            // 特定の位置に挿入する場合
            const adjustedTargetIndex = remainingTodos.findIndex(todo => todo.id === targetTodoId);
            
            // 移動方向を判定: ドラッグされた要素の現在位置とターゲット位置を比較
            const draggedIndex = currentListTodos.findIndex(todo => todo.id === draggedTodoIds[0]);
            const targetIndex = currentListTodos.findIndex(todo => todo.id === targetTodoId);
            const isMovingForward = draggedIndex < targetIndex; // 前方移動（下向き）
            
            if (isMovingForward) {
                // 前方移動: ターゲットの後に挿入
                // ターゲット要素まで（含む）追加
                for (let i = 0; i <= adjustedTargetIndex; i++) {
                    if (remainingTodos[i]) {
                        newOrderTodoIds.push(remainingTodos[i].id);
                    }
                }
                
                // ドラッグされたTODOを挿入（ターゲットの後）
                draggedTodos.forEach(todo => {
                    newOrderTodoIds.push(todo.id);
                });
                
                // 残りのTODOを追加
                for (let i = adjustedTargetIndex + 1; i < remainingTodos.length; i++) {
                    if (remainingTodos[i]) {
                        newOrderTodoIds.push(remainingTodos[i].id);
                    }
                }
            } else {
                // 後方移動: ターゲットの前に挿入
                // ターゲット要素の前まで追加
                for (let i = 0; i < adjustedTargetIndex; i++) {
                    if (remainingTodos[i]) {
                        newOrderTodoIds.push(remainingTodos[i].id);
                    }
                }
                
                // ドラッグされたTODOを挿入（ターゲットの前）
                draggedTodos.forEach(todo => {
                    newOrderTodoIds.push(todo.id);
                });
                
                // ターゲット要素以降を追加
                for (let i = adjustedTargetIndex; i < remainingTodos.length; i++) {
                    if (remainingTodos[i]) {
                        newOrderTodoIds.push(remainingTodos[i].id);
                    }
                }
            }
        }

        // TodoOperationsを使って並び替えを実行
        const success = this.todoOperations.reorderTodos(newOrderTodoIds, this.currentListId, this.todos);
        
        if (success) {
            this.renderTodos(); // UI更新
        } else {
            console.warn('Failed to reorder TODOs');
        }
    }

}

module.exports = TodoApp;