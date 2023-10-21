(function() {
    // Initialization
    let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
    let synth = window.speechSynthesis;
    let manuallyStopped = false;
    let recognitionActive = false;
    const RECOGNITION_TIMEOUT = 1000;  
    const INACTIVITY_DURATION = 90000; 
    let isAwakened = false;
    let inactivityTimeout;
    let programmaticRestart = false;

    const WAKE_UP_PHRASES = ["Hi"];
    let conversationHistory = [{
        role: "system",
        content: "You are an helpful assistant"
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
        programmaticRestart = false;
    };
    recognition.onsoundstart = () => { console.log("Some sound is being received"); };
    recognition.onspeechstart = () => { console.log("Speech has been detected"); };
    recognition.onstart = () => { recognitionActive = true; };
    recognition.onend = () => {
        recognitionActive = false;
        if (isVoiceButtonActive() && !synth.speaking && !manuallyStopped) {
            programmaticRestart = true;
            recognition.start();
        }
    };

    function isVoiceButtonActive() {
        const voiceButton = document.getElementById("voice-btn");
        return voiceButton && voiceButton.textContent === "STOP";
    }

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
            const messageList = document.getElementById("message-list");
            const lastMessage = messageList.lastChild;
            if (lastMessage && lastMessage.textContent === "Listening...") {
                messageList.removeChild(lastMessage);
            }
        }
    });

    function getPreferredVoiceName() {
        return /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent) ? "Google US English" : "Samantha";
    }

    function speakText(text, synth) {
        recognition.stop();
        if (synth.speaking) {
            synth.cancel();
        }
        voiceButton.innerHTML = '<img src="https://kingamada.github.io/lord/listeng.gif" alt="Listening...">';
        const voiceName = getPreferredVoiceName();
        const targetVoice = synth.getVoices().find(voice => voice.name === voiceName) || synth.getVoices()[0];
        
        let chunks = text.split(/(?<=[.!?])\s+/);
        let speakChunk = () => {
            if (chunks.length === 0) {
                voiceButton.textContent = "STOP";
                if (!manuallyStopped) {
                    programmaticRestart = true;
                    recognition.start();
                    displayMessage("Listening...", "user");
                }
                return;
            }
            let chunk = chunks.shift();
            let utterance = new SpeechSynthesisUtterance(chunk);
            utterance.voice = targetVoice;
            utterance.rate = 1.1;
            utterance.onend = () => {
                setTimeout(speakChunk, 7);
            };
            synth.speak(utterance);
        };

        speakChunk();
    }

    const MODEL_PRIORITY = ["gpt-4", "gpt-3.5-turbo", "gpt-3", "gpt-2"];

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
