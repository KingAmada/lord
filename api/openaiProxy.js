const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const payload = req.body;

  // Check if the payload contains a "type" key to determine the kind of request
  if (payload.type === 'chat') {
    // Handle chat completion request
    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', payload.data, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      return res.status(200).json(response.data);

    } catch (error) {
      return res.status(error.response?.status || 500).json(error.response?.data || {});
    }
  } else if (payload.type === 'tts') {
    // Handle TTS request
    try {
      const response = await axios.post('https://api.openai.com/v1/audio/speech', payload.data, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer' // This is important for binary responses like audio
      });

      // Send the audio data as a binary response
      res.setHeader('Content-Type', 'audio/mpeg');
      return res.send(response.data);

    } catch (error) {
      return res.status(error.response?.status || 500).json(error.response?.data || {});
    }
  } else {
    return res.status(400).send("Bad Request: Unknown type");
  }
};
