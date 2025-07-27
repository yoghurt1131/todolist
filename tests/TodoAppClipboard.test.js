const TodoApp = require('../src/TodoApp');
const fs = require('fs');

// Mock document at top level to ensure typeof document works
const mockAddEventListener = jest.fn();
global.document = {
    addEventListener: mockAddEventListener,
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    getElementById: jest.fn(() => null)
};

// Mock navigator for platform detection
Object.defineProperty(global.navigator, 'platform', {
    value: 'MacIntel',
    configurable: true
});

// Mock file system
jest.mock('fs');

// Mock Electron modules
jest.mock('electron', () => ({
    ipcRenderer: {
        invoke: jest.fn()
    },
    clipboard: {
        readText: jest.fn(),
        writeText: jest.fn()
    }
}));

describe('TodoApp External Clipboard Integration', () => {
    let todoApp;
    let mockDataPath;
    const { clipboard } = require('electron');

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        mockAddEventListener.mockClear();
        fs.__clearMockFileData();
        fs.writeFileSync.mockImplementation(() => {});
        
        mockDataPath = '/test/tododata.json';
        todoApp = new TodoApp(mockDataPath);
    });

    describe('pasteClipboardTodos', () => {
        beforeEach(async () => {
            fs.existsSync.mockReturnValue(false);
            await todoApp.initializeApp();
            
            // Clear mock calls from setup
            fs.writeFileSync.mockClear();
        });

        test('should paste from system clipboard when internal clipboard is empty', () => {
            const clipboardText = `Task from external app
Another task from external app`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const initialCount = todoApp.todos.length;
            todoApp.pasteClipboardTodos();
            
            expect(todoApp.todos.length).toBe(initialCount + 2);
            expect(todoApp.todos[initialCount].text).toBe('Task from external app');
            expect(todoApp.todos[initialCount + 1].text).toBe('Another task from external app');
            
            // Should save data
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        test('should prefer internal clipboard over system clipboard', () => {
            const clipboardText = 'External task';
            clipboard.readText.mockReturnValue(clipboardText);
            
            // Add something to internal clipboard
            const internalTodo = todoApp.addTodoFromText('Internal task');
            
            // Select and copy the todo
            todoApp.selectionManager.clearSelection();
            todoApp.selectionManager.selectTodo(internalTodo.id, false, false);
            todoApp.copySelectedTodos();
            
            const initialCount = todoApp.todos.length;
            todoApp.pasteClipboardTodos();
            
            // Should paste from internal clipboard, not system
            const newTodo = todoApp.todos[todoApp.todos.length - 1];
            expect(newTodo.text).toBe('Internal task');
            expect(newTodo.completed).toBe(false);
        });

        test('should handle markdown format from external apps', () => {
            const clipboardText = `- [ ] Incomplete task from external
- [x] Completed task from external
- Another plain task`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const initialCount = todoApp.todos.length;
            todoApp.pasteClipboardTodos();
            
            expect(todoApp.todos.length).toBe(initialCount + 3);
            expect(todoApp.todos[initialCount].text).toBe('Incomplete task from external');
            expect(todoApp.todos[initialCount + 1].text).toBe('Completed task from external');
            expect(todoApp.todos[initialCount + 2].text).toBe('Another plain task');
            
            // All should be uncompleted when pasted from external
            expect(todoApp.todos[initialCount].completed).toBe(false);
            expect(todoApp.todos[initialCount + 1].completed).toBe(false);
            expect(todoApp.todos[initialCount + 2].completed).toBe(false);
        });

        test('should assign order values to pasted todos', () => {
            const clipboardText = `First pasted task
Second pasted task`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const initialCount = todoApp.todos.length;
            todoApp.pasteClipboardTodos();
            
            const newTodos = todoApp.todos.slice(initialCount);
            expect(newTodos[0].order).toBeDefined();
            expect(newTodos[1].order).toBeDefined();
            expect(typeof newTodos[0].order).toBe('number');
            expect(typeof newTodos[1].order).toBe('number');
        });

        test('should select pasted todos after paste', () => {
            const clipboardText = `Task to select 1
Task to select 2`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            todoApp.pasteClipboardTodos();
            
            const selectedIds = todoApp.selectionManager.getSelectedIds();
            expect(selectedIds.length).toBe(2);
            
            // Check that selected todos match the pasted ones
            const pastedTodos = todoApp.todos.slice(-2);
            expect(selectedIds.includes(pastedTodos[0].id)).toBe(true);
            expect(selectedIds.includes(pastedTodos[1].id)).toBe(true);
        });

        test('should add paste operation to undo stack', () => {
            const clipboardText = 'Task for undo test';
            clipboard.readText.mockReturnValue(clipboardText);
            
            const initialUndoCount = todoApp.undoManager.getHistoryCount();
            todoApp.pasteClipboardTodos();
            
            expect(todoApp.undoManager.getHistoryCount()).toBe(initialUndoCount + 1);
            expect(todoApp.undoManager.getLastActionType()).toBe('pasteTodos');
        });

        test('should handle empty system clipboard gracefully', () => {
            clipboard.readText.mockReturnValue('');
            
            const initialCount = todoApp.todos.length;
            todoApp.pasteClipboardTodos();
            
            // Should not add any todos
            expect(todoApp.todos.length).toBe(initialCount);
            
            // Should not save data
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should handle clipboard read error gracefully', () => {
            clipboard.readText.mockImplementation(() => {
                throw new Error('Clipboard access denied');
            });
            
            const initialCount = todoApp.todos.length;
            
            // Should not throw error
            expect(() => todoApp.pasteClipboardTodos()).not.toThrow();
            
            // Should not add any todos
            expect(todoApp.todos.length).toBe(initialCount);
        });

        test('should paste to current list', () => {
            const clipboardText = 'Task for specific list';
            clipboard.readText.mockReturnValue(clipboardText);
            
            // Switch to a specific list
            todoApp.addListFromName('Work');
            const workListId = todoApp.lists.find(l => l.name === 'Work').id;
            todoApp.currentListId = workListId;
            
            todoApp.pasteClipboardTodos();
            
            const pastedTodo = todoApp.todos[todoApp.todos.length - 1];
            expect(pastedTodo.listId).toBe(workListId);
        });

        test('should paste to default list when current is default', () => {
            const clipboardText = 'Task for default list';
            clipboard.readText.mockReturnValue(clipboardText);
            
            todoApp.currentListId = 'default';
            todoApp.pasteClipboardTodos();
            
            const pastedTodo = todoApp.todos[todoApp.todos.length - 1];
            expect(pastedTodo.listId).toBe(null); // null means default list
        });
    });

    describe('Keyboard shortcut integration', () => {
        let keydownHandler;

        beforeEach(async () => {
            fs.existsSync.mockReturnValue(false);
            
            await todoApp.initializeApp();
            
            // Get the keydown handler from mock calls
            const keydownCall = mockAddEventListener.mock.calls
                .find(call => call[0] === 'keydown');
            keydownHandler = keydownCall ? keydownCall[1] : null;
        });

        test('should register Cmd+V keyboard shortcut', () => {
            // Debug: Check if document is available and typeof
            console.log('In test - typeof document:', typeof document);
            console.log('In test - document exists:', !!document);
            console.log('In test - addEventListener calls:', mockAddEventListener.mock.calls.length);
            console.log('In test - All calls:', mockAddEventListener.mock.calls);
            
            expect(mockAddEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
        });

        test('should call pasteClipboardTodos on Cmd+V', () => {
            if (!keydownHandler) {
                throw new Error('Keydown handler not found');
            }
            
            const clipboardText = 'Task from Cmd+V';
            clipboard.readText.mockReturnValue(clipboardText);
            
            // Spy on pasteClipboardTodos
            const pasteSpied = jest.spyOn(todoApp, 'pasteClipboardTodos');
            
            // Simulate Cmd+V on Mac
            const mockEvent = {
                target: { tagName: 'DIV' }, // Not an input field
                metaKey: true,
                key: 'v',
                preventDefault: jest.fn()
            };
            
            keydownHandler(mockEvent);
            
            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(pasteSpied).toHaveBeenCalled();
        });

        test('should not trigger on Cmd+V when input is focused', () => {
            if (!keydownHandler) {
                throw new Error('Keydown handler not found');
            }
            
            // Spy on pasteClipboardTodos
            const pasteSpied = jest.spyOn(todoApp, 'pasteClipboardTodos');
            
            // Simulate Cmd+V while input is focused
            const mockEvent = {
                target: { tagName: 'INPUT' }, // Input field is focused
                metaKey: true,
                key: 'v',
                preventDefault: jest.fn()
            };
            
            keydownHandler(mockEvent);
            
            // Should not prevent default or call paste
            expect(mockEvent.preventDefault).not.toHaveBeenCalled();
            expect(pasteSpied).not.toHaveBeenCalled();
        });
    });

    describe('Undo integration for paste operations', () => {
        beforeEach(async () => {
            fs.existsSync.mockReturnValue(false);
            await todoApp.initializeApp();
            fs.writeFileSync.mockClear();
        });

        test('should be able to undo paste operation', () => {
            const clipboardText = `Undo test task 1
Undo test task 2`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const initialCount = todoApp.todos.length;
            
            // Paste todos
            todoApp.pasteClipboardTodos();
            expect(todoApp.todos.length).toBe(initialCount + 2);
            
            // Clear save calls from paste
            fs.writeFileSync.mockClear();
            
            // Undo the paste operation
            const undoSuccess = todoApp.undo();
            
            expect(undoSuccess).toBe(true);
            expect(todoApp.todos.length).toBe(initialCount);
            expect(fs.writeFileSync).toHaveBeenCalled(); // Should save after undo
        });
    });
});