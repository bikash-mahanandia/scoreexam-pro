const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  attemptedCount: { type: Number, required: true },
  correctCount: { type: Number, required: true },
  wrongCount: { type: Number, required: true },
  accuracy: { type: Number, required: true },
  checkInPhoto: { type: String, default: null },
  checkOutPhoto: { type: String, default: null },
  ipAddress: { type: String, default: null },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null }
  },
  // Retained for records created before the proctoring field names were updated.
  initialPhoto: { type: String, default: null },
  finalPhoto: { type: String, default: null },
  answers: [{
    questionIndex: Number,
    selectedOption: Number,
    isCorrect: Boolean
  }],
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Result', resultSchema);