const { ipcRenderer } = require('electron');


ipcRenderer.on('tesseract-result', function (evt, message)
{
  //console.log(message);
  document.getElementById('idTranslatedText').innerText = message.text;
});

ipcRenderer.on('translate-result', function (evt, message)
{
  //console.log(message);
  document.getElementById('idTranslatedText').innerText = message.text;
});
