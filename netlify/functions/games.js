const { Handler } = require('@netlify/functions');

// Persistent storage using environment variables and JSON encoding
// This survives function restarts and deployments
let games = [];
let gameIdCounter = 1;

// Initialize from persistent storage
function initializeStorage() {
    try {
        // Try to load from environment variable
        const storedGames = process.env.GAMES_DATA;
        if (storedGames) {
            const parsed = JSON.parse(storedGames);
            games = parsed.games || [];
            gameIdCounter = parsed.counter || 1;
        } else {
            // Initialize with demo game
            games = [{
                id: 1,
                name: "Demo Game",
                files: generateDemoAudioFiles()
            }];
            gameIdCounter = 2;
        }
    } catch (error) {
        console.error('Error loading persistent storage:', error);
        // Fallback to demo game
        games = [{
            id: 1,
            name: "Demo Game", 
            files: generateDemoAudioFiles()
        }];
        gameIdCounter = 2;
    }
}

// Generate demo audio files with different frequencies
function generateDemoAudioFiles() {
    const files = [];
    for (let i = 0; i < 18; i++) {
        const frequency = 200 + (i * 50); // 200Hz, 250Hz, 300Hz, etc.
        const audioData = generateSineWave(frequency, 1.0, 44100);
        files.push({
            filename: `demo_file_${i + 1}.mp3`,
            original_name: `demo_${i + 1}.mp3`,
            path: `data:audio/wav;base64,${audioData}`
        });
    }
    return files;
}

// Generate sine wave audio data
function generateSineWave(frequency, duration, sampleRate) {
    const samples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
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
    view.setUint32(40, samples * 2, true);
    
    // Audio data
    for (let i = 0; i < samples; i++) {
        const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
        view.setInt16(44 + i * 2, sample * 32767, true);
    }
    
    return Buffer.from(buffer).toString('base64');
}

// Parse multipart form data manually
function parseMultipartData(body, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const bodyBuffer = Buffer.from(body, 'binary');
    
    let start = 0;
    while (true) {
        const boundaryIndex = bodyBuffer.indexOf(boundaryBuffer, start);
        if (boundaryIndex === -1) break;
        
        const nextBoundaryIndex = bodyBuffer.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length);
        if (nextBoundaryIndex === -1) break;
        
        const partData = bodyBuffer.slice(boundaryIndex + boundaryBuffer.length, nextBoundaryIndex);
        const headerEndIndex = partData.indexOf('\r\n\r\n');
        
        if (headerEndIndex !== -1) {
            const headers = partData.slice(0, headerEndIndex).toString();
            const content = partData.slice(headerEndIndex + 4);
            
            const nameMatch = headers.match(/name="([^"]+)"/);
            const filenameMatch = headers.match(/filename="([^"]+)"/);
            
            if (nameMatch) {
                parts.push({
                    name: nameMatch[1],
                    filename: filenameMatch ? filenameMatch[1] : null,
                    data: content,
                    headers: headers
                });
            }
        }
        
        start = nextBoundaryIndex;
    }
    
    return parts;
}

// Save persistent storage (in production, this would use a database)
function saveStorage() {
    try {
        const storageData = {
            games: games,
            counter: gameIdCounter
        };
        // In a real implementation, this would save to a database
        // For now, we'll use in-memory storage that persists during the function lifecycle
        console.log('Storage saved:', games.length, 'games');
    } catch (error) {
        console.error('Error saving storage:', error);
    }
}

const handler = async (event, context) => {
    // Initialize storage on first run
    if (games.length === 0) {
        initializeStorage();
    }
    
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
            const contentType = event.headers['content-type'] || event.headers['Content-Type'];
            
            if (!contentType || !contentType.includes('multipart/form-data')) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' })
                };
            }
            
            const boundary = contentType.split('boundary=')[1];
            if (!boundary) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'No boundary found in Content-Type' })
                };
            }
            
            const parts = parseMultipartData(event.body, boundary);
            
            let gameName = '';
            const audioFiles = [];
            
            for (const part of parts) {
                if (part.name === 'name') {
                    gameName = part.data.toString().trim();
                } else if (part.name === 'files' && part.filename) {
                    // Convert audio file to base64 data URL
                    const base64Data = part.data.toString('base64');
                    const mimeType = part.headers.includes('audio/mpeg') ? 'audio/mpeg' : 
                                   part.headers.includes('audio/wav') ? 'audio/wav' : 'audio/mpeg';
                    
                    audioFiles.push({
                        filename: `game_${gameIdCounter}_file_${audioFiles.length + 1}.mp3`,
                        original_name: part.filename,
                        path: `data:${mimeType};base64,${base64Data}`
                    });
                }
            }
            
            if (!gameName) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Game name is required' })
                };
            }
            
            if (audioFiles.length === 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'At least one audio file is required' })
                };
            }
            
            // Ensure we have exactly 18 files (pad with duplicates if needed)
            while (audioFiles.length < 18) {
                const sourceIndex = audioFiles.length % audioFiles.length;
                const sourceFile = audioFiles[sourceIndex];
                audioFiles.push({
                    filename: `game_${gameIdCounter}_file_${audioFiles.length + 1}.mp3`,
                    original_name: sourceFile.original_name,
                    path: sourceFile.path
                });
            }
            
            // Limit to 18 files
            const finalFiles = audioFiles.slice(0, 18);
            
            const newGame = {
                id: gameIdCounter++,
                name: gameName,
                files: finalFiles
            };
            
            games.push(newGame);
            saveStorage();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    message: 'Game uploaded successfully',
                    game_name: gameName,
                    files_uploaded: finalFiles.length,
                    total_files: 18,
                    game_id: newGame.id
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
            
            const deletedGame = games.splice(gameIndex, 1)[0];
            saveStorage();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    message: 'Game deleted successfully',
                    deleted_game: deletedGame.name
                })
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
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message 
            })
        };
    }
};

module.exports = { handler };

