const TodoApp = require('../src/TodoApp');

// Mock fs module
jest.mock('fs');

describe('TodoApp Double-Click Editing', () => {
    let todoApp;
    let createElementSpy;
    let mockInput;
    let mockElements;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Create mock input element that will be returned by createElement
        mockInput = {
            type: '',
            className: '',
            value: '',
            focus: jest.fn(),
            select: jest.fn(),
            addEventListener: jest.fn()
        };

        // Create mock DOM elements
        mockElements = {
            todoText: {
                classList: {
                    add: jest.fn(),
                    remove: jest.fn(),
                    contains: jest.fn(() => false)
                },
                innerHTML: '',
                appendChild: jest.fn()
            },
            listName: {
                classList: {
                    add: jest.fn(),
                    remove: jest.fn(),
                    contains: jest.fn(() => false)
                },
                innerHTML: '',
                appendChild: jest.fn()
            }
        };

        // Mock createElement
        createElementSpy = jest.fn((tagName) => {
            if (tagName === 'input') {
                return mockInput;
            }
            return null;
        });

        // Set up global document mock
        global.document = {
            createElement: createElementSpy,
            getElementById: jest.fn(),
            querySelector: jest.fn(),
            addEventListener: jest.fn()
        };

        todoApp = new TodoApp('/test/tododata.json');
        todoApp.initializeApp();
    });

    describe('TODO Double-Click Editing', () => {
        test('should start editing todo on double-click', () => {
            const todo = todoApp.addTodoFromText('Test TODO');
            
            // Debug: Check if document is set up correctly
            expect(global.document).toBeDefined();
            expect(typeof global.document).toBe('object');
            
            todoApp.startEditingTodo(todo.id, mockElements.todoText);
            
            // Should create input element
            expect(createElementSpy).toHaveBeenCalledWith('input');
            expect(mockInput.type).toBe('text');
            expect(mockInput.className).toBe('edit-input');
            expect(mockInput.value).toBe('Test TODO');
            
            // Should add editing class and append input
            expect(mockElements.todoText.classList.add).toHaveBeenCalledWith('editing');
            expect(mockElements.todoText.appendChild).toHaveBeenCalledWith(mockInput);
            
            // Should focus and select the input
            expect(mockInput.focus).toHaveBeenCalled();
            expect(mockInput.select).toHaveBeenCalled();
        });

        test('should save todo changes on Enter key', () => {
            const todo = todoApp.addTodoFromText('Original TODO');
            
            todoApp.startEditingTodo(todo.id, mockElements.todoText);
            
            // Simulate user typing new text
            mockInput.value = 'Updated TODO';
            
            // Get the keypress handler that was added
            const keyPressCall = mockInput.addEventListener.mock.calls.find(call => call[0] === 'keypress');
            expect(keyPressCall).toBeTruthy();
            
            const keyPressHandler = keyPressCall[1];
            
            // Simulate Enter key press
            keyPressHandler({ key: 'Enter', preventDefault: jest.fn() });
            
            // Should update the todo
            const updatedTodo = todoApp.todos.find(t => t.id === todo.id);
            expect(updatedTodo.text).toBe('Updated TODO');
        });

        test('should cancel todo editing on Escape key', () => {
            const todo = todoApp.addTodoFromText('Original TODO');
            const originalText = todo.text;
            
            todoApp.startEditingTodo(todo.id, mockElements.todoText);
            
            // Simulate user typing new text
            mockInput.value = 'Changed text';
            
            // Get the keypress handler
            const keyPressCall = mockInput.addEventListener.mock.calls.find(call => call[0] === 'keypress');
            const keyPressHandler = keyPressCall[1];
            
            // Simulate Escape key press
            keyPressHandler({ key: 'Escape', preventDefault: jest.fn() });
            
            // Should not update the todo
            const unchangedTodo = todoApp.todos.find(t => t.id === todo.id);
            expect(unchangedTodo.text).toBe(originalText);
            
            // Should end editing mode
            expect(mockElements.todoText.classList.remove).toHaveBeenCalledWith('editing');
        });

        test('should save todo changes on blur', () => {
            const todo = todoApp.addTodoFromText('Original TODO');
            
            todoApp.startEditingTodo(todo.id, mockElements.todoText);
            
            // Simulate user typing new text
            mockInput.value = 'Blur Updated TODO';
            
            // Get the blur handler
            const blurCall = mockInput.addEventListener.mock.calls.find(call => call[0] === 'blur');
            expect(blurCall).toBeTruthy();
            
            const blurHandler = blurCall[1];
            blurHandler();
            
            // Should update the todo
            const updatedTodo = todoApp.todos.find(t => t.id === todo.id);
            expect(updatedTodo.text).toBe('Blur Updated TODO');
        });

        test('should not save empty todo text', () => {
            const todo = todoApp.addTodoFromText('Original TODO');
            const originalText = todo.text;
            
            todoApp.startEditingTodo(todo.id, mockElements.todoText);
            
            // Simulate user clearing text
            mockInput.value = '   ';
            
            // Get the keypress handler
            const keyPressCall = mockInput.addEventListener.mock.calls.find(call => call[0] === 'keypress');
            const keyPressHandler = keyPressCall[1];
            
            // Simulate Enter key press
            keyPressHandler({ key: 'Enter', preventDefault: jest.fn() });
            
            // Should not update the todo
            const unchangedTodo = todoApp.todos.find(t => t.id === todo.id);
            expect(unchangedTodo.text).toBe(originalText);
        });
    });

    describe('List Double-Click Editing', () => {
        test('should start editing list name on double-click', () => {
            const list = todoApp.addListFromName('Test List');
            
            todoApp.startEditingList(list.id, mockElements.listName);
            
            // Should create input element
            expect(createElementSpy).toHaveBeenCalledWith('input');
            expect(mockInput.type).toBe('text');
            expect(mockInput.className).toBe('edit-input');
            expect(mockInput.value).toBe('Test List');
            
            // Should add editing class and append input
            expect(mockElements.listName.classList.add).toHaveBeenCalledWith('editing');
            expect(mockElements.listName.appendChild).toHaveBeenCalledWith(mockInput);
        });

        test('should save list name changes on Enter key', () => {
            const list = todoApp.addListFromName('Original List');
            
            todoApp.startEditingList(list.id, mockElements.listName);
            
            // Simulate user typing new name
            mockInput.value = 'Updated List';
            
            // Get the keypress handler
            const keyPressCall = mockInput.addEventListener.mock.calls.find(call => call[0] === 'keypress');
            const keyPressHandler = keyPressCall[1];
            
            // Simulate Enter key press
            keyPressHandler({ key: 'Enter', preventDefault: jest.fn() });
            
            // Should update the list
            const updatedList = todoApp.lists.find(l => l.id === list.id);
            expect(updatedList.name).toBe('Updated List');
        });

        test('should not edit default list', () => {
            createElementSpy.mockClear();
            
            todoApp.startEditingList('default', mockElements.listName);
            
            // Should not create input element
            expect(createElementSpy).not.toHaveBeenCalled();
            expect(mockElements.listName.classList.add).not.toHaveBeenCalled();
        });

        test('should cancel list editing on Escape key', () => {
            const list = todoApp.addListFromName('Original List');
            const originalName = list.name;
            
            todoApp.startEditingList(list.id, mockElements.listName);
            
            // Simulate user typing new name
            mockInput.value = 'Changed name';
            
            // Get the keypress handler
            const keyPressCall = mockInput.addEventListener.mock.calls.find(call => call[0] === 'keypress');
            const keyPressHandler = keyPressCall[1];
            
            // Simulate Escape key press
            keyPressHandler({ key: 'Escape', preventDefault: jest.fn() });
            
            // Should not update the list
            const unchangedList = todoApp.lists.find(l => l.id === list.id);
            expect(unchangedList.name).toBe(originalName);
            
            // Should end editing mode
            expect(mockElements.listName.classList.remove).toHaveBeenCalledWith('editing');
        });
    });

    describe('Error Handling', () => {
        test('should handle editing non-existent todo gracefully', () => {
            createElementSpy.mockClear();
            
            expect(() => {
                todoApp.startEditingTodo('nonexistent', mockElements.todoText);
            }).not.toThrow();
            
            expect(createElementSpy).not.toHaveBeenCalled();
        });

        test('should handle editing non-existent list gracefully', () => {
            createElementSpy.mockClear();
            
            expect(() => {
                todoApp.startEditingList('nonexistent', mockElements.listName);
            }).not.toThrow();
            
            expect(createElementSpy).not.toHaveBeenCalled();
        });

        test('should handle null elements gracefully', () => {
            expect(() => {
                todoApp.endEditingTodo(null, 'test');
                todoApp.endEditingList(null, 'test');
            }).not.toThrow();
        });
    });
});