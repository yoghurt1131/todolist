const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

/**
 * データの永続化を担当するクラス
 * ファイルシステムへの読み書きとElectronとの通信を管理
 */
class DataManager {
    constructor(dataPath = null) {
        this.dataPath = dataPath;
    }

    /**
     * IPCでメインプロセスからユーザーデータパスを取得してセットアップ
     */
    async setupDataPath() {
        if (this.dataPath) {
            return;
        }

        try {
            const userDataPath = await ipcRenderer.invoke('get-user-data-path');
            this.dataPath = path.join(userDataPath, 'tododata.json');
            
            const appInfo = await ipcRenderer.invoke('get-app-info');
            console.log('App info:', appInfo);
            console.log('Data path:', this.dataPath);
            
            this.checkPermissions();
        } catch (error) {
            console.warn('Failed to get user data path via IPC:', error);
            this.dataPath = path.join(require('os').homedir(), '.todolist', 'tododata.json');
            console.warn('Using fallback path:', this.dataPath);
        }
    }

    /**
     * データファイルからTODOとリストを読み込み
     * @returns {Object} { lists: Array, todos: Array }
     */
    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
                const todos = data.todos || [];
                
                // 既存のTODOデータにorder値を自動付与（移行処理）
                this.migrateTodoOrders(todos);
                
                return {
                    lists: data.lists || [],
                    todos: todos
                };
            }
        } catch (error) {
            console.error('データの読み込みに失敗:', error);
        }

        // デフォルトデータを返す
        return {
            lists: [{
                id: 'default',
                name: 'すべて',
                createdAt: new Date().toISOString()
            }],
            todos: []
        };
    }

    /**
     * TODOとリストをファイルに保存
     * @param {Object} data - { lists: Array, todos: Array }
     */
    saveData(data) {
        try {
            console.log('Saving data to:', this.dataPath);
            console.log('Data to save:', JSON.stringify(data, null, 2));
            
            // ディレクトリが存在するか確認
            const dir = path.dirname(this.dataPath);
            if (!fs.existsSync(dir)) {
                console.log('Creating directory:', dir);
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
            console.log('Data saved successfully');
            
            // 保存後に確認
            if (fs.existsSync(this.dataPath)) {
                console.log('File exists after save');
            } else {
                console.error('File does not exist after save attempt');
            }
        } catch (error) {
            console.error('データの保存に失敗:', error);
            console.error('Error details:', {
                code: error.code,
                path: error.path,
                syscall: error.syscall,
                errno: error.errno
            });
            throw error; // 保存失敗を呼び出し元に通知
        }
    }

    /**
     * ファイルシステムの権限をチェック
     */
    checkPermissions() {
        try {
            const dir = path.dirname(this.dataPath);
            console.log('Checking permissions for directory:', dir);
            
            // ディレクトリの読み取り権限
            try {
                fs.accessSync(dir, fs.constants.R_OK);
                console.log('Directory read permission: OK');
            } catch (e) {
                console.error('Directory read permission: DENIED');
            }
            
            // ディレクトリの書き込み権限
            try {
                fs.accessSync(dir, fs.constants.W_OK);
                console.log('Directory write permission: OK');
            } catch (e) {
                console.error('Directory write permission: DENIED');
            }
            
            // ファイルが存在する場合の権限チェック
            if (fs.existsSync(this.dataPath)) {
                try {
                    fs.accessSync(this.dataPath, fs.constants.R_OK | fs.constants.W_OK);
                    console.log('File read/write permission: OK');
                } catch (e) {
                    console.error('File read/write permission: DENIED');
                }
            }
        } catch (error) {
            console.error('Permission check failed:', error);
        }
    }

    /**
     * データパスを取得
     * @returns {string}
     */
    getDataPath() {
        return this.dataPath;
    }

    /**
     * データファイルが存在するかチェック
     * @returns {boolean}
     */
    dataFileExists() {
        return fs.existsSync(this.dataPath);
    }

    /**
     * 既存のTODOデータにorder値を自動付与（移行処理）
     * @param {Array} todos - TODOリスト（参照）
     */
    migrateTodoOrders(todos) {
        let needsMigration = false;
        
        // order値が欠けているTODOを特定
        todos.forEach(todo => {
            if (todo.order === undefined || todo.order === null) {
                needsMigration = true;
            }
        });
        
        if (!needsMigration) {
            return; // 移行不要
        }
        
        console.log('Migrating TODO orders...');
        
        // リスト別にグループ化
        const todosByList = {};
        todos.forEach(todo => {
            const listId = todo.listId || 'default';
            if (!todosByList[listId]) {
                todosByList[listId] = [];
            }
            todosByList[listId].push(todo);
        });
        
        // 各リスト内でorder値を割り当て
        Object.keys(todosByList).forEach(listId => {
            const listTodos = todosByList[listId];
            
            // createdAtでソートして順序を決める
            listTodos.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            
            // order値を1000刻みで割り当て
            listTodos.forEach((todo, index) => {
                if (todo.order === undefined || todo.order === null) {
                    todo.order = (index + 1) * 1000;
                }
            });
        });
        
        console.log('TODO order migration completed');
    }
}

module.exports = DataManager;