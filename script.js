let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
recognition.lang = 'en-US';
recognition.interimResults = false;
recognition.maxAlternatives = 1;

let conversationHistory = [
    {
        role: "system",
        content: `
        You are an emergency lawyer with a clever, slightly crooked demeanor. Respond with bold confidence, citing relevant laws, rules, and regulations that will favor the user. Always aim to convince the officer using the law, leveraging the constitution, user rights, state laws, county laws, and federal laws. Your tone can vary based on the query – be it angry, sad, or happy. Be brief, punchy, but convincing. Do not express uncertainty or lack of knowledge.
        `
    }
];

document.getElementById("voice-btn").addEventListener("click", () => {
    recognition.start();
});

recognition.onresult = function(event) {
    const last = event.results.length - 1;
    const userMessage = event.results[last][0].transcript;
    displayMessage(userMessage, "user");
    getChatCompletion(userMessage).then(responseMessage => {
        displayMessage(responseMessage, "assistant");
        textToSpeech(responseMessage); 
    });
};
async function textToSpeech(text) {
    const voice_id = "21m00Tcm4TlvDq8ikWAM";  // Placeholder, replace this with the desired voice ID
    const model = 'eleven_monolingual_v1';
    const uri = `wss://api.elevenlabs.io/v1/text-to-speech/${voice_id}/stream-input?model_id=${model}`;

    let audioChunks = [];

    const websocket = new WebSocket(uri);

    websocket.onopen = function(event) {
        // Initialize the connection with initial settings
        websocket.send(JSON.stringify({
            "text": " ",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": true
            },
            "xi_api_key": "57311814f19ad395d1442578df566233"
        }));

        // Send the text to be converted to speech
        websocket.send(JSON.stringify({
            "text": text + " ",
            "try_trigger_generation": true
        }));

        // Send the End of Sequence (EOS) message
        websocket.send(JSON.stringify({
            "text": ""
        }));
    };

let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let source = null;
let startTime = 0;

function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function playDecodedAudio(audioBuffer) {
    if (source) {
        source.stop();
        source = null;
    }
    source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    if (startTime === 0) {
        startTime = audioContext.currentTime;
    }
    source.start(startTime);
    startTime += audioBuffer.duration;
}

websocket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (data.audio) {
        const uint8ArrayData = base64ToUint8Array(data.audio);
        audioContext.decodeAudioData(uint8ArrayData.buffer, function(audioBuffer) {
            playDecodedAudio(audioBuffer);
        });
    }
};




    websocket.onerror = function(error) {
        console.error("WebSocket Error:", error);
    };

    websocket.onclose = function(event) {
        if (event.wasClean) {
            console.log(`Connection closed cleanly, code=${event.code}, reason=${event.reason}`);
        } else {
            console.error('Connection died');
        }
    };
}


function displayMessage(message, role) {
    const messageList = document.getElementById("message-list");
    const messageItem = document.createElement("li");
    messageItem.className = role;
    messageItem.textContent = message;
    messageList.appendChild(messageItem);
    messageList.scrollTop = messageList.scrollHeight;  // Auto-scroll to latest message
}

async function getChatCompletion(prompt) {
    // Add the user's message to the conversation history
    conversationHistory.push({ role: "system", content: prompt });

    const endpoint = "https://lord-nine.vercel.app/api/openaiProxy";
    const payload = {
        model: "gpt-4",
        messages: conversationHistory
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API Error: ${errorData}`);
        }

        const jsonResponse = await response.json();
        const assistantReply = jsonResponse.choices[0].message.content;

        // Add the assistant's message to the conversation history
        conversationHistory.push({ role: "assistant", content: assistantReply });

        return assistantReply;

    } catch (error) {
        console.error("Error fetching completion:", error);
        return "Sorry, I encountered an error. Please try again.";
    }
}
