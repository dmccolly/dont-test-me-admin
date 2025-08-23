const fs = require('fs');
const path = require('path');

// Use a more persistent approach - try multiple storage locations
const STORAGE_LOCATIONS = [
    '/tmp/audio-games-data.json',
    '/var/task/games-data.json',  // Alternative location
    process.env.LAMBDA_TASK_ROOT ? path.join(process.env.LAMBDA_TASK_ROOT, 'games-data.json') : null
].filter(Boolean);

let gameIdCounter = 1;
let gamesCache = null; // In-memory cache

// Initialize storage with multiple fallback locations
function initializeStorage() {
    try {
        // First try to load from any existing storage location
        for (const location of STORAGE_LOCATIONS) {
            try {
                if (fs.existsSync(location)) {
                    const data = fs.readFileSync(location, 'utf8');
                    const parsed = JSON.parse(data);
                    gameIdCounter = parsed.counter || 1;
                    gamesCache = parsed.games || [];
                    console.log(`Loaded existing games from ${location}:`, gamesCache.length, 'games');
                    return gamesCache;
                }
            } catch (err) {
                console.log(`Could not load from ${location}:`, err.message);
                continue;
            }
        }
        
        // No existing data found, initialize with demo game
        console.log('No existing storage found, initializing with demo game');
        const initialGames = [{
            id: 1,
            name: "Demo Game",
            files: generateDemoAudioFiles()
        }];
        gameIdCounter = 2;
        gamesCache = initialGames;
        
        // Save initial data
        saveToStorage(initialGames);
        return initialGames;
        
    } catch (error) {
        console.error('Error initializing storage:', error);
        // Fallback to demo game
        const fallbackGames = [{
            id: 1,
            name: "Demo Game",
            files: generateDemoAudioFiles()
        }];
        gameIdCounter = 2;
        gamesCache = fallbackGames;
        return fallbackGames;
    }
}

// Save games with multiple location attempts and caching
function saveToStorage(games) {
    try {
        const dataToSave = {
            games: games,
            counter: gameIdCounter,
            lastUpdated: new Date().toISOString(),
            version: '1.0'
        };
        
        const jsonData = JSON.stringify(dataToSave, null, 2);
        let savedSuccessfully = false;
        
        // Try to save to multiple locations
        for (const location of STORAGE_LOCATIONS) {
            try {
                // Ensure directory exists
                const dir = path.dirname(location);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                fs.writeFileSync(location, jsonData, 'utf8');
                console.log(`Successfully saved games to ${location}`);
                savedSuccessfully = true;
                break; // Success, no need to try other locations
            } catch (err) {
                console.log(`Could not save to ${location}:`, err.message);
                continue;
            }
        }
        
        // Update cache regardless of file save success
        gamesCache = games;
        
        if (!savedSuccessfully) {
            console.warn('Could not save to any storage location, using memory cache only');
        }
        
        return savedSuccessfully;
    } catch (error) {
        console.error('Error saving to storage:', error);
        // Still update cache
        gamesCache = games;
        return false;
    }
}

// Load games with cache fallback
function loadFromStorage() {
    try {
        // Try to load from file first
        for (const location of STORAGE_LOCATIONS) {
            try {
                if (fs.existsSync(location)) {
                    const data = fs.readFileSync(location, 'utf8');
                    const parsed = JSON.parse(data);
                    gameIdCounter = parsed.counter || gameIdCounter;
                    gamesCache = parsed.games || [];
                    return gamesCache;
                }
            } catch (err) {
                console.log(`Could not load from ${location}:`, err.message);
                continue;
            }
        }
        
        // Fallback to cache if files not available
        if (gamesCache) {
            console.log('Using cached games data');
            return gamesCache;
        }
        
        // No data available, reinitialize
        console.log('No data available, reinitializing');
        return initializeStorage();
        
    } catch (error) {
        console.error('Error loading from storage:', error);
        return gamesCache || [];
    }
}

// Generate demo audio files with different frequencies
function generateDemoAudioFiles() {
    const files = [];
    for (let i = 0; i < 18; i++) {
        const frequency = 200 + (i * 50);
        const audioData = generateSineWave(frequency, 0.3, 44100); // 0.3 seconds duration
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
    
    for (let i = 0; i < samples; i++) {
        const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
        view.setInt16(44 + i * 2, sample * 32767, true);
    }
    
    return Buffer.from(buffer).toString('base64');
}

// MULTIPART PARSER - working solution without external dependencies
function parseMultipartFormData(body, boundary) {
    console.log('=== MULTIPART PARSING DEBUG ===');
    console.log('Boundary:', boundary);
    console.log('Body type:', typeof body);
    console.log('Body length:', body ? body.length : 'null/undefined');
    
    if (!body) {
        console.log('ERROR: No body provided');
        return { fields: {}, files: [] };
    }
    
    const bodyStr = typeof body === 'string' ? body : body.toString();
    const fields = {};
    const files = [];
    
    const delimiter = `--${boundary}`;
    const parts = bodyStr.split(delimiter);
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        if (part.length < 10 || part.trim() === '--' || part.trim() === '') {
            continue;
        }
        
        const headerEndIndex = part.indexOf('\r\n\r\n');
        const actualHeaderEnd = headerEndIndex !== -1 ? headerEndIndex : part.indexOf('\n\n');
        
        if (actualHeaderEnd === -1) continue;
        
        const headers = part.substring(0, actualHeaderEnd);
        const content = part.substring(actualHeaderEnd + (headerEndIndex !== -1 ? 4 : 2));
        
        const dispositionMatch = headers.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
        
        if (dispositionMatch) {
            const fieldName = dispositionMatch[1];
            const fileName = dispositionMatch[2];
            
            if (fileName) {
                const contentBuffer = Buffer.from(content, 'binary');
                const base64Data = contentBuffer.toString('base64');
                
                let mimeType = 'audio/mpeg';
                const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
                if (contentTypeMatch) {
                    mimeType = contentTypeMatch[1].trim();
                }
                
                files.push({
                    fieldName: fieldName,
                    filename: fileName,
                    mimeType: mimeType,
                    base64: base64Data,
                    dataUrl: `data:${mimeType};base64,${base64Data}`,
                    size: contentBuffer.length
                });
            } else {
                let fieldValue = content;
                if (fieldValue.endsWith('\r\n')) {
                    fieldValue = fieldValue.slice(0, -2);
                }
                if (fieldValue.endsWith('\n')) {
                    fieldValue = fieldValue.slice(0, -1);
                }
                
                fields[fieldName] = fieldValue;
            }
        }
    }
    
    console.log('Fields found:', Object.keys(fields));
    console.log('Files found:', files.length);
    
    return { fields, files };
}

const handler = async (event, context) => {
    // Initialize storage and load games
    let games = initializeStorage();
    
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
                games = loadFromStorage();
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(games)
                };
            } else {
                const gameId = parseInt(path.split('/')[1]);
                games = loadFromStorage();
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
                    body: JSON.stringify({ 
                        error: 'Content-Type must be multipart/form-data',
                        received: contentType 
                    })
                };
            }
            
            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            if (!boundaryMatch) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'No boundary found in Content-Type' })
                };
            }
            
            const boundary = boundaryMatch[1].replace(/"/g, '');
            
            let bodyData = event.body;
            if (event.isBase64Encoded) {
                bodyData = Buffer.from(event.body, 'base64').toString('binary');
            }
            
            const { fields, files } = parseMultipartFormData(bodyData, boundary);
            
            const gameName = fields.name;
            if (!gameName) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Game name is required',
                        received_fields: Object.keys(fields),
                        field_values: fields
                    })
                };
            }
            
            const audioFiles = files.filter(f => f.fieldName === 'files');
            if (audioFiles.length === 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'At least one audio file is required',
                        received_files: files.length
                    })
                };
            }
            
            games = loadFromStorage();
            
            const processedFiles = [];
            for (let i = 0; i < Math.min(audioFiles.length, 18); i++) {
                const file = audioFiles[i];
                processedFiles.push({
                    filename: `game_${gameIdCounter}_file_${i + 1}.mp3`,
                    original_name: file.filename,
                    path: file.dataUrl
                });
            }
            
            while (processedFiles.length < 18) {
                const sourceIndex = processedFiles.length % audioFiles.length;
                const sourceFile = audioFiles[sourceIndex];
                processedFiles.push({
                    filename: `game_${gameIdCounter}_file_${processedFiles.length + 1}.mp3`,
                    original_name: sourceFile.filename,
                    path: sourceFile.dataUrl
                });
            }
            
            const newGame = {
                id: gameIdCounter++,
                name: gameName,
                files: processedFiles.slice(0, 18),
                created: new Date().toISOString()
            };
            
            games.push(newGame);
            
            const saveSuccess = saveToStorage(games);
            
            console.log(`SUCCESS: Created game "${gameName}" with ${newGame.files.length} files`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    message: 'Game uploaded successfully',
                    game_name: gameName,
                    files_uploaded: audioFiles.length,
                    total_files: newGame.files.length,
                    game_id: newGame.id,
                    saved_to_disk: saveSuccess
                })
            };
        }
        
        if (event.httpMethod === 'DELETE') {
            const gameId = parseInt(path.split('/')[1]);
            
            games = loadFromStorage();
            const gameIndex = games.findIndex(g => g.id === gameId);
            
            if (gameIndex === -1) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Game not found' })
                };
            }
            
            const deletedGame = games.splice(gameIndex, 1)[0];
            
            const saveSuccess = saveToStorage(games);
            
            console.log(`Successfully deleted game: ${deletedGame.name}`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    message: 'Game deleted successfully',
                    deleted_game: deletedGame.name,
                    saved_to_disk: saveSuccess
                })
            };
        }
        
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
        
    } catch (error) {
        console.error('FUNCTION ERROR:', error);
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
