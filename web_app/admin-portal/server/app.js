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
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api', require('./routes/students'));
  app.use('/api', require('./routes/enrollment'));
  app.use('/api', require('./routes/modules'));
  app.use('/api', require('./routes/studentReports'));
  app.use('/api', require('./routes/moduleManagement'));
  app.use('/api/attendance', require('./routes/attendanceRoutes'));
  // Parser errors contain request bodies and development stack traces. Keep
  // the HTTP contract bounded and independent of NODE_ENV; never echo input.
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON request body.' });
    return res.status(500).json({ message: 'Unable to complete this operation right now.' });
  });
  return app;
}

module.exports = { createApp };
