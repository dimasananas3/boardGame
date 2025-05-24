const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/unmatched-stats';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define Schemas
const playerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatarUrl: { type: String, default: 'https://via.placeholder.com/150' },
  gamesPlayed: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  favoriteCharacter: { type: String }
});

const gameSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  players: [{ 
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    character: { type: String, required: true }
  }],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  notes: { type: String }
});

// Create Models
const Player = mongoose.model('Player', playerSchema);
const Game = mongoose.model('Game', gameSchema);

// Player Routes
app.get('/api/players', async (req, res) => {
  try {
    const players = await Player.find();
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/players/:id', async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/players', async (req, res) => {
  try {
    const player = new Player(req.body);
    await player.save();
    res.status(201).json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/players/:id', async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(
      req.params.id, 
      req.body,
      { new: true }
    );
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Game Routes
app.get('/api/games', async (req, res) => {
  try {
    const games = await Game.find().populate('players.player winner');
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/games/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id).populate('players.player winner');
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/games', async (req, res) => {
  try {
    const game = new Game(req.body);
    await game.save();
    
    // Update player stats
    if (game.winner) {
      await Player.findByIdAndUpdate(game.winner, { $inc: { wins: 1, gamesPlayed: 1 } });
      
      // Update gamesPlayed for other players
      for (const playerEntry of game.players) {
        if (playerEntry.player.toString() !== game.winner.toString()) {
          await Player.findByIdAndUpdate(playerEntry.player, { $inc: { gamesPlayed: 1 } });
        }
      }
    }
    
    res.status(201).json(game);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
