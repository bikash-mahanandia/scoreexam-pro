const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  rollNumber: { type: String, required: true, unique: true, index: true, trim: true },
  fullName: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['STUDENT', 'ADMIN'], default: 'STUDENT' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);