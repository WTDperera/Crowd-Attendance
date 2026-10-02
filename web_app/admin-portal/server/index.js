// QA never loads a developer's production .env file.
if (process.env.QA_MODE !== 'true') require('dotenv').config();
const { createApp } = require('./app');
const { getQaConfig } = require('./qaConfig');
const qa = getQaConfig();
const port = process.env.PORT || 5000;
createApp().listen(port, qa ? '127.0.0.1' : '0.0.0.0', () => {
  console.log(`Server running on port ${port}${qa ? ' (isolated QA)' : ''}`);
});
