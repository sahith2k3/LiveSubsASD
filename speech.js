const record = require('node-record-lpcm16');
const speech = require('@google-cloud/speech');
const {Translate} = require('@google-cloud/translate').v2;
require('dotenv').config();

const client = new speech.SpeechClient();
const translate = new Translate();

var lang = "en-US" || process.env.userlang;
var splang = "en-US" || process.env.LANGUAGE;

const diarizationConfig = {
  enableSpeakerDiarization: true,
  minSpeakerCount: 2,
  maxSpeakerCount: 4,
};

const request = {
  config: {
    encoding: 'LINEAR16',
    sampleRateHertz: 16000,
    languageCode: lang,
    diarizationConfig: diarizationConfig,
    enableWordTimeOffsets: false,
  },
  interimResults: true,
};

async function translateText(text, mainWindow) {
    //retrieve the language code from the environment variable
    // console.log(process.env.LANGUAGE);
    let [translations] = await translate.translate(text, process.env.LANGUAGE );
    translations = Array.isArray(translations) ? translations : [translations];
    console.log('Translations:');
    translations.forEach((translation, i) => {
        console.log(`${text} => ${translation}`);
        mainWindow.webContents.send('subtitle', translation);
    });
}

module.exports.startRecording = (mainWindow) => {
    console.log('Started');
    mainWindow.webContents.send('start', Date.now());
    const recording = record.record();

    const recognizeStream = client
    .streamingRecognize(request)
    .on('error', console.error)
    .on('data', async (data) => {

    if (data.results[0] && data.results[0].alternatives[0]) {
        const text = data.results[0].alternatives[0].transcript;

        lang = process.env.userlang;
        splang = process.env.LANGUAGE;

        if (data.results[0].isFinal)  {
          console.log(`Transcription: ${text}`);
        }        

        console.log(lang, splang);

        if ( lang !== splang ){          
          await translateText(text, mainWindow);
        }

        else{
          mainWindow.webContents.send('subtitle', text);
        }

        
      } else {
        console.log(`\n\nReached transcription time limit, press Ctrl+C\n`);
      }
  });

    recording.stream().pipe(recognizeStream);
}