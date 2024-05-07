const { ipcRenderer } = require('electron');

ipcRenderer.on('subtitle', (event, data) => {
  document.getElementById("subtitles-text").innerHTML = data;
  // divEle.style.top = "600px";
  // divEle.style.left = "450px";

  setTimeout(() => {
    divEle.innerHTML = "";
  }, 60000);
});