# Screen OCR
Cross-platform (MacOS Windows Linux) screen translation app created with Electron.

Created for personal use.

![스크린샷 2023-04-12 오전 2 35 49](https://user-images.githubusercontent.com/58328950/231250980-9d53ef49-ab1b-467a-a6a5-f20601fec496.jpg)


---

'tesseract.js' for OCR.

'ChatGPT' for translation.

It doesn't automatically mark up the area of text.

---

## Installation

    git clone https://github.com/potion2/screenocr
    cd screenocr
    npm install

#### OCR traineddata

  - Download it in [here](https://github.com/tesseract-ocr/tessdata_best) and move it to project root.


#### OpenAI API key

  - Obtain OpenAI api-key from [OpenAI](https://platform.openai.com/account/api-keys)
  - Register 'OPENAI_API_KEY' env as it is good for security.

      - Windows(not tested on windows)

        advanced system setting -> Advanced -> Environment Variables -> User Variables / New
        
        SET OPENAI_API_KEY='sk-...'



      - MacOS(zsh terminal)

        $ open ~/.zshrc
        
        and add
        
        export OPENAI_API_KEY='sk-...'



      - Or you can use 'api-key' directly in source code if you want




## Run

    npx electron-forge start


## Packaging

    npx electron-forge package



