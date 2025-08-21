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

// Parse multipart form data without external dependencies
function parseMultipart(body, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const bodyBuffer = Buffer.from(body, 'base64');
  
  let start = 0;
  let end = bodyBuffer.indexOf(boundaryBuffer, start);
  
  while (end !== -1) {
    if (start !== 0) {
      const partBuffer = bodyBuffer.slice(start, end);
      const headerEnd = partBuffer.indexOf('\r\n\r\n');
      
      if (headerEnd !== -1) {
        const headers = partBuffer.slice(0, headerEnd).toString();
        const content = partBuffer.slice(headerEnd + 4);
        
        // Parse Content-Disposition header
        const nameMatch = headers.match(/name="([^"]+)"/);
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/);
        
        if (nameMatch) {
          parts.push({
            name: nameMatch[1],
            filename: filenameMatch ? filenameMatch[1] : null,
            contentType: contentTypeMatch ? contentTypeMatch[1] : 'text/plain',
            content: content
          });
        }
      }
    }
    
    start = end + boundaryBuffer.length;
    end = bodyBuffer.indexOf(boundaryBuffer, start);
  }
  
  return parts;
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
      try {
        const contentType = event.headers['content-type'] || event.headers['Content-Type'];
        
        if (contentType && contentType.includes('multipart/form-data')) {
          // Handle file upload
          const boundary = contentType.split('boundary=')[1];
          if (!boundary) {
            throw new Error('No boundary found in multipart data');
          }
          
          const parts = parseMultipart(event.body, boundary);
          
          let gameName = 'New Game';
          const audioFiles = [];
          
          parts.forEach(part => {
            if (part.name === 'name') {
              gameName = part.content.toString();
            } else if (part.name === 'files' && part.filename) {
              audioFiles.push(part);
            }
          });
          
          const gameId = games.length + 1;
          const uploadedFiles = [];
          
          // Process uploaded audio files
          for (let i = 0; i < Math.min(audioFiles.length, 18); i++) {
            const file = audioFiles[i];
            const base64Data = file.content.toString('base64');
            const mimeType = file.contentType || 'audio/mpeg';
            
            uploadedFiles.push({
              filename: `game_${gameId}_file_${i + 1}.mp3`,
              original_name: file.filename,
              path: `data:${mimeType};base64,${base64Data}`
            });
          }
          
          // Fill remaining slots with placeholder tones if needed
          while (uploadedFiles.length < 18) {
            const index = uploadedFiles.length;
            uploadedFiles.push({
              filename: `game_${gameId}_placeholder_${index + 1}.mp3`,
              original_name: `placeholder_${index + 1}.mp3`,
              path: generateToneDataURL(200 + (index * 50))
            });
          }
          
          const newGame = {
            id: gameId,
            name: gameName,
            files: uploadedFiles
          };
          
          games.push(newGame);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              message: 'Game created successfully',
              game_id: newGame.id,
              game_name: newGame.name,
              files_uploaded: audioFiles.length,
              total_files: uploadedFiles.length
            })
          };
          
        } else {
          // Handle JSON request (fallback)
          const body = JSON.parse(event.body || '{}');
          const gameId = games.length + 1;
          
          const newGame = {
            id: gameId,
            name: body.name || 'New Game',
            files: Array.from({length: 18}, (_, i) => ({
              filename: `game_${gameId}_tone_${i + 1}.mp3`,
              original_name: `tone_${i + 1}.mp3`,
              path: generateToneDataURL(200 + (i * 50))
            }))
          };
          
          games.push(newGame);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              message: 'Game created successfully (with tone placeholders)',
              game_id: newGame.id,
              game_name: newGame.name,
              files_uploaded: 0,
              total_files: 18
            })
          };
        }
        
      } catch (parseError) {
        console.error('Parse error:', parseError);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Failed to parse request', 
            details: parseError.message 
          })
        };
      }
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

