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
  const API_KEY = process.env.GROQ_API_KEY || '';
  if (!API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: { message: 'API key not configured' } }) };
  }
  try {
    const body = JSON.parse(event.body);
    const maxTokens = Math.min(body.max_tokens || 4096, 4096);
    const messages = [];
    const msg = body.messages[0];
    if (typeof msg.content === 'string') {
      messages.push({ role: 'user', content: msg.content });
    } else if (Array.isArray(msg.content)) {
      let contentArray = [];
      for (const block of msg.content) {
        if (block.type === 'text') {
          contentArray.push({ type: 'text', text: block.text });
        } else if (block.type === 'image') {
          contentArray.push({ type: 'image_url', image_url: { url: 'data:' + block.source.media_type + ';base64,' + block.source.data } });
        }
      }
      messages.push({ role: 'user', content: contentArray });
    }
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: messages, max_tokens: maxTokens, temperature: 0.1 })
    });
    const data = await response.json();
    if (!response.ok) {
      return { statusCode: response.status, headers, body: JSON.stringify({ error: { message: data.error?.message || 'API error' } }) };
    }
    const text = data.choices?.[0]?.message?.content || '';
    return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: 'text', text: text }] }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: { message: 'Server error. Try again.' } }) };
  }
};
