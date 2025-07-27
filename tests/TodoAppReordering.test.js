const TodoApp = require('../src/TodoApp');
const fs = require('fs');

// Mock file system
jest.mock('fs');

// Mock Electron modules
jest.mock('electron', () => ({
    ipcRenderer: {
        invoke: jest.fn()
    }
}));

describe('TodoApp Reordering Integration', () => {
    let todoApp;
    let mockDataPath;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        fs.__clearMockFileData();
        fs.writeFileSync.mockImplementation(() => {}); // デフォルトの実装をリセット
        
        mockDataPath = '/test/tododata.json';
        todoApp = new TodoApp(mockDataPath);

        // Mock console methods
        global.console = {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
    });

    describe('reorderTodosInList', () => {
        beforeEach(async () => {
            fs.existsSync.mockReturnValue(false);
            await todoApp.initializeApp();
            
            // Create test todos
            todoApp.addTodoFromText('Task 1');
            todoApp.addTodoFromText('Task 2');
            todoApp.addTodoFromText('Task 3');
            
            // Clear mock calls from setup
            fs.writeFileSync.mockClear();
        });

        test('should reorder todos and save data', () => {
            const todoIds = todoApp.todos.map(t => t.id);
            const reversedIds = [todoIds[2], todoIds[1], todoIds[0]]; // reverse order
            
            todoApp.reorderTodosInList(reversedIds, todoIds[1]); // target middle todo
            
            // Verify that saveData was called (through TodoOperations)
            expect(fs.writeFileSync).toHaveBeenCalled();
            
            // Verify the todos are properly ordered
            const savedData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            const savedTodos = savedData.todos;
            
            // Find the todos by their text since IDs are generated
            const task1 = savedTodos.find(t => t.text === 'Task 1');
            const task2 = savedTodos.find(t => t.text === 'Task 2');
            const task3 = savedTodos.find(t => t.text === 'Task 3');
            
            expect(task1).toBeDefined();
            expect(task2).toBeDefined();
            expect(task3).toBeDefined();
            expect(task1.order).toBeDefined();
            expect(task2.order).toBeDefined();
            expect(task3.order).toBeDefined();
        });

        test('should not save if no change is made', () => {
            const todoIds = todoApp.todos.map(t => t.id);
            
            // Try to "reorder" with same todo
            todoApp.reorderTodosInList([todoIds[0]], todoIds[0]);
            
            // Should not save since no actual reordering happened
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should handle empty draggedTodoIds', () => {
            const todoIds = todoApp.todos.map(t => t.id);
            
            todoApp.reorderTodosInList([], todoIds[0]);
            
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should handle non-existent target todo', () => {
            const todoIds = todoApp.todos.map(t => t.id);
            
            todoApp.reorderTodosInList([todoIds[0]], 'nonexistent-id');
            
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });
    });

    describe('getFilteredTodos ordering', () => {
        beforeEach(async () => {
            fs.existsSync.mockReturnValue(false);
            await todoApp.initializeApp();
        });

        test('should return todos sorted by order value', () => {
            // Add todos in specific order
            const todo1 = todoApp.addTodoFromText('First Task');
            const todo2 = todoApp.addTodoFromText('Second Task');
            const todo3 = todoApp.addTodoFromText('Third Task');
            
            // Manually adjust order values to test sorting
            todo1.order = 3000;
            todo2.order = 1000;
            todo3.order = 2000;
            
            const filteredTodos = todoApp.getFilteredTodos();
            
            expect(filteredTodos[0].text).toBe('Second Task'); // order: 1000
            expect(filteredTodos[1].text).toBe('Third Task');  // order: 2000
            expect(filteredTodos[2].text).toBe('First Task');  // order: 3000
        });

        test('should sort completed todos after incomplete ones', () => {
            const todo1 = todoApp.addTodoFromText('Incomplete Task');
            const todo2 = todoApp.addTodoFromText('Complete Task');
            
            // Mark one as completed
            todoApp.toggleTodo(todo2.id);
            
            const filteredTodos = todoApp.getFilteredTodos();
            
            expect(filteredTodos[0].completed).toBe(false);
            expect(filteredTodos[1].completed).toBe(true);
        });

        test('should fallback to createdAt for todos without order', () => {
            const todo1 = todoApp.addTodoFromText('First Task');
            const todo2 = todoApp.addTodoFromText('Second Task');
            
            // Remove order from first todo to test fallback
            delete todo1.order;
            
            const filteredTodos = todoApp.getFilteredTodos();
            
            // The todo without order should be sorted based on createdAt timestamp
            // Since createdAt is a timestamp and the second todo has an order value,
            // the one with order value (todo2) will come first
            expect(filteredTodos[0].text).toBe('Second Task');
            expect(filteredTodos[1].text).toBe('First Task');
        });
    });

    describe('Data persistence with ordering', () => {
        test('should save todos with order values', async () => {
            fs.existsSync.mockReturnValue(false);
            await todoApp.initializeApp();
            
            const todo = todoApp.addTodoFromText('Test Task');
            
            expect(fs.writeFileSync).toHaveBeenCalled();
            const savedData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            const savedTodo = savedData.todos[0];
            
            expect(savedTodo.order).toBeDefined();
            expect(typeof savedTodo.order).toBe('number');
        });

        test('should load and migrate existing todos without order', async () => {
            const mockData = {
                lists: [
                    { id: 'default', name: 'すべて', createdAt: '2023-01-01T00:00:00.000Z' }
                ],
                todos: [
                    { id: 'todo1', text: 'Old Task 1', completed: false, listId: null, createdAt: '2023-01-01T00:00:00.000Z' },
                    { id: 'todo2', text: 'Old Task 2', completed: false, listId: null, createdAt: '2023-01-02T00:00:00.000Z' }
                ]
            };

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockData));
            
            await todoApp.initializeApp();
            
            // Check that orders were assigned during migration
            expect(todoApp.todos[0].order).toBeDefined();
            expect(todoApp.todos[1].order).toBeDefined();
            expect(todoApp.todos[0].order).toBeLessThan(todoApp.todos[1].order);
        });
    });

    describe('Undo functionality for reordering', () => {
        beforeEach(async () => {
            fs.existsSync.mockReturnValue(false);
            await todoApp.initializeApp();
            
            todoApp.addTodoFromText('Task 1');
            todoApp.addTodoFromText('Task 2');
            todoApp.addTodoFromText('Task 3');
            
            fs.writeFileSync.mockClear();
        });

        test('should record reorder action in undo stack', () => {
            const todoIds = todoApp.todos.map(t => t.id);
            const reversedIds = [todoIds[2], todoIds[0], todoIds[1]];
            
            const initialUndoCount = todoApp.undoManager.getHistoryCount();
            
            todoApp.reorderTodosInList(reversedIds, todoIds[1]);
            
            const finalUndoCount = todoApp.undoManager.getHistoryCount();
            expect(finalUndoCount).toBe(initialUndoCount + 1);
        });

        test('should be able to undo reorder operation', () => {
            const todoIds = todoApp.todos.map(t => t.id);
            const originalOrders = todoApp.todos.map(t => ({ id: t.id, order: t.order }));
            
            // Perform reorder
            const reversedIds = [todoIds[2], todoIds[0], todoIds[1]];
            todoApp.reorderTodosInList(reversedIds, todoIds[1]);
            
            // Clear save calls from reorder
            fs.writeFileSync.mockClear();
            
            // Undo the operation
            const undoSuccess = todoApp.undo();
            
            expect(undoSuccess).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalled(); // Should save after undo
            
            // Check that orders are restored
            originalOrders.forEach(({ id, order }) => {
                const todo = todoApp.todos.find(t => t.id === id);
                expect(todo.order).toBe(order);
            });
        });
    });
});