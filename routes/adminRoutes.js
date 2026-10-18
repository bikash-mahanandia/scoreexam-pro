const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const User = require('../models/User');
const { protect, isAdmin } = require('../middleware/authMiddleware');

router.use(protect, isAdmin);

router.post('/exams', async (req, res) => {
  try {
    const { title, subject, durationMinutes, totalMarks, questions } = req.body;
    const exam = await Exam.create({
      title,
      subject,
      durationMinutes,
      totalMarks,
      questions,
      createdBy: req.user.id
    });
    res.status(201).json({ message: 'Exam created successfully', exam });
  } catch (err) {
    res.status(500).json({ message: 'Error creating exam', error: err.message });
  }
});

router.get('/results', async (req, res) => {
  try {
    const results = await Result.find()
      .populate('student', 'fullName rollNumber')
      .populate('exam', 'title subject totalMarks')
      .sort({ submittedAt: -1 });

    const totalStudents = await User.countDocuments({ role: 'STUDENT' });
    const totalExams = await Exam.countDocuments();
    const totalAttempts = results.length;
    const avgScore = totalAttempts > 0 
      ? (results.reduce((acc, curr) => acc + curr.score, 0) / totalAttempts).toFixed(2) 
      : 0;

    res.json({
      kpi: { totalExams, totalStudents, totalAttempts, avgScore },
      results
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching admin results', error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Result.deleteMany({ student: req.params.id });
    res.json({ message: 'User deleted permanently' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
});

module.exports = router;