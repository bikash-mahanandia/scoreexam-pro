const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const { protect, isStudent } = require('../middleware/authMiddleware');

router.use(protect, isStudent);

router.get('/exams', async (req, res) => {
  try {
    const exams = await Exam.find({ isActive: true, isPublished: { $ne: false } })
      .select('title subject topic durationMinutes totalMarks questions scheduledStartTime scheduledEndTime allowRetry');
    const completedExamIds = new Set(
      (await Result.find({ student: req.user.id }).select('exam')).map(result => String(result.exam))
    );
    const now = new Date();
    const examSummaries = exams.map(e => ({
      _id: e._id,
      title: e.title,
      subject: e.subject,
      topic: e.topic,
      durationMinutes: e.durationMinutes,
      totalMarks: e.totalMarks,
      totalQuestions: e.questions.length,
      scheduledStartTime: e.scheduledStartTime,
      scheduledEndTime: e.scheduledEndTime,
      allowRetry: e.allowRetry,
      hasCompleted: completedExamIds.has(String(e._id)),
      status: completedExamIds.has(String(e._id)) || (e.scheduledEndTime && now > e.scheduledEndTime)
        ? 'test-over'
        : (e.scheduledStartTime && now < e.scheduledStartTime ? 'scheduled' : 'available'),
      canStart: (!completedExamIds.has(String(e._id)) || e.allowRetry) &&
        (!e.scheduledStartTime || now >= e.scheduledStartTime) &&
        (!e.scheduledEndTime || now <= e.scheduledEndTime)
    }));
    res.json(examSummaries);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching exams', error: err.message });
  }
});

router.get('/exams/:id/start', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam || !exam.isActive || exam.isPublished === false) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    const now = new Date();
    if (exam.scheduledStartTime && now < exam.scheduledStartTime) {
      return res.status(403).json({ message: 'This exam is not open yet' });
    }
    if (exam.scheduledEndTime && now > exam.scheduledEndTime) {
      return res.status(403).json({ message: 'This exam is over' });
    }
    const previousResult = await Result.exists({ student: req.user.id, exam: exam._id });
    if (previousResult && !exam.allowRetry) {
      return res.status(403).json({ message: 'This exam has already been completed' });
    }

    const secureQuestions = exam.questions.map((q, idx) => ({
      index: idx,
      questionText: q.questionText,
      options: q.options
    }));

    res.json({
      _id: exam._id,
      title: exam.title,
      subject: exam.subject,
      topic: exam.topic,
      durationMinutes: exam.durationMinutes,
      totalMarks: exam.totalMarks,
      questions: secureQuestions
    });
  } catch (err) {
    res.status(500).json({ message: 'Error starting exam', error: err.message });
  }
});

router.post('/exams/:id/submit', async (req, res) => {
  try {
    const {
      studentAnswers, checkInPhoto, checkOutPhoto, location,
      initialPhoto, finalPhoto
    } = req.body;
    const exam = await Exam.findById(req.params.id);

    if (!exam || !exam.isActive || exam.isPublished === false) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    const now = new Date();
    if ((exam.scheduledStartTime && now < exam.scheduledStartTime) ||
        (exam.scheduledEndTime && now > exam.scheduledEndTime)) {
      return res.status(403).json({ message: 'This exam is not currently available' });
    }
    const previousResult = await Result.exists({ student: req.user.id, exam: exam._id });
    if (previousResult && !exam.allowRetry) {
      return res.status(403).json({ message: 'This exam has already been completed' });
    }

    const totalQuestions = exam.questions.length;
    const markPerQuestion = totalQuestions ? exam.totalMarks / totalQuestions : 0;
    
    let correctCount = 0;
    let attemptedCount = 0;
    const evaluatedAnswers = [];

    exam.questions.forEach((q, index) => {
      const userAns = studentAnswers ? studentAnswers.find(a => a.questionIndex === index) : null;
      const selectedOption = userAns ? userAns.selectedOption : null;
      
      let isCorrect = false;
      if (selectedOption !== null && selectedOption !== undefined) {
        attemptedCount++;
        if (selectedOption === q.correctOptionIndex) {
          isCorrect = true;
          correctCount++;
        }
      }

      evaluatedAnswers.push({ questionIndex: index, selectedOption, isCorrect });
    });

    const wrongCount = attemptedCount - correctCount;
    const score = Number((correctCount * markPerQuestion).toFixed(2));
    const accuracy = attemptedCount > 0 ? Number(((correctCount / attemptedCount) * 100).toFixed(2)) : 0;

    const result = await Result.create({
      student: req.user.id,
      exam: exam._id,
      score,
      totalQuestions,
      attemptedCount,
      correctCount,
      wrongCount,
      accuracy,
      checkInPhoto: checkInPhoto || initialPhoto || null,
      checkOutPhoto: checkOutPhoto || finalPhoto || null,
      ipAddress: req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || null,
      location: location && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))
        ? { latitude: Number(location.latitude), longitude: Number(location.longitude) }
        : undefined,
      initialPhoto: initialPhoto || null,
      finalPhoto: finalPhoto || null,
      answers: evaluatedAnswers
    });

    const detailedReview = exam.questions.map((q, idx) => {
      const evalAns = evaluatedAnswers.find(a => a.questionIndex === idx);
      return {
        questionText: q.questionText,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        selectedOption: evalAns ? evalAns.selectedOption : null,
        isCorrect: evalAns ? evalAns.isCorrect : false,
        explanation: q.explanation
      };
    });

    res.json({
      resultId: result._id,
      title: exam.title,
      score,
      totalMarks: exam.totalMarks,
      totalQuestions,
      attemptedCount,
      correctCount,
      wrongCount,
      accuracy,
      detailedReview
    });

  } catch (err) {
    res.status(500).json({ message: 'Error evaluating submission', error: err.message });
  }
});

router.get('/analytics/my-history', async (req, res) => {
  try {
    const history = await Result.find({ student: req.user.id })
      .populate('exam', 'title subject totalMarks')
      .sort({ submittedAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching history', error: err.message });
  }
});

module.exports = router;