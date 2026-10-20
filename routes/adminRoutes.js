const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const User = require('../models/User');
const { protect, isAdmin } = require('../middleware/authMiddleware');

router.use(protect, isAdmin);

router.put('/credentials', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username && !password) {
      return res.status(400).json({ message: 'Provide a username or password to update' });
    }

    const admin = await User.findById(req.user.id);
    if (!admin || admin.role !== 'ADMIN') {
      return res.status(404).json({ message: 'Admin account not found' });
    }

    if (username) {
      const normalizedUsername = username.trim();
      if (!normalizedUsername) return res.status(400).json({ message: 'Username cannot be empty' });
      const existingUser = await User.findOne({ rollNumber: normalizedUsername, _id: { $ne: admin._id } });
      if (existingUser) return res.status(409).json({ message: 'Username is already in use' });
      admin.rollNumber = normalizedUsername;
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
      admin.password = await bcrypt.hash(password, 10);
    }

    await admin.save();
    res.json({ message: 'Admin credentials updated', username: admin.rollNumber });
  } catch (err) {
    res.status(500).json({ message: 'Error updating admin credentials', error: err.message });
  }
});

router.get('/exams', async (req, res) => {
  try {
    const exams = await Exam.find().sort({ createdAt: -1 });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching exams', error: err.message });
  }
});

// Create an exam; publication can be enabled immediately or later.
router.post('/exams', async (req, res) => {
  try {
    const {
      title, subject, topic, durationMinutes, totalMarks, questions,
      scheduledStartTime, scheduledEndTime, isPublished, allowRetry
    } = req.body;
    if (scheduledStartTime && scheduledEndTime && new Date(scheduledEndTime) <= new Date(scheduledStartTime)) {
      return res.status(400).json({ message: 'Scheduled end time must be after the start time' });
    }
    const exam = await Exam.create({
      title,
      subject,
      topic,
      durationMinutes,
      totalMarks,
      questions,
      scheduledStartTime: scheduledStartTime || null,
      scheduledEndTime: scheduledEndTime || null,
      isPublished: isPublished === true,
      allowRetry: allowRetry === true,
      createdBy: req.user.id
    });
    res.status(201).json({ message: 'Exam created successfully', exam });
  } catch (err) {
    res.status(500).json({ message: 'Error creating exam', error: err.message });
  }
});

router.patch('/exams/:id/publish', async (req, res) => {
  try {
    const isPublished = req.body.isPublished;
    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({ message: 'isPublished must be a boolean' });
    }
    const exam = await Exam.findByIdAndUpdate(
      req.params.id,
      { isPublished },
      { new: true, runValidators: true }
    );
    if (!exam) return res.status(404).json({ message: 'Exam paper not found' });
    res.json({ message: isPublished ? 'Exam published' : 'Exam unpublished', exam });
  } catch (err) {
    res.status(500).json({ message: 'Error changing exam publication', error: err.message });
  }
});

// Delete an exam and its related results.
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

router.get('/proctoring', async (req, res) => {
  try {
    const records = await Result.find()
      .populate('student', 'fullName rollNumber')
      .populate('exam', 'title subject topic')
      .sort({ submittedAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching proctoring records', error: err.message });
  }
});

router.delete('/proctoring/:id', async (req, res) => {
  try {
    const record = await Result.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Proctoring record not found' });
    res.json({ message: 'Proctoring record deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting proctoring record', error: err.message });
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


router.put('/exams/:id', async (req, res) => {
  try {
    const examId = req.params.id;
    const allowedFields = [
      'title', 'subject', 'topic', 'durationMinutes', 'totalMarks', 'questions',
      'scheduledStartTime', 'scheduledEndTime', 'isPublished', 'isActive', 'allowRetry'
    ];
    const updates = Object.fromEntries(
      allowedFields
        .filter(field => Object.prototype.hasOwnProperty.call(req.body, field))
        .map(field => [field, req.body[field]])
    );
    if (updates.scheduledStartTime === '') updates.scheduledStartTime = null;
    if (updates.scheduledEndTime === '') updates.scheduledEndTime = null;
    if (updates.scheduledStartTime && updates.scheduledEndTime &&
        new Date(updates.scheduledEndTime) <= new Date(updates.scheduledStartTime)) {
      return res.status(400).json({ message: 'Scheduled end time must be after the start time' });
    }

    const updatedExam = await Exam.findByIdAndUpdate(examId, updates, { new: true, runValidators: true });

    if (!updatedExam) {
      return res.status(404).json({ message: 'Exam paper not found' });
    }

    res.json({ message: 'Exam paper updated successfully', exam: updatedExam });
  } catch (err) {
    res.status(500).json({ message: 'Error updating exam paper', error: err.message });
  }
});

module.exports = router;