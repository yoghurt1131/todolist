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

// Mock document
global.document = {
    addEventListener: jest.fn(),
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
    getElementById: jest.fn(() => null)
};

describe('Mouse Focus Selection', () => {
    let todoApp;
    let mockDataPath;

    beforeEach(() => {
        jest.clearAllMocks();
        fs.__clearMockFileData();
        fs.writeFileSync.mockImplementation(() => {});
        
        mockDataPath = '/test/tododata.json';
        todoApp = new TodoApp(mockDataPath);
    });

    beforeEach(async () => {
        fs.existsSync.mockReturnValue(false);
        await todoApp.initializeApp();
        fs.writeFileSync.mockClear();
    });

    test('should select todo on mouse focus', () => {
        // Add test todos
        const todo1 = todoApp.addTodoFromText('Task 1');
        const todo2 = todoApp.addTodoFromText('Task 2');
        
        // Clear initial selection
        todoApp.selectionManager.clearSelection();
        
        // Simulate mouse focus on todo1
        todoApp.selectTodo(todo1.id, false, false);
        
        expect(todoApp.selectionManager.isSelected(todo1.id)).toBe(true);
        expect(todoApp.selectionManager.isSelected(todo2.id)).toBe(false);
        expect(todoApp.selectionManager.getSelectedCount()).toBe(1);
    });

    test('should change selection when mouse moves to different todo', () => {
        // Add test todos
        const todo1 = todoApp.addTodoFromText('Task 1');
        const todo2 = todoApp.addTodoFromText('Task 2');
        
        // Select first todo
        todoApp.selectTodo(todo1.id, false, false);
        expect(todoApp.selectionManager.isSelected(todo1.id)).toBe(true);
        
        // Move to second todo (mouse focus)
        todoApp.selectTodo(todo2.id, false, false);
        
        expect(todoApp.selectionManager.isSelected(todo1.id)).toBe(false);
        expect(todoApp.selectionManager.isSelected(todo2.id)).toBe(true);
        expect(todoApp.selectionManager.getSelectedCount()).toBe(1);
    });

    test('should maintain single selection on normal mouse focus', () => {
        // Add test todos
        const todo1 = todoApp.addTodoFromText('Task 1');
        const todo2 = todoApp.addTodoFromText('Task 2');
        const todo3 = todoApp.addTodoFromText('Task 3');
        
        // Select multiple todos first (simulate Cmd+click)
        todoApp.selectTodo(todo1.id, false, false);
        todoApp.selectTodo(todo2.id, true, false); // multi-select
        expect(todoApp.selectionManager.getSelectedCount()).toBe(2);
        
        // Mouse focus on todo3 should clear multi-selection
        todoApp.selectTodo(todo3.id, false, false);
        
        expect(todoApp.selectionManager.isSelected(todo1.id)).toBe(false);
        expect(todoApp.selectionManager.isSelected(todo2.id)).toBe(false);
        expect(todoApp.selectionManager.isSelected(todo3.id)).toBe(true);
        expect(todoApp.selectionManager.getSelectedCount()).toBe(1);
    });

    test('should update last selected todo on mouse focus', () => {
        // Add test todos
        const todo1 = todoApp.addTodoFromText('Task 1');
        const todo2 = todoApp.addTodoFromText('Task 2');
        
        // Focus on first todo
        todoApp.selectTodo(todo1.id, false, false);
        expect(todoApp.selectionManager.getLastSelectedId()).toBe(todo1.id);
        
        // Focus on second todo
        todoApp.selectTodo(todo2.id, false, false);
        expect(todoApp.selectionManager.getLastSelectedId()).toBe(todo2.id);
    });

    test('should work with range selection when Shift is used', () => {
        // Add test todos
        const todo1 = todoApp.addTodoFromText('Task 1');
        const todo2 = todoApp.addTodoFromText('Task 2');
        const todo3 = todoApp.addTodoFromText('Task 3');
        
        // Focus on first todo
        todoApp.selectTodo(todo1.id, false, false);
        
        // Shift+focus on third todo should create range selection
        const rangeResult = todoApp.selectionManager.selectTodo(todo3.id, false, true);
        if (rangeResult.type === 'range') {
            todoApp.selectionManager.selectTodoRange(rangeResult.startId, rangeResult.endId, todoApp.todos);
        }
        
        // Should select all todos in range
        expect(todoApp.selectionManager.isSelected(todo1.id)).toBe(true);
        expect(todoApp.selectionManager.isSelected(todo2.id)).toBe(true);
        expect(todoApp.selectionManager.isSelected(todo3.id)).toBe(true);
        expect(todoApp.selectionManager.getSelectedCount()).toBe(3);
    });
});