const recognition = new webkitSpeechRecognition();
recognition.lang = 'en-US';
recognition.continuous = true;
recognition.interimResults = true;

let finalTranscript = '';
recognition.onresult = function (event) {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
        } else {
            interimTranscript += event.results[i][0].transcript;
        }
    }

    document.getElementById('input-area').textContent = finalTranscript;
    if (finalTranscript !== '') {
        recognition.stop();
        getChatCompletion(finalTranscript);
    }
};

recognition.onerror = function (event) {
    console.log('Error occurred in recognition:', event.error);
};

function startRecognition() {
    finalTranscript = '';
    recognition.start();
}

let audioBuffer = [];
let isPlaying = false;

function playAudio() {
    if (audioBuffer.length === 0) {
        isPlaying = false;
        return;
    }

    isPlaying = true;
    const audioChunk = audioBuffer.shift();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioContext.decodeAudioData(audioChunk.buffer, function (buffer) {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.onended = playAudio;
        source.start(0);
    }, function (err) {
        console.log('Error decoding audio:', err);
    });
}

function textToSpeech(text) {
    const websocket = new WebSocket('wss://api.openai.com/v1/tts/ws');
    websocket.onopen = function () {
        websocket.send(JSON.stringify({ text: text }));
    };

    websocket.onmessage = function (event) {
        const data = JSON.parse(event.data);
        if (data.audio) {
            const audioChunk = base64ToUint8Array(data.audio);
            audioBuffer.push(audioChunk);
            if (!isPlaying) {
                playAudio();
            }
        }
    };

    websocket.onerror = function (event) {
        console.error('WebSocket Error:', event);
    };

    websocket.onclose = function (event) {
        if (event.code !== 1000) {
            console.warn('WebSocket closed unexpectedly. Code:', event.code, 'Reason:', event.reason);
        }
    };
}

function getChatCompletion(prompt) {
    fetch('/complete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: prompt })
    }).then(response => response.json()).then(data => {
        document.getElementById('chatOutput').textContent = data.completion;
        textToSpeech(data.completion);
    }).catch(error => {
        console.error('Error fetching chat completion:', error);
    });
}

function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

document.getElementById('voice-btn').addEventListener('click', startRecognition);
