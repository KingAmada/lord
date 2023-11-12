(function() {
    // Initialization
    let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
    let manuallyStopped = false;
    const RECOGNITION_TIMEOUT = 1000;  
    const INACTIVITY_DURATION = 90000; 
    let isAwakened = false;
    let inactivityTimeout;
    let isRecognitionActive = false;
    let programmaticRestart = false;
    let track = false;

    const WAKE_UP_PHRASES = ["Hi"];
    let conversationHistory = [{
        role: "system",
        content: "You are an helpful assistant, but always respond like snoop dog"
    }];

    // Event Listeners
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = handleRecognitionResult;
    recognition.onaudiostart = () => { 
        console.log("Audio capturing started");
        if (!programmaticRestart) {
            displayMessage("Listening...", "user");
        }
    };
    recognition.onsoundstart = () => { console.log("Some sound is being received"); };
    recognition.onspeechstart = () => { console.log("Speech has been detected"); };
    recognition.onstart = () => { 
    setVoiceButtonState("STOP");
    setActiveMode();};
    recognition.onend = () => {
      programmaticRestart = true;
      console.log("Programatic Restart");
      startRecognition();
    };


    function startsWithWakeUpPhrase(message) {
        return WAKE_UP_PHRASES.some(phrase => message.toLowerCase().startsWith(phrase));
    }

    if (window.AudioContext && new AudioContext().state === "suspended") {
        console.log("Auto-play might be restricted. Need user gesture to enable.");
        document.addEventListener('click', function resumeAudioContext(event) {
            new AudioContext().resume().then(() => {
                console.log("AudioContext resumed successfully");
                document.removeEventListener('click', resumeAudioContext);
            });
        });
    }

    function handleRecognitionResult(event) {
        const userMessage = event.results[event.results.length - 1][0].transcript.trim();
        document.getElementById("voice-btn").classList.add("active");
        console.log("Recognized speech:", userMessage);
        const messageList = document.getElementById("message-list");
        const lastMessage = messageList.lastChild;
        if (lastMessage) {
            lastMessage.textContent = userMessage;
        }

        if (isAwakened) {
            processCommand(userMessage);
        } else if (startsWithWakeUpPhrase(userMessage)) {
            setActiveMode();
            processCommand(userMessage);
        }
    }
function startRecognition() {
    // Check if the recognition is already active to prevent double-start errors)
     if (programmaticRestart) {
       try {
            recognition.start();
            isRecognitionActive = true;
            console.log("Recognition started.");
            setVoiceButtonState("STOP");
        } catch (e) {
            // Handle the error, e.g., if the recognition is already started
            console.error("Error starting recognition:", e);
        }
  }
        else if (!programmaticRestart) {
        programmaticRestart = false;
        console.log("Recognition ended, attempting to restart second stage.");
        try {
            recognition.start();
            isRecognitionActive = true;
            console.log("Recognition started.");
            setVoiceButtonState("STOP");
        } catch (e) {
            // Handle the error, e.g., if the recognition is already started
            console.error("Error starting recognition:", e);
        }
    }
}

function stopRecognition() {
    // Only attempt to stop if the recognition is currently active
        recognition.stop();
        isRecognitionActive = false;
        console.log("Recognition stopped.");
        setVoiceButtonState("START");
}
    function processCommand(command) {
        getChatCompletion(command).then(displayAndSpeak);
        resetActiveTimer();
        if (conversationHistory.length > 4) {
            conversationHistory.splice(1, 1);
        }
    }

    function displayAndSpeak(message) {
        displayMessage(message, "assistant");
        textToSpeech(message);
    }

    function setActiveMode() {
        isAwakened = true;
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(() => {
            isAwakened = false;
            displayMessage("Listening for wake word...", "system");
        }, INACTIVITY_DURATION);
    }

    function resetActiveTimer() {
        if (isAwakened) {
            clearTimeout(inactivityTimeout);
            inactivityTimeout = setTimeout(() => {
                isAwakened = false;
            }, INACTIVITY_DURATION);
        }
    }

    function displayMessage(message, role) {
        const messageList = document.getElementById("message-list");
        const messageItem = document.createElement("li");
        messageItem.className = role;
        messageItem.textContent = message;
        messageList.appendChild(messageItem);
        messageList.scrollTop = messageList.scrollHeight;
        return messageItem;
    }

  async function textToSpeech(text) {
  const endpoint = 'https://lordne.vercel.app/api/openaiProxy';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'tts', // Indicate that this is a TTS request
        data: { // Data for the TTS request
          model: "tts-1",
          voice: "alloy",
          input: text
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const audioData = await response.blob();
    // Play the audio blob with an audio element
    const audioUrl = URL.createObjectURL(audioData);
    const audio = new Audio(audioUrl);
      stopRecognition();
      isRecognitionActive = false;
      programmaticRestart = false;
      setVoiceButtonState("LISTENING");
    audio.play();
       // Update the UI to reflect that the assistant has finished speaking
      audio.onended = () => {
         if (!manuallyStopped) {
    startRecognition();
//             isRecognitionActive = false;
         }
    };
  } catch (error) {
    console.error('There was an error with the text-to-speech request:', error);
  }
}

    function setVoiceButtonState(state) {
         const voiceButton = document.getElementById("voice-btn");
    if (state === "START") {
        voiceButton.textContent = "START";
        voiceButton.classList.remove("active", "listening");
    } else if (state === "STOP") {
        voiceButton.textContent = "STOP";
        voiceButton.classList.add("active");
        } else if (state === "LISTENING") {
            voiceButton.innerHTML = '<img src="https://kingamada.github.io/lord/listeng.gif" alt="Listening...">';
        voiceButton.classList.add("listening");
        }
    }
    const voiceButton = document.getElementById("voice-btn");
    voiceButton.addEventListener("click", function() {
        if (voiceButton.textContent === "START" || voiceButton.querySelector("svg")) {
    manuallyStopped = true;
    startRecognition();
            setVoiceButtonState("STOP");
  } else {
            setVoiceButtonState("START");
    manuallyStopped = false;
    stopRecognition();
            const messageList = document.getElementById("message-list");
            const lastMessage = messageList.lastChild;
            if (lastMessage && lastMessage.textContent === "Listening...") {
                messageList.removeChild(lastMessage);
            }
  }
    });
   
    const MODEL_PRIORITY = ["gpt-4", "gpt-3.5-turbo", "gpt-3", "gpt-2"];

    async function getChatCompletion(prompt, modelIndex = 0) {
        if (modelIndex >= MODEL_PRIORITY.length) {
            console.error("All models exhausted.");
            return "Sorry, I encountered multiple errors. Please try again later.";
        }

        const currentModel = MODEL_PRIORITY[modelIndex];
        conversationHistory.push({ role: "system", content: prompt });
        const endpoint = "https://lordne.vercel.app/api/openaiProxy";
        const payload = {
             type: 'chat', // Indicate that this is a chat request
    data: { // Data for the chat completion request
      model: currentModel,
      messages: conversationHistory
    }
        };

        try {
            console.log("Sending request with payload:", JSON.stringify(payload));
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const jsonResponse = await response.json();
            const assistantReply = jsonResponse.choices[0].message.content;
            conversationHistory.push({ role: "assistant", content: assistantReply });
            return assistantReply;

        } catch (error) {
            console.warn(`Error using model ${currentModel}. Trying next model. Error: ${error.message}`);
            return await getChatCompletion(prompt, modelIndex + 1);
        }
    }
})();

