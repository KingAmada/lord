const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const payload = req.body;

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return res.status(200).json(response.data);

  } catch (error) {
    return res.status(error.response?.status || 500).json(error.response?.data || {});
  }
};
