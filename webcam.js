import * as faceapi from './face-api.esm.js'; // use when in dev mode
// import * as faceapi from '@vladmandic/face-api'; // use when downloading face-api as npm
const { ipcRenderer } = require('electron'); 

var subEle;
let sublocation = [0, 0];

document.addEventListener('DOMContentLoaded', function() {
  subEle = document.getElementById('subtitles');
});

// configuration options
const modelPath = './model/'; 
const minScore = 0.2;
const maxResults = 5;
let optionsSSDMobileNet;
let greenIndexes = [];
let faces = [];

let keyIsPressed = false;
let currentKey = '';
let canTriggerKeydown = true;

document.addEventListener('keydown', (event) => {
  if (!canTriggerKeydown) return;
  
  const key = event.key;
  if (key >= '1' && key <= '9') {
    const index = parseInt(key) - 1;
    if (!greenIndexes.includes(index)) {
      greenIndexes.push(index);
      keyIsPressed = true;
      currentKey = key;
      updateSubtitlePosition(); // Call the function to start updating the position
      canTriggerKeydown = false;
      setTimeout(() => {
        canTriggerKeydown = true;
      }, 100); // Allow triggering keydown every 0.5s
    }
  }
});
document.addEventListener('keyup', (event) => {
  const key = event.key;
  if (key >= '1' && key <= '9') {
    const index = parseInt(key) - 1;
    const indexToRemove = greenIndexes.indexOf(index);
    if (indexToRemove !== -1) {
      greenIndexes.splice(indexToRemove, 1);
      keyIsPressed = false;
      currentKey = '';
      subEle.style.top = "600px";
      subEle.style.left = '450px';
    }
  }
});

ipcRenderer.on('subtitle', (event, data) => {
  subEle.innerHTML = data;

  setTimeout(() => {
    subEle.innerHTML = "";
  }, 60000);
});

function updateSubtitlePosition() {
  if (keyIsPressed) {
    const index = parseInt(currentKey) - 1;
    if (faces[index]) {
      subEle.style.position = 'absolute';
      subEle.style.top = faces[index].box.y + 100 + 'px';
      subEle.style.left = faces[index].box.x - 50 + 'px';
    }
    requestAnimationFrame(updateSubtitlePosition);
  }
}

function str(json) {
  let text = '<font color="lightblue">';
  text += json ? JSON.stringify(json).replace(/{|}|"|\[|\]/g, '').replace(/,/g, ', ') : '';
  text += '</font>';
  return text;
}

function log(...txt) {
  console.log(...txt); 
  const div = document.getElementById('log');
  if (div) div.innerHTML += `<br>${txt}`;
}

function drawFaces(canvas, data, greenIndex) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'small-caps 20px "Segoe UI"';
  ctx.fillStyle = 'white';

  var sdata = data.sort((a, b) => a.box.x - b.box.x); 

  faces = sdata;

  for (let i = 0; i < data.length; i++) {
    const person = sdata[i];
    ctx.lineWidth = 3;
    if (greenIndexes.includes(i)) {
      console.log(i, greenIndexes)
      ctx.strokeStyle = 'lime';

      sublocation = [person.box.x , person.box.y];
      
    } else {
      ctx.strokeStyle = 'deepskyblue'; 
    }
    ctx.fillStyle = 'deepskyblue';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.rect(person.box.x , person.box.y , person.box.width, person.box.height);
    ctx.stroke();

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = 'lightblue';
    const pointSize = 2;
  }
}

async function detectVideo(video, canvas) {
  if (!video || video.paused) return false;
  const t0 = performance.now();
  faceapi
    .detectAllFaces(video, optionsSSDMobileNet)
    .then((result) => {
      console.log(result);
      const fps = 1000 / (performance.now() - t0);
      drawFaces(canvas, result, greenIndexes);
      requestAnimationFrame(() => detectVideo(video, canvas));
      return true;
    });

  return false;
}

// just initialize everything and call main function
async function setupCamera() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  if (!video || !canvas) return null;

  log('Setting up camera');
  // setup webcam. note that navigator.mediaDevices requires that page is accessed via https
  if (!navigator.mediaDevices) {
    log('Camera Error: access not supported');
    return null;
  }
  let stream;
  const constraints = { audio: false, video: { facingMode: 'user', resizeMode: 'crop-and-scale' } };
  if (window.innerWidth > window.innerHeight) constraints.video.width = { ideal: window.innerWidth };
  else constraints.video.height = { ideal: window.innerHeight };
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (err.name === 'PermissionDeniedError' || err.name === 'NotAllowedError') log(`Camera Error: camera permission denied: ${err.message || err}`);
    if (err.name === 'SourceUnavailableError') log(`Camera Error: camera not available: ${err.message || err}`);
    return null;
  }
  if (stream) {
    video.srcObject = stream;
  } else {
    log('Camera Error: stream empty');
    return null;
  }
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  if (settings.deviceId) delete settings.deviceId;
  if (settings.groupId) delete settings.groupId;
  if (settings.aspectRatio) settings.aspectRatio = Math.trunc(100 * settings.aspectRatio) / 100;
  log(`Camera active: ${track.label}`);
  log(`Camera settings: ${str(settings)}`);


  canvas.addEventListener('click', () => {
    if (video && video.readyState >= 2) {
      if (video.paused) {
        video.play();
        detectVideo(video, canvas);
      } else {
        video.pause();
      }
    }
    log(`Camera state: ${video.paused ? 'paused' : 'playing'}`);
  });

  return new Promise((resolve) => {
    video.onloadeddata = async () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.play();
      detectVideo(video, canvas);
      resolve(true);
    };
  });
}

async function setupFaceAPI() {
  // load face-api models
  // log('Models loading');
  // await faceapi.nets.tinyFaceDetector.load(modelPath); // using ssdMobilenetv1
  // await faceapi.nets.tinyFaceDetector.load(modelPath);
  await faceapi.nets.ssdMobilenetv1.load(modelPath);
  // await faceapi.nets.faceLandmark68Net.load(modelPath);


  optionsSSDMobileNet = new faceapi.SsdMobilenetv1Options({ minConfidence: minScore, maxResults });
  // check tf engine state
  log(`Models loaded: ${str(faceapi.tf.engine().state.numTensors)} tensors`);
}

// async function main() {
//   // initialize tfjs
//   log('FaceAPI WebCam Test');

//   // if you want to use wasm backend location for wasm binaries must be specified
//   // await faceapi.tf?.setWasmPaths(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${faceapi.tf.version_core}/dist/`);
//   // await faceapi.tf?.setBackend('wasm');
//   // log(`WASM SIMD: ${await faceapi.tf?.env().getAsync('WASM_HAS_SIMD_SUPPORT')} Threads: ${await faceapi.tf?.env().getAsync('WASM_HAS_MULTITHREAD_SUPPORT') ? 'Multi' : 'Single'}`);

//   // default is webgl backend
//   await faceapi.tf.setBackend('webgl');
//   await faceapi.tf.ready();

//   // tfjs optimizations
//   if (faceapi.tf?.env().flagRegistry.CANVAS2D_WILL_READ_FREQUENTLY) faceapi.tf.env().set('CANVAS2D_WILL_READ_FREQUENTLY', true);
//   if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV) faceapi.tf.env().set('WEBGL_EXP_CONV', true);
//   if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV) faceapi.tf.env().set('WEBGL_EXP_CONV', true);

//   // check version
//   log(`Version: FaceAPI ${str(faceapi?.version || '(not loaded)')} TensorFlow/JS ${str(faceapi.tf?.version_core || '(not loaded)')} Backend: ${str(faceapi.tf?.getBackend() || '(not loaded)')}`);

//   await setupFaceAPI();
//   await setupCamera();
// }

async function main(){
  document.getElementById('start-button').addEventListener('click', async function() {
    const selectedLanguage = document.getElementById('sl').value;
    console.log(`Selected language: ${selectedLanguage}`);
    const spLanguage = document.getElementById('tl').value;
    console.log(`Selected language: ${spLanguage}`);

    ipcRenderer.send('language', [selectedLanguage, spLanguage]);

  
    // You can use the selectedLanguage in your function
    // initialize tfjs
    log('FaceAPI WebCam Test');
  
    // default is webgl backend
    await faceapi.tf.setBackend('webgl');
    await faceapi.tf.ready();
  
    // tfjs optimizations
    if (faceapi.tf?.env().flagRegistry.CANVAS2D_WILL_READ_FREQUENTLY) faceapi.tf.env().set('CANVAS2D_WILL_READ_FREQUENTLY', true);
    if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV) faceapi.tf.env().set('WEBGL_EXP_CONV', true);
    if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV) faceapi.tf.env().set('WEBGL_EXP_CONV', true);
  
    // check version
    log(`Version: FaceAPI ${str(faceapi?.version || '(not loaded)')} TensorFlow/JS ${str(faceapi.tf?.version_core || '(not loaded)')} Backend: ${str(faceapi.tf?.getBackend() || '(not loaded)')}`);
  
    await setupFaceAPI();
    await setupCamera();
  });
}

// start processing as soon as page is loaded
window.onload = main;
