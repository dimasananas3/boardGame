const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Use environment variable for port or default to 5000
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Sample data (replace with database later)
const players = [
  {
    id: 1,
    name: 'Player 1',
    avatarUrl: 'https://via.placeholder.com/150',
    gamesPlayed: 15,
    wins: 7,
    favoriteCharacter: 'Medusa'
  },
  {
    id: 2,
    name: 'Player 2',
    avatarUrl: 'https://via.placeholder.com/150',
    gamesPlayed: 12,
    wins: 5,
    favoriteCharacter: 'Sinbad'
  },
  {
    id: 3,
    name: 'Player 3',
    avatarUrl: 'https://via.placeholder.com/150',
    gamesPlayed: 18,
    wins: 9,
    favoriteCharacter: 'King Arthur'
  }
];

// API Routes
app.get('/api/players', (req, res) => {
  res.json(players);
});

app.get('/api/players/:id', (req, res) => {
  const player = players.find(p => p.id === parseInt(req.params.id));
  if (!player) return res.status(404).json({ error: 'Player not found' });
  res.json(player);
});

// Serve static assets if in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static('client/build'));

  // Any routes not caught by API will serve the index.html
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
