const { Handler } = require('@netlify/functions');

// Simple in-memory storage for demo
let tickerMessages = [
  "Welcome to the audio challenge!",
  "Can you match all the sounds?",
  "Listen carefully and remember!",
  "Your ears are your best tool here!",
  "Sound memory at its finest!"
];

const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ messages: tickerMessages })
      };
    }
    
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (body.messages) {
        const newMessages = body.messages.split('\n').filter(msg => msg.trim());
        tickerMessages = newMessages;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            message: 'Messages uploaded successfully', 
            count: newMessages.length 
          })
        };
      }
      
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Messages data required' })
      };
    }
    
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

module.exports = { handler };
