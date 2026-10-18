const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Result = require('../models/Result');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', async (req, res) => {
  try {
    const { fullName, rollNumber, password } = req.body;
    if (!fullName || !rollNumber || !password) {
      return res.status(400).json({ message: 'All registration fields are required' });
    }

    const exists = await User.findOne({ rollNumber });
    if (exists) {
      return res.status(400).json({ message: 'Roll number already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      fullName,
      rollNumber,
      password: hashedPassword,
      role: 'STUDENT'
    });

    res.status(201).json({ message: 'Account created successfully', userId: user._id });
  } catch (err) {
    res.status(500).json({ message: 'Error registering user', error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { rollNumber, password } = req.body;
    const user = await User.findOne({ rollNumber });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, fullName: user.fullName, rollNumber: user.rollNumber, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user._id, fullName: user.fullName, rollNumber: user.rollNumber, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Server login error', error: err.message });
  }
});

router.delete('/delete-account', protect, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    await Result.deleteMany({ student: req.user.id });
    res.json({ message: 'Account and associated records deleted permanently' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting account', error: err.message });
  }
});

module.exports = router;