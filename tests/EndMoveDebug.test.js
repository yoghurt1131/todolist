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

describe('Debug End Move (null target)', () => {
    let todoApp;
    let mockDataPath;
    let todo1, todo2, todo3, todo4;

    beforeEach(() => {
        jest.clearAllMocks();
        fs.__clearMockFileData();
        fs.writeFileSync.mockImplementation(() => {});
        
        mockDataPath = '/test/tododata.json';
        todoApp = new TodoApp(mockDataPath);
        
        // Remove problematic console override
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

    function getCurrentOrder() {
        const currentTodos = todoApp.getFilteredTodos();
        return currentTodos.map(todo => todo.text);
    }

    function getDetailedTodos() {
        const currentTodos = todoApp.getFilteredTodos();
        return currentTodos.map(todo => ({
            text: todo.text,
            order: todo.order,
            id: todo.id
        }));
    }

    test('debug Task 1 to end movement', () => {
        console.log('=== DEBUG: Task 1 to End Movement ===');
        
        // Initial state
        console.log('Initial order:', getCurrentOrder());
        console.log('Initial details:', getDetailedTodos());
        
        // Perform the move
        console.log('Moving Task 1 (id:', todo1.id, ') to end (null target)');
        todoApp.reorderTodosInList([todo1.id], null);
        
        // Result
        const newOrder = getCurrentOrder();
        const newDetails = getDetailedTodos();
        console.log('Result order:', newOrder);
        console.log('Result details:', newDetails);
        
        // The expectation
        console.log('Expected: ["Task 2", "Task 3", "Task 4", "Task 1"]');
        console.log('Actual:  ', JSON.stringify(newOrder));
        
        // Log the failure instead of failing immediately
        if (JSON.stringify(newOrder) !== JSON.stringify(['Task 2', 'Task 3', 'Task 4', 'Task 1'])) {
            console.error('TEST FAILED: Order mismatch');
            console.error('Expected: ["Task 2", "Task 3", "Task 4", "Task 1"]');
            console.error('Actual:   ', JSON.stringify(newOrder));
            
            // Show internal data for debugging
            console.log('All todos in app:');
            todoApp.todos.forEach((todo, index) => {
                console.log(`  ${index}: ${todo.text} (id: ${todo.id}, order: ${todo.order}, listId: ${todo.listId})`);
            });
        }
        
        expect(newOrder).toEqual(['Task 2', 'Task 3', 'Task 4', 'Task 1']);
    });

    test('debug internal TodoOperations.reorderTodos call', () => {
        console.log('=== DEBUG: Internal reorderTodos call ===');
        
        // Spy on the TodoOperations method
        const reorderSpy = jest.spyOn(todoApp.todoOperations, 'reorderTodos');
        
        console.log('Before move - todos array length:', todoApp.todos.length);
        console.log('Before move - filtered todos:', getCurrentOrder());
        
        // Perform the move
        todoApp.reorderTodosInList([todo1.id], null);
        
        // Check if reorderTodos was called and with what arguments
        console.log('reorderTodos called:', reorderSpy.mock.calls.length, 'times');
        if (reorderSpy.mock.calls.length > 0) {
            console.log('reorderTodos call arguments:');
            reorderSpy.mock.calls.forEach((call, index) => {
                console.log(`  Call ${index + 1}:`, {
                    newOrderTodoIds: call[0],
                    currentListId: call[1],
                    todosArrayLength: call[2].length
                });
            });
        }
        
        console.log('After move - filtered todos:', getCurrentOrder());
        
        reorderSpy.mockRestore();
    });

    test('manual direct reorderTodos call', () => {
        console.log('=== DEBUG: Direct TodoOperations.reorderTodos call ===');
        
        const initialOrder = getCurrentOrder();
        console.log('Initial order:', initialOrder);
        
        // Check initial order values
        console.log('Initial order values:');
        todoApp.todos.forEach(todo => {
            console.log(`  ${todo.text}: order=${todo.order}, listId=${todo.listId}`);
        });
        
        // Manually construct the expected new order
        const expectedNewOrder = [todo2.id, todo3.id, todo4.id, todo1.id];
        console.log('Expected new order IDs:', expectedNewOrder);
        
        // Call reorderTodos directly
        const success = todoApp.todoOperations.reorderTodos(expectedNewOrder, todoApp.currentListId, todoApp.todos);
        console.log('reorderTodos returned:', success);
        
        // Check final order values
        console.log('Final order values:');
        todoApp.todos.forEach(todo => {
            console.log(`  ${todo.text}: order=${todo.order}, listId=${todo.listId}`);
        });
        
        const resultOrder = getCurrentOrder();
        console.log('Result order:', resultOrder);
        
        if (success) {
            expect(resultOrder).toEqual(['Task 2', 'Task 3', 'Task 4', 'Task 1']);
        } else {
            console.log('reorderTodos failed - investigating why...');
            // Don't fail the test, just log for debugging
        }
    });
});