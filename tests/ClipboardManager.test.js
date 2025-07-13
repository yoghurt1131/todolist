const ClipboardManager = require('../src/ClipboardManager');

// Mock electron clipboard
const mockClipboard = {
    writeText: jest.fn()
};

// Mock require function
jest.mock('electron', () => ({
    clipboard: mockClipboard
}), { virtual: true });

// Mock console methods but keep real console for debugging
const realConsole = console;
global.console = {
    log: jest.fn((...args) => realConsole.log(...args)),
    warn: jest.fn((...args) => realConsole.warn(...args)),
    error: jest.fn((...args) => realConsole.error(...args))
};

describe('ClipboardManager', () => {
    let clipboardManager;
    let mockTodos;
    let mockGenerateId;
    let mockOnNotify;

    beforeEach(() => {
        clipboardManager = new ClipboardManager();
        mockOnNotify = jest.fn();
        
        // Mock todos data
        mockTodos = [
            {
                id: 'todo1',
                text: 'First todo',
                completed: false,
                listId: null,
                createdAt: '2023-01-01T00:00:00.000Z'
            },
            {
                id: 'todo2',
                text: 'Second todo',
                completed: true,
                listId: 'list1',
                createdAt: '2023-01-02T00:00:00.000Z'
            },
            {
                id: 'todo3',
                text: 'Third todo',
                completed: false,
                listId: 'list1',
                createdAt: '2023-01-03T00:00:00.000Z'
            }
        ];

        // Mock ID generator
        let idCounter = 0;
        mockGenerateId = jest.fn(() => `new-id-${++idCounter}`);

        // Reset mocks
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        test('should initialize with empty clipboard', () => {
            expect(clipboardManager.isEmpty()).toBe(true);
            expect(clipboardManager.getCount()).toBe(0);
            expect(clipboardManager.getClipboardData()).toEqual([]);
        });
    });

    describe('copyTodos', () => {
        test('should copy selected todos successfully', () => {
            const selectedIds = ['todo1', 'todo3'];
            
            const result = clipboardManager.copyTodos(selectedIds, mockTodos, mockOnNotify);
            
            expect(result).toBe(true);
            expect(clipboardManager.getCount()).toBe(2);
            expect(mockOnNotify).toHaveBeenCalledWith(2);
            
            const clipboardData = clipboardManager.getClipboardData();
            expect(clipboardData).toHaveLength(2);
            expect(clipboardData[0].text).toBe('First todo');
            expect(clipboardData[1].text).toBe('Third todo');
        });

        test('should return false when no todos selected', () => {
            const result = clipboardManager.copyTodos([], mockTodos, mockOnNotify);
            
            expect(result).toBe(false);
            expect(clipboardManager.isEmpty()).toBe(true);
            expect(mockOnNotify).not.toHaveBeenCalled();
            expect(console.warn).toHaveBeenCalledWith('No todos selected for copy');
        });

        test('should handle null/undefined selectedTodoIds', () => {
            const result1 = clipboardManager.copyTodos(null, mockTodos, mockOnNotify);
            const result2 = clipboardManager.copyTodos(undefined, mockTodos, mockOnNotify);
            
            expect(result1).toBe(false);
            expect(result2).toBe(false);
            expect(clipboardManager.isEmpty()).toBe(true);
        });

        test('should filter out non-existent todos', () => {
            const selectedIds = ['todo1', 'nonexistent', 'todo2'];
            
            const result = clipboardManager.copyTodos(selectedIds, mockTodos, mockOnNotify);
            
            expect(result).toBe(true);
            expect(clipboardManager.getCount()).toBe(2);
            
            const clipboardData = clipboardManager.getClipboardData();
            expect(clipboardData[0].text).toBe('First todo');
            expect(clipboardData[1].text).toBe('Second todo');
        });

        test('should work without notification callback', () => {
            const selectedIds = ['todo1'];
            
            const result = clipboardManager.copyTodos(selectedIds, mockTodos);
            
            expect(result).toBe(true);
            expect(clipboardManager.getCount()).toBe(1);
        });
    });

    describe('copyToSystemClipboard', () => {
        beforeEach(() => {
            clipboardManager.copyTodos(['todo1', 'todo2'], mockTodos, mockOnNotify);
        });

        test('should copy to system clipboard successfully', () => {
            const result = clipboardManager.copyToSystemClipboard();
            
            expect(result).toBe(true);
            expect(mockClipboard.writeText).toHaveBeenCalledWith('- [ ] First todo\n- [x] Second todo');
            expect(console.log).toHaveBeenCalledWith('TODOリストをシステムクリップボードにコピーしました');
        });

        test('should return false when clipboard is empty', () => {
            clipboardManager.clearClipboard();
            
            const result = clipboardManager.copyToSystemClipboard();
            
            expect(result).toBe(false);
            expect(mockClipboard.writeText).not.toHaveBeenCalled();
            expect(console.warn).toHaveBeenCalledWith('Cannot copy to system clipboard: no todos or not in Electron environment');
        });

        test('should handle clipboard errors', () => {
            mockClipboard.writeText.mockImplementation(() => {
                throw new Error('Clipboard error');
            });
            
            const result = clipboardManager.copyToSystemClipboard();
            
            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalledWith('システムクリップボードへのコピーに失敗しました:', expect.any(Error));
        });
    });

    describe('pasteTodos', () => {
        beforeEach(() => {
            clipboardManager.copyTodos(['todo1', 'todo2'], mockTodos, mockOnNotify);
        });

        test('should paste todos successfully', () => {
            const newTodos = clipboardManager.pasteTodos('list2', mockGenerateId);
            
            expect(newTodos).toHaveLength(2);
            expect(newTodos[0].id).toBe('new-id-1');
            expect(newTodos[0].text).toBe('First todo');
            expect(newTodos[0].completed).toBe(false);
            expect(newTodos[0].listId).toBe('list2');
            expect(newTodos[1].id).toBe('new-id-2');
            expect(newTodos[1].text).toBe('Second todo');
            expect(newTodos[1].completed).toBe(false);
        });

        test('should handle default list ID', () => {
            const newTodos = clipboardManager.pasteTodos('default', mockGenerateId);
            
            expect(newTodos[0].listId).toBeNull();
        });

        test('should return empty array when clipboard is empty', () => {
            clipboardManager.clearClipboard();
            
            const newTodos = clipboardManager.pasteTodos('list2', mockGenerateId);
            
            expect(newTodos).toEqual([]);
            expect(console.warn).toHaveBeenCalledWith('No todos in clipboard to paste');
        });
    });

    describe('utility methods', () => {
        test('clearClipboard should clear content', () => {
            clipboardManager.copyTodos(['todo1'], mockTodos, mockOnNotify);
            expect(clipboardManager.isEmpty()).toBe(false);
            
            const result = clipboardManager.clearClipboard();
            
            expect(result).toBe(true);
            expect(clipboardManager.isEmpty()).toBe(true);
            expect(clipboardManager.getCount()).toBe(0);
        });

        test('clearClipboard should return false when already empty', () => {
            const result = clipboardManager.clearClipboard();
            
            expect(result).toBe(false);
        });

        test('containsTodo should check for todo existence', () => {
            clipboardManager.copyTodos(['todo1', 'todo2'], mockTodos, mockOnNotify);
            
            expect(clipboardManager.containsTodo('First todo')).toBe(true);
            expect(clipboardManager.containsTodo('Second todo')).toBe(true);
            expect(clipboardManager.containsTodo('Nonexistent todo')).toBe(false);
        });

        test('getClipboardData should return copy of data', () => {
            clipboardManager.copyTodos(['todo1'], mockTodos, mockOnNotify);
            
            const data = clipboardManager.getClipboardData();
            data[0].text = 'Modified';
            
            // Original should be unchanged
            const originalData = clipboardManager.getClipboardData();
            expect(originalData[0].text).toBe('First todo');
        });
    });

    describe('text formatting', () => {
        beforeEach(() => {
            clipboardManager.copyTodos(['todo1', 'todo2'], mockTodos, mockOnNotify);
        });

        test('toMarkdown should format as markdown', () => {
            const markdown = clipboardManager.toMarkdown();
            
            expect(markdown).toBe('- [ ] First todo\n- [x] Second todo');
        });

        test('toPlainText should format as plain text', () => {
            const plainText = clipboardManager.toPlainText();
            
            expect(plainText).toBe('○ First todo\n✓ Second todo');
        });

        test('should return empty string when clipboard is empty', () => {
            clipboardManager.clearClipboard();
            
            expect(clipboardManager.toMarkdown()).toBe('');
            expect(clipboardManager.toPlainText()).toBe('');
        });
    });

    describe('setClipboardData', () => {
        test('should set clipboard data from external array', () => {
            const externalData = [
                { text: 'External todo 1', completed: false },
                { text: 'External todo 2', completed: true, listId: 'list1' }
            ];
            
            const result = clipboardManager.setClipboardData(externalData);
            
            expect(result).toBe(true);
            expect(clipboardManager.getCount()).toBe(2);
            
            const data = clipboardManager.getClipboardData();
            expect(data[0].text).toBe('External todo 1');
            expect(data[1].text).toBe('External todo 2');
            expect(data[1].listId).toBe('list1');
        });

        test('should return false for invalid data', () => {
            const result1 = clipboardManager.setClipboardData(null);
            const result2 = clipboardManager.setClipboardData('not an array');
            
            expect(result1).toBe(false);
            expect(result2).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Invalid data provided to setClipboardData');
        });

        test('should handle todos with missing properties', () => {
            const externalData = [
                { text: 'Minimal todo' },
                { completed: true },
                {}
            ];
            
            clipboardManager.setClipboardData(externalData);
            
            const data = clipboardManager.getClipboardData();
            expect(data[0].text).toBe('Minimal todo');
            expect(data[0].completed).toBe(false);
            expect(data[1].text).toBe('');
            expect(data[1].completed).toBe(true);
            expect(data[2].text).toBe('');
            expect(data[2].completed).toBe(false);
        });
    });

    describe('statistics', () => {
        test('should calculate statistics correctly', () => {
            clipboardManager.copyTodos(['todo1', 'todo2', 'todo3'], mockTodos, mockOnNotify);
            
            const stats = clipboardManager.getStatistics();
            
            expect(stats.total).toBe(3);
            expect(stats.completed).toBe(1);
            expect(stats.incomplete).toBe(2);
            expect(stats.completionRate).toBe(33);
        });

        test('should handle empty clipboard statistics', () => {
            const stats = clipboardManager.getStatistics();
            
            expect(stats.total).toBe(0);
            expect(stats.completed).toBe(0);
            expect(stats.incomplete).toBe(0);
            expect(stats.completionRate).toBe(0);
        });
    });

    describe('removeDuplicates', () => {
        beforeEach(() => {
            const duplicateData = [
                { text: 'Todo A', completed: false },
                { text: 'Todo B', completed: true },
                { text: 'Todo A', completed: true },
                { text: 'Todo C', completed: false },
                { text: 'Todo B', completed: false }
            ];
            clipboardManager.setClipboardData(duplicateData);
        });

        test('should remove duplicates keeping first occurrence', () => {
            clipboardManager.removeDuplicates('first');
            
            const data = clipboardManager.getClipboardData();
            expect(data).toHaveLength(3);
            expect(data[0].text).toBe('Todo A');
            expect(data[0].completed).toBe(false);
            expect(data[1].text).toBe('Todo B');
            expect(data[1].completed).toBe(true);
            expect(data[2].text).toBe('Todo C');
        });

        test('should remove duplicates keeping last occurrence', () => {
            clipboardManager.removeDuplicates('last');
            
            const data = clipboardManager.getClipboardData();
            expect(data).toHaveLength(3);
            expect(data[0].text).toBe('Todo A');
            expect(data[0].completed).toBe(true);
            expect(data[1].text).toBe('Todo B');
            expect(data[1].completed).toBe(false);
            expect(data[2].text).toBe('Todo C');
        });

        test('should merge completion status', () => {
            clipboardManager.removeDuplicates('merge');
            
            const data = clipboardManager.getClipboardData();
            expect(data).toHaveLength(3);
            expect(data[0].text).toBe('Todo A');
            expect(data[0].completed).toBe(true); // merged: false || true = true
            expect(data[1].text).toBe('Todo B');
            expect(data[1].completed).toBe(true); // merged: true || false = true
        });
    });

    describe('debugPrintClipboard', () => {
        test('should log clipboard contents', () => {
            clipboardManager.copyTodos(['todo1', 'todo2'], mockTodos, mockOnNotify);
            
            clipboardManager.debugPrintClipboard();
            
            expect(console.log).toHaveBeenCalledWith('Clipboard state:');
            expect(console.log).toHaveBeenCalledWith('  Count:', 2);
            expect(console.log).toHaveBeenCalledWith('  1. [ ] First todo');
            expect(console.log).toHaveBeenCalledWith('  2. [✓] Second todo');
        });
    });
});