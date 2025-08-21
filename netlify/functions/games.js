const { Handler } = require('@netlify/functions');

// Simple in-memory storage for demo (in production, use a real database)
let games = [
  {
    id: 1,
    name: "Demo Game",
    files: generateDemoAudio()
  }
];

let gameIdCounter = 2;

// Generate demo audio with sine waves
function generateDemoAudio() {
  const files = [];
  for (let i = 0; i < 18; i++) {
    const frequency = 200 + (i * 50); // 200Hz, 250Hz, 300Hz, etc.
    const audioData = generateSineWave(frequency, 1.0); // 1 second duration
    files.push({
      filename: `demo_file_${i + 1}.wav`,
      original_name: `demo_${i + 1}.wav`,
      path: `data:audio/wav;base64,${audioData}`
    });
  }
  return files;
}

// Generate sine wave audio data
function generateSineWave(frequency, duration) {
  const sampleRate = 44100;
  const numSamples = sampleRate * duration;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  
  // Generate sine wave samples
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }
  
  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Parse multipart form data manually
function parseMultipartData(body, boundary) {
  const parts = body.split(`--${boundary}`);
  const formData = {};
  const files = [];
  
  for (const part of parts) {
    if (part.includes('Content-Disposition')) {
      const lines = part.split('\r\n');
      let name = '';
      let filename = '';
      let contentType = '';
      let data = '';
      
      // Parse headers
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('Content-Disposition')) {
          const nameMatch = line.match(/name="([^"]+)"/);
          const filenameMatch = line.match(/filename="([^"]+)"/);
          if (nameMatch) name = nameMatch[1];
          if (filenameMatch) filename = filenameMatch[1];
        } else if (line.includes('Content-Type')) {
          contentType = line.split(': ')[1];
        } else if (line === '' && i < lines.length - 1) {
          // Data starts after empty line
          data = lines.slice(i + 1).join('\r\n');
          break;
        }
      }
      
      if (filename) {
        // This is a file
        // Convert binary data to base64
        const binaryData = data.split('').map(char => char.charCodeAt(0));
        const uint8Array = new Uint8Array(binaryData);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binary);
        
        files.push({
          filename: filename,
          original_name: filename,
          path: `data:${contentType};base64,${base64Data}`
        });
      } else if (name) {
        // This is a form field
        formData[name] = data.trim();
      }
    }
  }
  
  return { formData, files };
}

const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/games', '');
  
  try {
    if (event.httpMethod === 'GET') {
      if (path === '' || path === '/') {
        // Get all games
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(games)
        };
      } else {
        // Get specific game
        const gameId = parseInt(path.split('/')[1]);
        const game = games.find(g => g.id === gameId);
        if (!game) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Game not found' })
          };
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(game)
        };
      }
    }
    
    if (event.httpMethod === 'POST') {
      // Handle file upload
      const contentType = event.headers['content-type'] || event.headers['Content-Type'];
      
      if (!contentType || !contentType.includes('multipart/form-data')) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' })
        };
      }
      
      // Extract boundary
      const boundaryMatch = contentType.match(/boundary=(.+)$/);
      if (!boundaryMatch) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'No boundary found in Content-Type' })
        };
      }
      
      const boundary = boundaryMatch[1];
      const body = event.isBase64Encoded ? 
        Buffer.from(event.body, 'base64').toString('binary') : 
        event.body;
      
      const { formData, files } = parseMultipartData(body, boundary);
      
      console.log('Parsed form data:', formData);
      console.log('Parsed files count:', files.length);
      
      const gameName = formData.name;
      
      if (!gameName || gameName.trim() === '') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Game name is required' })
        };
      }
      
      if (files.length !== 18) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Expected 18 files, got ${files.length}` })
        };
      }
      
      // Create new game
      const newGame = {
        id: gameIdCounter++,
        name: gameName.trim(),
        files: files
      };
      
      games.push(newGame);
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          message: 'Game uploaded successfully', 
          game: newGame 
        })
      };
    }
    
    if (event.httpMethod === 'DELETE') {
      const gameId = parseInt(path.split('/')[1]);
      const gameIndex = games.findIndex(g => g.id === gameId);
      
      if (gameIndex === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Game not found' })
        };
      }
      
      games.splice(gameIndex, 1);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Game deleted successfully' })
      };
    }
    
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
    
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      })
    };
  }
};

module.exports = { handler };

