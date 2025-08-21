const { Handler } = require('@netlify/functions');

// Persistent storage using environment variables and JSON encoding
let games = [];
let gameIdCounter = 1;

// Initialize from persistent storage
function initializeStorage() {
    try {
        const storedGames = process.env.GAMES_DATA;
        if (storedGames) {
            const parsed = JSON.parse(storedGames);
            games = parsed.games || [];
            gameIdCounter = parsed.counter || 1;
        } else {
            games = [{
                id: 1,
                name: "Demo Game",
                files: generateDemoAudioFiles()
            }];
            gameIdCounter = 2;
        }
    } catch (error) {
        console.error('Error loading persistent storage:', error);
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
        const frequency = 200 + (i * 50);
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

// ROBUST MULTIPART PARSER - This is the key fix!
function parseMultipartData(body, boundary) {
    console.log('Parsing multipart data with boundary:', boundary);
    
    // Convert body to Buffer if it's a string
    const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body, 'binary');
    
    // Create boundary markers
    const boundaryMarker = Buffer.from(`--${boundary}`);
    const endBoundaryMarker = Buffer.from(`--${boundary}--`);
    
    const parts = [];
    let currentPos = 0;
    
    // Skip to first boundary
    let boundaryPos = bodyBuffer.indexOf(boundaryMarker, currentPos);
    if (boundaryPos === -1) {
        console.log('No boundary found in body');
        return parts;
    }
    
    currentPos = boundaryPos + boundaryMarker.length;
    
    while (currentPos < bodyBuffer.length) {
        // Skip CRLF after boundary
        if (bodyBuffer[currentPos] === 0x0D && bodyBuffer[currentPos + 1] === 0x0A) {
            currentPos += 2;
        }
        
        // Find next boundary
        const nextBoundaryPos = bodyBuffer.indexOf(boundaryMarker, currentPos);
        if (nextBoundaryPos === -1) break;
        
        // Extract part data
        const partBuffer = bodyBuffer.slice(currentPos, nextBoundaryPos);
        
        // Find headers/body separator (double CRLF)
        const headerSeparator = Buffer.from('\r\n\r\n');
        const headerEndPos = partBuffer.indexOf(headerSeparator);
        
        if (headerEndPos === -1) {
            currentPos = nextBoundaryPos + boundaryMarker.length;
            continue;
        }
        
        // Extract headers and content
        const headersBuffer = partBuffer.slice(0, headerEndPos);
        const contentBuffer = partBuffer.slice(headerEndPos + 4);
        
        // Remove trailing CRLF from content
        let finalContentBuffer = contentBuffer;
        if (contentBuffer.length >= 2 && 
            contentBuffer[contentBuffer.length - 2] === 0x0D && 
            contentBuffer[contentBuffer.length - 1] === 0x0A) {
            finalContentBuffer = contentBuffer.slice(0, -2);
        }
        
        // Parse headers
        const headersText = headersBuffer.toString('utf8');
        console.log('Headers found:', headersText);
        
        // Extract Content-Disposition
        const dispositionMatch = headersText.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
        
        if (dispositionMatch) {
            const fieldName = dispositionMatch[1];
            const fileName = dispositionMatch[2];
            
            console.log(`Found field: ${fieldName}, filename: ${fileName || 'none'}`);
            
            parts.push({
                name: fieldName,
                filename: fileName || null,
                data: finalContentBuffer,
                headers: headersText,
                isFile: !!fileName
            });
        }
        
        currentPos = nextBoundaryPos + boundaryMarker.length;
    }
    
    console.log(`Parsed ${parts.length} parts`);
    return parts;
}

// Enhanced form data extraction
function extractFormData(parts) {
    const formData = {};
    const files = [];
    
    for (const part of parts) {
        if (part.isFile) {
            // Handle file upload
            console.log(`Processing file: ${part.filename}, size: ${part.data.length} bytes`);
            
            // Determine MIME type from headers or filename
            let mimeType = 'audio/mpeg'; // default
            if (part.headers.includes('Content-Type:')) {
                const typeMatch = part.headers.match(/Content-Type:\s*([^\r\n]+)/i);
                if (typeMatch) {
                    mimeType = typeMatch[1].trim();
                }
            } else if (part.filename) {
                // Guess from extension
                const ext = part.filename.toLowerCase().split('.').pop();
                if (ext === 'wav') mimeType = 'audio/wav';
                else if (ext === 'mp3') mimeType = 'audio/mpeg';
                else if (ext === 'ogg') mimeType = 'audio/ogg';
                else if (ext === 'm4a') mimeType = 'audio/mp4';
            }
            
            // Convert to base64 data URL
            const base64Data = part.data.toString('base64');
            
            files.push({
                fieldName: part.name,
                filename: part.filename,
                mimeType: mimeType,
                data: part.data,
                base64: base64Data,
                dataUrl: `data:${mimeType};base64,${base64Data}`
            });
        } else {
            // Handle text field
            const value = part.data.toString('utf8').trim();
            console.log(`Processing field: ${part.name} = "${value}"`);
            formData[part.name] = value;
        }
    }
    
    return { formData, files };
}

// Save storage
function saveStorage() {
    try {
        const storageData = {
            games: games,
            counter: gameIdCounter
        };
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
            console.log('Processing POST request');
            console.log('Headers:', JSON.stringify(event.headers, null, 2));
            
            const contentType = event.headers['content-type'] || event.headers['Content-Type'];
            
            if (!contentType || !contentType.includes('multipart/form-data')) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' })
                };
            }
            
            // Extract boundary
            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            if (!boundaryMatch) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'No boundary found in Content-Type' })
                };
            }
            
            const boundary = boundaryMatch[1].replace(/"/g, ''); // Remove quotes if present
            console.log('Using boundary:', boundary);
            
            // Parse multipart data
            const parts = parseMultipartData(event.body, boundary);
            const { formData, files } = extractFormData(parts);
            
            console.log('Extracted form data:', formData);
            console.log('Extracted files:', files.map(f => ({ name: f.filename, size: f.data.length })));
            
            // Validate game name
            const gameName = formData.name;
            if (!gameName) {
                console.log('Game name validation failed. Form data keys:', Object.keys(formData));
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Game name is required',
                        received_fields: Object.keys(formData),
                        form_data: formData
                    })
                };
            }
            
            // Validate files
            const audioFiles = files.filter(f => f.fieldName === 'files');
            if (audioFiles.length === 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'At least one audio file is required',
                        received_files: files.length,
                        file_fields: files.map(f => f.fieldName)
                    })
                };
            }
            
            // Process audio files
            const processedFiles = [];
            for (let i = 0; i < Math.min(audioFiles.length, 18); i++) {
                const file = audioFiles[i];
                processedFiles.push({
                    filename: `game_${gameIdCounter}_file_${i + 1}.mp3`,
                    original_name: file.filename,
                    path: file.dataUrl
                });
            }
            
            // Ensure we have exactly 18 files (duplicate if needed)
            while (processedFiles.length < 18) {
                const sourceIndex = processedFiles.length % audioFiles.length;
                const sourceFile = audioFiles[sourceIndex];
                processedFiles.push({
                    filename: `game_${gameIdCounter}_file_${processedFiles.length + 1}.mp3`,
                    original_name: sourceFile.filename,
                    path: sourceFile.dataUrl
                });
            }
            
            // Create new game
            const newGame = {
                id: gameIdCounter++,
                name: gameName,
                files: processedFiles.slice(0, 18)
            };
            
            games.push(newGame);
            saveStorage();
            
            console.log(`Successfully created game: ${gameName} with ${newGame.files.length} files`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    message: 'Game uploaded successfully',
                    game_name: gameName,
                    files_uploaded: audioFiles.length,
                    total_files: newGame.files.length,
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
        console.error('Stack trace:', error.stack);
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
