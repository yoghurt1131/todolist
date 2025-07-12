let mockFileData = {};

const fs = {
  existsSync: jest.fn((path) => {
    return mockFileData[path] !== undefined;
  }),
  
  readFileSync: jest.fn((path, encoding) => {
    if (mockFileData[path]) {
      return mockFileData[path];
    }
    throw new Error(`File not found: ${path}`);
  }),
  
  writeFileSync: jest.fn((path, data) => {
    mockFileData[path] = data;
  }),

  // Helper function for tests to set mock data
  __setMockFileData: (data) => {
    mockFileData = { ...data };
  },

  // Helper function for tests to clear mock data
  __clearMockFileData: () => {
    mockFileData = {};
  }
};

module.exports = fs;