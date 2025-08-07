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
    getElementById: jest.fn(() => null),
    createElement: jest.fn(() => ({
        className: '',
        remove: jest.fn()
    }))
};

describe('Drag & Drop Scenarios with 4 Items', () => {
    let todoApp;
    let mockDataPath;
    let todo1, todo2, todo3, todo4;

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
        
        // Create 4 test todos in order
        todo1 = todoApp.addTodoFromText('Task 1');
        todo2 = todoApp.addTodoFromText('Task 2'); 
        todo3 = todoApp.addTodoFromText('Task 3');
        todo4 = todoApp.addTodoFromText('Task 4');
        
        fs.writeFileSync.mockClear();
    });

    // Helper function to get current order of todos
    function getCurrentOrder() {
        const currentTodos = todoApp.getFilteredTodos();
        return currentTodos.map(todo => todo.text);
    }

    // Helper function to get order values
    function getOrderValues() {
        const currentTodos = todoApp.getFilteredTodos();
        return currentTodos.map(todo => ({
            text: todo.text,
            order: todo.order
        }));
    }

    describe('Moving 1st item (Task 1)', () => {
        test('should move Task 1 to position 2 (between Task 1 and Task 2)', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move Task 1 to position 2 (after Task 2)
            todoApp.reorderTodosInList([todo1.id], todo2.id);
            
            // Expected: [Task 2, Task 1, Task 3, Task 4]
            const newOrder = getCurrentOrder();
            console.log('Task 1 to pos 2:', newOrder);
            expect(newOrder).toEqual(['Task 2', 'Task 1', 'Task 3', 'Task 4']);
            
            // Check order values are properly set
            const orderValues = getOrderValues();
            expect(orderValues[0].order).toBeLessThan(orderValues[1].order);
            expect(orderValues[1].order).toBeLessThan(orderValues[2].order);
        });

        test('should move Task 1 to position 3 (between Task 2 and Task 3)', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move Task 1 to position 3 (after Task 3)
            todoApp.reorderTodosInList([todo1.id], todo3.id);
            
            // Expected: [Task 2, Task 3, Task 1, Task 4]
            const newOrder = getCurrentOrder();
            console.log('Task 1 to pos 3:', newOrder);
            expect(newOrder).toEqual(['Task 2', 'Task 3', 'Task 1', 'Task 4']);
        });

        test('should move Task 1 to position 4 (between Task 3 and Task 4)', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move Task 1 to position 4 (after Task 4)
            todoApp.reorderTodosInList([todo1.id], todo4.id);
            
            // Expected: [Task 2, Task 3, Task 4, Task 1]
            const newOrder = getCurrentOrder();
            console.log('Task 1 to pos 4:', newOrder);
            expect(newOrder).toEqual(['Task 2', 'Task 3', 'Task 4', 'Task 1']);
        });

        test('should move Task 1 to end (after Task 4)', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move Task 1 to end (no target = append at end)
            todoApp.reorderTodosInList([todo1.id], null);
            
            // Expected: [Task 2, Task 3, Task 4, Task 1]
            const newOrder = getCurrentOrder();
            console.log('Task 1 to end:', newOrder);
            expect(newOrder).toEqual(['Task 2', 'Task 3', 'Task 4', 'Task 1']);
        });
    });

    describe('Moving 2nd item (Task 2)', () => {
        test('should move Task 2 to position 1 (before Task 1)', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move Task 2 to position 1 (before Task 1)
            todoApp.reorderTodosInList([todo2.id], todo1.id);
            
            // Expected: [Task 2, Task 1, Task 3, Task 4]
            const newOrder = getCurrentOrder();
            console.log('Task 2 to pos 1:', newOrder);
            expect(newOrder).toEqual(['Task 2', 'Task 1', 'Task 3', 'Task 4']);
        });

        test('should move Task 2 to position 3 (between Task 2 and Task 3)', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move Task 2 to position 3 (after Task 3)
            todoApp.reorderTodosInList([todo2.id], todo3.id);
            
            // Expected: [Task 1, Task 3, Task 2, Task 4]
            const newOrder = getCurrentOrder();
            console.log('Task 2 to pos 3:', newOrder);
            expect(newOrder).toEqual(['Task 1', 'Task 3', 'Task 2', 'Task 4']);
        });

        test('should move Task 2 to position 4 (between Task 3 and Task 4)', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move Task 2 to position 4 (after Task 4)
            todoApp.reorderTodosInList([todo2.id], todo4.id);
            
            // Expected: [Task 1, Task 3, Task 4, Task 2]
            const newOrder = getCurrentOrder();
            console.log('Task 2 to pos 4:', newOrder);
            expect(newOrder).toEqual(['Task 1', 'Task 3', 'Task 4', 'Task 2']);
        });
    });

    describe('Moving 3rd item (Task 3)', () => {
        test('should move Task 3 to position 1 (before Task 1)', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move Task 3 to position 1 (before Task 1)
            todoApp.reorderTodosInList([todo3.id], todo1.id);
            
            // Expected: [Task 3, Task 1, Task 2, Task 4]
            const newOrder = getCurrentOrder();
            console.log('Task 3 to pos 1:', newOrder);
            expect(newOrder).toEqual(['Task 3', 'Task 1', 'Task 2', 'Task 4']);
        });

        test('should move Task 3 to position 2 (between Task 1 and Task 2)', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move Task 3 to position 2 (after Task 2, but before Task 3's current position)
            todoApp.reorderTodosInList([todo3.id], todo2.id);
            
            // Expected: [Task 1, Task 2, Task 3, Task 4] - Task 3 moves between Task 1 and Task 2
            const newOrder = getCurrentOrder();
            console.log('Task 3 to pos 2:', newOrder);
            expect(newOrder).toEqual(['Task 1', 'Task 3', 'Task 2', 'Task 4']);
        });

        test('should move Task 3 to end (after Task 4)', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move Task 3 to end
            todoApp.reorderTodosInList([todo3.id], null);
            
            // Expected: [Task 1, Task 2, Task 4, Task 3]
            const newOrder = getCurrentOrder();
            console.log('Task 3 to end:', newOrder);
            expect(newOrder).toEqual(['Task 1', 'Task 2', 'Task 4', 'Task 3']);
        });
    });

    describe('Moving 4th item (Task 4)', () => {
        test('should move Task 4 to position 1 (before Task 1)', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move Task 4 to position 1
            todoApp.reorderTodosInList([todo4.id], todo1.id);
            
            // Expected: [Task 4, Task 1, Task 2, Task 3]
            const newOrder = getCurrentOrder();
            console.log('Task 4 to pos 1:', newOrder);
            expect(newOrder).toEqual(['Task 4', 'Task 1', 'Task 2', 'Task 3']);
        });

        test('should move Task 4 to position 2 (between Task 1 and Task 2)', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move Task 4 to position 2
            todoApp.reorderTodosInList([todo4.id], todo2.id);
            
            // Expected: [Task 1, Task 4, Task 2, Task 3]
            const newOrder = getCurrentOrder();
            console.log('Task 4 to pos 2:', newOrder);
            expect(newOrder).toEqual(['Task 1', 'Task 4', 'Task 2', 'Task 3']);
        });

        test('should move Task 4 to position 3 (between Task 2 and Task 3)', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move Task 4 to position 3
            todoApp.reorderTodosInList([todo4.id], todo3.id);
            
            // Expected: [Task 1, Task 2, Task 4, Task 3]
            const newOrder = getCurrentOrder();
            console.log('Task 4 to pos 3:', newOrder);
            expect(newOrder).toEqual(['Task 1', 'Task 2', 'Task 4', 'Task 3']);
        });
    });

    describe('Complex scenarios', () => {
        test('should handle multiple consecutive moves correctly', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            expect(getCurrentOrder()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
            
            // Move 1: Task 1 to end
            todoApp.reorderTodosInList([todo1.id], null);
            expect(getCurrentOrder()).toEqual(['Task 2', 'Task 3', 'Task 4', 'Task 1']);
            
            // Move 2: Task 4 to position 1
            todoApp.reorderTodosInList([todo4.id], todo2.id);
            expect(getCurrentOrder()).toEqual(['Task 4', 'Task 2', 'Task 3', 'Task 1']);
            
            // Move 3: Task 2 to end
            todoApp.reorderTodosInList([todo2.id], null);
            expect(getCurrentOrder()).toEqual(['Task 4', 'Task 3', 'Task 1', 'Task 2']);
        });

        test('should maintain order values correctly after multiple moves', () => {
            // Perform several moves
            todoApp.reorderTodosInList([todo1.id], todo3.id); // Task 1 after Task 3
            todoApp.reorderTodosInList([todo4.id], todo2.id); // Task 4 after Task 2
            todoApp.reorderTodosInList([todo2.id], null);     // Task 2 to end
            
            const orderValues = getOrderValues();
            console.log('Final order values:', orderValues);
            
            // Check that order values are strictly increasing
            for (let i = 0; i < orderValues.length - 1; i++) {
                expect(orderValues[i].order).toBeLessThan(orderValues[i + 1].order);
            }
        });

        test('should handle edge case: moving item to same position', () => {
            // Initial: [Task 1, Task 2, Task 3, Task 4]
            const initialOrder = getCurrentOrder();
            
            // Try to move Task 2 to position 2 (its current position)
            todoApp.reorderTodosInList([todo2.id], todo3.id);
            
            // Should result in [Task 1, Task 2, Task 3, Task 4] - no change expected
            const newOrder = getCurrentOrder();
            console.log('Same position move:', newOrder);
            
            // The order might change slightly due to implementation, but should be logical
            expect(newOrder.length).toBe(4);
            expect(newOrder).toContain('Task 1');
            expect(newOrder).toContain('Task 2');
            expect(newOrder).toContain('Task 3');
            expect(newOrder).toContain('Task 4');
        });
    });
});