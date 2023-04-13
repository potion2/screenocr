const { ipcRenderer } = require('electron');

const desktopCapturer = {
  getSources: (opts) => ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts)
}
const screen = {
  getSize: (opts) => ipcRenderer.invoke('SCREEN_GET_SIZE', opts)
}
const Tesseract = {
  recognize: (opts) => ipcRenderer.invoke('TESSERACT_JS_RECOGNIZE', opts)
}
const Translate = {
  translate_openai: (opts) => ipcRenderer.invoke('TRANSLATE_OPENAI', opts)
}

const OverlayWindow = {
  Show: (opts) => ipcRenderer.invoke('OVERLAYWINDOW_SHOW', opts)
}

var gTesseractFinished = true;
ipcRenderer.on('tesseract-progress', function (evt, message)
{
  document.getElementById('btnTesseract').disabled = !message.finished;
  document.getElementById('idProgress').value = message.progress;
  if(message.text)
  {
    document.getElementById('idTesseractedText').value = message.text;
  }
  gTesseractFinished = message.finished;
});

var gTranslateFinished = true;
ipcRenderer.on('translate-progress', function (evt, message)
{
  document.getElementById('idTranslateProgress').value = message.progress;
  document.getElementById('btnTranslate').disabled = !message.finished;
  if(message.text)
  {
    document.getElementById('idTranslatedText').value = message.text;
  }
  gTranslateFinished = message.finished;
});


function refreshScreenSources()
{
  var screenSelector = document.getElementById("selectScreen");
  screenSelector.options.length = 0;

  var opts =
  {
    types: ['window', 'screen']
  };

  desktopCapturer.getSources(opts).then(async sources =>
  {
    for(const source of sources)
    {
      var option = document.createElement("option");
      option.innerText = source.name;
      screenSelector.append(option);
    }
    changeCaptureTarget();
  });
}

function changeCaptureTarget()
{
  var screenSelector = document.getElementById("selectScreen");
  if(screenSelector.length === 0) return;

  var screen_name = screenSelector.value;

  var opts =
  {
    types: ['window', 'screen']
  };

  desktopCapturer.getSources(opts).then(async sources =>
  {
    for(const source of sources)
    {
      if(source.name === screen_name)
      {
        try
        {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video:
            {
              mandatory:
              {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id,
                minWidth: 300,
                maxWidth: 300,
                minHeight: 200,
                maxHeight: 200
              }
            }
          })
          const video = document.querySelector('video')
          video.srcObject = stream
          video.onloadedmetadata = (e) => video.play()
        }
        catch(e)
        {
          console.log(e)
        }
        return;
      }
    }
  });
}


// set up canvas element
const gCanvasToCrop = document.createElement("canvas");

//crop the image and draw it to the canvas
async function cropImage(imageURL, newX, newY, newWidth, newHeight)
{
  //create an image object from the path
  const originalImage = new Image();
  originalImage.src = imageURL;

  //initialize the canvas object
  const canvas = gCanvasToCrop;
  const ctx = canvas.getContext("2d");

  //wait for the image to finish loading
  await originalImage.decode();

  //set the canvas size to the new width and height
  canvas.width = newWidth;
  canvas.height = newHeight;

  //draw the image
  ctx.drawImage(originalImage, newX, newY, newWidth, newHeight, 0, 0, newWidth, newHeight);
  return canvas.toDataURL();
}

function contrastImage(srcURL, callBack)
{
  var sliderCaptureScale = document.getElementById("sliderContrast");
  var contrast_value = sliderCaptureScale.value/100.0;

  const image = new Image();
  image.src = srcURL;

  const canvas = gCanvasToCrop;
  const ctx = canvas.getContext('2d');
  image.onload = () =>
  {
    canvas.width = image.width;
    canvas.height = image.height;

    ctx.filter = 'contrast(' + contrast_value*contrast_value*contrast_value*contrast_value + ')';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    callBack(canvas.toDataURL("image/png"));
  }
}

var gCaptureFinished = true;
function captureScreenSources()
{
  if(gMouseDown === true || gCaptureFinished === false) return;
  gCaptureFinished = false;
  screen.getSize().then((screen_size) =>
  {
    var screenSelector = document.getElementById("selectScreen");
    if(screenSelector.length === 0) return;

    var screen_name = screenSelector.value;

    var sliderCaptureScale = document.getElementById("sliderCaptureScale");
    var scale = sliderCaptureScale.value;

    var opts =
    {
      types: ['window', 'screen'],
      thumbnailSize: {
        width: parseInt(screen_size.width*scale/100.0),
        height: parseInt(screen_size.height*scale/100.0) }
    };

    desktopCapturer.getSources(opts).then(async sources =>
    {
      for (const source of sources)
      {
        if (source.name === screen_name)
        {
          var img = document.getElementById("imgCaptured");
          var videoDiv = document.getElementById("videoCaptured");
          var vr = videoDiv.getBoundingClientRect();
          var rectDiv = document.getElementById("selectAreaRect");
          var sr = rectDiv.getBoundingClientRect();

          var timg = source.thumbnail;
          var tsize = timg.getSize();
          var cx = tsize.width*(sr.x - parseInt(vr.x))/vr.width;
          var cy = tsize.height*(sr.y - parseInt(vr.y))/vr.height;
          var cw = tsize.width*sr.width/vr.width;
          var ch = tsize.height*sr.height/vr.height;
          //timg.crop({ x: cx, y: cy, width: cw, height: ch });
          var imgCropped = await cropImage(timg.toDataURL(), cx, cy, cw, ch);
          contrastImage(imgCropped, (ci) =>
          {
            img.setAttribute("src", ci);
            gCaptureFinished = true;
          });

          return;
        }
      }
    });
  });
}

var gTesseractImage;
var gTesseractLanguage;
function tesseractImage()
{
  if(gTesseractFinished === false) return;

  //const imgCapture = document.images[0];
  //console.log(source.thumbnail.toDataURL());

  var imageurl = document.getElementById("imgCaptured").src;

  var lang = document.getElementById("selectLanguage");
  var langtext = lang.options[lang.selectedIndex].value;

  if(imageurl === gTesseractImage && langtext === gTesseractLanguage) return;

  gTesseractImage = imageurl;
  gTesseractLanguage = langtext;
  Tesseract.recognize({
    image: imageurl,
    language: langtext
  });
}


var gTranslatedText = "";
var gTranslatedLangSrc = "";
var gTranslatedLangDst = "";

/*function translateText()
{
  var lang = document.getElementById("selectTranslateFrom");
  const langsrc = lang.options[lang.selectedIndex].value;
  lang = document.getElementById("selectTranslateTo");
  const langdst = lang.options[lang.selectedIndex].value;

  const query = document.getElementById('idTesseractedText').value;

  if(gTranslatedText.localeCompare(query) === 0 &&
     gTranslatedLangSrc.localeCompare(langsrc) === 0 &&
     gTranslatedLangDst.localeCompare(langdst) === 0)
  {
    return;
  }

  // naver PAPAGO
  var client_id = 'PAPAGO_CLIENTID';
  var client_secret = 'PAPAGO_SECRET';

  var api_url = 'https://openapi.naver.com/v1/papago/n2mt';
  var request = require('request');
  var options = {
    url: api_url,
    form: {'source':langsrc, 'target':langdst, 'text':query},
    headers: {'X-Naver-Client-Id':client_id, 'X-Naver-Client-Secret': client_secret}
  };

  request.post(options, function (error, response, body)
  {
    if (!error && response.statusCode == 200) {
      var obj = JSON.parse(body);
      document.getElementById('idTranslatedText').value = obj.message.result.translatedText;
    } else {
      console.log('error = ' + response.statusCode);
      document.getElementById('idTranslatedText').value = 'error = ' + response.statusCode;
    }
  });
}*/


function translateText()
{
  if(gTranslateFinished === false) return;

  var lang = document.getElementById("selectTranslateFrom");
  const langsrc = lang.options[lang.selectedIndex].value;
  lang = document.getElementById("selectTranslateTo");
  const langdst = lang.options[lang.selectedIndex].value;

  const query = document.getElementById('idTesseractedText').value;

  if(query.length === 0 || langdst.length ===  0) return;
  if(gTranslatedText.localeCompare(query) === 0 &&
     gTranslatedLangSrc.localeCompare(langsrc) === 0 &&
     gTranslatedLangDst.localeCompare(langdst) === 0)
  {
    return;
  }

  Translate.translate_openai({
    langsrc: langsrc,
    langdst: langdst,
    query: query
  });
}


var gMouseDown = false;
var gMouseStartX = 0;
var gMouseStartY = 0;
var gMouseEndX = 0;
var gMouseEndY = 0;

function initializeApp()
{
  refreshScreenSources();

  var videoDiv = document.getElementById("videoCaptured");
  var r = videoDiv.getBoundingClientRect();
  gMouseStartX = parseInt(r.x);
  gMouseStartY = parseInt(r.y);
  gMouseEndX = gMouseStartX + r.width - 1;
  gMouseEndY = gMouseStartY + r.height - 1;

  var rectDiv = document.getElementById("selectAreaRect");
  rectDiv.style.display = 'block';
  rectDiv.style.left = r.x + "px";
  rectDiv.style.top = r.y + "px";
  rectDiv.style.width = r.width + "px";
  rectDiv.style.height = r.height + "px";
}


function onMouseDown(e)
{
  if(e.button === 2)
  {
    var videoDiv = document.getElementById("videoCaptured");
    var r = videoDiv.getBoundingClientRect();
    gMouseStartX = parseInt(r.x);
    gMouseStartY = parseInt(r.y);
    gMouseEndX = gMouseStartX + r.width - 1;
    gMouseEndY = gMouseStartY + r.height - 1;

    var rectDiv = document.getElementById("selectAreaRect");
    rectDiv.style.display = 'block';
    rectDiv.style.left = r.x + "px";
    rectDiv.style.top = r.y + "px";
    rectDiv.style.width = r.width + "px";
    rectDiv.style.height = r.height + "px";

    return;
  }

  gMouseDown = true;

  var rectDiv = document.getElementById("selectAreaRect");
  rectDiv.style.display = 'block';

  gMouseStartX = e.pageX;
  gMouseStartY = e.pageY;
}

function onMouseMove(e)
{
  if(gMouseDown === false) return;

  var rectDiv = document.getElementById("selectAreaRect");

  gMouseEndX = e.pageX;
  gMouseEndY = e.pageY;

  var x = Math.min(gMouseStartX, e.pageX);
  var y = Math.min(gMouseStartY, e.pageY);
  var w = Math.abs(e.pageX - gMouseStartX);
  var h = Math.abs(e.pageY - gMouseStartY);
  rectDiv.style.left = "" + x + "px";
  rectDiv.style.width = "" + w + "px";
  rectDiv.style.top = "" + y + "px";
  rectDiv.style.height = "" + h + "px";
}

function onMouseUp(e)
{
  if(gMouseDown === false) return;
  gMouseDown = false;
}


var gAutoTimeoutID;

function onAutoChanged()
{
  var btnCapture = document.getElementById("btnCapture");
  var btnTesseract = document.getElementById("btnTesseract");
  var btnTranslate = document.getElementById("btnTranslate");

  var cbTesseractAuto = document.getElementById("idTesseractAuto");
  var cbTranslateAuto = document.getElementById("idTranslateAuto");

  if(cbTesseractAuto.checked === false && cbTranslateAuto.checked === false)
  {
    clearTimeout(gAutoTimeoutID);
    btnCapture.disabled = false;
    btnTesseract.disabled = false;
    btnTranslate.disabled = false;
    return;
  }

  if(cbTesseractAuto.checked === true)
  {
    btnCapture.disabled = true;
    btnTesseract.disabled = true;
  }
  if(cbTranslateAuto.checked === true)
  {
    btnTranslate.disabled = true;
  }

  setTimeout(() => doAutoTranslateRecursive(), 500);
}

function doAutoTranslateRecursive()
{
  var btnCapture = document.getElementById("btnCapture");
  var btnTesseract = document.getElementById("btnTesseract");
  var btnTranslate = document.getElementById("btnTranslate");

  var cbTesseractAuto = document.getElementById("idTesseractAuto");
  var cbTranslateAuto = document.getElementById("idTranslateAuto");

  if(cbTesseractAuto.checked === false && cbTranslateAuto.checked === false)
  {
    clearTimeout(gAutoTimeoutID);
    btnCapture.disabled = false;
    btnTesseract.disabled = false;
    btnTranslate.disabled = false;
    return;
  }

  if(cbTesseractAuto.checked ===  true)
  {
    btnCapture.disabled = true;
    btnTesseract.disabled = true;
    captureScreenSources();
    if(gTesseractFinished === true)
    {
      tesseractImage();
    }
  }

  if(cbTranslateAuto.checked ===  true)
  {
    btnTranslate.disabled = true;
    if(gTranslateFinished === true)
    {
      translateText();
    }
  }

  setTimeout(() => doAutoTranslateRecursive(), 1000);
}

function onShowOverlayChanged()
{
  var checkBox = document.getElementById("idShowOverlay");
  OverlayWindow.Show({ show: checkBox.checked });
}
