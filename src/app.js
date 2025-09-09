const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('@config/db');

// Load environment variables
require('dotenv').config();

// Initialize Express app
const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Routes
const routes = require('./routes');
routes(app);

// Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Global Error Handler
app.use((err, req, res) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;
