# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TODOLIST is an Electron-based TODO application for macOS, designed to provide a local, simple task management tool similar to macOS Reminders app.

## Development Commands

```bash
# Install dependencies
npm install

# Start development mode
npm run dev

# Start production mode
npm start

# Build for macOS
npm run build-mac

# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate app icons from SVG
npm run build-icons
```

## Project Structure

- `main.js` - Electron main process with window management and app lifecycle
- `index.html` - Main application UI with split-pane layout (sidebar + main content)
- `styles.css` - macOS-style CSS with native look and feel
- `renderer.js` - Entry point that initializes the TodoApp class
- `src/TodoApp.js` - Core application logic (testable, separated from DOM)
- `tests/` - Jest unit tests with mocks for Electron and filesystem
- `package.json` - Electron configuration and build settings

## Architecture

### Data Management
- Local JSON file storage in app data directory (`tododata.json`)
- Real-time auto-save on all operations
- Simple data structure: lists array + todos array with foreign key relationships

### UI Components
- **Left Sidebar**: List management, "すべて" (All) default list
- **Right Panel**: TODO items with completion checkboxes and delete actions
- **Modals**: List creation/editing dialogs
- **Forms**: Inline TODO addition at bottom

### Key Features (Phase 1 MVP)
- Multiple list creation/deletion (except default "すべて" list)
- TODO add/complete/delete functionality
- Persistent local storage
- macOS-native styling with sidebar vibrancy

## Technical Notes

- Uses `nodeIntegration: true` for file system access
- Window configured with `hiddenInset` title bar and `sidebar` vibrancy for native macOS feel
- Data stored in Electron's `userData` directory automatically
- Context menu on custom lists enables deletion (right-click)
- Keyboard shortcuts: Enter to save, Escape to cancel in forms

## Testing

- Unit tests with Jest covering all core functionality
- Mocked Electron and filesystem dependencies for isolated testing
- 25 test cases covering initialization, data persistence, list/todo management
- Run `npm test` for full test suite or `npm run test:watch` for development

## Requirements Reference

The original requirements are preserved in Japanese as comments within the codebase for reference. Key points:
- Phase 1 (MVP): Basic list/TODO management, simple UI, local data storage
- Phase 2: Due dates/notifications, export, search
- Phase 3: UI/UX improvements, performance optimization