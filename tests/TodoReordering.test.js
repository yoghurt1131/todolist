const TodoOperations = require('../src/TodoOperations');

describe('TodoReordering', () => {
    let todoOperations;
    let mockGenerateId;
    let mockAddToUndoStack;
    let mockSaveData;
    let mockTodos;

    beforeEach(() => {
        mockGenerateId = jest.fn(() => 'test-id');
        mockAddToUndoStack = jest.fn();
        mockSaveData = jest.fn();
        
        todoOperations = new TodoOperations(mockGenerateId, mockAddToUndoStack, mockSaveData);
        
        mockTodos = [
            { id: 'todo1', text: 'Task 1', completed: false, listId: null, createdAt: '2023-01-01T00:00:00.000Z', order: 1000 },
            { id: 'todo2', text: 'Task 2', completed: false, listId: null, createdAt: '2023-01-02T00:00:00.000Z', order: 2000 },
            { id: 'todo3', text: 'Task 3', completed: false, listId: null, createdAt: '2023-01-03T00:00:00.000Z', order: 3000 },
            { id: 'todo4', text: 'Task 4', completed: false, listId: 'list1', createdAt: '2023-01-04T00:00:00.000Z', order: 1000 }
        ];

        // Mock console methods
        global.console = {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
    });

    describe('getNextOrderValue', () => {
        test('should return 1000 for empty list', () => {
            const emptyTodos = [];
            const result = todoOperations.getNextOrderValue(emptyTodos, null);
            expect(result).toBe(1000);
        });

        test('should return next order value for default list', () => {
            const result = todoOperations.getNextOrderValue(mockTodos, null);
            expect(result).toBe(4000); // max order (3000) + 1000
        });

        test('should return next order value for specific list', () => {
            const result = todoOperations.getNextOrderValue(mockTodos, 'list1');
            expect(result).toBe(2000); // max order in list1 (1000) + 1000
        });

        test('should handle todos without order values', () => {
            const todosWithoutOrder = [
                { id: 'todo1', text: 'Task 1', completed: false, listId: null, createdAt: '2023-01-01T00:00:00.000Z' }
            ];
            const result = todoOperations.getNextOrderValue(todosWithoutOrder, null);
            expect(result).toBe(1000); // treats missing order as 0, so max is 0 + 1000
        });
    });

    describe('reorderTodos', () => {
        test('should reorder todos successfully', () => {
            const newOrder = ['todo3', 'todo1', 'todo2'];
            const result = todoOperations.reorderTodos(newOrder, null, mockTodos);

            expect(result).toBe(true);
            expect(mockTodos.find(t => t.id === 'todo3').order).toBe(1000);
            expect(mockTodos.find(t => t.id === 'todo1').order).toBe(2000);
            expect(mockTodos.find(t => t.id === 'todo2').order).toBe(3000);
            expect(mockSaveData).toHaveBeenCalled();
            expect(mockAddToUndoStack).toHaveBeenCalledWith({
                type: 'reorderTodos',
                listId: null,
                todoIds: newOrder,
                originalOrders: {
                    'todo3': 3000,
                    'todo1': 1000,
                    'todo2': 2000
                }
            });
        });

        test('should not reorder if no changes needed', () => {
            const currentOrder = ['todo1', 'todo2', 'todo3'];
            const result = todoOperations.reorderTodos(currentOrder, null, mockTodos);

            expect(result).toBe(false);
            expect(mockSaveData).not.toHaveBeenCalled();
        });

        test('should handle empty todoIds array', () => {
            const result = todoOperations.reorderTodos([], null, mockTodos);
            expect(result).toBe(false);
        });

        test('should only reorder todos in specified list', () => {
            const newOrder = ['todo4'];
            const originalOrder = mockTodos.find(t => t.id === 'todo4').order;
            
            const result = todoOperations.reorderTodos(newOrder, 'list1', mockTodos);

            // Should not change order for single item
            expect(result).toBe(false);
            expect(mockTodos.find(t => t.id === 'todo4').order).toBe(originalOrder);
        });
    });

    describe('updateTodoOrder', () => {
        test('should update single todo order', () => {
            const result = todoOperations.updateTodoOrder('todo1', 2500, mockTodos);

            expect(result).toBe(true);
            expect(mockTodos.find(t => t.id === 'todo1').order).toBe(2500);
            expect(mockSaveData).toHaveBeenCalled();
            expect(mockAddToUndoStack).toHaveBeenCalledWith({
                type: 'updateTodoOrder',
                todoId: 'todo1',
                originalOrder: 1000,
                newOrder: 2500
            });
        });

        test('should return false if no change needed', () => {
            const result = todoOperations.updateTodoOrder('todo1', 1000, mockTodos);
            expect(result).toBe(false);
            expect(mockSaveData).not.toHaveBeenCalled();
        });

        test('should return false for non-existent todo', () => {
            const result = todoOperations.updateTodoOrder('nonexistent', 1500, mockTodos);
            expect(result).toBe(false);
        });

        test('should return false for invalid order value', () => {
            const result = todoOperations.updateTodoOrder('todo1', 'invalid', mockTodos);
            expect(result).toBe(false);
        });
    });

    describe('normalizeTodoOrders', () => {
        test('should normalize order values', () => {
            // Set up todos with irregular order values
            mockTodos[0].order = 100;
            mockTodos[1].order = 5000;
            mockTodos[2].order = 7500;

            const result = todoOperations.normalizeTodoOrders(mockTodos, null);

            expect(result).toBe(true);
            expect(mockTodos[0].order).toBe(1000);
            expect(mockTodos[1].order).toBe(2000);
            expect(mockTodos[2].order).toBe(3000);
            expect(mockSaveData).toHaveBeenCalled();
        });

        test('should handle todos without order values', () => {
            mockTodos[0].order = undefined;
            mockTodos[1].order = null;

            const result = todoOperations.normalizeTodoOrders(mockTodos, null);

            expect(result).toBe(true);
            // Should assign order based on createdAt timestamp
            expect(mockTodos[0].order).toBeDefined();
            expect(mockTodos[1].order).toBeDefined();
        });

        test('should return false for empty list', () => {
            const result = todoOperations.normalizeTodoOrders([], null);
            expect(result).toBe(false);
        });

        test('should not normalize if already normalized', () => {
            const result = todoOperations.normalizeTodoOrders(mockTodos, null);
            expect(result).toBe(false);
            expect(mockSaveData).not.toHaveBeenCalled();
        });
    });

    describe('insertTodoAtPosition', () => {
        test('should insert todo at specified position', () => {
            const result = todoOperations.insertTodoAtPosition('todo3', 0, null, mockTodos);

            expect(result).toBe(true);
            // After normalization, the order should be 1000 (first position)
            expect(mockTodos.find(t => t.id === 'todo3').order).toBe(1000);
            expect(mockAddToUndoStack).toHaveBeenCalled();
        });

        test('should return false for non-existent todo', () => {
            const result = todoOperations.insertTodoAtPosition('nonexistent', 0, null, mockTodos);
            expect(result).toBe(false);
        });

        test('should return false if todo not in target list', () => {
            const result = todoOperations.insertTodoAtPosition('todo1', 0, 'list1', mockTodos);
            expect(result).toBe(false);
        });
    });

    describe('Integration with addTodoFromText', () => {
        test('should assign order value when creating new todo', () => {
            const result = todoOperations.addTodoFromText('New Todo', 'default', mockTodos);

            expect(result).toBeTruthy();
            expect(result.order).toBe(4000); // next order value for default list
            expect(mockSaveData).toHaveBeenCalled();
        });
    });

    describe('Integration with duplicateTodo', () => {
        test('should assign order value when duplicating todo', () => {
            const result = todoOperations.duplicateTodo('todo1', mockTodos);

            expect(result).toBeTruthy();
            expect(result.order).toBe(4000); // next order value for default list
            expect(result.text).toBe('Task 1 (コピー)');
            expect(mockSaveData).toHaveBeenCalled();
        });
    });
});