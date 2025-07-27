const TodoApp = require('../src/TodoApp');
const fs = require('fs');

// Mock fs module
jest.mock('fs');

describe('TodoApp', () => {
    let todoApp;
    let mockDataPath;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        fs.__clearMockFileData();
        fs.writeFileSync.mockImplementation(() => {}); // デフォルトの実装をリセット
        
        mockDataPath = '/test/tododata.json';
        todoApp = new TodoApp(mockDataPath);
    });

    describe('Initialization', () => {
        test('should initialize with default list when no data exists', async () => {
            fs.existsSync.mockReturnValue(false);
            
            await todoApp.initializeApp();
            
            expect(todoApp.lists).toHaveLength(1);
            expect(todoApp.lists[0].name).toBe('すべて');
            expect(todoApp.lists[0].id).toBe('default');
            expect(todoApp.todos).toHaveLength(0);
            expect(todoApp.currentListId).toBe('default');
        });

        test('should load existing data when file exists', async () => {
            const mockData = {
                lists: [
                    { id: 'default', name: 'すべて', createdAt: '2023-01-01T00:00:00.000Z' },
                    { id: 'work', name: '仕事', createdAt: '2023-01-02T00:00:00.000Z' }
                ],
                todos: [
                    { id: 'todo1', text: 'テストタスク', completed: false, listId: 'work', createdAt: '2023-01-01T00:00:00.000Z', order: 1000 }
                ]
            };

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockData));
            
            await todoApp.initializeApp();
            
            expect(todoApp.lists).toHaveLength(2);
            expect(todoApp.todos).toHaveLength(1);
            expect(todoApp.lists[1].name).toBe('仕事');
            expect(todoApp.todos[0].text).toBe('テストタスク');
        });

        test('should handle corrupted data file gracefully', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('invalid json');
            
            await todoApp.initializeApp();
            
            expect(todoApp.lists).toHaveLength(1);
            expect(todoApp.lists[0].name).toBe('すべて');
            expect(todoApp.todos).toHaveLength(0);
        });
    });

    describe('Data Persistence', () => {
        test('should save data to file', () => {
            todoApp.lists = [{ id: 'default', name: 'すべて', createdAt: '2023-01-01T00:00:00.000Z' }];
            todoApp.todos = [{ id: 'todo1', text: 'テスト', completed: false, listId: null, createdAt: '2023-01-01T00:00:00.000Z' }];
            
            todoApp.saveData();
            
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                mockDataPath,
                expect.stringContaining('"lists"')
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                mockDataPath,
                expect.stringContaining('"todos"')
            );
        });

        test('should handle save errors gracefully', () => {
            fs.writeFileSync.mockImplementation(() => {
                throw new Error('Write error');
            });
            
            expect(() => todoApp.saveData()).toThrow('Write error');
        });
    });

    describe('List Management', () => {
        beforeEach(async () => {
            fs.writeFileSync.mockClear();
            await todoApp.initializeApp();
        });

        test('should add a new list', () => {
            const list = todoApp.addListFromName('仕事');
            
            expect(list).toBeTruthy();
            expect(list.name).toBe('仕事');
            expect(list.id).toBeDefined();
            expect(todoApp.lists).toHaveLength(2);
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        test('should not add list with empty name', () => {
            const list = todoApp.addListFromName('   ');
            
            expect(list).toBeNull();
            expect(todoApp.lists).toHaveLength(1);
        });

        test('should delete a custom list', () => {
            const list = todoApp.addListFromName('仕事');
            const deleted = todoApp.deleteList(list.id);
            
            expect(deleted).toBe(true);
            expect(todoApp.lists).toHaveLength(1);
            expect(todoApp.lists[0].id).toBe('default');
        });

        test('should not delete default list', () => {
            const deleted = todoApp.deleteList('default');
            
            expect(deleted).toBe(false);
            expect(todoApp.lists).toHaveLength(1);
        });

        test('should delete todos when deleting list', () => {
            const list = todoApp.addListFromName('仕事');
            todoApp.addTodoFromText('テストタスク');
            todoApp.currentListId = list.id;
            todoApp.addTodoFromText('仕事タスク');
            
            expect(todoApp.todos).toHaveLength(2);
            
            todoApp.deleteList(list.id);
            
            expect(todoApp.todos).toHaveLength(1);
            expect(todoApp.todos[0].listId).toBeNull();
        });

        test('should switch current list when deleted list is selected', () => {
            const list = todoApp.addListFromName('仕事');
            todoApp.currentListId = list.id;
            
            todoApp.deleteList(list.id);
            
            expect(todoApp.currentListId).toBe('default');
        });

        test('should select existing list', () => {
            const list = todoApp.addListFromName('仕事');
            const selected = todoApp.selectList(list.id);
            
            expect(selected).toBe(true);
            expect(todoApp.currentListId).toBe(list.id);
        });

        test('should not select non-existing list', () => {
            const selected = todoApp.selectList('nonexistent');
            
            expect(selected).toBe(false);
            expect(todoApp.currentListId).toBe('default');
        });
    });

    describe('TODO Management', () => {
        beforeEach(async () => {
            fs.writeFileSync.mockClear();
            await todoApp.initializeApp();
        });

        test('should add a new todo', () => {
            const todo = todoApp.addTodoFromText('新しいタスク');
            
            expect(todo).toBeTruthy();
            expect(todo.text).toBe('新しいタスク');
            expect(todo.completed).toBe(false);
            expect(todo.listId).toBeNull();
            expect(todo.id).toBeDefined();
            expect(todoApp.todos).toHaveLength(1);
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        test('should add todo to current list', () => {
            const list = todoApp.addListFromName('仕事');
            todoApp.currentListId = list.id;
            
            const todo = todoApp.addTodoFromText('仕事タスク');
            
            expect(todo.listId).toBe(list.id);
        });

        test('should not add todo with empty text', () => {
            const todo = todoApp.addTodoFromText('   ');
            
            expect(todo).toBeNull();
            expect(todoApp.todos).toHaveLength(0);
        });

        test('should toggle todo completion', () => {
            const todo = todoApp.addTodoFromText('テストタスク');
            
            expect(todo.completed).toBe(false);
            
            const updated = todoApp.toggleTodo(todo.id);
            
            expect(updated.completed).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalledTimes(2); // Once for add, once for toggle
        });

        test('should not toggle non-existing todo', () => {
            const result = todoApp.toggleTodo('nonexistent');
            
            expect(result).toBeNull();
        });

        test('should delete todo', () => {
            const todo = todoApp.addTodoFromText('テストタスク');
            const deleted = todoApp.deleteTodo(todo.id);
            
            expect(deleted).toBe(true);
            expect(todoApp.todos).toHaveLength(0);
            expect(fs.writeFileSync).toHaveBeenCalledTimes(2); // Once for add, once for delete
        });

        test('should not delete non-existing todo', () => {
            const deleted = todoApp.deleteTodo('nonexistent');
            
            expect(deleted).toBe(false);
        });
    });

    describe('Data Retrieval', () => {
        beforeEach(async () => {
            await todoApp.initializeApp();
            
            // Set up test data
            const workList = todoApp.addListFromName('仕事');
            
            todoApp.addTodoFromText('全体タスク1'); // default list
            todoApp.addTodoFromText('全体タスク2'); // default list
            
            todoApp.currentListId = workList.id;
            todoApp.addTodoFromText('仕事タスク1');
            todoApp.addTodoFromText('仕事タスク2');
            
            // Complete one task
            todoApp.toggleTodo(todoApp.todos[0].id);
        });

        test('should get todos for default list', () => {
            const todos = todoApp.getTodosForList('default');
            
            expect(todos).toHaveLength(4); // All todos
        });

        test('should get todos for specific list', () => {
            const workList = todoApp.lists.find(l => l.name === '仕事');
            const todos = todoApp.getTodosForList(workList.id);
            
            expect(todos).toHaveLength(2);
            expect(todos.every(t => t.listId === workList.id)).toBe(true);
        });

        test('should count incomplete todos for default list', () => {
            const count = todoApp.getIncompleteTodosCount('default');
            
            expect(count).toBe(3); // 4 total - 1 completed
        });

        test('should count incomplete todos for specific list', () => {
            const workList = todoApp.lists.find(l => l.name === '仕事');
            const count = todoApp.getIncompleteTodosCount(workList.id);
            
            expect(count).toBe(2); // All work todos are incomplete
        });
    });

    describe('ID Generation', () => {
        test('should generate unique IDs', () => {
            const id1 = todoApp.generateId();
            const id2 = todoApp.generateId();
            
            expect(id1).toBeDefined();
            expect(id2).toBeDefined();
            expect(id1).not.toBe(id2);
            expect(typeof id1).toBe('string');
            expect(typeof id2).toBe('string');
        });
    });

    describe('Double-click editing functionality', () => {
        beforeEach(() => {
            // DOM環境のセットアップ
            document.body.innerHTML = `
                <div id="todosContainer"></div>
                <div class="current-list-title"></div>
            `;
            
            // テストデータをセットアップ
            todoApp.lists = [
                { id: 'default', name: 'すべて', createdAt: '2023-01-01T00:00:00.000Z' }
            ];
            todoApp.todos = [
                { id: 'test-todo-1', text: '編集テスト用タスク', completed: false, listId: null, createdAt: '2023-01-01T00:00:00.000Z' }
            ];
            todoApp.currentListId = 'default';
        });

        test('should start editing mode when double-clicking on todo text', () => {
            // TodoAppをレンダリング
            todoApp.renderTodos();
            
            const todoText = document.querySelector('.todo-text');
            expect(todoText).toBeTruthy();
            expect(todoText.textContent).toBe('編集テスト用タスク');

            // ダブルクリックをシミュレート
            todoApp.startEditingTodo('test-todo-1', todoText);

            // 編集モードに入ったか確認
            expect(todoText.classList.contains('editing')).toBe(true);
            
            const editInput = todoText.querySelector('.edit-input');
            expect(editInput).toBeTruthy();
            expect(editInput.value).toBe('編集テスト用タスク');
        });

        test('should save changes when Enter key is pressed', (done) => {
            todoApp.renderTodos();
            const todoText = document.querySelector('.todo-text');
            
            // 編集モードに入る
            todoApp.startEditingTodo('test-todo-1', todoText);
            const editInput = todoText.querySelector('.edit-input');
            
            // テキストを変更
            editInput.value = '変更されたタスク';
            
            // Enterキーイベントをシミュレート
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
            editInput.dispatchEvent(enterEvent);
            
            // 非同期でテストを続行
            setTimeout(() => {
                // TODOが更新されたか確認
                const updatedTodo = todoApp.todos.find(t => t.id === 'test-todo-1');
                expect(updatedTodo.text).toBe('変更されたタスク');
                
                // 編集モードが終了したか確認
                expect(todoText.classList.contains('editing')).toBe(false);
                done();
            }, 10);
        });

        test('should cancel changes when Escape key is pressed', () => {
            todoApp.renderTodos();
            const todoText = document.querySelector('.todo-text');
            
            // 編集モードに入る
            todoApp.startEditingTodo('test-todo-1', todoText);
            const editInput = todoText.querySelector('.edit-input');
            
            // テキストを変更
            editInput.value = '破棄されるべきテキスト';
            
            // Escapeキーイベントをシミュレート
            const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
            editInput.dispatchEvent(escapeEvent);
            
            // TODOが変更されていないか確認
            const todo = todoApp.todos.find(t => t.id === 'test-todo-1');
            expect(todo.text).toBe('編集テスト用タスク');
            
            // 編集モードが終了したか確認
            expect(todoText.classList.contains('editing')).toBe(false);
        });

        test('should not start editing if todo is already being edited', () => {
            todoApp.renderTodos();
            const todoText = document.querySelector('.todo-text');
            
            // 最初の編集モードに入る
            todoApp.startEditingTodo('test-todo-1', todoText);
            expect(todoText.classList.contains('editing')).toBe(true);
            
            const firstEditInput = todoText.querySelector('.edit-input');
            firstEditInput.value = '最初の編集';
            
            // 再度編集を試みる
            todoApp.startEditingTodo('test-todo-1', todoText);
            
            // 依然として最初の編集状態のまま
            expect(todoText.classList.contains('editing')).toBe(true);
            const currentInput = todoText.querySelector('.edit-input');
            expect(currentInput.value).toBe('最初の編集');
        });

        test('should handle non-existent todo gracefully', () => {
            todoApp.renderTodos();
            const todoText = document.querySelector('.todo-text');
            
            // 存在しないTODO IDで編集を試みる
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            todoApp.startEditingTodo('non-existent-id', todoText);
            
            // 編集モードに入らない
            expect(todoText.classList.contains('editing')).toBe(false);
            
            consoleSpy.mockRestore();
        });

        test('should skip rendering when todo is being edited', () => {
            todoApp.renderTodos();
            const todoText = document.querySelector('.todo-text');
            
            // 編集モードに入る
            todoApp.startEditingTodo('test-todo-1', todoText);
            expect(todoText.classList.contains('editing')).toBe(true);
            
            // ログスパイをセットアップ
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            // 編集中にrenderTodosを呼び出す
            todoApp.renderTodos();
            
            // スキップメッセージが表示されるか確認
            expect(consoleSpy).toHaveBeenCalledWith('Skipping render: todo is being edited');
            
            // 編集状態が維持されているか確認
            expect(todoText.classList.contains('editing')).toBe(true);
            
            consoleSpy.mockRestore();
        });

        test('should add undo history when todo is edited', (done) => {
            todoApp.renderTodos();
            const todoText = document.querySelector('.todo-text');
            
            // Undo履歴をクリア
            todoApp.undoStack = [];
            
            // 編集モードに入る
            todoApp.startEditingTodo('test-todo-1', todoText);
            const editInput = todoText.querySelector('.edit-input');
            
            // テキストを変更して保存
            editInput.value = 'Undo履歴テスト';
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
            editInput.dispatchEvent(enterEvent);
            
            // 非同期でテストを続行
            setTimeout(() => {
                // Undo履歴が追加されたか確認（重複を避けるため最後の1件を確認）
                expect(todoApp.undoStack.length).toBeGreaterThan(0);
                const lastUndo = todoApp.undoStack[todoApp.undoStack.length - 1];
                expect(lastUndo.type).toBe('editTodo');
                expect(lastUndo.todoId).toBe('test-todo-1');
                expect(lastUndo.previousText).toBe('編集テスト用タスク');
                expect(lastUndo.newText).toBe('Undo履歴テスト');
                done();
            }, 10);
        });
    });
});