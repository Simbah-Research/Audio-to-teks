const recordBtn = document.querySelector(".record"),
  result = document.querySelector(".result"),
  copyTextBtn = document.querySelector(".copy-text"),
  inputLanguage = document.querySelector("#language"),
  clearBtn = document.querySelector(".clear");

let SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition,
  recognition,
  recording = false,
  mediaRecorder,
  audioChunks = [],
  recordingTimer,
  recordingDuration = 0,
  offlineChunks = [],
  isOnline = navigator.onLine;

let fullTranscript = "";

// Mendeteksi status online/offline
window.addEventListener("online", () => {
  isOnline = true;
  showNotification("Connection restored. Resuming transcription.", "success");
  if (recording) {
    restartRecognition();
  }
});

window.addEventListener("offline", () => {
  isOnline = false;
  showNotification(
    "Connection lost. Recording will continue but transcription may be delayed.",
    "warning"
  );
});

function populateLanguages() {
  languages.forEach((lang) => {
    const option = document.createElement("option");
    option.value = lang.code;
    option.innerHTML = lang.name;
    inputLanguage.appendChild(option);
  });
}

populateLanguages();

function createAudioPlayer(audioUrl, duration) {
  const audioContainer = document.createElement("div");
  audioContainer.className = "audio-container";
  audioContainer.style.display = "flex";
  audioContainer.style.alignItems = "center";
  audioContainer.style.marginTop = "10px";
  audioContainer.style.padding = "10px";
  audioContainer.style.backgroundColor = "#f0f0f0";
  audioContainer.style.borderRadius = "5px";

  const audioPlayer = document.createElement("audio");
  audioPlayer.src = audioUrl;
  audioPlayer.controls = true;
  audioPlayer.style.flexGrow = "1";

  const durationSpan = document.createElement("span");
  durationSpan.textContent = formatDuration(duration);
  durationSpan.style.marginLeft = "10px";
  durationSpan.style.minWidth = "50px";

  const deleteButton = document.createElement("button");
  deleteButton.textContent = "🗑️";
  deleteButton.style.marginLeft = "10px";
  deleteButton.style.padding = "5px 10px";
  deleteButton.style.border = "none";
  deleteButton.style.borderRadius = "3px";
  deleteButton.style.backgroundColor = "#ff4d4d";
  deleteButton.style.color = "white";
  deleteButton.style.cursor = "pointer";
  deleteButton.onclick = () => {
    audioContainer.remove();
    showNotification("Recording deleted");
  };

  audioContainer.appendChild(audioPlayer);
  audioContainer.appendChild(durationSpan);
  audioContainer.appendChild(deleteButton);

  document.body.appendChild(audioContainer);
}

function formatDuration(seconds) {
  if (!isFinite(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.style.position = "fixed";
  notification.style.top = "20px";
  notification.style.left = "50%";
  notification.style.transform = "translateX(-50%)";
  notification.style.padding = "10px 20px";
  notification.style.borderRadius = "5px";
  notification.style.color = "white";
  notification.style.fontWeight = "bold";
  notification.style.zIndex = "1000";
  notification.style.textAlign = "center";
  notification.style.maxWidth = "80%";

  switch (type) {
    case "success":
      notification.style.backgroundColor = "#4CAF50";
      break;
    case "error":
      notification.style.backgroundColor = "#f44336";
      break;
    case "warning":
      notification.style.backgroundColor = "#ff9800";
      break;
    default:
      notification.style.backgroundColor = "#2196F3";
  }

  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transition = "opacity 0.5s ease";
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}

function updateRecordingStatus() {
  recordingDuration++;
  const minutes = Math.floor(recordingDuration / 60);
  const seconds = recordingDuration % 60;
  recordBtn.querySelector("p").innerHTML = `Stop Recording (${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")})`;
}

function restartRecognition() {
  if (recognition) {
    recognition.stop();
  }
  speechToText();
}

function ensureAccuracy(transcript) {
  const corrections = {
    presiden: "Presiden",
    menteri: "Menteri",
    dpr: "DPR",
    "undang-undang": "Undang-Undang",
  };

  Object.keys(corrections).forEach((key) => {
    const regex = new RegExp("\\b" + key + "\\b", "gi");
    transcript = transcript.replace(regex, corrections[key]);
  });

  return transcript;
}

function speechToText() {
  try {
    recognition = new SpeechRecognition();
    recognition.lang = inputLanguage.value;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 5;

    recordBtn.classList.add("recording");
    recordBtn.querySelector("p").innerHTML = "Stop Recording";
    if (!recordingTimer) {
      recordingDuration = 0;
      recordingTimer = setInterval(updateRecordingStatus, 1000);
    }

    recognition.start();
    showNotification("Recording started", "success");

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += ensureAccuracy(transcript) + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      fullTranscript += finalTranscript;
      result.innerHTML =
        fullTranscript +
        '<i style="color: #999;">' +
        interimTranscript +
        "</i>";
      copyTextBtn.disabled = false;
    };

    recognition.onerror = (event) => {
      console.error("Recognition error:", event.error);
      if (event.error === "network") {
        showNotification(
          "Network error. Attempting to restart recognition.",
          "warning"
        );
        setTimeout(restartRecognition, 1000);
      } else {
        showNotification(`Error: ${event.error}. Please try again.`, "error");
      }
    };

    recognition.onend = () => {
      if (recording && isOnline) {
        recognition.start();
      }
    };

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
          mediaRecorder.start();

          mediaRecorder.addEventListener("dataavailable", (event) => {
            audioChunks.push(event.data);
            if (!isOnline) {
              offlineChunks.push(event.data);
            }
          });

          mediaRecorder.addEventListener("stop", () => {
            clearInterval(recordingTimer);
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
            const audioUrl = URL.createObjectURL(audioBlob);

            const audio = new Audio(audioUrl);
            audio.onloadedmetadata = () => {
              if (isFinite(audio.duration)) {
                createAudioPlayer(audioUrl, audio.duration);
              } else {
                createAudioPlayer(audioUrl, 0);
              }
            };

            showNotification("Recording saved successfully", "success");
          });
        })
        .catch((error) => {
          console.error("Error accessing microphone:", error);
          showNotification(
            "Error accessing microphone. Please check your permissions.",
            "error"
          );
        });
    }
  } catch (error) {
    console.error("Error initializing speech recognition:", error);
    showNotification(
      "Error initializing speech recognition. Please try again.",
      "error"
    );
    recording = false;
  }
}

recordBtn.addEventListener("click", () => {
  if (!recording) {
    speechToText();
    recording = true;
    recordBtn.classList.add("recording-animation");
  } else {
    stopRecording();
  }
});

function stopRecording() {
  if (recognition) {
    recognition.stop();
  }
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  recordBtn.querySelector("p").innerHTML = "Start Listening";
  recordBtn.classList.remove("recording");
  recordBtn.classList.remove("recording-animation");
  recording = false;
  clearInterval(recordingTimer);
  recordingTimer = null;
  showNotification("Recording stopped", "info");

  if (offlineChunks.length > 0) {
    processOfflineChunks();
  }
}

function processOfflineChunks() {
  const offlineBlob = new Blob(offlineChunks, { type: "audio/webm" });
  const offlineUrl = URL.createObjectURL(offlineBlob);

  createAudioPlayer(offlineUrl, 0);
  showNotification("Offline recording processed", "info");

  offlineChunks = [];
}

function copyText() {
  const text = result.innerText;
  navigator.clipboard.writeText(text).then(
    () => {
      showNotification("Text copied to clipboard!", "success");
    },
    (err) => {
      console.error("Could not copy text: ", err);
      showNotification("Failed to copy text", "error");
    }
  );
}

copyTextBtn.addEventListener("click", copyText);

clearBtn.addEventListener("click", () => {
  result.innerHTML = "";
  fullTranscript = "";
  copyTextBtn.disabled = true;
  const audioContainers = document.querySelectorAll(".audio-container");
  audioContainers.forEach((container) => container.remove());
  showNotification("All content cleared", "info");
});

function handleAudioUpload() {
  // Placeholder function to maintain original structure
  showNotification("Audio upload feature is currently disabled", "warning");
}

uploadBtn.addEventListener("change", handleAudioUpload);
