const AdminDashboard = {
  questionCount: 0,

  async loadData() {
    this.bindAdminEvents();
    this.resetQuestionBuilder();
    this.addQuestionBlock();
    this.loadPublishedExams();

    try {
      const res = await fetch('/api/admin/results', {
        headers: { Authorization: `Bearer ${App.token}` }
      });
      const data = await res.json();

      document.getElementById('kpiExams').textContent = data.kpi.totalExams;
      document.getElementById('kpiStudents').textContent = data.kpi.totalStudents;
      document.getElementById('kpiAttempts').textContent = data.kpi.totalAttempts;
      document.getElementById('kpiAvg').textContent = data.kpi.avgScore;

      const tbody = document.getElementById('gradebookTableBody');
      tbody.innerHTML = data.results.map(r => `
        <tr class="hover:bg-slate-50">
          <td class="p-3">
            ${r.initialPhoto ? `<img src="${r.initialPhoto}" class="w-12 h-12 object-cover rounded-md border" alt="Check-In">` : 'N/A'}
          </td>
          <td class="p-3">
            ${r.finalPhoto ? `<img src="${r.finalPhoto}" class="w-12 h-12 object-cover rounded-md border" alt="Post-Exam">` : 'N/A'}
          </td>
          <td class="p-3 font-bold">${r.student ? r.student.fullName : 'N/A'}</td>
          <td class="p-3 font-mono text-xs">${r.student ? r.student.rollNumber : 'N/A'}</td>
          <td class="p-3 text-xs">${r.exam ? r.exam.title : 'N/A'}</td>
          <td class="p-3 font-bold text-indigo-600">${r.score} / ${r.exam ? r.exam.totalMarks : ''}</td>
          <td class="p-3 font-semibold text-emerald-600">${r.accuracy}%</td>
          <td class="p-3">
            ${r.student ? `<button onclick="AdminDashboard.deleteCandidate('${r.student._id}')" class="bg-rose-600 hover:bg-rose-700 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold transition">Delete Candidate</button>` : ''}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async loadPublishedExams() {
    try {
      const res = await fetch('/api/student/exams', {
        headers: { Authorization: `Bearer ${App.token}` }
      });
      const exams = await res.json();
      const container = document.getElementById('publishedExamsContainer');

      if (!container) return;

      if (!exams.length) {
        container.innerHTML = `<p class="text-xs text-slate-400">No published exams available.</p>`;
        return;
      }

      container.innerHTML = exams.map(exam => `
        <div class="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-2">
          <div>
            <h4 class="font-bold text-sm text-slate-800">${exam.title}</h4>
            <p class="text-xs text-indigo-600 font-semibold">${exam.subject} • ${exam.durationMinutes} mins • ${exam.totalMarks} Marks</p>
          </div>
          <button onclick="AdminDashboard.deleteExam('${exam._id}')" class="bg-rose-600 hover:bg-rose-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition">
            <i class="fa-solid fa-trash mr-1"></i> Delete Exam
          </button>
        </div>
      `).join('');
    } catch (err) {
      console.error('Error loading published exams:', err);
    }
  },

  async deleteCandidate(userId) {
    if (confirm('Permanently delete this candidate account and all associated test records?')) {
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${App.token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        alert('Candidate deleted successfully!');
        this.loadData();
      } catch (err) {
        alert(`Delete Error: ${err.message}`);
      }
    }
  },

  async deleteExam(examId) {
    if (confirm('Permanently delete this exam paper and all student results for it?')) {
      try {
        const res = await fetch(`/api/admin/exams/${examId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${App.token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        alert('Exam paper deleted successfully!');
        this.loadData();
      } catch (err) {
        alert(`Delete Error: ${err.message}`);
      }
    }
  },

  bindAdminEvents() {
    document.getElementById('addQuestionBtn').onclick = () => this.addQuestionBlock();
    document.getElementById('createExamForm').onsubmit = (e) => this.handleCreateExam(e);
  },

  resetQuestionBuilder() {
    document.getElementById('dynamicQuestionsContainer').innerHTML = '';
    this.questionCount = 0;
  },

  addQuestionBlock() {
    this.questionCount++;
    const container = document.getElementById('dynamicQuestionsContainer');
    const qDiv = document.createElement('div');
    qDiv.className = 'q-block bg-slate-50 p-4 rounded-xl border space-y-3';
    qDiv.innerHTML = `
      <h4 class="font-bold text-xs text-slate-500 uppercase">Question #${this.questionCount}</h4>
      <input type="text" class="q-text w-full p-2.5 border rounded-lg text-sm" placeholder="Question Text" required>
      <div class="grid grid-cols-2 gap-2">
        <input type="text" class="q-opt-0 p-2 border rounded-lg text-xs" placeholder="Option A" required>
        <input type="text" class="q-opt-1 p-2 border rounded-lg text-xs" placeholder="Option B" required>
        <input type="text" class="q-opt-2 p-2 border rounded-lg text-xs" placeholder="Option C" required>
        <input type="text" class="q-opt-3 p-2 border rounded-lg text-xs" placeholder="Option D" required>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <select class="q-correct p-2 border rounded-lg text-xs font-semibold">
          <option value="0">Correct Choice: Option A</option>
          <option value="1">Correct Choice: Option B</option>
          <option value="2">Correct Choice: Option C</option>
          <option value="3">Correct Choice: Option D</option>
        </select>
        <input type="text" class="q-exp p-2 border rounded-lg text-xs" placeholder="Explanation (Optional)">
      </div>
    `;
    container.appendChild(qDiv);
  },

  async handleCreateExam(e) {
    e.preventDefault();

    const title = document.getElementById('examTitle').value;
    const subject = document.getElementById('examSubject').value;
    const durationMinutes = parseInt(document.getElementById('examDuration').value);
    const totalMarks = parseInt(document.getElementById('examTotalMarks').value);

    const qBlocks = document.querySelectorAll('.q-block');
    const questions = [];

    qBlocks.forEach(block => {
      questions.push({
        questionText: block.querySelector('.q-text').value,
        options: [
          block.querySelector('.q-opt-0').value,
          block.querySelector('.q-opt-1').value,
          block.querySelector('.q-opt-2').value,
          block.querySelector('.q-opt-3').value
        ],
        correctOptionIndex: parseInt(block.querySelector('.q-correct').value),
        explanation: block.querySelector('.q-exp').value
      });
    });

    try {
      const res = await fetch('/api/admin/exams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${App.token}`
        },
        body: JSON.stringify({ title, subject, durationMinutes, totalMarks, questions })
      });

      if (!res.ok) throw new Error('Failed to publish exam');

      alert('Exam paper published successfully!');
      document.getElementById('createExamForm').reset();
      this.loadData();
    } catch (err) {
      alert(err.message);
    }
  }
};