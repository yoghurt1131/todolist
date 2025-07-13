const SelectionManager = require('../src/SelectionManager');

describe('SelectionManager', () => {
    let selectionManager;
    let mockTodos;

    beforeEach(() => {
        selectionManager = new SelectionManager();
        
        // Mock todos for range selection testing
        mockTodos = [
            { id: 'todo1', text: 'First todo' },
            { id: 'todo2', text: 'Second todo' },
            { id: 'todo3', text: 'Third todo' },
            { id: 'todo4', text: 'Fourth todo' },
            { id: 'todo5', text: 'Fifth todo' }
        ];
    });

    describe('constructor', () => {
        test('should initialize with empty selection', () => {
            expect(selectionManager.getSelectedCount()).toBe(0);
            expect(selectionManager.hasSelection()).toBe(false);
            expect(selectionManager.getLastSelectedId()).toBeNull();
            expect(selectionManager.getSelectedIds()).toEqual([]);
        });
    });

    describe('selectTodo', () => {
        test('should select single todo', () => {
            const result = selectionManager.selectTodo('todo1');
            
            expect(result.type).toBe('single');
            expect(result.selectedIds).toEqual(['todo1']);
            expect(selectionManager.isSelected('todo1')).toBe(true);
            expect(selectionManager.getLastSelectedId()).toBe('todo1');
            expect(selectionManager.getSelectedCount()).toBe(1);
        });

        test('should replace selection when selecting new todo without modifiers', () => {
            selectionManager.selectTodo('todo1');
            const result = selectionManager.selectTodo('todo2');
            
            expect(result.type).toBe('single');
            expect(result.selectedIds).toEqual(['todo2']);
            expect(selectionManager.isSelected('todo1')).toBe(false);
            expect(selectionManager.isSelected('todo2')).toBe(true);
            expect(selectionManager.getLastSelectedId()).toBe('todo2');
        });

        test('should add to selection in multi-select mode', () => {
            selectionManager.selectTodo('todo1');
            const result = selectionManager.selectTodo('todo2', true);
            
            expect(result.type).toBe('single');
            expect(result.selectedIds).toEqual(['todo1', 'todo2']);
            expect(selectionManager.isSelected('todo1')).toBe(true);
            expect(selectionManager.isSelected('todo2')).toBe(true);
            expect(selectionManager.getLastSelectedId()).toBe('todo2');
        });

        test('should remove from selection in multi-select mode if already selected', () => {
            selectionManager.selectTodo('todo1');
            selectionManager.selectTodo('todo2', true);
            const result = selectionManager.selectTodo('todo1', true);
            
            expect(result.type).toBe('single');
            expect(result.selectedIds).toEqual(['todo2']);
            expect(selectionManager.isSelected('todo1')).toBe(false);
            expect(selectionManager.isSelected('todo2')).toBe(true);
            expect(selectionManager.getLastSelectedId()).toBe('todo2'); // Should be the remaining selected todo
        });

        test('should return range info in range select mode', () => {
            selectionManager.selectTodo('todo1');
            const result = selectionManager.selectTodo('todo3', false, true);
            
            expect(result.type).toBe('range');
            expect(result.startId).toBe('todo1');
            expect(result.endId).toBe('todo3');
        });

        test('should handle range select without previous selection', () => {
            const result = selectionManager.selectTodo('todo1', false, true);
            
            expect(result.type).toBe('single');
            expect(result.selectedIds).toEqual(['todo1']);
        });
    });

    describe('selectTodoRange', () => {
        test('should select range of todos', () => {
            const selectedIds = selectionManager.selectTodoRange('todo2', 'todo4', mockTodos);
            
            expect(selectedIds).toEqual(['todo2', 'todo3', 'todo4']);
            expect(selectionManager.getSelectedCount()).toBe(3);
            expect(selectionManager.isSelected('todo1')).toBe(false);
            expect(selectionManager.isSelected('todo2')).toBe(true);
            expect(selectionManager.isSelected('todo3')).toBe(true);
            expect(selectionManager.isSelected('todo4')).toBe(true);
            expect(selectionManager.isSelected('todo5')).toBe(false);
            expect(selectionManager.getLastSelectedId()).toBe('todo4');
        });

        test('should handle reverse range selection', () => {
            const selectedIds = selectionManager.selectTodoRange('todo4', 'todo2', mockTodos);
            
            expect(selectedIds).toEqual(['todo2', 'todo3', 'todo4']);
            expect(selectionManager.getSelectedCount()).toBe(3);
        });

        test('should handle single todo range', () => {
            const selectedIds = selectionManager.selectTodoRange('todo3', 'todo3', mockTodos);
            
            expect(selectedIds).toEqual(['todo3']);
            expect(selectionManager.getSelectedCount()).toBe(1);
        });

        test('should handle invalid todo ids', () => {
            const selectedIds = selectionManager.selectTodoRange('invalid1', 'invalid2', mockTodos);
            
            expect(selectedIds).toBeUndefined();
            expect(selectionManager.getSelectedCount()).toBe(0);
        });

        test('should handle empty todo list', () => {
            const selectedIds = selectionManager.selectTodoRange('todo1', 'todo2', []);
            
            expect(selectedIds).toBeUndefined();
            expect(selectionManager.getSelectedCount()).toBe(0);
        });

        test('should clear previous selection before range select', () => {
            selectionManager.selectTodo('todo1');
            const selectedIds = selectionManager.selectTodoRange('todo3', 'todo4', mockTodos);
            
            expect(selectedIds).toEqual(['todo3', 'todo4']);
            expect(selectionManager.isSelected('todo1')).toBe(false);
        });
    });

    describe('clearSelection', () => {
        test('should clear all selections', () => {
            selectionManager.selectTodo('todo1');
            selectionManager.selectTodo('todo2', true);
            
            expect(selectionManager.getSelectedCount()).toBe(2);
            
            selectionManager.clearSelection();
            
            expect(selectionManager.getSelectedCount()).toBe(0);
            expect(selectionManager.hasSelection()).toBe(false);
            expect(selectionManager.getLastSelectedId()).toBeNull();
            expect(selectionManager.getSelectedIds()).toEqual([]);
        });
    });

    describe('utility methods', () => {
        test('isSelected should return correct status', () => {
            expect(selectionManager.isSelected('todo1')).toBe(false);
            
            selectionManager.selectTodo('todo1');
            expect(selectionManager.isSelected('todo1')).toBe(true);
            expect(selectionManager.isSelected('todo2')).toBe(false);
        });

        test('getSelectedIds should return array of selected ids', () => {
            expect(selectionManager.getSelectedIds()).toEqual([]);
            
            selectionManager.selectTodo('todo1');
            expect(selectionManager.getSelectedIds()).toEqual(['todo1']);
            
            selectionManager.selectTodo('todo2', true);
            expect(selectionManager.getSelectedIds()).toEqual(['todo1', 'todo2']);
        });

        test('getSelectedCount should return correct count', () => {
            expect(selectionManager.getSelectedCount()).toBe(0);
            
            selectionManager.selectTodo('todo1');
            expect(selectionManager.getSelectedCount()).toBe(1);
            
            selectionManager.selectTodo('todo2', true);
            expect(selectionManager.getSelectedCount()).toBe(2);
        });

        test('hasSelection should return correct status', () => {
            expect(selectionManager.hasSelection()).toBe(false);
            
            selectionManager.selectTodo('todo1');
            expect(selectionManager.hasSelection()).toBe(true);
            
            selectionManager.clearSelection();
            expect(selectionManager.hasSelection()).toBe(false);
        });
    });

    describe('getRangePreviewIds', () => {
        test('should return preview ids for range', () => {
            const previewIds = selectionManager.getRangePreviewIds('todo2', 'todo4', mockTodos);
            
            expect(previewIds).toEqual(['todo2', 'todo3', 'todo4']);
        });

        test('should handle reverse range preview', () => {
            const previewIds = selectionManager.getRangePreviewIds('todo4', 'todo2', mockTodos);
            
            expect(previewIds).toEqual(['todo2', 'todo3', 'todo4']);
        });

        test('should return empty array for invalid ids', () => {
            const previewIds = selectionManager.getRangePreviewIds('invalid1', 'invalid2', mockTodos);
            
            expect(previewIds).toEqual([]);
        });

        test('should return empty array for empty todo list', () => {
            const previewIds = selectionManager.getRangePreviewIds('todo1', 'todo2', []);
            
            expect(previewIds).toEqual([]);
        });
    });

    describe('setSelectedIds', () => {
        test('should set multiple selected ids', () => {
            selectionManager.setSelectedIds(['todo1', 'todo3', 'todo5']);
            
            expect(selectionManager.getSelectedIds()).toEqual(['todo1', 'todo3', 'todo5']);
            expect(selectionManager.getSelectedCount()).toBe(3);
            expect(selectionManager.getLastSelectedId()).toBe('todo5');
            expect(selectionManager.isSelected('todo1')).toBe(true);
            expect(selectionManager.isSelected('todo2')).toBe(false);
            expect(selectionManager.isSelected('todo3')).toBe(true);
        });

        test('should clear previous selection', () => {
            selectionManager.selectTodo('todo1');
            selectionManager.setSelectedIds(['todo2', 'todo3']);
            
            expect(selectionManager.isSelected('todo1')).toBe(false);
            expect(selectionManager.isSelected('todo2')).toBe(true);
            expect(selectionManager.isSelected('todo3')).toBe(true);
        });

        test('should handle empty array', () => {
            selectionManager.selectTodo('todo1');
            selectionManager.setSelectedIds([]);
            
            expect(selectionManager.getSelectedCount()).toBe(0);
            expect(selectionManager.getLastSelectedId()).toBeNull();
        });
    });

    describe('selection state management', () => {
        test('should get current selection state', () => {
            selectionManager.selectTodo('todo1');
            selectionManager.selectTodo('todo2', true);
            
            const state = selectionManager.getSelectionState();
            
            expect(state.selectedIds).toEqual(['todo1', 'todo2']);
            expect(state.lastSelectedId).toBe('todo2');
        });

        test('should restore selection state', () => {
            const state = {
                selectedIds: ['todo2', 'todo4'],
                lastSelectedId: 'todo4'
            };
            
            selectionManager.restoreSelectionState(state);
            
            expect(selectionManager.getSelectedIds()).toEqual(['todo2', 'todo4']);
            expect(selectionManager.getLastSelectedId()).toBe('todo4');
            expect(selectionManager.isSelected('todo2')).toBe(true);
            expect(selectionManager.isSelected('todo4')).toBe(true);
        });

        test('should handle empty state restoration', () => {
            selectionManager.selectTodo('todo1');
            
            selectionManager.restoreSelectionState({});
            
            expect(selectionManager.getSelectedCount()).toBe(0);
            expect(selectionManager.getLastSelectedId()).toBeNull();
        });

        test('should handle null state restoration', () => {
            selectionManager.selectTodo('todo1');
            
            selectionManager.restoreSelectionState({ selectedIds: null, lastSelectedId: null });
            
            expect(selectionManager.getSelectedCount()).toBe(0);
            expect(selectionManager.getLastSelectedId()).toBeNull();
        });
    });

    describe('debugPrintSelection', () => {
        test('should log selection state', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            selectionManager.selectTodo('todo1');
            selectionManager.selectTodo('todo2', true);
            
            selectionManager.debugPrintSelection();
            
            expect(consoleSpy).toHaveBeenCalledWith('Selection state:');
            expect(consoleSpy).toHaveBeenCalledWith('  Selected IDs:', ['todo1', 'todo2']);
            expect(consoleSpy).toHaveBeenCalledWith('  Last selected:', 'todo2');
            expect(consoleSpy).toHaveBeenCalledWith('  Count:', 2);
            
            consoleSpy.mockRestore();
        });
    });
});