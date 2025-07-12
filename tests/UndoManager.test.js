const UndoManager = require('../src/UndoManager');

describe('UndoManager', () => {
    let undoManager;
    let mockTodoOps;
    let mockListOps;

    beforeEach(() => {
        undoManager = new UndoManager(5); // Small max size for testing
        
        // Mock operations objects
        mockTodoOps = {
            deleteTodoById: jest.fn(),
            restoreTodo: jest.fn(),
            toggleTodoById: jest.fn(),
            updateTodoById: jest.fn(),
            moveTodosToListById: jest.fn()
        };

        mockListOps = {
            deleteListById: jest.fn(),
            restoreList: jest.fn(),
            updateListById: jest.fn()
        };
    });

    describe('constructor', () => {
        test('should initialize with default max size', () => {
            const defaultUM = new UndoManager();
            expect(defaultUM.maxSize).toBe(50);
            expect(defaultUM.getHistoryCount()).toBe(0);
        });

        test('should initialize with custom max size', () => {
            expect(undoManager.maxSize).toBe(5);
            expect(undoManager.getHistoryCount()).toBe(0);
        });
    });

    describe('addAction', () => {
        test('should add valid action to history', () => {
            const action = { type: 'addTodo', todoId: 'test-id' };
            
            undoManager.addAction(action);
            
            expect(undoManager.getHistoryCount()).toBe(1);
            expect(undoManager.canUndo()).toBe(true);
            expect(undoManager.getLastActionType()).toBe('addTodo');
        });

        test('should reject invalid actions', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            undoManager.addAction(null);
            undoManager.addAction({});
            undoManager.addAction({ data: 'no type' });
            
            expect(undoManager.getHistoryCount()).toBe(0);
            expect(consoleSpy).toHaveBeenCalledTimes(3);
            
            consoleSpy.mockRestore();
        });

        test('should maintain max size by removing oldest actions', () => {
            // Add more actions than max size
            for (let i = 0; i < 7; i++) {
                undoManager.addAction({ type: 'addTodo', todoId: `test-${i}` });
            }
            
            expect(undoManager.getHistoryCount()).toBe(5);
            // Should have kept the last 5 actions (test-2 through test-6)
            expect(undoManager.getLastActionType()).toBe('addTodo');
        });
    });

    describe('undo', () => {
        test('should return false when no actions to undo', () => {
            const result = undoManager.undo({ todoOps: mockTodoOps, listOps: mockListOps });
            
            expect(result).toBe(false);
            expect(undoManager.getHistoryCount()).toBe(0);
        });

        test('should undo addTodo action', () => {
            const action = { type: 'addTodo', todoId: 'test-todo' };
            undoManager.addAction(action);
            
            const result = undoManager.undo({ todoOps: mockTodoOps, listOps: mockListOps });
            
            expect(result).toBe(true);
            expect(mockTodoOps.deleteTodoById).toHaveBeenCalledWith('test-todo');
            expect(undoManager.getHistoryCount()).toBe(0);
        });

        test('should undo deleteTodo action', () => {
            const todo = { id: 'test-todo', text: 'Test', completed: false };
            const action = { type: 'deleteTodo', todo: todo };
            undoManager.addAction(action);
            
            const result = undoManager.undo({ todoOps: mockTodoOps, listOps: mockListOps });
            
            expect(result).toBe(true);
            expect(mockTodoOps.restoreTodo).toHaveBeenCalledWith(todo);
        });

        test('should undo toggleTodo action', () => {
            const action = { type: 'toggleTodo', todoId: 'test-todo' };
            undoManager.addAction(action);
            
            const result = undoManager.undo({ todoOps: mockTodoOps, listOps: mockListOps });
            
            expect(result).toBe(true);
            expect(mockTodoOps.toggleTodoById).toHaveBeenCalledWith('test-todo');
        });

        test('should undo editTodo action', () => {
            const action = { 
                type: 'editTodo', 
                todoId: 'test-todo', 
                previousText: 'Original Text',
                newText: 'New Text'
            };
            undoManager.addAction(action);
            
            const result = undoManager.undo({ todoOps: mockTodoOps, listOps: mockListOps });
            
            expect(result).toBe(true);
            expect(mockTodoOps.updateTodoById).toHaveBeenCalledWith('test-todo', 'Original Text');
        });

        test('should undo addList action', () => {
            const action = { type: 'addList', listId: 'test-list' };
            undoManager.addAction(action);
            
            const result = undoManager.undo({ todoOps: mockTodoOps, listOps: mockListOps });
            
            expect(result).toBe(true);
            expect(mockListOps.deleteListById).toHaveBeenCalledWith('test-list');
        });

        test('should undo deleteList action', () => {
            const list = { id: 'test-list', name: 'Test List' };
            const todos = [{ id: 'todo1', text: 'Todo 1' }];
            const action = { type: 'deleteList', list: list, todos: todos };
            undoManager.addAction(action);
            
            const result = undoManager.undo({ todoOps: mockTodoOps, listOps: mockListOps });
            
            expect(result).toBe(true);
            expect(mockListOps.restoreList).toHaveBeenCalledWith(list, todos);
        });

        test('should undo editList action', () => {
            const action = { 
                type: 'editList', 
                listId: 'test-list', 
                previousName: 'Original Name',
                newName: 'New Name'
            };
            undoManager.addAction(action);
            
            const result = undoManager.undo({ todoOps: mockTodoOps, listOps: mockListOps });
            
            expect(result).toBe(true);
            expect(mockListOps.updateListById).toHaveBeenCalledWith('test-list', 'Original Name');
        });

        test('should undo moveTodos action', () => {
            const action = { 
                type: 'moveTodos', 
                todoIds: ['todo1', 'todo2'], 
                originalListId: 'original-list',
                targetListId: 'target-list'
            };
            undoManager.addAction(action);
            
            const result = undoManager.undo({ todoOps: mockTodoOps, listOps: mockListOps });
            
            expect(result).toBe(true);
            expect(mockTodoOps.moveTodosToListById).toHaveBeenCalledWith(['todo1', 'todo2'], 'original-list');
        });

        test('should handle unknown action types', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            const action = { type: 'unknownAction', data: 'test' };
            undoManager.addAction(action);
            
            const result = undoManager.undo({ todoOps: mockTodoOps, listOps: mockListOps });
            
            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Unknown action type for undo:', 'unknownAction');
            expect(undoManager.getHistoryCount()).toBe(1); // Action should be back in stack
            
            consoleSpy.mockRestore();
        });

        test('should handle errors during undo and restore action to stack', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            mockTodoOps.deleteTodoById.mockImplementation(() => {
                throw new Error('Undo failed');
            });
            
            const action = { type: 'addTodo', todoId: 'test-todo' };
            undoManager.addAction(action);
            
            const result = undoManager.undo({ todoOps: mockTodoOps, listOps: mockListOps });
            
            expect(result).toBe(false);
            expect(undoManager.getHistoryCount()).toBe(1); // Action restored to stack
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error during undo operation:', expect.any(Error));
            
            consoleErrorSpy.mockRestore();
        });
    });

    describe('utility methods', () => {
        test('canUndo should return correct status', () => {
            expect(undoManager.canUndo()).toBe(false);
            
            undoManager.addAction({ type: 'addTodo', todoId: 'test' });
            expect(undoManager.canUndo()).toBe(true);
            
            undoManager.undo({ todoOps: mockTodoOps, listOps: mockListOps });
            expect(undoManager.canUndo()).toBe(false);
        });

        test('clear should remove all history', () => {
            undoManager.addAction({ type: 'addTodo', todoId: 'test1' });
            undoManager.addAction({ type: 'addTodo', todoId: 'test2' });
            
            expect(undoManager.getHistoryCount()).toBe(2);
            
            undoManager.clear();
            
            expect(undoManager.getHistoryCount()).toBe(0);
            expect(undoManager.canUndo()).toBe(false);
        });

        test('getLastActionType should return correct type', () => {
            expect(undoManager.getLastActionType()).toBeNull();
            
            undoManager.addAction({ type: 'addTodo', todoId: 'test' });
            expect(undoManager.getLastActionType()).toBe('addTodo');
            
            undoManager.addAction({ type: 'editTodo', todoId: 'test' });
            expect(undoManager.getLastActionType()).toBe('editTodo');
        });

        test('debugPrintHistory should log history', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            undoManager.addAction({ type: 'addTodo', todoId: 'test1' });
            undoManager.addAction({ type: 'editTodo', todoId: 'test2' });
            
            undoManager.debugPrintHistory();
            
            expect(consoleSpy).toHaveBeenCalledWith('Undo history:');
            expect(consoleSpy).toHaveBeenCalledWith('  1. addTodo', expect.any(Object));
            expect(consoleSpy).toHaveBeenCalledWith('  2. editTodo', expect.any(Object));
            
            consoleSpy.mockRestore();
        });
    });
});