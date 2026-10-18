const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const User = require('../models/User');
const { protect, isAdmin } = require('../middleware/authMiddleware');

router.use(protect, isAdmin);

// 1. Publish Exam
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

// 2. Delete Published Exam & Related Results
router.delete('/exams/:id', async (req, res) => {
  try {
    const examId = req.params.id;
    const deletedExam = await Exam.findByIdAndDelete(examId);

    if (!deletedExam) {
      return res.status(404).json({ message: 'Exam paper not found' });
    }

    await Result.deleteMany({ exam: examId });
    res.json({ message: 'Exam paper and related results deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting exam paper', error: err.message });
  }
});

// 3. Fetch Admin Gradebook & KPIs
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

// 4. Delete Candidate Account & Their Results
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: 'User account not found' });
    }

    await Result.deleteMany({ student: userId });
    res.json({ message: 'Candidate account and submission records deleted permanently' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
});

module.exports = router;