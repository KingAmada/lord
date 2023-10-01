let conversionHistory = [];

async function getVoiceInput() {
    return new Promise((resolve) => {
        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let transcript = event.results[0][0].transcript;
            resolve(transcript);
        };

        recognition.start();
    });
}

async function getChatCompletion(prompt) {
    conversionHistory.push({ role: "user", content: prompt });
    
    const response = await fetch("/api/openaiProxy", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: conversionHistory
        })
    });

    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API Error: ${errorData}`);
    }

    const jsonResponse = await response.json();
    conversionHistory.push({ role: "assistant", content: jsonResponse.choices[0].message.content });
    return jsonResponse.choices[0].message.content;
}

async function getAudioFromHuggingFace(text) {
    const API_URL = "https://api-inference.huggingface.co/models/microsoft/speecht5_tts";
    const headers = {
        "Authorization": "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",
        "Content-Type": "application/json"
    };
    const body = JSON.stringify({ "text_inputs": text });

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: headers,
        body: body
    });

    const responseData = await response.json();
    return responseData.audio_url;  // Assuming the API returns an audio URL
}

function playAudioResponse(audioUrl) {
    let audio = new Audio(audioUrl);
    audio.play();
}

document.getElementById("voice-btn").addEventListener("click", async () => {
    let userMessage = await getVoiceInput();
    addToChat("User", userMessage);
    
    let chatGPTResponse = await getChatCompletion(userMessage);
    addToChat("ChatGPT", chatGPTResponse);

    let audioUrl = await getAudioFromHuggingFace(chatGPTResponse);
    playAudioResponse(audioUrl);
});

function addToChat(role, message) {
    let chatArea = document.getElementById("chatArea");
    let messageDiv = document.createElement("div");
    messageDiv.className = role;
    messageDiv.textContent = `${role}: ${message}`;
    chatArea.appendChild(messageDiv);
}
