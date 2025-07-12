# TODOLIST

A native macOS TODO application built with Electron, featuring a clean interface similar to macOS Reminders.

## Features

- **List Management**: Create, delete, and organize multiple TODO lists
- **Task Management**: Add, complete, and delete tasks with visual feedback
- **Local Storage**: All data stored locally in JSON format
- **macOS Integration**: Native look and feel with vibrancy effects
- **Keyboard Shortcuts**: Enter to save, Escape to cancel

## Development

### Prerequisites

- Node.js 16.x or later
- npm or yarn
- macOS (for building .dmg packages)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd todolist

# Install dependencies
npm install
```

### Development Commands

```bash
# Start in development mode (with DevTools)
npm run dev

# Start in development mode (without DevTools)
npm run dev-no-console

# Start in production mode
npm start

# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for macOS
npm run build-mac
```

### Project Structure

```
todolist/
├── main.js                 # Electron main process
├── index.html              # Application UI
├── styles.css              # macOS-style CSS
├── renderer.js             # UI initialization
├── src/
│   └── TodoApp.js          # Core application logic
├── tests/
│   ├── TodoApp.test.js     # Unit tests
│   ├── setup.js            # Test setup
│   └── __mocks__/          # Mock files for testing
├── assets/
│   ├── icon.svg            # Source icon
│   ├── icon.icns           # macOS app icon
│   └── create-icons.js     # Icon generation helper
└── package.json            # Project configuration
```

## Architecture

### Data Flow

1. **TodoApp Class**: Core business logic handling lists and todos
2. **Local Storage**: JSON file in Electron's userData directory
3. **UI Layer**: DOM manipulation methods for rendering
4. **Event Handling**: User interactions and keyboard shortcuts

### Data Structure

```javascript
{
  "lists": [
    {
      "id": "default",
      "name": "すべて",
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  ],
  "todos": [
    {
      "id": "unique-id",
      "text": "Task description",
      "completed": false,
      "listId": "list-id", // null for default list
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

## Testing

The application includes comprehensive unit tests covering:

- Data initialization and loading
- List creation, deletion, and selection
- TODO management operations
- Data persistence
- Error handling

**Test Coverage**: 25 test cases with mocked Electron and filesystem dependencies.

```bash
# Run all tests
npm test

# Generate coverage report
npm test -- --coverage
```

## Building and Distribution

### macOS App (.dmg)

```bash
npm run build-mac
```

This creates a `.dmg` file in the `dist/` directory.

### Icon Creation

The app uses a custom icon located at `assets/icon.icns`. To update:

1. Edit `assets/icon.svg`
2. Convert to 1024x1024 PNG
3. Generate .icns file using online tools or `iconutil`

## Configuration

### Electron Settings

- **Window**: 1000x700 initial size, 800x600 minimum
- **Title Bar**: Hidden inset style for native macOS feel
- **Vibrancy**: Sidebar effect
- **Node Integration**: Enabled for file system access

### Build Configuration

- **App ID**: `com.claude.todolist`
- **Product Name**: `TODOLIST`
- **Category**: Productivity
- **Target**: macOS DMG

## Troubleshooting

### Common Issues

1. **DevTools Opening Automatically**
   - Use `npm start` instead of `npm run dev`
   - Or use `npm run dev-no-console`

2. **Data Not Persisting**
   - Check file permissions in userData directory
   - Verify JSON file format is valid

3. **App Won't Start**
   - Ensure all dependencies are installed: `npm install`
   - Check Node.js version compatibility

4. **Tests Failing**
   - Clear Jest cache: `npx jest --clearCache`
   - Ensure all mocks are properly configured

### Development Tips

- Use browser DevTools for UI debugging (F12 when `--dev` flag is used)
- Check Electron's userData directory for data files
- Use `console.log` in renderer process for debugging UI issues
- Use VS Code's integrated terminal for running commands

## Performance

- **Startup Time**: < 3 seconds
- **Memory Usage**: 200-500MB (typical for Electron apps)
- **Data Handling**: Optimized for hundreds of tasks per list

## Security

- No external network requests
- Local data storage only
- No sensitive data encryption (designed for personal use)

## Contributing

### Code Style

- Use existing patterns and conventions
- Follow macOS design guidelines
- Maintain test coverage for new features
- Update documentation for significant changes

### Testing New Features

1. Write unit tests first
2. Ensure all existing tests pass
3. Test manually on macOS
4. Verify build process works

## License

MIT License - see package.json for details.

## Support

For issues and feature requests, check the project's issue tracker or documentation.