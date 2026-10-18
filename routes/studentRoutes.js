const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const { protect, isStudent } = require('../middleware/authMiddleware');

router.use(protect, isStudent);

router.get('/exams', async (req, res) => {
  try {
    const exams = await Exam.find({ isActive: true }).select('title subject durationMinutes totalMarks questions');
    const examSummaries = exams.map(e => ({
      _id: e._id,
      title: e.title,
      subject: e.subject,
      durationMinutes: e.durationMinutes,
      totalMarks: e.totalMarks,
      totalQuestions: e.questions.length
    }));
    res.json(examSummaries);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching exams', error: err.message });
  }
});

router.get('/exams/:id/start', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam || !exam.isActive) return res.status(404).json({ message: 'Exam not found' });

    const secureQuestions = exam.questions.map((q, idx) => ({
      index: idx,
      questionText: q.questionText,
      options: q.options
    }));

    res.json({
      _id: exam._id,
      title: exam.title,
      subject: exam.subject,
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
    const { studentAnswers, initialPhoto, finalPhoto } = req.body;
    const exam = await Exam.findById(req.params.id);

    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const totalQuestions = exam.questions.length;
    const markPerQuestion = exam.totalMarks / totalQuestions;
    
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