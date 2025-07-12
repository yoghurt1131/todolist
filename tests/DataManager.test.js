const DataManager = require('../src/DataManager');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock fs module
jest.mock('fs');
jest.mock('os');

describe('DataManager', () => {
    let dataManager;
    let mockDataPath;

    beforeEach(() => {
        jest.clearAllMocks();
        fs.__clearMockFileData();
        
        mockDataPath = '/test/tododata.json';
        dataManager = new DataManager(mockDataPath);
    });

    describe('constructor', () => {
        test('should set dataPath when provided', () => {
            const customPath = '/custom/path/data.json';
            const dm = new DataManager(customPath);
            expect(dm.getDataPath()).toBe(customPath);
        });

        test('should accept null dataPath', () => {
            const dm = new DataManager();
            expect(dm.getDataPath()).toBeNull();
        });
    });

    describe('loadData', () => {
        test('should return data when file exists and is valid', () => {
            const mockData = {
                lists: [
                    { id: 'default', name: 'すべて', createdAt: '2023-01-01T00:00:00.000Z' },
                    { id: 'work', name: '仕事', createdAt: '2023-01-02T00:00:00.000Z' }
                ],
                todos: [
                    { id: 'todo1', text: 'テストタスク', completed: false, listId: 'work', createdAt: '2023-01-01T00:00:00.000Z' }
                ]
            };

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(mockData));

            const result = dataManager.loadData();

            expect(fs.existsSync).toHaveBeenCalledWith(mockDataPath);
            expect(fs.readFileSync).toHaveBeenCalledWith(mockDataPath, 'utf8');
            expect(result).toEqual(mockData);
        });

        test('should return default data when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = dataManager.loadData();

            expect(result.lists).toHaveLength(1);
            expect(result.lists[0].name).toBe('すべて');
            expect(result.lists[0].id).toBe('default');
            expect(result.todos).toHaveLength(0);
        });

        test('should return default data when file is corrupted', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('invalid json');

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const result = dataManager.loadData();

            expect(result.lists).toHaveLength(1);
            expect(result.lists[0].name).toBe('すべて');
            expect(result.todos).toHaveLength(0);
            expect(consoleSpy).toHaveBeenCalledWith('データの読み込みに失敗:', expect.any(SyntaxError));
            
            consoleSpy.mockRestore();
        });

        test('should handle missing lists or todos in data file', () => {
            const partialData = { lists: [{ id: 'test', name: 'テスト' }] };
            
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(partialData));

            const result = dataManager.loadData();

            expect(result.lists).toEqual(partialData.lists);
            expect(result.todos).toEqual([]);
        });
    });

    describe('saveData', () => {
        beforeEach(() => {
            // Mock successful directory operations
            fs.existsSync.mockReturnValue(true);
            fs.mkdirSync.mockReturnValue(undefined);
            fs.writeFileSync.mockReturnValue(undefined);
        });

        test('should save data to file successfully', () => {
            const testData = {
                lists: [{ id: 'test', name: 'テスト' }],
                todos: [{ id: 'todo1', text: 'テストタスク', completed: false }]
            };

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            dataManager.saveData(testData);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                mockDataPath,
                JSON.stringify(testData, null, 2)
            );
            expect(consoleSpy).toHaveBeenCalledWith('Data saved successfully');
            
            consoleSpy.mockRestore();
        });

        test('should create directory if it does not exist', () => {
            const testData = { lists: [], todos: [] };
            
            // Mock directory doesn't exist initially
            fs.existsSync
                .mockReturnValueOnce(false) // Directory doesn't exist
                .mockReturnValueOnce(true);  // File exists after save

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            dataManager.saveData(testData);

            expect(fs.mkdirSync).toHaveBeenCalledWith(
                path.dirname(mockDataPath),
                { recursive: true }
            );
            expect(consoleSpy).toHaveBeenCalledWith('Creating directory:', path.dirname(mockDataPath));
            
            consoleSpy.mockRestore();
        });

        test('should throw error when save fails', () => {
            const testData = { lists: [], todos: [] };
            const saveError = new Error('Permission denied');
            saveError.code = 'EACCES';

            fs.writeFileSync.mockImplementation(() => {
                throw saveError;
            });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            expect(() => dataManager.saveData(testData)).toThrow('Permission denied');
            expect(consoleSpy).toHaveBeenCalledWith('データの保存に失敗:', saveError);
            
            consoleSpy.mockRestore();
        });
    });

    describe('checkPermissions', () => {
        test('should check directory and file permissions', () => {
            fs.accessSync.mockImplementation(() => {}); // Successful access
            fs.existsSync.mockReturnValue(true);

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            dataManager.checkPermissions();

            expect(fs.accessSync).toHaveBeenCalledWith(
                path.dirname(mockDataPath),
                fs.constants.R_OK
            );
            expect(fs.accessSync).toHaveBeenCalledWith(
                path.dirname(mockDataPath),
                fs.constants.W_OK
            );
            expect(consoleSpy).toHaveBeenCalledWith('Directory read permission: OK');
            expect(consoleSpy).toHaveBeenCalledWith('Directory write permission: OK');
            
            consoleSpy.mockRestore();
        });

        test('should report permission denials', () => {
            fs.accessSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });
            fs.existsSync.mockReturnValue(false);

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            dataManager.checkPermissions();

            expect(consoleSpy).toHaveBeenCalledWith('Directory read permission: DENIED');
            expect(consoleSpy).toHaveBeenCalledWith('Directory write permission: DENIED');
            
            consoleSpy.mockRestore();
        });
    });

    describe('utility methods', () => {
        test('getDataPath should return current data path', () => {
            expect(dataManager.getDataPath()).toBe(mockDataPath);
        });

        test('dataFileExists should return file existence status', () => {
            fs.existsSync.mockReturnValue(true);
            expect(dataManager.dataFileExists()).toBe(true);

            fs.existsSync.mockReturnValue(false);
            expect(dataManager.dataFileExists()).toBe(false);

            expect(fs.existsSync).toHaveBeenCalledWith(mockDataPath);
        });
    });

    describe('setupDataPath', () => {
        test('should skip setup if dataPath is already set', async () => {
            // dataPath is already set in beforeEach
            await dataManager.setupDataPath();
            
            // Should not change the existing path
            expect(dataManager.getDataPath()).toBe(mockDataPath);
        });

        test('should use fallback path when IPC fails', async () => {
            const dmWithoutPath = new DataManager();
            
            // Mock os.homedir for fallback
            os.homedir.mockReturnValue('/home/user');
            
            // setupDataPath should fail and use fallback
            await dmWithoutPath.setupDataPath();
            
            expect(dmWithoutPath.getDataPath()).toBe('/home/user/.todolist/tododata.json');
        });
    });
});