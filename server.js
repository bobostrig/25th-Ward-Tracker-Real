require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'visits.json');

// Admin password comes from an environment variable now instead of being
// hardcoded, since this file is going up on GitHub. Set ADMIN_PASSWORD in
// your host's environment settings (and in a local .env file for dev).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.warn('WARNING: ADMIN_PASSWORD is not set. The reset button will be disabled until you set it.');
}

// MongoDB Setup
const MONGODB_URI = process.env.MONGODB_URI;
let useMongoDB = false;
let VisitModel;

if (MONGODB_URI) {
  const mongoose = require('mongoose');
  console.log('Connecting to MongoDB Atlas...');
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Successfully connected to MongoDB Atlas!');
      useMongoDB = true;
    })
    .catch(err => {
      console.error('MongoDB Atlas connection failed. Falling back to local visits.json.', err);
    });

  const visitSchema = new mongoose.Schema({
    name: { type: String, required: true },
    note: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
  });

  VisitModel = mongoose.model('Visit', visitSchema);
} else {
  console.warn('WARNING: MONGODB_URI is not set. Using local visits.json instead.');
  console.warn('This is fine for local testing, but on most hosting platforms local files');
  console.warn('are NOT shared between users/instances and may be wiped on restart/redeploy.');
  console.warn('Set MONGODB_URI (e.g. a free MongoDB Atlas cluster) before deploying so everyone shares the same data.');
}

// Fallback Local File Data Store (local dev only - see warning above)
let localData = {
  count: 0,
  goal: 100,
  history: []
};

if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    localData = JSON.parse(raw);
  } catch (err) {
    console.error('Error reading visits.json, initializing fresh data.', err);
  }
} else {
  saveLocalData();
}

function saveLocalData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(localData, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving data to visits.json', err);
  }
}

// Abstracted Database Functions
async function getTrackerState() {
  if (useMongoDB) {
    try {
      const count = await VisitModel.countDocuments();
      const history = await VisitModel.find().sort({ timestamp: -1 }).limit(50);
      return {
        count,
        goal: 100,
        history: history.map(doc => ({
          id: doc._id.toString(),
          name: doc.name,
          note: doc.note,
          timestamp: doc.timestamp.toISOString()
        }))
      };
    } catch (err) {
      console.error('Error fetching tracker state from MongoDB:', err);
    }
  }
  return localData;
}

async function recordVisit(name, note, timestamp) {
  if (useMongoDB) {
    try {
      const doc = new VisitModel({ name, note, timestamp: new Date(timestamp) });
      await doc.save();
      return;
    } catch (err) {
      console.error('Error saving visit to MongoDB:', err);
    }
  }

  // Local File Fallback
  localData.count += 1;
  localData.history.unshift({
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    name,
    note,
    timestamp
  });
  if (localData.history.length > 50) {
    localData.history.pop();
  }
  saveLocalData();
}

async function resetTracker() {
  if (useMongoDB) {
    try {
      await VisitModel.deleteMany({});
      return;
    } catch (err) {
      console.error('Error resetting visits in MongoDB:', err);
    }
  }

  // Local File Fallback
  localData.count = 0;
  localData.history = [];
  saveLocalData();
}

// Serve public static folder
app.use(express.static(path.join(__dirname, 'public')));

// REST endpoint to get state
app.get('/api/status', async (req, res) => {
  const data = await getTrackerState();
  res.json(data);
});

// Socket.io Real-Time Event Handlers
io.on('connection', async (socket) => {
  console.log('A user connected:', socket.id);

  // Send current state to client on connect
  const currentState = await getTrackerState();
  socket.emit('init', currentState);

  // Add new visit
  socket.on('add_visit', async (visitInfo) => {
    const name = (visitInfo.name || 'Anonymous').trim().substring(0, 50);
    const note = (visitInfo.note || '').trim().substring(0, 150);
    const timestamp = new Date().toISOString();

    await recordVisit(name, note, timestamp);

    // Broadcast updated state to all connected clients
    const updatedState = await getTrackerState();
    io.emit('update', updatedState);
    console.log(`Visit recorded by ${name}. New total: ${updatedState.count}`);
  });

  // Password-protected Admin Reset
  socket.on('reset_tracker', async (password) => {
    if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
      await resetTracker();
      const updatedState = await getTrackerState();
      io.emit('update', updatedState);
      console.log('Tracker successfully reset by admin.');
    } else {
      socket.emit('reset_error', 'Incorrect admin password. Counter reset denied.');
      console.log('Unauthorized reset attempt blocked.');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(` 25th Ward Temple Tracker server listening on port ${PORT}`);
  console.log(` Access locally at http://localhost:${PORT}`);
  console.log(`==================================================`);
});
