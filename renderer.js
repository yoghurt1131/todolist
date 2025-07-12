const TodoApp = require('./src/TodoApp');
const { ipcRenderer } = require('electron');

let todoApp;

// メインプロセスからのapp準備完了通知を待つ
ipcRenderer.once('app-ready', () => {
    initializeTodoApp();
});

// DOMContentLoadedでも初期化（フォールバック）
document.addEventListener('DOMContentLoaded', () => {
    // 少し遅延させてapp-readyを待つ
    setTimeout(() => {
        if (!todoApp) {
            console.warn('app-ready signal not received, initializing anyway');
            initializeTodoApp();
        }
    }, 1000);
});

async function initializeTodoApp() {
    todoApp = new TodoApp();
    await todoApp.initializeApp();
}

// ウィンドウが閉じられる前にデータを保存
window.addEventListener('beforeunload', (event) => {
    if (todoApp) {
        todoApp.saveData();
    }
});

// メインプロセスからの保存指示を受信
ipcRenderer.on('save-data-before-quit', () => {
    if (todoApp) {
        todoApp.saveData();
    }
});

ipcRenderer.on('final-save-data', () => {
    if (todoApp) {
        todoApp.saveData();
    }
});