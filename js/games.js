const { Handler } = require('@netlify/functions');

// Simple in-memory storage for demo (in production, use a real database)
let games = [
  {
    id: 1,
    name: "Demo Game",
    files: Array.from({length: 18}, (_, i) => ({
      filename: `demo_file_${i + 1}.mp3`,
      original_name: `demo_${i + 1}.mp3`,
      path: `/audio/demo_file_${i + 1}.mp3`
    }))
  }
];

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
      // For demo purposes, create a simple game
      const body = JSON.parse(event.body || '{}');
      const newGame = {
        id: games.length + 1,
        name: body.name || 'New Game',
        files: Array.from({length: 18}, (_, i) => ({
          filename: `game_${games.length + 1}_file_${i + 1}.mp3`,
          original_name: `file_${i + 1}.mp3`,
          path: `/audio/game_${games.length + 1}_file_${i + 1}.mp3`
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
          files_uploaded: 18
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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

module.exports = { handler };

