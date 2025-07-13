const InlineEditor = require('../src/InlineEditor');

// Mock DOM methods
const mockElement = {
    style: { display: '' },
    parentNode: {
        insertBefore: jest.fn(),
        removeChild: jest.fn()
    },
    nextSibling: null
};

const mockInput = {
    type: 'text',
    value: '',
    className: '',
    classList: {
        add: jest.fn(),
        contains: jest.fn(() => true)
    },
    focus: jest.fn(),
    select: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    parentNode: {
        removeChild: jest.fn()
    },
    _editorEvents: null,
    dispatchEvent: jest.fn()
};

global.document = {
    querySelector: jest.fn().mockReturnValue(null),
    createElement: jest.fn(() => ({ ...mockInput }))
};

global.setTimeout = jest.fn();
global.clearTimeout = jest.fn();

// Mock console methods
global.console = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

describe('InlineEditor', () => {
    let inlineEditor;
    let mockOnComplete;
    let mockOnCancel;

    beforeEach(() => {
        inlineEditor = new InlineEditor();
        mockOnComplete = jest.fn();
        mockOnCancel = jest.fn();
        
        // Reset mocks
        jest.clearAllMocks();
        document.querySelector = jest.fn().mockReturnValue(null);
    });

    describe('constructor', () => {
        test('should initialize with empty state', () => {
            expect(inlineEditor.isCurrentlyEditing()).toBe(false);
            expect(inlineEditor.getCurrentEditingInfo()).toBeNull();
            expect(inlineEditor.clickTimeout).toBeNull();
        });
    });

    describe('startEditingTodo', () => {
        test('should return false when element not found', () => {
            document.querySelector.mockReturnValue(null);
            
            const result = inlineEditor.startEditingTodo('todo1', 'text', mockOnComplete, mockOnCancel);
            
            expect(result).toBe(false);
            expect(inlineEditor.isCurrentlyEditing()).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Todo element not found for editing:', 'todo1');
        });

        test('should start editing when element found', () => {
            document.querySelector.mockReturnValue({ ...mockElement });
            
            const result = inlineEditor.startEditingTodo('todo1', 'Original text', mockOnComplete, mockOnCancel);
            
            expect(result).toBe(true);
            expect(inlineEditor.isCurrentlyEditing()).toBe(true);
            expect(inlineEditor.isEditingElement('todo', 'todo1')).toBe(true);
            
            const editInfo = inlineEditor.getCurrentEditingInfo();
            expect(editInfo.type).toBe('todo');
            expect(editInfo.id).toBe('todo1');
            expect(editInfo.originalText).toBe('Original text');
        });

        test('should cancel existing edit when starting new one', () => {
            document.querySelector.mockReturnValue({ ...mockElement });
            
            // Start first edit
            inlineEditor.startEditingTodo('todo1', 'text1', jest.fn(), jest.fn());
            
            // Start second edit
            inlineEditor.startEditingTodo('todo2', 'text2', mockOnComplete, mockOnCancel);
            
            expect(inlineEditor.isEditingElement('todo', 'todo2')).toBe(true);
        });
    });

    describe('startEditingList', () => {
        test('should return false when element not found', () => {
            document.querySelector.mockReturnValue(null);
            
            const result = inlineEditor.startEditingList('list1', 'text', mockOnComplete, mockOnCancel);
            
            expect(result).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('List element not found for editing:', 'list1');
        });

        test('should start editing when element found', () => {
            document.querySelector.mockReturnValue({ ...mockElement });
            
            const result = inlineEditor.startEditingList('list1', 'List name', mockOnComplete, mockOnCancel);
            
            expect(result).toBe(true);
            expect(inlineEditor.isCurrentlyEditing()).toBe(true);
            expect(inlineEditor.isEditingElement('list', 'list1')).toBe(true);
        });
    });

    describe('completeEditing', () => {
        test('should return false when not editing', () => {
            const result = inlineEditor.completeEditing();
            expect(result).toBe(false);
        });

        test('should complete editing with changes', () => {
            document.querySelector.mockReturnValue({ ...mockElement });
            
            inlineEditor.startEditingTodo('todo1', 'Original', mockOnComplete, mockOnCancel);
            
            // Mock the input element with changed value
            inlineEditor.editingState.inputElement = {
                value: 'Changed text',
                parentNode: { removeChild: jest.fn() },
                _editorEvents: null
            };
            
            const result = inlineEditor.completeEditing();
            
            expect(result).toBe(true);
            expect(mockOnComplete).toHaveBeenCalledWith('todo1', 'Changed text');
            expect(inlineEditor.isCurrentlyEditing()).toBe(false);
        });

        test('should complete editing without changes', () => {
            document.querySelector.mockReturnValue({ ...mockElement });
            
            inlineEditor.startEditingTodo('todo1', 'Original', mockOnComplete, mockOnCancel);
            
            // Mock the input element with same value
            inlineEditor.editingState.inputElement = {
                value: 'Original',
                parentNode: { removeChild: jest.fn() },
                _editorEvents: null
            };
            
            const result = inlineEditor.completeEditing();
            
            expect(result).toBe(false);
            expect(mockOnComplete).not.toHaveBeenCalled();
            expect(inlineEditor.isCurrentlyEditing()).toBe(false);
        });

        test('should not save empty text', () => {
            document.querySelector.mockReturnValue({ ...mockElement });
            
            inlineEditor.startEditingTodo('todo1', 'Original', mockOnComplete, mockOnCancel);
            
            // Mock the input element with empty value
            inlineEditor.editingState.inputElement = {
                value: '   ',
                parentNode: { removeChild: jest.fn() },
                _editorEvents: null
            };
            
            const result = inlineEditor.completeEditing();
            
            expect(result).toBe(false);
            expect(mockOnComplete).not.toHaveBeenCalled();
        });
    });

    describe('cancelEditing', () => {
        test('should return false when not editing', () => {
            const result = inlineEditor.cancelEditing();
            expect(result).toBe(false);
        });

        test('should cancel editing', () => {
            document.querySelector.mockReturnValue({ ...mockElement });
            
            inlineEditor.startEditingTodo('todo1', 'Original', mockOnComplete, mockOnCancel);
            
            const result = inlineEditor.cancelEditing();
            
            expect(result).toBe(true);
            expect(mockOnCancel).toHaveBeenCalledWith('todo1');
            expect(inlineEditor.isCurrentlyEditing()).toBe(false);
        });
    });

    describe('handleClick', () => {
        beforeEach(() => {
            document.querySelector.mockReturnValue({ ...mockElement });
        });

        test('should return false on first click', () => {
            const result = inlineEditor.handleClick('todo1', 'todo', 'text', mockOnComplete, mockOnCancel);
            
            expect(result).toBe(false);
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 300);
        });

        test('should return true on double click', () => {
            // First click - sets timeout
            const result1 = inlineEditor.handleClick('todo1', 'todo', 'text', mockOnComplete, mockOnCancel);
            expect(result1).toBe(false);
            
            // Simulate that timeout is set (the mock doesn't actually set clickTimeout)
            inlineEditor.clickTimeout = 'mock-timeout';
            
            // Second click (double click)
            const result2 = inlineEditor.handleClick('todo1', 'todo', 'text', mockOnComplete, mockOnCancel);
            
            expect(result2).toBe(true);
            expect(clearTimeout).toHaveBeenCalled();
            expect(inlineEditor.isCurrentlyEditing()).toBe(true);
        });

        test('should handle list double click', () => {
            // First click
            const result1 = inlineEditor.handleClick('list1', 'list', 'List name', mockOnComplete, mockOnCancel);
            expect(result1).toBe(false);
            
            // Simulate timeout is set
            inlineEditor.clickTimeout = 'mock-timeout';
            
            // Second click (double click)
            const result2 = inlineEditor.handleClick('list1', 'list', 'List name', mockOnComplete, mockOnCancel);
            
            expect(result2).toBe(true);
            expect(inlineEditor.isEditingElement('list', 'list1')).toBe(true);
        });
    });

    describe('utility methods', () => {
        test('isCurrentlyEditing should return correct status', () => {
            expect(inlineEditor.isCurrentlyEditing()).toBe(false);
            
            document.querySelector.mockReturnValue({ ...mockElement });
            inlineEditor.startEditingTodo('todo1', 'text', mockOnComplete, mockOnCancel);
            
            expect(inlineEditor.isCurrentlyEditing()).toBe(true);
        });

        test('getCurrentEditingInfo should return correct info', () => {
            expect(inlineEditor.getCurrentEditingInfo()).toBeNull();
            
            document.querySelector.mockReturnValue({ ...mockElement });
            inlineEditor.startEditingTodo('todo1', 'Original text', mockOnComplete, mockOnCancel);
            
            const info = inlineEditor.getCurrentEditingInfo();
            expect(info.type).toBe('todo');
            expect(info.id).toBe('todo1');
            expect(info.originalText).toBe('Original text');
        });

        test('isEditingElement should return correct status', () => {
            expect(inlineEditor.isEditingElement('todo', 'todo1')).toBe(false);
            
            document.querySelector.mockReturnValue({ ...mockElement });
            inlineEditor.startEditingTodo('todo1', 'text', mockOnComplete, mockOnCancel);
            
            expect(inlineEditor.isEditingElement('todo', 'todo1')).toBe(true);
            expect(inlineEditor.isEditingElement('todo', 'todo2')).toBe(false);
            expect(inlineEditor.isEditingElement('list', 'todo1')).toBe(false);
        });

        test('debugPrintState should log current state', () => {
            inlineEditor.debugPrintState();
            
            expect(console.log).toHaveBeenCalledWith('InlineEditor state:');
            expect(console.log).toHaveBeenCalledWith('  Is editing:', false);
            expect(console.log).toHaveBeenCalledWith('  Type:', null);
            expect(console.log).toHaveBeenCalledWith('  ID:', null);
            expect(console.log).toHaveBeenCalledWith('  Original text:', null);
            expect(console.log).toHaveBeenCalledWith('  Has timeout:', false);
        });
    });

    describe('edge cases', () => {
        test('should handle cleanup with missing elements', () => {
            // Set up editing state manually
            inlineEditor.editingState = {
                type: 'todo',
                id: 'nonexistent',
                originalText: 'text',
                inputElement: null,
                onComplete: mockOnComplete,
                onCancel: mockOnCancel
            };
            inlineEditor.isEditing = true;
            
            expect(() => inlineEditor._cleanupEditing()).not.toThrow();
            expect(inlineEditor.isCurrentlyEditing()).toBe(false);
        });

        test('should handle cleanup with input element but no parent', () => {
            inlineEditor.editingState = {
                type: 'todo',
                id: 'todo1',
                originalText: 'text',
                inputElement: {
                    _editorEvents: {
                        keydown: jest.fn(),
                        blur: jest.fn()
                    },
                    removeEventListener: jest.fn(),
                    parentNode: null
                },
                onComplete: mockOnComplete,
                onCancel: mockOnCancel
            };
            inlineEditor.isEditing = true;
            
            expect(() => inlineEditor._cleanupEditing()).not.toThrow();
        });
    });
});