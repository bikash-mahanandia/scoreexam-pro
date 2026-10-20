const ExamEngine = {
  currentExam: null,
  currentIndex: 0,
  userResponses: {},
  reviewStatus: {},
  timerInterval: null,
  timeRemainingSeconds: 0,
  initialPhotoBase64: null,
  checkOutPhotoBase64: null,
  location: null,
  submitting: false,
  videoStream: null,

  async loadAvailableExams() {
    this.bindWebcamControls();
    try {
      const res = await fetch('/api/student/exams', {
        headers: { Authorization: `Bearer ${App.token}` }
      });
      const exams = await res.json();

      const grid = document.getElementById('examList');
      if (!exams.length) {
        grid.innerHTML = `<p class="col-span-3 text-sm text-slate-500">No exams published yet.</p>`;
        return;
      }

      grid.innerHTML = exams.map(exam => `
        <div class="bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-between ${exam.status === 'available' && !exam.hasCompleted ? 'ring-2 ring-emerald-400' : ''}">
          <div>
            <h3 class="font-bold text-slate-800 text-lg mb-1">${exam.title}</h3>
            <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border mb-4 inline-block">${exam.subject}</span>
            ${exam.topic ? `<p class="text-xs text-slate-500 mb-3">${exam.topic}</p>` : ''}
            <p class="text-xs font-bold ${exam.status === 'available' ? 'text-emerald-700' : exam.status === 'scheduled' ? 'text-amber-700' : 'text-slate-500'} mb-3">${exam.status === 'test-over' ? 'Test Over' : exam.status === 'scheduled' ? `Starts ${new Date(exam.scheduledStartTime).toLocaleString()}` : 'NEW · Available now'}</p>
            <div class="text-xs text-slate-500 space-y-1 mb-5">
              <p>Duration: ${exam.durationMinutes} mins</p>
              <p>Questions: ${exam.totalQuestions}</p>
              <p>Total Marks: ${exam.totalMarks}</p>
            </div>
          </div>
          ${exam.canStart ? `<button onclick="ExamEngine.startExam('${exam._id}')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm">${exam.hasCompleted ? 'Retry Test' : 'Launch Test Paper'}</button>` : `<button disabled class="w-full bg-slate-200 text-slate-500 font-bold py-2.5 rounded-xl text-sm">${exam.status === 'test-over' ? 'Test Over' : 'Not Yet Available'}</button>`}
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async loadCandidateAnalytics() {
    try {
      const res = await fetch('/api/student/analytics/my-history', {
        headers: { Authorization: `Bearer ${App.token}` }
      });
      const history = await res.json();

      const tbody = document.getElementById('studentAnalyticsBody');
      tbody.innerHTML = history.map(h => `
        <tr>
          <td class="p-3 font-bold">${h.exam ? h.exam.title : 'N/A'}</td>
          <td class="p-3 text-indigo-600 font-bold">${h.score} / ${h.exam ? h.exam.totalMarks : ''}</td>
          <td class="p-3 text-emerald-600 font-bold">${h.accuracy}%</td>
          <td class="p-3 text-xs text-slate-400">${new Date(h.submittedAt).toLocaleString()}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  bindWebcamControls() {
    const initCamBtn = document.getElementById('initCamBtn');
    const snapPhotoBtn = document.getElementById('snapPhotoBtn');

    initCamBtn.onclick = async () => {
      try {
        this.videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        document.getElementById('webcamVideo').srcObject = this.videoStream;
        snapPhotoBtn.disabled = false;
      } catch (err) {
        alert('Webcam permission denied.');
      }
    };

    snapPhotoBtn.onclick = () => {
      this.initialPhotoBase64 = this.captureFrame();
      if (this.videoStream) this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
      document.getElementById('webcamVideo').srcObject = null;
      snapPhotoBtn.disabled = true;
      const previewImg = document.getElementById('capturedPhotoPreview');
      previewImg.src = this.initialPhotoBase64;
      document.getElementById('webcamVideo').classList.add('hidden');
      previewImg.classList.remove('hidden');
    };
  },

  captureFrame() {
    const videoEl = document.getElementById('webcamVideo');
    const canvasEl = document.getElementById('photoCanvas');
    canvasEl.width = videoEl.videoWidth || 320;
    canvasEl.height = videoEl.videoHeight || 240;
    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    return canvasEl.toDataURL('image/jpeg');
  },

  async captureTemporaryPhoto() {
    if (!navigator.mediaDevices?.getUserMedia) return null;
    const videoEl = document.getElementById('webcamVideo');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.videoStream = stream;
      videoEl.srcObject = stream;
      await videoEl.play();
      if (videoEl.readyState < 2) {
        await new Promise(resolve => {
          videoEl.addEventListener('loadeddata', resolve, { once: true });
          setTimeout(resolve, 1500);
        });
      }
      return videoEl.videoWidth ? this.captureFrame() : null;
    } catch (err) {
      return null;
    } finally {
      if (this.videoStream) this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
      videoEl.srcObject = null;
    }
  },

  requestLocation() {
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        position => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
      );
    });
  },

  async startExam(examId) {
    if (!this.initialPhotoBase64) this.initialPhotoBase64 = await this.captureTemporaryPhoto();
    if (!this.initialPhotoBase64 && !confirm('Check-in photo could not be captured. Continue without it?')) return;
    this.location = await this.requestLocation();

    try {
      const res = await fetch(`/api/student/exams/${examId}/start`, {
        headers: { Authorization: `Bearer ${App.token}` }
      });
      this.currentExam = await res.json();
      if (!res.ok) throw new Error(this.currentExam.message || 'Exam is not available');

      App.hideAllViews();
      document.getElementById('cbtEngineView').classList.remove('hidden');

      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      document.getElementById('cbtExamTitle').textContent = this.currentExam.title;
      document.getElementById('cbtSubject').textContent = this.currentExam.subject;

      this.currentIndex = 0;
      this.userResponses = {};
      this.reviewStatus = {};
      this.timeRemainingSeconds = this.currentExam.durationMinutes * 60;
      this.submitting = false;

      this.startTimer();
      this.renderQuestion();
      this.renderPalette();
      this.bindEngineEvents();
    } catch (err) {
      alert('Error launching test paper');
    }
  },

  startTimer() {
    clearInterval(this.timerInterval);
    const timerEl = document.getElementById('cbtTimer');

    this.timerInterval = setInterval(() => {
      if (this.timeRemainingSeconds <= 0) {
        clearInterval(this.timerInterval);
        alert('Time expired! Submitting test paper.');
        this.submitExam();
        return;
      }
      this.timeRemainingSeconds--;
      const mins = Math.floor(this.timeRemainingSeconds / 60).toString().padStart(2, '0');
      const secs = (this.timeRemainingSeconds % 60).toString().padStart(2, '0');
      timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
  },

  renderQuestion() {
    const q = this.currentExam.questions[this.currentIndex];
    document.getElementById('questionNumBadge').textContent = `Question #${this.currentIndex + 1} of ${this.currentExam.questions.length}`;
    document.getElementById('questionText').textContent = q.questionText;

    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = q.options.map((opt, idx) => `
      <div class="border rounded-xl p-3.5 cursor-pointer bg-slate-50">
        <input type="radio" id="opt_${idx}" name="mcq_option" value="${idx}" ${this.userResponses[this.currentIndex] === idx ? 'checked' : ''} class="mr-2">
        <label for="opt_${idx}" class="text-sm font-semibold text-slate-700 cursor-pointer">${opt}</label>
      </div>
    `).join('');

    optionsContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.userResponses[this.currentIndex] = parseInt(e.target.value);
        this.renderPalette();
      });
    });
  },

  renderPalette() {
    const palette = document.getElementById('questionPaletteGrid');
    palette.innerHTML = this.currentExam.questions.map((_, idx) => {
      let statusClass = 'status-unvisited';
      if (this.reviewStatus[idx]) statusClass = 'status-review';
      else if (this.userResponses[idx] !== undefined) statusClass = 'status-answered';
      else if (idx < this.currentIndex) statusClass = 'status-not-answered';

      return `<button onclick="ExamEngine.jumpToQuestion(${idx})" class="btn-palette ${statusClass}">${idx + 1}</button>`;
    }).join('');
  },

  jumpToQuestion(index) {
    this.currentIndex = index;
    this.renderQuestion();
    this.renderPalette();
  },

  bindEngineEvents() {
    document.getElementById('prevQBtn').onclick = () => {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.renderQuestion();
        this.renderPalette();
      }
    };
    document.getElementById('nextQBtn').onclick = () => {
      if (this.currentIndex < this.currentExam.questions.length - 1) {
        this.currentIndex++;
        this.renderQuestion();
        this.renderPalette();
      } else if (confirm('Do you want to submit?')) {
        this.submitExam();
      }
    };
    document.getElementById('markReviewBtn').onclick = () => {
      this.reviewStatus[this.currentIndex] = !this.reviewStatus[this.currentIndex];
      this.renderPalette();
    };
    document.getElementById('clearChoiceBtn').onclick = () => {
      delete this.userResponses[this.currentIndex];
      this.renderQuestion();
      this.renderPalette();
    };
    document.getElementById('submitExamBtn').onclick = () => {
      if (confirm('Finalize and submit your test paper?')) this.submitExam();
    };
  },

  async submitExam() {
    if (this.submitting) return;
    this.submitting = true;
    clearInterval(this.timerInterval);
    this.checkOutPhotoBase64 = await this.captureTemporaryPhoto();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    const studentAnswers = Object.keys(this.userResponses).map(idx => ({
      questionIndex: parseInt(idx),
      selectedOption: this.userResponses[idx]
    }));

    try {
      const res = await fetch(`/api/student/exams/${this.currentExam._id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${App.token}`
        },
        body: JSON.stringify({
          studentAnswers,
          checkInPhoto: this.initialPhotoBase64,
          checkOutPhoto: this.checkOutPhotoBase64,
          location: this.location
        })
      });

      const evaluation = await res.json();
      if (!res.ok) throw new Error(evaluation.message || 'Unable to submit exam');
      this.renderScorecard(evaluation);
    } catch (err) {
      this.submitting = false;
      alert(err.message || 'Error submitting test evaluation.');
    }
  },

  renderScorecard(evalData) {
    App.hideAllViews();
    document.getElementById('resultScorecardView').classList.remove('hidden');

    document.getElementById('scoreVal').textContent = `${evalData.score} / ${evalData.totalMarks}`;
    document.getElementById('accuracyVal').textContent = `${evalData.accuracy}%`;

    const solutionsContainer = document.getElementById('solutionsReviewContainer');
    solutionsContainer.innerHTML = evalData.detailedReview.map((rev, idx) => `
      <div class="border rounded-xl p-4 ${rev.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}">
        <p class="font-bold text-slate-800 text-sm mb-2">Q${idx + 1}. ${rev.questionText}</p>
        <div class="text-xs space-y-1 mb-2">
          ${rev.options.map((opt, oIdx) => `
            <div class="${oIdx === rev.correctOptionIndex ? 'font-bold text-emerald-700' : (oIdx === rev.selectedOption ? 'font-bold text-rose-600' : 'text-slate-600')}">
              ${String.fromCharCode(65 + oIdx)}.${opt}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }
};