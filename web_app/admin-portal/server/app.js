const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { getQaConfig } = require('./qaConfig');

function createApp() {
  const qa = getQaConfig();
  const app = express();
  if (!qa) app.use(morgan('combined'));
  app.use(cors({ origin: qa
    ? ['http://localhost:5173', 'http://127.0.0.1:5173']
    : ['http://localhost:5173', 'https://crowed-attendence.web.app'] }));
  app.use(express.json());
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api', require('./routes/students'));
  app.use('/api', require('./routes/enrollment'));
  app.use('/api', require('./routes/modules'));
  app.use('/api', require('./routes/studentReports'));
  app.use('/api', require('./routes/moduleManagement'));
  app.use('/api/attendance', require('./routes/attendanceRoutes'));
  return app;
}

module.exports = { createApp };
