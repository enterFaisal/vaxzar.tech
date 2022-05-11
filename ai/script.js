const MODEL_FILE_URL = "./model/model.json";
const contaner = document.querySelectorAll(".container");
const video = document.getElementById("webcam");
const liveView = document.getElementById("liveView");
const invisible = document.getElementById("invisible");
const enableWebcamButton = document.getElementById("webcamButton");
const loader = document.getElementsByClassName("loader")[0];
const speed = document.getElementById("speed");
const threshold = document.getElementById("Threshold");
const predictionTable = document.getElementById("predictionTable");

// Check if webcam access is supported.
function getUserMediaSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// If webcam supported, add event listener to button for when user
// wants to activate it to call enableCam function which we will
// define in the next step.
if (getUserMediaSupported()) {
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }

  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
      // First get ahold of the legacy getUserMedia, if present
      var getUserMedia =
        navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

      // Some browsers just don't implement it - return a rejected promise with an error
      // to keep a consistent interface
      if (!getUserMedia) {
        return Promise.reject(
          new Error("getUserMedia is not implemented in this browser")
        );
      }

      // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    };
  }
}
//button to activate the webcam
function enableCam(event) {
  if (!model) {
    return;
  }
  //edit video style and make width 100%
  video.style.width = "100%";

  // add hidden to the style of the container.
  contaner[0].style.display = "none";

  // make container visible.
  contaner[1].style.display = "block";

  // getUsermedia parameters to force video but not audio.
  const constraints = {
    facingMode: "user",
    video: {
      height: {
        min: 315,
        ideal: 360,
        max: 540,
      },
      width: {
        min: 560,
        ideal: 640,
        max: 960,
      },
      frameRate: {
        min: 1,
        ideal: 7,
        max: 60,
      },
    },
  };

  // Activate the webcam stream.
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(
      function (stream) {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
      }
      // If the user denies access to the webcam, show a message.
    )
    .catch(function (err) {
      alert("Please allow access to your webcam.");
    });
}

var model = undefined;

// load the model
async function loadModel() {
  const model = await tf.loadGraphModel(MODEL_FILE_URL);

  // Set the model in the global scope so we can use it in the predictWebcam
  window.model = model;

  invisible.classList.remove("invisible");

  // remove the loader
  loader.remove();
}

loadModel();

async function detact(webcamImage) {
  // Run the model on the webcam image.
  const resizedImage = webcamImage.resizeNearestNeighbor([720, 405]);
  const casted = resizedImage.cast("int32");
  const expanded = casted.expandDims(0);
  const obj = await model.executeAsync(expanded);
  return obj;
}

var children = [];

function predictWebcam() {
  // get the frame from the webcam.
  const webcamImage = tf.browser.fromPixels(video);
  // predict the objects in the frame.
  detact(webcamImage).then(function (predictions) {
    // Get the scores, class names, and bounding boxes of the detected objects.
    const classes = predictions[5].dataSync();
    const scores = predictions[1].dataSync();
    const boxes = predictions[3].dataSync();
    // remove predictions from memory.
    predictions = null;

    // score threshold to filter out objects.
    const scoresThreshold = Number("0." + threshold.value) + 0.3;

    // organize the data into a list of objects.
    const detectionObjects = buildDetectedObjects(
      scores,
      scoresThreshold,
      liveView.clientWidth, // imageWidth
      liveView.clientHeight, // imageHeight
      boxes,
      classes
    );

    // clear the old list of objects.
    for (let i = 0; i < children.length; i++) {
      liveView.removeChild(children[i]);
    }

    children.splice(0);

    //draw the bounding boxes on the image.
    if (detectionObjects.length > 0) {
      for (let i = 0; i < detectionObjects.length; i++) {
        const highlighter = document.createElement("div");

        highlighter.setAttribute("class", "highlighter");

        highlighter.style =
          "left: " +
          detectionObjects[i].bbox[0] +
          "px; top: " +
          detectionObjects[i].bbox[1] +
          "px; width: " +
          detectionObjects[i].bbox[2] +
          "px; height: " +
          detectionObjects[i].bbox[3] +
          "px;";
        highlighter.style.backgroundColor = "rgba(255, 0, 0, 0.5)";

        liveView.appendChild(highlighter);

        children.push(highlighter);
      }

      // get hh and mm and ss and but it in one string.
      const time = new Date().toLocaleTimeString();

      // add to the predictionTable the data.
      const row = predictionTable.insertRow(1);
      const cell1 = row.insertCell(0);

      const cell2 = row.insertCell(1);
      cell2.classList.add("centd");

      const cell3 = row.insertCell(2);

      cell1.innerHTML = detectionObjects.length;
      cell2.innerHTML = time;
      cell3.innerHTML = detectionObjects[0].score;
    }
  });

  setTimeout(function () {
    window.requestAnimationFrame(predictWebcam);
    //the time that we want to wait between each frame.
  }, 2400 / speed.value);
}

function buildDetectedObjects(
  scores,
  threshold,
  imageWidth,
  imageHeight,
  boxes,
  classes
) {
  const detectionObjects = [];
  scores.forEach((score, i) => {
    if (score > threshold && classes[i] == "3") {
      const bbox = [];
      const minY = boxes[i * 4] * imageHeight;
      const minX = boxes[i * 4 + 1] * imageWidth;
      const maxY = boxes[i * 4 + 2] * imageHeight;
      const maxX = boxes[i * 4 + 3] * imageWidth;
      bbox[0] = minX;
      bbox[1] = minY;
      bbox[2] = maxX - minX;
      bbox[3] = maxY - minY;

      detectionObjects.push({
        class: classes[i],
        score: score.toFixed(4),
        bbox: bbox,
      });
    }
  });

  return detectionObjects;
}

function procam() {
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }

  // Some browsers partially implement mediaDevices. We can't just assign an object
  // with getUserMedia as it would overwrite existing properties.
  // Here, we will just add the getUserMedia property if it's missing.
  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
      // First get ahold of the legacy getUserMedia, if present
      var getUserMedia =
        navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

      // Some browsers just don't implement it - return a rejected promise with an error
      // to keep a consistent interface
      if (!getUserMedia) {
        return Promise.reject(
          new Error("getUserMedia is not implemented in this browser")
        );
      }

      // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    };
  }

  navigator.mediaDevices
    .getUserMedia({ audio: true, video: true })
    .then(function (stream) {
      var video = document.querySelector("video");
      // Older browsers may not have srcObject
      if ("srcObject" in video) {
        video.srcObject = stream;
      } else {
        // Avoid using this in new browsers, as it is going away.
        video.src = window.URL.createObjectURL(stream);
      }
      video.onloadedmetadata = function (e) {
        video.play();
      };
    })
    .catch(function (err) {
      console.log(err.name + ": " + err.message);
    });
}
