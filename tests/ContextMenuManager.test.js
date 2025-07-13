const ContextMenuManager = require('../src/ContextMenuManager');

// Mock DOM environment
const mockContextMenu = {
    classList: {
        remove: jest.fn(),
        add: jest.fn()
    },
    style: {
        left: '',
        top: ''
    },
    getBoundingClientRect: jest.fn(() => ({
        right: 200,
        bottom: 300,
        width: 150,
        height: 200,
        left: 50,
        top: 100
    })),
    contains: jest.fn(() => false)
};

const mockSelectedTodoCount = {
    textContent: ''
};

const mockContextMenuLists = {
    innerHTML: '',
    appendChild: jest.fn(),
    querySelectorAll: jest.fn(() => [])
};

global.document = {
    getElementById: jest.fn((id) => {
        switch (id) {
            case 'todoContextMenu': return mockContextMenu;
            case 'selectedTodoCount': return mockSelectedTodoCount;
            case 'contextMenuLists': return mockContextMenuLists;
            default: return null;
        }
    }),
    createElement: jest.fn(() => ({
        className: '',
        classList: {
            add: jest.fn()
        },
        innerHTML: '',
        addEventListener: jest.fn(),
        style: {}
    })),
    addEventListener: jest.fn(),
    querySelectorAll: jest.fn(() => [])
};

global.window = {
    innerWidth: 1920,
    innerHeight: 1080
};

global.requestAnimationFrame = jest.fn(cb => cb());

// Mock console methods
global.console = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

describe('ContextMenuManager', () => {
    let contextMenuManager;
    let mockTodos;
    let mockLists;
    let mockOnMoveToList;

    beforeEach(() => {
        contextMenuManager = new ContextMenuManager();
        mockOnMoveToList = jest.fn();
        
        // Mock data
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
            }
        ];

        mockLists = [
            { id: 'default', name: 'すべて' },
            { id: 'list1', name: '仕事' },
            { id: 'list2', name: 'プライベート' }
        ];

        // Reset mocks
        jest.clearAllMocks();
        mockContextMenuLists.appendChild.mockClear();
    });

    describe('constructor', () => {
        test('should initialize with default state', () => {
            expect(contextMenuManager.isContextMenuVisible()).toBe(false);
            expect(contextMenuManager.getCurrentPosition()).toEqual({ x: 0, y: 0 });
        });
    });

    describe('showContextMenu', () => {
        test('should show context menu successfully', () => {
            const result = contextMenuManager.showContextMenu(
                100, 200, 
                ['todo1'], 
                mockTodos, 
                mockLists, 
                mockOnMoveToList
            );

            expect(result).toBe(true);
            expect(contextMenuManager.isContextMenuVisible()).toBe(true);
            expect(mockSelectedTodoCount.textContent).toBe(1);
            expect(mockContextMenu.classList.remove).toHaveBeenCalledWith('hidden');
            expect(mockContextMenuLists.appendChild).toHaveBeenCalledTimes(3); // 3 lists
        });

        test('should return false when DOM elements are missing', () => {
            document.getElementById = jest.fn(() => null);

            const result = contextMenuManager.showContextMenu(
                100, 200, 
                ['todo1'], 
                mockTodos, 
                mockLists, 
                mockOnMoveToList
            );

            expect(result).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Context menu elements not found');
        });

        test('should update selected count correctly', () => {
            contextMenuManager.showContextMenu(
                100, 200, 
                ['todo1', 'todo2'], 
                mockTodos, 
                mockLists, 
                mockOnMoveToList
            );

            expect(mockSelectedTodoCount.textContent).toBe(2);
        });

        test('should set menu position', () => {
            contextMenuManager.showContextMenu(
                150, 250, 
                ['todo1'], 
                mockTodos, 
                mockLists, 
                mockOnMoveToList
            );

            expect(mockContextMenu.style.left).toBe('150px');
            expect(mockContextMenu.style.top).toBe('250px');
        });
    });

    describe('hideContextMenu', () => {
        test('should hide context menu successfully', () => {
            // First show the menu
            contextMenuManager.showContextMenu(100, 200, ['todo1'], mockTodos, mockLists, mockOnMoveToList);
            
            const result = contextMenuManager.hideContextMenu();

            expect(result).toBe(true);
            expect(contextMenuManager.isContextMenuVisible()).toBe(false);
            expect(mockContextMenu.classList.add).toHaveBeenCalledWith('hidden');
        });

        test('should return false when context menu element not found', () => {
            document.getElementById = jest.fn(() => null);

            const result = contextMenuManager.hideContextMenu();

            expect(result).toBe(false);
        });
    });

    describe('isPointInMenu', () => {
        beforeEach(() => {
            contextMenuManager.showContextMenu(100, 200, ['todo1'], mockTodos, mockLists, mockOnMoveToList);
        });

        test('should return true when point is inside menu', () => {
            mockContextMenu.getBoundingClientRect.mockReturnValue({
                left: 100,
                top: 200,
                right: 250,
                bottom: 400
            });

            const result = contextMenuManager.isPointInMenu(150, 300);
            expect(result).toBe(true);
        });

        test('should return false when point is outside menu', () => {
            mockContextMenu.getBoundingClientRect.mockReturnValue({
                left: 100,
                top: 200,
                right: 250,
                bottom: 400
            });

            const result = contextMenuManager.isPointInMenu(50, 100);
            expect(result).toBe(false);
        });

        test('should return false when menu is not visible', () => {
            contextMenuManager.hideContextMenu();

            const result = contextMenuManager.isPointInMenu(150, 300);
            expect(result).toBe(false);
        });
    });

    describe('updateSelectedCount', () => {
        test('should update selected count', () => {
            contextMenuManager.updateSelectedCount(5);
            expect(mockSelectedTodoCount.textContent).toBe(5);
        });
    });

    describe('bindEvents', () => {
        test('should bind event listeners', () => {
            const mockOnHide = jest.fn();
            
            contextMenuManager.bindEvents(mockOnHide);

            expect(document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(document.addEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function));
            expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
        });
    });

    describe('_isCurrentList', () => {
        test('should identify current list correctly', () => {
            const selectedTodos = [
                { listId: 'list1' },
                { listId: 'list1' }
            ];

            const result = contextMenuManager._isCurrentList(selectedTodos, 'list1');
            expect(result).toBe(true);
        });

        test('should handle default list correctly', () => {
            const selectedTodos = [
                { listId: null },
                { listId: null }
            ];

            const result = contextMenuManager._isCurrentList(selectedTodos, 'default');
            expect(result).toBe(true);
        });

        test('should return false for mixed lists', () => {
            const selectedTodos = [
                { listId: 'list1' },
                { listId: 'list2' }
            ];

            const result = contextMenuManager._isCurrentList(selectedTodos, 'list1');
            expect(result).toBe(false);
        });
    });

    describe('addCustomAction', () => {
        beforeEach(() => {
            contextMenuManager.showContextMenu(100, 200, ['todo1'], mockTodos, mockLists, mockOnMoveToList);
        });

        test('should add custom action to menu', () => {
            const mockOnClick = jest.fn();
            
            contextMenuManager.addCustomAction('Delete All', '🗑️', mockOnClick);

            expect(mockContextMenuLists.appendChild).toHaveBeenCalledTimes(5); // 3 lists + separator + action
        });
    });

    describe('setListItemDisabled', () => {
        test('should disable list items', () => {
            contextMenuManager.showContextMenu(100, 200, ['todo1'], mockTodos, mockLists, mockOnMoveToList);
            
            const mockItems = [
                { classList: { add: jest.fn(), remove: jest.fn() }, style: {} },
                { classList: { add: jest.fn(), remove: jest.fn() }, style: {} }
            ];
            mockContextMenuLists.querySelectorAll.mockReturnValue(mockItems);

            contextMenuManager.setListItemDisabled('list1', true);

            mockItems.forEach(item => {
                expect(item.classList.add).toHaveBeenCalledWith('disabled');
                expect(item.style.pointerEvents).toBe('none');
                expect(item.style.opacity).toBe('0.5');
            });
        });

        test('should enable list items', () => {
            contextMenuManager.showContextMenu(100, 200, ['todo1'], mockTodos, mockLists, mockOnMoveToList);
            
            const mockItems = [
                { classList: { add: jest.fn(), remove: jest.fn() }, style: {} }
            ];
            mockContextMenuLists.querySelectorAll.mockReturnValue(mockItems);

            contextMenuManager.setListItemDisabled('list1', false);

            mockItems.forEach(item => {
                expect(item.classList.remove).toHaveBeenCalledWith('disabled');
                expect(item.style.pointerEvents).toBe('');
                expect(item.style.opacity).toBe('');
            });
        });
    });

    describe('getCurrentPosition', () => {
        test('should return current position', () => {
            contextMenuManager.showContextMenu(150, 250, ['todo1'], mockTodos, mockLists, mockOnMoveToList);
            
            const position = contextMenuManager.getCurrentPosition();
            expect(position).toEqual({ x: 150, y: 250 });
        });

        test('should return copy of position object', () => {
            contextMenuManager.showContextMenu(100, 200, ['todo1'], mockTodos, mockLists, mockOnMoveToList);
            
            const position1 = contextMenuManager.getCurrentPosition();
            const position2 = contextMenuManager.getCurrentPosition();
            
            expect(position1).not.toBe(position2); // Different objects
            expect(position1).toEqual(position2); // Same values
        });
    });

    describe('edge cases', () => {
        test('should handle empty selected todos', () => {
            const result = contextMenuManager.showContextMenu(
                100, 200, 
                [], 
                mockTodos, 
                mockLists, 
                mockOnMoveToList
            );

            expect(result).toBe(true);
            expect(mockSelectedTodoCount.textContent).toBe(0);
        });

        test('should handle empty lists', () => {
            const result = contextMenuManager.showContextMenu(
                100, 200, 
                ['todo1'], 
                mockTodos, 
                [], 
                mockOnMoveToList
            );

            expect(result).toBe(true);
            expect(mockContextMenuLists.appendChild).not.toHaveBeenCalled();
        });

        test('should handle non-existent selected todos', () => {
            const result = contextMenuManager.showContextMenu(
                100, 200, 
                ['nonexistent'], 
                mockTodos, 
                mockLists, 
                mockOnMoveToList
            );

            expect(result).toBe(true);
            expect(mockSelectedTodoCount.textContent).toBe(1);
        });
    });

    describe('debugPrintState', () => {
        test('should log current state', () => {
            contextMenuManager.debugPrintState();

            expect(console.log).toHaveBeenCalledWith('ContextMenuManager state:');
            expect(console.log).toHaveBeenCalledWith('  Is visible:', false);
            expect(console.log).toHaveBeenCalledWith('  Position:', { x: 0, y: 0 });
        });
    });
});