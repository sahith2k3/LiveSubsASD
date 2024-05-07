const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { startRecording } = require('./speech');

let mainWindow

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  ipcMain.on('language', (event, arg) => {
    console.log(arg);
    const languages = arg;
    process.env.userlang = languages[0];
    process.env.LANGUAGE = languages[1];
  });


  startRecording(mainWindow);
}

app.on('ready', () => {
  createWindow();
});