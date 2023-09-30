
const synth = window.speechSynthesis;
document.addEventListener('DOMContentLoaded', function() {
    const chatbox = document.getElementById('chatbox');
    const textInput = document.getElementById('textInput');
    const startVoiceInput = document.getElementById('startVoiceInput');
    const sendMessage = document.getElementById('sendMessage');


    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        startVoiceInput.addEventListener('click', function() {
            recognition.start();
        });

        recognition.onresult = function(event) {
            const speechToText = event.results[0][0].transcript;
            textInput.value = speechToText;
sendMessage.click(); 
        };
    } else {
        startVoiceInput.disabled = true;
        startVoiceInput.textContent = 'Voice input not supported';
    }

    sendMessage.addEventListener('click', async function() {
        const userMessage = textInput.value;
        if (userMessage) {
            displayMessage(userMessage, 'user');
            const gptResponse = await getChatCompletion(userMessage);
            displayMessage(gptResponse, 'assistant');
            textInput.value = '';
        }
    });
});
function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    synth.speak(utterance);
}

function displayMessage(message, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = role;
    messageDiv.textContent = message;
    chatbox.appendChild(messageDiv);
 if (role === 'assistant') {
        speakText(message);
    }
}

async function getChatCompletion(prompt) {
    const endpoint = "https://lord-nine.vercel.app/api/openaiProxy";
  
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ "role": "user", "content": prompt }]
        })
    });

    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API Error: ${errorData}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse.choices[0].message.content;
}

