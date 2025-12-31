// Load environment variables from .env file
// Skip in test mode - Playwright sets env vars directly
import { config } from 'dotenv';
if (process.env.NODE_ENV !== 'test' && process.env.E2E_TEST !== 'true') {
  config();
}

// Log environment variables in test mode for debugging
if (process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true') {
  console.log('=== E2E TEST MODE DETECTED ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('E2E_TEST:', process.env.E2E_TEST);
  console.log('PLAYWRIGHT_TEST:', process.env.PLAYWRIGHT_TEST);
  console.log('==============================');
}

import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations, closeDatabase } from './database/index.js';
import { registerAllHandlers } from './ipc/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const isDev =
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // DevTools can be opened manually with Ctrl+Shift+I (Cmd+Option+I on Mac)
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database before creating window
  console.log('Initializing database...');
  runMigrations();
  console.log('Database ready');

  // Register IPC handlers before creating window
  registerAllHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase();
    app.quit();
  }
});

// Graceful shutdown
app.on('before-quit', () => {
  closeDatabase();
});
