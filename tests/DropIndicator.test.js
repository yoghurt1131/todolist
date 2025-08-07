const TodoApp = require('../src/TodoApp');
const fs = require('fs');

// Mock file system
jest.mock('fs');

// Mock Electron modules
jest.mock('electron', () => ({
    ipcRenderer: {
        invoke: jest.fn()
    }
}));

// Mock document and DOM methods
const mockCreateElement = jest.fn();
const mockQuerySelector = jest.fn();

global.document = {
    addEventListener: jest.fn(),
    querySelector: mockQuerySelector,
    querySelectorAll: jest.fn(() => []),
    getElementById: jest.fn(() => null),
    createElement: mockCreateElement
};

describe('Drop Indicator Functionality', () => {
    let todoApp;
    let mockDataPath;
    let mockContainer;
    let mockIndicator;

    beforeEach(() => {
        jest.clearAllMocks();
        fs.__clearMockFileData();
        fs.writeFileSync.mockImplementation(() => {});
        
        mockDataPath = '/test/tododata.json';
        todoApp = new TodoApp(mockDataPath);

        // Mock DOM elements
        mockIndicator = {
            className: '',
            remove: jest.fn()
        };

        mockContainer = {
            insertBefore: jest.fn(),
            appendChild: jest.fn(),
            querySelectorAll: jest.fn(() => [])
        };

        // Mock document methods
        mockCreateElement.mockReturnValue(mockIndicator);
        mockQuerySelector.mockReturnValue(null);
    });

    beforeEach(async () => {
        fs.existsSync.mockReturnValue(false);
        await todoApp.initializeApp();
        fs.writeFileSync.mockClear();
    });

    describe('showDropIndicator', () => {
        test('should create and add drop indicator element', () => {
            const afterElement = { id: 'mock-todo' };

            todoApp.showDropIndicator(mockContainer, afterElement);

            expect(mockCreateElement).toHaveBeenCalledWith('div');
            expect(mockIndicator.className).toBe('drop-indicator');
            expect(mockContainer.insertBefore).toHaveBeenCalledWith(mockIndicator, afterElement);
        });

        test('should append indicator to container when no afterElement provided', () => {
            todoApp.showDropIndicator(mockContainer, null);

            expect(mockCreateElement).toHaveBeenCalledWith('div');
            expect(mockIndicator.className).toBe('drop-indicator');
            expect(mockContainer.appendChild).toHaveBeenCalledWith(mockIndicator);
        });

        test('should hide existing indicator before showing new one', () => {
            const existingIndicator = { remove: jest.fn() };
            mockQuerySelector.mockReturnValue(existingIndicator);

            todoApp.showDropIndicator(mockContainer, null);

            expect(existingIndicator.remove).toHaveBeenCalled();
            expect(mockCreateElement).toHaveBeenCalledWith('div');
        });
    });

    describe('hideDropIndicator', () => {
        test('should remove existing drop indicator', () => {
            const mockIndicatorElement = { remove: jest.fn() };
            mockQuerySelector.mockReturnValue(mockIndicatorElement);

            todoApp.hideDropIndicator();

            expect(mockQuerySelector).toHaveBeenCalledWith('.drop-indicator');
            expect(mockIndicatorElement.remove).toHaveBeenCalled();
        });

        test('should not throw error when no indicator exists', () => {
            mockQuerySelector.mockReturnValue(null);

            expect(() => todoApp.hideDropIndicator()).not.toThrow();
        });
    });

    describe('getDragAfterElement', () => {
        test('should return closest element after drag position', () => {
            const mockElements = [
                {
                    getBoundingClientRect: () => ({ top: 100, height: 50 })
                },
                {
                    getBoundingClientRect: () => ({ top: 200, height: 50 })
                }
            ];

            mockContainer.querySelectorAll.mockReturnValue(mockElements);

            // Test Y position between elements
            const result = todoApp.getDragAfterElement(mockContainer, 175);

            // Should return the second element as it's after the drag position
            expect(result).toBe(mockElements[1]);
        });

        test('should return null when dragging at the end', () => {
            const mockElements = [
                {
                    getBoundingClientRect: () => ({ top: 100, height: 50 })
                }
            ];

            mockContainer.querySelectorAll.mockReturnValue(mockElements);

            // Test Y position below all elements
            const result = todoApp.getDragAfterElement(mockContainer, 300);

            expect(result).toBe(null);
        });

        test('should handle empty container', () => {
            mockContainer.querySelectorAll.mockReturnValue([]);

            const result = todoApp.getDragAfterElement(mockContainer, 100);

            expect(result).toBe(null);
        });
    });

    describe('Drop indicator integration', () => {
        test('should show indicator during dragover and hide after drop', () => {
            const existingIndicator = { remove: jest.fn() };
            mockQuerySelector.mockReturnValue(existingIndicator);

            // Simulate dragover
            todoApp.showDropIndicator(mockContainer, null);
            expect(existingIndicator.remove).toHaveBeenCalled();
            expect(mockContainer.appendChild).toHaveBeenCalledWith(mockIndicator);

            // Simulate drop
            todoApp.hideDropIndicator();
            // Note: hideDropIndicator creates a new query, so we need to mock it again
            const dropIndicator = { remove: jest.fn() };
            mockQuerySelector.mockReturnValue(dropIndicator);
            todoApp.hideDropIndicator();
            expect(dropIndicator.remove).toHaveBeenCalled();
        });
    });
});