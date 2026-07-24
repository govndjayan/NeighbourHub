const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./src/config/db');
const initSocket = require('./src/config/socket');

// Routes (we'll add these soon)
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const societyRoutes = require('./src/routes/societies');
const announcementRoutes = require('./src/routes/announcements');
const foodRoutes = require('./src/routes/food');
const complaintRoutes = require('./src/routes/complaints');
const chatRoutes = require('./src/routes/chat');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Init Socket.io
const io = initSocket(server);

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make io accessible in routes.
// Community-wide events must go through req.emitToSociety so they only reach
// the caller's own society — a bare io.emit() would broadcast every society's
// posts, complaints and announcements to every connected client.
const { societyRoom } = initSocket;
app.use((req, res, next) => {
  req.io = io;
  req.emitToSociety = (event, payload) => {
    if (!req.societyId) {
      console.warn(`[socket] emitToSociety('${event}') called without a societyId; dropping event`);
      return;
    }
    io.to(societyRoom(req.societyId)).emit(event, payload);
  };
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/societies', societyRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Eaze Apt API is running 🚀' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Server Error' });
});

const PORT = process.env.PORT || 5000;
const errorHandler = require('./src/middleware/errorHandler');
app.use(errorHandler);
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
