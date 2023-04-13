const { app, BrowserWindow } = require('electron');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

var gMainWindow;
var gOverlayWindow;
const createWindow = () => {
  // Create the browser window.
  gMainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      maximizable: false,
      fullscreenable: false,
      preload: path.join(__dirname, 'preload.js'),
      langPath: path.join(__dirname, '..', 'lang-data'),
      nodeIntegration: true,
      contextIsolation : false
    },
  });
  gOverlayWindow = new BrowserWindow({
    width: 400,
    height:300,
    //parent: gMainWindow,
    titleBarStyle: 'hidden',
    titleBarOverlay: true,
    minimizable: false,
    maximizable: false,
    focusable: false,
    fullscreenable: false,
    transparent: true,
    backgroundColor: '#55F5F5DC',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation : false
    },
  });

  // and load the index.html of the app.
  gMainWindow.loadFile(path.join(__dirname, 'index.html'));
  gOverlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  gOverlayWindow.setWindowButtonVisibility(false);
  gOverlayWindow.setAlwaysOnTop(true);
  var [mainWindowPosX,mainWindowPosY] = gMainWindow.getPosition();
  var [mainWindowSizeW, mainWindowSizeH] = gMainWindow.getSize();
  gOverlayWindow.setPosition(mainWindowPosX + mainWindowSizeW, mainWindowPosY);
  gMainWindow.focus();

  // Open the DevTools.
  //gMainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  //if (process.platform !== 'darwin') {
    app.quit();
  //}
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

const { screen, ipcMain, desktopCapturer } = require('electron');
const { createWorker } = require('tesseract.js');

ipcMain.handle(
  'DESKTOP_CAPTURER_GET_SOURCES',
  (event, opts) => desktopCapturer.getSources(opts)
);

ipcMain.handle(
  'SCREEN_GET_SIZE',
  (event, opts) =>
  {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;
    return {
      width: width,
      height: height,
      pixel_width: width*primaryDisplay.scaleFactor,
      pixel_height: height*primaryDisplay.scaleFactor };
  }
);

ipcMain.handle(
  'TESSERACT_JS_RECOGNIZE',
  async (event, opts) =>
  {
    event.sender.send('tesseract-progress', { finished: false, progress: 0 });

    const tesseractWorker = await createWorker({
      logger: m => {
        //console.log(m);
        event.sender.send('tesseract-progress', { finished: false, progress: (m.progress*100) });
      }, // Add logger here
    });

    (async () => {
      try
      {
        await tesseractWorker.loadLanguage(opts.language);
        await tesseractWorker.initialize(opts.language);
        const detectedData = opts.detect ? await tesseractWorker.detect(opts.image) : null;
        if(opts.detect === false || detectedData.data.script !== null)
        {
          const { data: { text } } = await tesseractWorker.recognize(opts.image);
          console.log(text);
          event.sender.send('tesseract-progress', { finished: true, progress: 100, text: text });
          //gOverlayWindow.webContents.send('tesseract-result', { text: text });
        }
        else
        {
          console.log(detectedData);
          event.sender.send('tesseract-progress', { finished: true, progress: 100, text: "" });
        }
        await tesseractWorker.terminate();
      }
      catch(err)
      {
        console.log(err);
        event.sender.send('tesseract-progress', { finished: true, progress: 100, text: "error" });
      }
    })();
  }
);


const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration(
  {
    apiKey: process.env.OPENAI_API_KEY,
  }
);
delete configuration.baseOptions.headers['User-Agent'];
const openai = new OpenAIApi(configuration);

ipcMain.handle(
  'TRANSLATE_OPENAI',
  async (event, opts) =>
  {
    var time_start = Date.now();
    //document.getElementById('btnTranslate').disabled = true;
    event.sender.send('translate-progress', { finished: false, progress: 0 });
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [ { role: "user", content: "Translate this into " + opts.langdst + "\n\n" + opts.query } ],
      temperature: 0.3,
      max_tokens: 1024,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
    });
    var time_end = Date.now();
    console.log(response);
    var result_reason = "Done";
    switch(response.data.choices[0].finish_reason)
    {
      case "stop": result_reason = "API returned complete model output"; break;
      case "length": result_reason = "Incomplete model output due to token limit"; break;
      case "content_filter": result_reason = "Omitted content due to a flag from OpenAI's content filters"; break;
    }
    var text_result = response.data.choices[0].message.content +
      "\n\n" +
      parseInt((time_end - time_start)/1000) + "s" +
      "\nfinish_reason : " + result_reason +
      "\ntotal_tokens : " + response.data.usage.total_tokens;
    event.sender.send('translate-progress', { finished: true, progress: 100, text: text_result });
    gOverlayWindow.webContents.send('translate-result', { text: response.data.choices[0].message.content });
  }
);

ipcMain.handle(
  'OVERLAYWINDOW_SHOW',
  async (event, opts) =>
  {
    if(opts.show === true)
    {
      gOverlayWindow.show();
      gOverlayWindow.blur();
    }
    else
    {
      gOverlayWindow.hide();
    }
  }
);

ipcMain.handle(
  'MESSAGEBOX_AUTOMATIC_TESSERACT',
  async (event, opts) =>
  {
  }
);
