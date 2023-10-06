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
const userAgent = navigator.userAgent;
let isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent);
let isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
const synths = window.speechSynthesis;

function logVoices() {
    const voices = synths.getVoices();
    voices.forEach(voice => {
        console.log(`Name: ${voice.name}, Lang: ${voice.lang}`);
    });
}
function textToSpeech(text) {
    // Determine the browser

    if (isChrome) {
        // Use Google's voice in Chrome
        speakWithVoice(text, "Google US English");
    
    } else if (isSafari) {
        // Use Siri's voice in Safari
        speakWithVoice(text, "Samantha"); // Samantha is often the name for Siri's voice in Safari
    } else {
        console.error("Unsupported browser");
    }
}

function speakWithVoice(text, voiceName) {
   const synth = window.speechSynthesis;
    
    // Split the text into sentences
    const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
    
    function speakSentence(index) {
        if (index >= sentences.length) return;

        const utterance = new SpeechSynthesisUtterance(sentences[index]);
        const voices = synth.getVoices();
        const targetVoice = voices.find(voice => voice.name === voiceName);

        if (targetVoice) {
            utterance.voice = targetVoice;
            utterance.onend = () => speakSentence(index + 1);  // Play the next sentence when the current one ends
            synth.speak(utterance);
        } else {
            console.error(`Voice with name "${voiceName}" not found.`);
        }
    }

    // Start with the first sentence
    speakSentence(0);
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
