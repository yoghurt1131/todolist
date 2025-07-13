const ListOperations = require('../src/ListOperations');

describe('ListOperations', () => {
    let listOperations;
    let mockGenerateId;
    let mockAddToUndoStack;
    let mockSaveData;
    let mockLists;
    let mockTodos;

    beforeEach(() => {
        mockGenerateId = jest.fn(() => 'test-list-id');
        mockAddToUndoStack = jest.fn();
        mockSaveData = jest.fn();
        
        listOperations = new ListOperations(mockGenerateId, mockAddToUndoStack, mockSaveData);
        
        mockLists = [
            { id: 'list1', name: 'Work', createdAt: '2023-01-01T00:00:00.000Z' },
            { id: 'list2', name: 'Personal', createdAt: '2023-01-02T00:00:00.000Z' },
            { id: 'list3', name: 'Shopping', createdAt: '2023-01-03T00:00:00.000Z' }
        ];
        
        mockTodos = [
            { id: 'todo1', text: 'Work task', listId: 'list1', completed: false },
            { id: 'todo2', text: 'Personal task', listId: 'list2', completed: true },
            { id: 'todo3', text: 'Default task', listId: null, completed: false }
        ];

        // Mock console methods
        global.console = {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
    });

    describe('addListFromName', () => {
        test('should add a new list successfully', () => {
            const name = 'New List';
            const result = listOperations.addListFromName(name, mockLists);
            
            expect(result).toEqual({
                id: 'test-list-id',
                name: 'New List',
                createdAt: expect.any(String)
            });
            expect(mockLists).toHaveLength(4);
            expect(mockAddToUndoStack).toHaveBeenCalled();
            expect(mockSaveData).toHaveBeenCalled();
        });

        test('should trim whitespace from list name', () => {
            const name = '   Spaced List   ';
            const result = listOperations.addListFromName(name, mockLists);
            
            expect(result.name).toBe('Spaced List');
        });

        test('should return null for empty name', () => {
            const result = listOperations.addListFromName('', mockLists);
            
            expect(result).toBe(null);
            expect(mockLists).toHaveLength(3);
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
            expect(mockSaveData).not.toHaveBeenCalled();
        });

        test('should return null for whitespace-only name', () => {
            const result = listOperations.addListFromName('   ', mockLists);
            
            expect(result).toBe(null);
            expect(mockLists).toHaveLength(3);
        });

        test('should return null for duplicate name', () => {
            const result = listOperations.addListFromName('Work', mockLists);
            
            expect(result).toBe(null);
            expect(mockLists).toHaveLength(3);
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
        });

        test('should return null for duplicate name case insensitive', () => {
            const result = listOperations.addListFromName('WORK', mockLists);
            
            expect(result).toBe(null);
            expect(mockLists).toHaveLength(3);
        });
    });

    describe('updateList', () => {
        test('should update list name successfully', () => {
            const newName = 'Updated Work';
            const result = listOperations.updateList('list1', newName, mockLists);
            
            expect(result).toBe(true);
            expect(mockLists[0].name).toBe(newName);
            expect(mockAddToUndoStack).toHaveBeenCalled();
            expect(mockSaveData).toHaveBeenCalled();
        });

        test('should trim whitespace from new name', () => {
            const newName = '   Trimmed Name   ';
            const result = listOperations.updateList('list1', newName, mockLists);
            
            expect(result).toBe(true);
            expect(mockLists[0].name).toBe('Trimmed Name');
        });

        test('should return false for empty name', () => {
            const result = listOperations.updateList('list1', '', mockLists);
            
            expect(result).toBe(false);
            expect(mockLists[0].name).toBe('Work');
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
        });

        test('should return false for non-existent list', () => {
            const result = listOperations.updateList('nonexistent', 'New Name', mockLists);
            
            expect(result).toBe(false);
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
        });

        test('should return false for duplicate name', () => {
            const result = listOperations.updateList('list1', 'Personal', mockLists);
            
            expect(result).toBe(false);
            expect(mockLists[0].name).toBe('Work');
        });

        test('should return true when name unchanged', () => {
            const result = listOperations.updateList('list1', 'Work', mockLists);
            
            expect(result).toBe(true);
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
            expect(mockSaveData).not.toHaveBeenCalled();
        });
    });

    describe('deleteList', () => {
        test('should delete list and move todos to default', () => {
            const result = listOperations.deleteList('list1', mockLists, mockTodos);
            
            expect(result).toBe(true);
            expect(mockLists).toHaveLength(2);
            expect(mockLists.find(l => l.id === 'list1')).toBeUndefined();
            expect(mockTodos[0].listId).toBe(null);
            expect(mockAddToUndoStack).toHaveBeenCalled();
            expect(mockSaveData).toHaveBeenCalled();
        });

        test('should return false for non-existent list', () => {
            const result = listOperations.deleteList('nonexistent', mockLists, mockTodos);
            
            expect(result).toBe(false);
            expect(mockLists).toHaveLength(3);
            expect(mockAddToUndoStack).not.toHaveBeenCalled();
        });
    });

    describe('isListNameDuplicate', () => {
        test('should return true for exact duplicate', () => {
            const result = listOperations.isListNameDuplicate('Work', mockLists);
            expect(result).toBe(true);
        });

        test('should return true for case insensitive duplicate', () => {
            const result = listOperations.isListNameDuplicate('WORK', mockLists);
            expect(result).toBe(true);
        });

        test('should return false for unique name', () => {
            const result = listOperations.isListNameDuplicate('Unique Name', mockLists);
            expect(result).toBe(false);
        });

        test('should exclude specific list ID from check', () => {
            const result = listOperations.isListNameDuplicate('Work', mockLists, 'list1');
            expect(result).toBe(false);
        });
    });

    describe('generateId', () => {
        test('should call provided generateId function', () => {
            const id = listOperations.generateId();
            
            expect(mockGenerateId).toHaveBeenCalled();
            expect(id).toBe('test-list-id');
        });
    });
});