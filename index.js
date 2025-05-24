const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/unmatched-stats';
const JWT_SECRET = process.env.JWT_SECRET || 'asdqfsdgfsdggdfgdfg';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Define Schemas for other models
const playerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatarUrl: { type: String, default: 'https://via.placeholder.com/150' },
  gamesPlayed: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  favoriteCharacter: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const gameSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  players: [{ 
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    character: { type: String, required: true }
  }],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  notes: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Create Models
const User = mongoose.model('User', userSchema);
const Player = mongoose.model('Player', playerSchema);
const Game = mongoose.model('Game', gameSchema);

// Authentication Middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
    
    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ 
        error: 'User already exists with that email or username' 
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const user = new User({
      username,
      email,
      password: hashedPassword
    });
    
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }
    
    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Protected Routes - require authentication
app.get('/api/me', auth, async (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    email: req.user.email
  });
});

// Player Routes - now with authentication
app.get('/api/players', auth, async (req, res) => {
  try {
    const players = await Player.find({ userId: req.userId });
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/players', auth, async (req, res) => {
  try {
    const player = new Player({
      ...req.body,
      userId: req.userId
    });
    await player.save();
    res.status(201).json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Game Routes - with authentication
app.get('/api/games', auth, async (req, res) => {
  try {
    const games = await Game.find({ userId: req.userId }).populate('players.player winner');
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/games', auth, async (req, res) => {
  try {
    const game = new Game({
      ...req.body,
      userId: req.userId
    });
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
