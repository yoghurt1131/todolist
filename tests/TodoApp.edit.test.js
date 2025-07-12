const TodoApp = require('../src/TodoApp');

// Mock fs module
jest.mock('fs');

describe('TodoApp Editing Functionality', () => {
    let todoApp;

    beforeEach(() => {
        jest.clearAllMocks();
        todoApp = new TodoApp('/test/tododata.json');
        todoApp.initializeApp();
    });

    describe('TODO Editing', () => {
        test('should update todo text', () => {
            const todo = todoApp.addTodoFromText('Original text');
            const updated = todoApp.updateTodo(todo.id, 'Updated text');
            
            expect(updated).toBeTruthy();
            expect(updated.text).toBe('Updated text');
            expect(todoApp.todos.find(t => t.id === todo.id).text).toBe('Updated text');
        });

        test('should not update todo with empty text', () => {
            const todo = todoApp.addTodoFromText('Original text');
            const updated = todoApp.updateTodo(todo.id, '   ');
            
            expect(updated).toBeNull();
            expect(todoApp.todos.find(t => t.id === todo.id).text).toBe('Original text');
        });

        test('should not update non-existing todo', () => {
            const updated = todoApp.updateTodo('nonexistent', 'New text');
            
            expect(updated).toBeNull();
        });

        test('should trim whitespace when updating todo', () => {
            const todo = todoApp.addTodoFromText('Original text');
            const updated = todoApp.updateTodo(todo.id, '  Updated text  ');
            
            expect(updated.text).toBe('Updated text');
        });
    });

    describe('List Editing', () => {
        test('should update list name', () => {
            const list = todoApp.addListFromName('Original name');
            const updated = todoApp.updateList(list.id, 'Updated name');
            
            expect(updated).toBeTruthy();
            expect(updated.name).toBe('Updated name');
            expect(todoApp.lists.find(l => l.id === list.id).name).toBe('Updated name');
        });

        test('should not update default list', () => {
            const updated = todoApp.updateList('default', 'New name');
            
            expect(updated).toBeNull();
            expect(todoApp.lists.find(l => l.id === 'default').name).toBe('すべて');
        });

        test('should not update list with empty name', () => {
            const list = todoApp.addListFromName('Original name');
            const updated = todoApp.updateList(list.id, '   ');
            
            expect(updated).toBeNull();
            expect(todoApp.lists.find(l => l.id === list.id).name).toBe('Original name');
        });

        test('should not update non-existing list', () => {
            const updated = todoApp.updateList('nonexistent', 'New name');
            
            expect(updated).toBeNull();
        });

        test('should trim whitespace when updating list name', () => {
            const list = todoApp.addListFromName('Original name');
            const updated = todoApp.updateList(list.id, '  Updated name  ');
            
            expect(updated.name).toBe('Updated name');
        });
    });

    describe('Editing Methods Existence', () => {
        test('should have editing methods defined', () => {
            expect(typeof todoApp.updateTodo).toBe('function');
            expect(typeof todoApp.updateList).toBe('function');
            expect(typeof todoApp.startEditingTodo).toBe('function');
            expect(typeof todoApp.endEditingTodo).toBe('function');
            expect(typeof todoApp.startEditingList).toBe('function');
            expect(typeof todoApp.endEditingList).toBe('function');
        });

        test('should not throw when DOM editing methods are called without DOM', () => {
            expect(() => {
                todoApp.startEditingTodo('test-id', null);
                todoApp.endEditingTodo(null, 'test');
                todoApp.startEditingList('test-id', null);
                todoApp.endEditingList(null, 'test');
            }).not.toThrow();
        });
    });
});