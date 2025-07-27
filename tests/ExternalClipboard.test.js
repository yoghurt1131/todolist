const ClipboardManager = require('../src/ClipboardManager');

// Mock Electron's clipboard
jest.mock('electron', () => ({
    clipboard: {
        readText: jest.fn(),
        writeText: jest.fn()
    }
}));

describe('External Clipboard Integration', () => {
    let clipboardManager;
    let mockGenerateId;
    const { clipboard } = require('electron');

    beforeEach(() => {
        clipboardManager = new ClipboardManager();
        mockGenerateId = jest.fn(() => `id-${Date.now()}`);
        
        // Clear mocks
        clipboard.readText.mockClear();
        clipboard.writeText.mockClear();
        
        // Mock console methods
        global.console = {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
    });

    describe('pasteFromSystemClipboard', () => {
        test('should create TODOs from plain text lines', () => {
            const clipboardText = `Buy groceries
Call dentist
Finish project report`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(3);
            expect(todos[0].text).toBe('Buy groceries');
            expect(todos[1].text).toBe('Call dentist');
            expect(todos[2].text).toBe('Finish project report');
            expect(todos.every(todo => todo.completed === false)).toBe(true);
        });

        test('should parse markdown checkboxes correctly', () => {
            const clipboardText = `- [ ] Incomplete task
- [x] Completed task
- [X] Another completed task`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('work', mockGenerateId);
            
            expect(todos).toHaveLength(3);
            expect(todos[0].text).toBe('Incomplete task');
            expect(todos[0].completed).toBe(false);
            expect(todos[1].text).toBe('Completed task');
            expect(todos[1].completed).toBe(false); // 外部貼り付けは常に未完了
            expect(todos[2].text).toBe('Another completed task');
            expect(todos[2].completed).toBe(false);
        });

        test('should handle numbered lists', () => {
            const clipboardText = `1. First item
2. Second item
10. Tenth item`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(3);
            expect(todos[0].text).toBe('First item');
            expect(todos[1].text).toBe('Second item');
            expect(todos[2].text).toBe('Tenth item');
        });

        test('should handle bullet points', () => {
            const clipboardText = `* Task with asterisk
+ Task with plus
- Task with dash`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(3);
            expect(todos[0].text).toBe('Task with asterisk');
            expect(todos[1].text).toBe('Task with plus');
            expect(todos[2].text).toBe('Task with dash');
        });

        test('should handle checkmark symbols', () => {
            const clipboardText = `✓ Completed task
○ Uncompleted task
✔ Another completed task`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(3);
            expect(todos[0].text).toBe('Completed task');
            expect(todos[1].text).toBe('Uncompleted task');
            expect(todos[2].text).toBe('Another completed task');
            // All should be false for external paste
            expect(todos.every(todo => todo.completed === false)).toBe(true);
        });

        test('should handle mixed format text', () => {
            const clipboardText = `Task 1
- [ ] Task 2
3. Task 3
* Task 4
✓ Task 5`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(5);
            expect(todos[0].text).toBe('Task 1');
            expect(todos[1].text).toBe('Task 2');
            expect(todos[2].text).toBe('Task 3');
            expect(todos[3].text).toBe('Task 4');
            expect(todos[4].text).toBe('Task 5');
        });

        test('should filter out empty lines', () => {
            const clipboardText = `Task 1

Task 2


Task 3`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(3);
            expect(todos[0].text).toBe('Task 1');
            expect(todos[1].text).toBe('Task 2');
            expect(todos[2].text).toBe('Task 3');
        });

        test('should handle empty clipboard', () => {
            clipboard.readText.mockReturnValue('');
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(0);
        });

        test('should handle whitespace-only clipboard', () => {
            clipboard.readText.mockReturnValue('   \n  \n  ');
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(0);
        });

        test('should truncate very long text', () => {
            const longText = 'A'.repeat(1500); // 1500 characters
            clipboard.readText.mockReturnValue(longText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(1);
            expect(todos[0].text).toHaveLength(1003); // 1000 + '...'
            expect(todos[0].text.endsWith('...')).toBe(true);
        });

        test('should set correct listId for target list', () => {
            const clipboardText = 'Test task';
            clipboard.readText.mockReturnValue(clipboardText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('work', mockGenerateId);
            
            expect(todos).toHaveLength(1);
            expect(todos[0].listId).toBe('work');
        });

        test('should set null listId for default list', () => {
            const clipboardText = 'Test task';
            clipboard.readText.mockReturnValue(clipboardText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(1);
            expect(todos[0].listId).toBe(null);
        });

        test('should handle clipboard read error', () => {
            clipboard.readText.mockImplementation(() => {
                throw new Error('Clipboard access denied');
            });
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(0);
        });

        test('should assign unique IDs to each TODO', () => {
            let idCounter = 0;
            mockGenerateId.mockImplementation(() => `id-${++idCounter}`);
            
            const clipboardText = 'Task 1\nTask 2\nTask 3';
            clipboard.readText.mockReturnValue(clipboardText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(3);
            expect(todos[0].id).toBe('id-1');
            expect(todos[1].id).toBe('id-2');
            expect(todos[2].id).toBe('id-3');
        });

        test('should set createdAt timestamp', () => {
            const clipboardText = 'Test task';
            clipboard.readText.mockReturnValue(clipboardText);
            
            const beforeTime = new Date().toISOString();
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            const afterTime = new Date().toISOString();
            
            expect(todos).toHaveLength(1);
            expect(todos[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            expect(todos[0].createdAt >= beforeTime).toBe(true);
            expect(todos[0].createdAt <= afterTime).toBe(true);
        });
    });

    describe('parseLineToTodo', () => {
        test('should return null for empty or whitespace-only lines', () => {
            expect(clipboardManager.parseLineToTodo('', 'default', mockGenerateId)).toBeNull();
            expect(clipboardManager.parseLineToTodo('   ', 'default', mockGenerateId)).toBeNull();
            expect(clipboardManager.parseLineToTodo('\t\n', 'default', mockGenerateId)).toBeNull();
        });

        test('should preserve original text for unrecognized formats', () => {
            const line = 'Just plain text without special formatting';
            const todo = clipboardManager.parseLineToTodo(line, 'default', mockGenerateId);
            
            expect(todo.text).toBe(line);
            expect(todo.completed).toBe(false);
        });

        test('should handle mixed spacing in markdown checkboxes', () => {
            const tests = [
                { line: '- [x]  Task with extra spaces', expectedText: 'Task with extra spaces' },
                { line: '-  [ ] Task with space before checkbox', expectedText: 'Task with space before checkbox' },
                { line: '- [X] Uppercase X checkbox', expectedText: 'Uppercase X checkbox' }
            ];
            
            tests.forEach(({ line, expectedText }) => {
                const todo = clipboardManager.parseLineToTodo(line, 'default', mockGenerateId);
                expect(todo).not.toBeNull();
                expect(todo.text).toBe(expectedText);
                expect(todo.completed).toBe(false); // Always false for external paste
            });
        });
    });

    describe('Real-world scenarios', () => {
        test('should handle text from Apple Notes', () => {
            // Example text that might be copied from Apple Notes
            const clipboardText = `Shopping List
• Milk
• Bread
• Eggs
• Apples`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(5);
            expect(todos[0].text).toBe('Shopping List');
            expect(todos[1].text).toBe('Milk');
            expect(todos[2].text).toBe('Bread');
            expect(todos[3].text).toBe('Eggs');
            expect(todos[4].text).toBe('Apples');
        });

        test('should handle text from GitHub issues', () => {
            // Example text from GitHub markdown
            const clipboardText = `## TODO List

- [ ] Fix bug in authentication
- [x] Add unit tests
- [ ] Update documentation
- [ ] Deploy to staging`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(5);
            expect(todos[0].text).toBe('## TODO List');
            expect(todos[1].text).toBe('Fix bug in authentication');
            expect(todos[2].text).toBe('Add unit tests');
            expect(todos[3].text).toBe('Update documentation');
            expect(todos[4].text).toBe('Deploy to staging');
        });

        test('should handle email content', () => {
            // Example text that might be copied from an email
            const clipboardText = `Tomorrow's agenda:

1. Team meeting at 9 AM
2. Review project proposal
3. Call client about requirements
4. Prepare presentation slides`;
            
            clipboard.readText.mockReturnValue(clipboardText);
            
            const todos = clipboardManager.pasteFromSystemClipboard('default', mockGenerateId);
            
            expect(todos).toHaveLength(5);
            expect(todos[0].text).toBe("Tomorrow's agenda:");
            expect(todos[1].text).toBe('Team meeting at 9 AM');
            expect(todos[2].text).toBe('Review project proposal');
            expect(todos[3].text).toBe('Call client about requirements');
            expect(todos[4].text).toBe('Prepare presentation slides');
        });
    });
});