// Simple in-memory storage for demo (in production, use a real database)
let games = [
  {
    id: 1,
    name: "Demo Game",
    files: Array.from({length: 18}, (_, i) => ({
      filename: `demo_file_${i + 1}.mp3`,
      original_name: `demo_${i + 1}.mp3`,
      path: generateToneDataURL(200 + (i * 50)) // Only Demo Game uses tones
    }))
  }
];

// Generate a working tone data URL with a sine wave (ONLY for Demo Game)
function generateToneDataURL(frequency) {
  const sampleRate = 44100;
  const duration = 0.5;
  const samples = Math.floor(sampleRate * duration);
  
  // WAV header (44 bytes)
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  
  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + samples * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  
  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  
  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, samples * 2, true);
  
  // Generate sine wave
  const audioData = new ArrayBuffer(samples * 2);
  const audioView = new DataView(audioData);
  
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    const pcmSample = Math.floor(sample * 32767);
    audioView.setInt16(i * 2, pcmSample, true);
  }
  
  // Combine header and data
  const combined = new Uint8Array(44 + samples * 2);
  combined.set(new Uint8Array(header), 0);
  combined.set(new Uint8Array(audioData), 44);
  
  const base64 = Buffer.from(combined).toString('base64');
  return `data:audio/wav;base64,${base64}`;
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
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(games)
        };
      } else {
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
      // For now, create games with unique tone frequencies until we can properly handle file uploads
      const body = JSON.parse(event.body || '{}');
      const gameId = games.length + 1;
      
      const newGame = {
        id: gameId,
        name: body.name || 'New Game',
        files: Array.from({length: 18}, (_, i) => ({
          filename: `game_${gameId}_file_${i + 1}.mp3`,
          original_name: `file_${i + 1}.mp3`,
          // Use different frequency ranges for each game so they sound different
          path: generateToneDataURL(200 + (gameId * 200) + (i * 50))
        }))
      };
      
      games.push(newGame);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Game created successfully',
          game_id: newGame.id,
          game_name: newGame.name,
          files_uploaded: 18,
          note: 'Using tone placeholders - file upload feature coming soon'
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
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};

module.exports = { handler };

