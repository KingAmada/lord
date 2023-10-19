// Initialization
let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
let synth = window.speechSynthesis;
let manuallyStopped = false;
let recognitionActive = false;
let listeningMessageElement = null;
const RECOGNITION_TIMEOUT = 1000;  // Set to 1 second for faster processing
const INACTIVITY_DURATION = 90000; // 1 minute 30 seconds in milliseconds
let isAwakened = false;
let inactivityTimeout;

const WAKE_UP_PHRASES = ["Hi"];

let conversationHistory = [
    {
        role: "system",
        content: `
        You are an helpful assistant `
    }
];

// Event listeners
recognition.continuous = false;
recognition.lang = 'en-US';
recognition.interimResults = false;
recognition.maxAlternatives = 1;

recognition.onresult = handleRecognitionResult;
recognition.onaudiostart = () => { console.log("Audio capturing started");  listeningMessageElement = displayMessage("Listening...", "user");};
recognition.onsoundstart = () => { console.log("Some sound is being received"); };
recognition.onspeechstart = () => { console.log("Speech has been detected"); };

recognition.onstart = () => { recognitionActive = true; };
recognition.onend = () => {
    recognitionActive = false;
    if (voiceButton.textContent === "Stop" && !synth.speaking && !manuallyStopped && !recognitionActive) {
        recognition.start();
    }
};

// Helper function to check if a message starts with a wake-up phrase
function startsWithWakeUpPhrase(message) {
    return WAKE_UP_PHRASES.some(phrase => message.toLowerCase().startsWith(phrase));
}
if (window.AudioContext && new AudioContext().state === "suspended") {
    console.log("Auto-play might be restricted. Need user gesture to enable.");

    // Add a one-time event listener for a user gesture
    document.addEventListener('click', function resumeAudioContext(event){
        // Attempt to resume the audio context
        new AudioContext().resume().then(() => {
            console.log("AudioContext resumed successfully");
            
            // Remove the event listener after it's been executed
            document.removeEventListener('click', resumeAudioContext);
        });
    });
}

// Function to handle results from the recognition service
function handleRecognitionResult(event) {
    const userMessage = event.results[event.results.length - 1][0].transcript.trim();
    document.getElementById("voice-btn").classList.add("active");
    console.log("Recognized speech:", userMessage);
     if (listeningMessageElement) {
        listeningMessageElement.textContent = userMessage;
        listeningMessageElement = null;
    } else {
        displayMessage(userMessage, "user");
    }   
    if (isAwakened) {
        processCommand(userMessage);
    } else if (startsWithWakeUpPhrase(userMessage)) {
        setActiveMode();
        processCommand(userMessage);
    }
}

// Process recognized command
function processCommand(command) {
    if (!listeningMessageElement) {
        displayMessage(command, "user");
    }
    getChatCompletion(command).then(displayAndSpeak);
    resetActiveTimer();
    if (conversationHistory.length > 4) {
        conversationHistory.splice(1, 1);
    }
}

// Display and read out the message
function displayAndSpeak(message) {
    displayMessage(message, "assistant");
    textToSpeech(message);
}

// Set to active listening mode
function setActiveMode() {
    isAwakened = true;
    clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(() => {
        isAwakened = false;
        displayMessage("Listening for wake word...", "system");
    }, INACTIVITY_DURATION);
}

// Reset the active timer
function resetActiveTimer() {
    if (isAwakened) {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(() => {
            isAwakened = false;
        }, INACTIVITY_DURATION);
    }
}

// Display message on the screen
function displayMessage(message, role) {
   const messageList = document.getElementById("message-list");
    const messageItem = document.createElement("li");
    messageItem.className = role;
    messageItem.textContent = message;
    messageList.appendChild(messageItem);
    // Scroll to the bottom
    messageList.scrollTop = messageList.scrollHeight;
    return messageItem;  // return the created element
}


// Convert text to speech
function textToSpeech(text) {
    if (synth.getVoices().length === 0) {
        synth.onvoiceschanged = () => {
            speakText(text, synth);
        };
    } else {
        speakText(text, synth);
    }
}

const voiceButton = document.getElementById("voice-btn");
voiceButton.addEventListener("click", function() {
    if (voiceButton.textContent === "START" || voiceButton.querySelector("svg")) {
        manuallyStopped = false;
        recognition.start();
        voiceButton.textContent = "STOP";
        setActiveMode();
    } else {
        manuallyStopped = true;
        recognition.stop();
        voiceButton.textContent = "START";
        document.getElementById("voice-btn").classList.remove("active");
    }
});

function speakText(text, synth) {
       const voices = synth.getVoices();
    const voiceName = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent) ? "Google US English" : "Samantha";
    let targetVoice = voices.find(voice => voice.name === voiceName);

    // If neither "Samantha" nor "Google US English" is found, use the first available voice
    if (!targetVoice) {
        console.warn(`Desired voice "${voiceName}" not found. Using default voice.`);
        targetVoice = voices[0];
    }
    speakUsingVoice(text, targetVoice, synth);
}

function speakUsingVoice(text, voice, synth) {
    if (synth.speaking) {
        synth.cancel();
    }
voiceButton.innerHTML = '<img src="https://kingamada.github.io/lord/listeng.gif" alt="Listening...">';
    let chunks = text.split(/(?<=[.!?])\s+/);
    let speakChunk = () => {
        if (chunks.length === 0) {
            // Revert the button content back to "Start" when the assistant stops speaking
            voiceButton.textContent = "STOP";
            if (voiceButton.textContent === "STOP" && !manuallyStopped) {
                console.log("Attempting to restart recognition...");
                recognition.start();  // Restart recognition after speaking is done only if not manually stopped
            }
            return;
        }
        let chunk = chunks.shift();
        let utterance = new SpeechSynthesisUtterance(chunk);
        utterance.voice = voice;
        utterance.rate = 1.1;
        utterance.onend = () => {
            setTimeout(() => {
        speakChunk(); // Continue with the next chunk
        if (chunks.length === 0) {
            // If no more chunks are left, restart the recognition after a delay
            setTimeout(() => {
                if (voiceButton.textContent === "STOP" && !manuallyStopped) {
                    console.log("Attempting to restart recognition...");
                    recognition.start();
                }
            }, 500); // 500ms delay
        } else {
            recognition.stop();  // Stop recognition while speaking the next chunk
        }
    }, 30);
        };
        synth.speak(utterance);
    };
    speakChunk();    
}

const MODEL_PRIORITY = ["gpt-4", "gpt-3.5-turbo", "gpt-3", "gpt-2"]; // and so on...

async function getChatCompletion(prompt, modelIndex = 0) {
    if (modelIndex >= MODEL_PRIORITY.length) {
        console.error("All models exhausted.");
        return "Sorry, I encountered multiple errors. Please try again later.";
    }

    const currentModel = MODEL_PRIORITY[modelIndex];
    conversationHistory.push({ role: "system", content: prompt });
    const endpoint = "https://lord-nine.vercel.app/api/openaiProxy";
    const payload = {
        model: currentModel,
        messages: conversationHistory
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
            throw new Error("API Error");
        }

        const jsonResponse = await response.json();
        const assistantReply = jsonResponse.choices[0].message.content;
        conversationHistory.push({ role: "assistant", content: assistantReply });
        return assistantReply;

    } catch (error) {
        console.warn(`Error using model ${currentModel}. Trying next model.`);
        return await getChatCompletion(prompt, modelIndex + 1);
    }
}
