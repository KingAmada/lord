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
    getChatCompletion(userMessage).then(audioUrl => {
        playAudio(audioUrl);
    });
};

function playAudio(audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play();
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

        // Send the OpenAI response to the new serverless function to get TTS audio URL
        const ttsResponse = await fetch('https://eleven-alpha.vercel.app/api/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: assistantReply })
        });

        const ttsData = await ttsResponse.json();
        return ttsData.audio;

    } catch (error) {
        console.error("Error fetching completion:", error);
        return "Sorry, I encountered an error. Please try again.";
    }
}
