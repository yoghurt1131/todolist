const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class TodoApp {
    constructor(dataPath = null) {
        this.lists = [];
        this.todos = [];
        this.currentListId = 'default';
        this.dataPath = dataPath || (app ? path.join(app.getPath('userData'), 'tododata.json') : './tododata.json');
        this.eventListeners = {};
    }

    initializeApp() {
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
            fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('データの保存に失敗:', error);
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
        this.saveData();
        return todo;
    }

    toggleTodo(todoId) {
        const todo = this.todos.find(t => t.id === todoId);
        if (todo) {
            todo.completed = !todo.completed;
            this.saveData();
            return todo;
        }
        return null;
    }

    updateTodo(todoId, newText) {
        const todo = this.todos.find(t => t.id === todoId);
        if (todo && newText && newText.trim()) {
            todo.text = newText.trim();
            this.saveData();
            return todo;
        }
        return null;
    }

    deleteTodo(todoId) {
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
        this.saveData();
        return list;
    }

    updateList(listId, newName) {
        const list = this.lists.find(l => l.id === listId);
        if (list && newName && newName.trim() && listId !== 'default') {
            list.name = newName.trim();
            this.saveData();
            return list;
        }
        return null;
    }

    deleteList(listId) {
        if (listId === 'default') return false;
        
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
            todoItem.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            
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
                let clickTimeout = null;
                
                text.addEventListener('click', (e) => {
                    // 編集中の場合は何もしない
                    if (text.classList.contains('editing')) {
                        return;
                    }
                    
                    // ダブルクリックを待つためのタイムアウト
                    if (clickTimeout) {
                        clearTimeout(clickTimeout);
                        clickTimeout = null;
                        return; // ダブルクリックなので何もしない
                    }
                    
                    clickTimeout = setTimeout(() => {
                        clickTimeout = null;
                        // シングルクリックの処理
                        this.toggleTodo(todo.id);
                        this.renderTodos();
                        this.renderLists();
                    }, 250); // 250ms後に実行（ダブルクリック検出時間）
                });

                // ダブルクリックで編集モード
                text.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // シングルクリックのタイムアウトをクリア
                    if (clickTimeout) {
                        clearTimeout(clickTimeout);
                        clickTimeout = null;
                    }
                    
                    this.startEditingTodo(todo.id, text);
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
    }
}

module.exports = TodoApp;