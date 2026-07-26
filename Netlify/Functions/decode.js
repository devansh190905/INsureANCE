exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: { message: 'Method not allowed' } }) };
  }

  const API_KEY = process.env.GEMINI_API_KEY || '';
  if (!API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: { message: 'API key not configured' } }) };
  }

  try {
    const body = JSON.parse(event.body);
    const maxTokens = Math.min(body.max_tokens || 4096, 4096);

    // Convert Anthropic message format to Gemini format
    const message = body.messages[0];
    let parts = [];

    if (typeof message.content === 'string') {
      parts.push({ text: message.content });
    } else if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'text') {
          parts.push({ text: block.text });
        } else if (block.type === 'image') {
          parts.push({
            inline_data: {
              mime_type: block.source.media_type,
              data: block.source.data
            }
          });
        }
      }
    }

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + API_KEY;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: parts }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1 }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: { message: data.error?.message || 'API error' } })
      };
    }

    // Convert Gemini response to Anthropic format so website works unchanged
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ content: [{ type: 'text', text: text }] })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: 'Server error. Try again.' } })
    };
  }
};
