const TodoOperations = require('../src/TodoOperations');

describe('TodoOperations', () => {
    let todoOperations;
    let mockGenerateId;
    let mockAddToUndoStack;
    let mockSaveData;
    let mockTodos;
    let mockLists;

    beforeEach(() => {
        mockGenerateId = jest.fn(() => 'test-id');
        mockAddToUndoStack = jest.fn();
        mockSaveData = jest.fn();
        
        todoOperations = new TodoOperations(mockGenerateId, mockAddToUndoStack, mockSaveData);
        
        mockTodos = [
            { id: 'todo1', text: 'Test todo 1', completed: false, listId: 'list1', createdAt: '2023-01-01T00:00:00.000Z', order: 1000 },
            { id: 'todo2', text: 'Test todo 2', completed: true, listId: 'list2', createdAt: '2023-01-02T00:00:00.000Z', order: 2000 },
            { id: 'todo3', text: 'Test todo 3', completed: false, listId: null, createdAt: '2023-01-03T00:00:00.000Z', order: 3000 }
        ];
        
        mockLists = [
            { id: 'list1', name: 'Work' },
            { id: 'list2', name: 'Personal' }
        ];

        // Mock console methods
        global.console = {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
    });

    describe('addTodoFromText', () => {
        test('should add a new todo to default list', () => {
            const text = 'New todo';
            const result = todoOperations.addTodoFromText(text, 'default', mockTodos);
            
            expect(result).toEqual(expect.objectContaining({
                id: 'test-id',
                text: 'New todo',
                completed: false,
                listId: null,
                createdAt: expect.any(String),
                order: expect.any(Number)
            }));
            expect(mockTodos).toHaveLength(4);
            expect(mockAddToUndoStack).toHaveBeenCalled();
            expect(mockSaveData).toHaveBeenCalled();
        });

        test('should add a new todo to specific list', () => {
            const text = 'Work todo';
            const result = todoOperations.addTodoFromText(text, 'list1', mockTodos);
            
            expect(result.listId).toBe('list1');
        });

        test('should trim whitespace from todo text', () => {
            const text = '   Spaced todo   ';
            const result = todoOperations.addTodoFromText(text, 'default', mockTodos);
            
            expect(result.text).toBe('Spaced todo');
        });

        test('should return null for empty text', () => {
            const result = todoOperations.addTodoFromText('', 'default', mockTodos);
            
            expect(result).toBe(null);
            expect(mockTodos).toHaveLength(3);
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
            expect(mockSaveData).not.toHaveBeenCalled();
        });

        test('should return null for whitespace-only text', () => {
            const result = todoOperations.addTodoFromText('   ', 'default', mockTodos);
            
            expect(result).toBe(null);
            expect(mockTodos).toHaveLength(3);
        });
    });

    describe('toggleTodo', () => {
        test('should toggle todo from incomplete to complete', () => {
            const result = todoOperations.toggleTodo('todo1', mockTodos);
            
            expect(result).toBe(true);
            expect(mockTodos[0].completed).toBe(true);
            expect(mockAddToUndoStack).toHaveBeenCalled();
            expect(mockSaveData).toHaveBeenCalled();
        });

        test('should toggle todo from complete to incomplete', () => {
            const result = todoOperations.toggleTodo('todo2', mockTodos);
            
            expect(result).toBe(true);
            expect(mockTodos[1].completed).toBe(false);
            expect(mockAddToUndoStack).toHaveBeenCalled();
        });

        test('should return false for non-existent todo', () => {
            const result = todoOperations.toggleTodo('nonexistent', mockTodos);
            
            expect(result).toBe(false);
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
            expect(mockSaveData).not.toHaveBeenCalled();
        });
    });

    describe('updateTodo', () => {
        test('should update todo text successfully', () => {
            const newText = 'Updated todo text';
            const result = todoOperations.updateTodo('todo1', newText, mockTodos);
            
            expect(result).toBe(true);
            expect(mockTodos[0].text).toBe(newText);
            expect(mockAddToUndoStack).toHaveBeenCalled();
            expect(mockSaveData).toHaveBeenCalled();
        });

        test('should trim whitespace from new text', () => {
            const newText = '   Trimmed text   ';
            const result = todoOperations.updateTodo('todo1', newText, mockTodos);
            
            expect(result).toBe(true);
            expect(mockTodos[0].text).toBe('Trimmed text');
        });

        test('should return false for empty text', () => {
            const result = todoOperations.updateTodo('todo1', '', mockTodos);
            
            expect(result).toBe(false);
            expect(mockTodos[0].text).toBe('Test todo 1');
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
        });

        test('should return false for non-existent todo', () => {
            const result = todoOperations.updateTodo('nonexistent', 'New text', mockTodos);
            
            expect(result).toBe(false);
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
        });

        test('should return true when text unchanged', () => {
            const result = todoOperations.updateTodo('todo1', 'Test todo 1', mockTodos);
            
            expect(result).toBe(true);
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
            expect(mockSaveData).not.toHaveBeenCalled();
        });
    });

    describe('deleteTodo', () => {
        test('should delete existing todo', () => {
            const result = todoOperations.deleteTodo('todo1', mockTodos);
            
            expect(result).toBe(true);
            expect(mockTodos).toHaveLength(2);
            expect(mockTodos.find(t => t.id === 'todo1')).toBeUndefined();
            expect(mockAddToUndoStack).toHaveBeenCalled();
            expect(mockSaveData).toHaveBeenCalled();
        });

        test('should return false for non-existent todo', () => {
            const result = todoOperations.deleteTodo('nonexistent', mockTodos);
            
            expect(result).toBe(false);
            expect(mockTodos).toHaveLength(3);
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
        });
    });

    describe('deleteSelectedTodos', () => {
        test('should delete multiple selected todos', () => {
            const selectedIds = ['todo1', 'todo3'];
            const result = todoOperations.deleteSelectedTodos(selectedIds, mockTodos);
            
            expect(result).toEqual([
                expect.objectContaining({ id: 'todo1' }),
                expect.objectContaining({ id: 'todo3' })
            ]);
            expect(mockTodos).toHaveLength(1);
            expect(mockTodos[0].id).toBe('todo2');
            expect(mockAddToUndoStack).toHaveBeenCalled();
        });

        test('should return empty array for empty selection', () => {
            const result = todoOperations.deleteSelectedTodos([], mockTodos);
            
            expect(result).toEqual([]);
            expect(mockTodos).toHaveLength(3);
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
        });
    });

    describe('moveTodosToList', () => {
        test('should move todos to specific list', () => {
            const todoIds = ['todo1', 'todo3'];
            const result = todoOperations.moveTodosToList(todoIds, 'list2', mockTodos, mockLists);
            
            expect(result).toBe(true);
            expect(mockTodos[0].listId).toBe('list2');
            expect(mockTodos[2].listId).toBe('list2');
            expect(mockAddToUndoStack).toHaveBeenCalled();
        });

        test('should move todos to default list', () => {
            const todoIds = ['todo1'];
            const result = todoOperations.moveTodosToList(todoIds, 'default', mockTodos, mockLists);
            
            expect(result).toBe(true);
            expect(mockTodos[0].listId).toBe(null);
        });

        test('should return false for empty todo list', () => {
            const result = todoOperations.moveTodosToList([], 'list1', mockTodos, mockLists);
            
            expect(result).toBe(false);
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
        });

        test('should return false for non-existent target list', () => {
            const result = todoOperations.moveTodosToList(['todo1'], 'nonexistent', mockTodos, mockLists);
            
            expect(result).toBe(false);
            expect(mockTodos[0].listId).toBe('list1');
        });
    });

    describe('generateId', () => {
        test('should call provided generateId function', () => {
            const id = todoOperations.generateId();
            
            expect(mockGenerateId).toHaveBeenCalled();
            expect(id).toBe('test-id');
        });
    });
});