(function() {
    // Speech recognition setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
    } else {
        console.error("Speech recognition not supported in this browser.");
        return;
    }

    let manuallyStopped = false;
    const RECOGNITION_TIMEOUT = 1000;  
    const INACTIVITY_DURATION = 90000; 
    let isAwakened = false;
    let inactivityTimeout;
    let isRecognitionActive = false;
    let programmaticRestart = false;
    const WAKE_UP_PHRASES = ["Hi"];
    let conversationHistory = [{ role: "system", content: "You are an helpful assistant, but always respond like snoop dog" }];

    // Initialize audio context
    let audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") {
        console.log("Auto-play might be restricted. Need user gesture to enable.");
        document.addEventListener('click', function resumeAudioContext() {
            audioContext.resume().then(() => {
                console.log("AudioContext resumed successfully");
                document.removeEventListener('click', resumeAudioContext);
            });
        });
    }

    // Recognition event listeners
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = handleRecognitionResult;
    recognition.onaudiostart = () => console.log("Audio capturing started");
    recognition.onsoundstart = () => console.log("Some sound is being received");
    recognition.onspeechstart = () => console.log("Speech has been detected");
    recognition.onstart = () => {
        setVoiceButtonState("STOP");
        setActiveMode();
    };
    recognition.onend = () => {
        if (!manuallyStopped) {
            programmaticRestart = true;
            startRecognition();
        }
    };

    function startsWithWakeUpPhrase(message) {
        return WAKE_UP_PHRASES.some(phrase => message.toLowerCase().startsWith(phrase));
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
        if (!isRecognitionActive) {
            try {
                recognition.start();
                isRecognitionActive = true;
                setVoiceButtonState("STOP");
            } catch (e) {
                console.error("Error starting recognition:", e);
            }
        }
    }

    function stopRecognition() {
        if (isRecognitionActive) {
            recognition.stop();
            isRecognitionActive = false;
            setVoiceButtonState("START");
        }
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
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(() => {
            isAwakened = false;
        }, INACTIVITY_DURATION);
    }

    function displayMessage(message, role) {
        const messageList = document.getElementById("message-list");
        const messageItem = document.createElement("li");
        messageItem.className = role;
        messageItem.textContent = message;
        messageList.appendChild(messageItem);
        messageList.scrollTop = messageList.scrollHeight;
    }

    async function textToSpeech(text) {
        const endpoint = 'https://lordne.vercel.app/api/openaiProxy';
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    type: 'tts',
                    data: { model: "tts-1", voice: "alloy", input: text }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            stopRecognition();
            const audioData = await response.blob();
            const audioUrl = URL.createObjectURL(audioData);
            const audio = new Audio(audioUrl);
            audio.play();
            audio.onended = () => {
                if (!manuallyStopped) startRecognition();
            };
        } catch (error) {
            console.error('Error with TTS request:', error);
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

    // Voice button event listener
    const voiceButton = document.getElementById("voice-btn");
    voiceButton.addEventListener("click", () => {
        if (voiceButton.textContent === "START" || voiceButton.querySelector("svg")) {
            manuallyStopped = false;
            startRecognition();
        } else {
            manuallyStopped = true;
            stopRecognition();
            const messageList = document.getElementById("message-list");
            const lastMessage = messageList.lastChild;
            if (lastMessage && lastMessage.textContent === "Listening...") {
                messageList.removeChild(lastMessage);
            }
        }
    });

    const MODEL_PRIORITY = ["gpt-4", "gpt-3.5-turbo", "gpt-3", "gpt-2"];

    async function getChatCompletion(prompt) {
    const currentModel = "gpt-4"; // Use the preferred model
    conversationHistory.push({ role: "user", content: prompt });

    const endpoint = "https://lordne.vercel.app/api/openaiProxy";
    const payload = {
        type: 'chat',
        data: { model: currentModel, messages: conversationHistory }
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            if (response.status === 429) {
                // Handle 429 status by waiting and then retrying
                const retryAfter = response.headers.get("Retry-After") || 30; // Use the Retry-After header value or default to 30 seconds
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                return getChatCompletion(prompt); // Retry the request
            }
            throw new Error(`API Error: ${response.statusText}`);
        }

        const jsonResponse = await response.json();
        const assistantReply = jsonResponse.choices[0].message.content;
        conversationHistory.push({ role: "assistant", content: assistantReply });
        return assistantReply;

    } catch (error) {
        console.error(`Error with chat completion: ${error.message}`);
        return "Sorry, I encountered an error. Please try again later.";
    }
}

})();
