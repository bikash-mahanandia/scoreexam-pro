const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectDB = require('./config/db');
const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const studentRoutes = require('./routes/studentRoutes');

const app = express();

connectDB();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'public')));

const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({ rollNumber: 'ADMIN1' });
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('123456', salt);
      await User.create({
        fullName: 'System Administrator',
        rollNumber: 'ADMIN1',
        password: hashedPassword,
        role: 'ADMIN'
      });
      console.log('Default Admin Account Created: ADMIN1 / 123456');
    }
  } catch (err) {
    console.error('Seeding error:', err);
  }
};
seedAdmin();

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);

// SPA Fallback (Express 5 compatible)
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`ScoreExam Production Server running on port ${PORT}`);
});