const path = require('path');
const os = require('os');

module.exports = {
  app: {
    getPath: jest.fn((name) => {
      if (name === 'userData') {
        return path.join(os.tmpdir(), 'test-todolist');
      }
      return os.tmpdir();
    })
  },
  BrowserWindow: jest.fn(),
  Menu: {
    setApplicationMenu: jest.fn(),
    buildFromTemplate: jest.fn()
  }
};