require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/authRoutes');
const studentsRouter = require('./routes/students');
const modulesRouter = require('./routes/modules');
const attendanceRouter = require('./routes/attendanceRoutes');

const morgan = require("morgan");

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://crowed-attendence.web.app'
];

app.use(morgan("combined"));
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api', studentsRouter);
app.use('/api', modulesRouter);
app.use('/api/attendance', attendanceRouter);


const PORT = process.env.PORT || 5000;


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});