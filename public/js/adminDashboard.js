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
            ${(r.checkInPhoto || r.initialPhoto) ? `<img src="${r.checkInPhoto || r.initialPhoto}" class="w-12 h-12 object-cover rounded-md border" alt="Check-In">` : 'N/A'}
          </td>
          <td class="p-3">
            ${(r.checkOutPhoto || r.finalPhoto) ? `<img src="${r.checkOutPhoto || r.finalPhoto}" class="w-12 h-12 object-cover rounded-md border" alt="Post-Exam">` : 'N/A'}
          </td>
          <td class="p-3 font-bold">${r.student ? r.student.fullName : 'N/A'}</td>
          <td class="p-3 font-mono text-xs">${r.student ? r.student.rollNumber : 'N/A'}</td>
          <td class="p-3 text-xs">${r.exam ? r.exam.title : 'N/A'}</td>
          <td class="p-3 font-bold text-indigo-600">${r.score} / ${r.exam ? r.exam.totalMarks : ''}</td>
          <td class="p-3 font-semibold text-emerald-600">${r.accuracy}%</td>
          <td class="p-3">
            <div class="space-y-1">
              <p class="text-[10px] text-slate-500">IP: ${r.ipAddress || 'N/A'}</p>
              <p class="text-[10px] text-slate-500">Location: ${r.location?.latitude ?? 'N/A'}, ${r.location?.longitude ?? 'N/A'}</p>
              <button onclick="AdminDashboard.deleteProctoringRecord('${r._id}')" class="bg-rose-600 hover:bg-rose-700 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold transition">Delete Record</button>
              ${r.student ? `<button onclick="AdminDashboard.deleteCandidate('${r.student._id}')" class="block bg-slate-600 hover:bg-slate-700 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold transition">Delete Candidate</button>` : ''}
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async loadPublishedExams() {
    try {
      const res = await fetch('/api/admin/exams', {
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
            <p class="text-xs text-indigo-600 font-semibold">${exam.subject}${exam.topic ? ` / ${exam.topic}` : ''} • ${exam.durationMinutes} mins • ${exam.totalMarks} Marks</p>
            <p class="text-[10px] font-bold ${exam.isPublished ? 'text-emerald-700' : 'text-amber-700'}">${exam.isPublished ? 'Published' : 'Draft'}${exam.scheduledStartTime ? ` · Starts ${new Date(exam.scheduledStartTime).toLocaleString()}` : ''}</p>
          </div>
          <div class="flex space-x-2">
            <button onclick="AdminDashboard.togglePublishExam('${exam._id}', ${!exam.isPublished})" class="${exam.isPublished ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white text-xs px-3 py-1.5 rounded-lg font-bold transition">${exam.isPublished ? 'Unpublish' : 'Publish'}</button>
            <button onclick='AdminDashboard.editExam(${JSON.stringify(exam).replace(/'/g, "&apos;")})' class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition">
              <i class="fa-solid fa-pen-to-square mr-1"></i> Edit
            </button>
            <button onclick="AdminDashboard.deleteExam('${exam._id}')" class="bg-rose-600 hover:bg-rose-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition">
              <i class="fa-solid fa-trash mr-1"></i> Delete
            </button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Error loading published exams:', err);
    }
  },

  editExam(exam) {
    document.getElementById('editingExamId').value = exam._id;
    document.getElementById('examTitle').value = exam.title;
    document.getElementById('examSubject').value = exam.subject;
    document.getElementById('examTopic').value = exam.topic || '';
    document.getElementById('examDuration').value = exam.durationMinutes;
    document.getElementById('examTotalMarks').value = exam.totalMarks;
    document.getElementById('examStartTime').value = this.toLocalDateTime(exam.scheduledStartTime);
    document.getElementById('examEndTime').value = this.toLocalDateTime(exam.scheduledEndTime);
    document.getElementById('examIsPublished').checked = Boolean(exam.isPublished);
    document.getElementById('examAllowRetry').checked = Boolean(exam.allowRetry);

    document.getElementById('formSectionTitle').textContent = `Editing Exam: ${exam.title}`;
    document.getElementById('submitExamFormBtn').textContent = 'Update Exam Paper';
    document.getElementById('cancelEditBtn').classList.remove('hidden');

    this.resetQuestionBuilder();
    exam.questions.forEach((q) => {
      this.addQuestionBlock(q);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  cancelEdit() {
    document.getElementById('editingExamId').value = '';
    document.getElementById('createExamForm').reset();
    document.getElementById('formSectionTitle').textContent = 'Create & Publish Exam';
    document.getElementById('submitExamFormBtn').textContent = 'Publish Exam';
    document.getElementById('cancelEditBtn').classList.add('hidden');
    this.resetQuestionBuilder();
    this.addQuestionBlock();
  },

  toLocalDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  },

  async togglePublishExam(examId, isPublished) {
    try {
      const res = await fetch(`/api/admin/exams/${examId}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${App.token}` },
        body: JSON.stringify({ isPublished })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      this.loadPublishedExams();
    } catch (err) {
      alert(err.message || 'Unable to change publication status');
    }
  },

  async deleteProctoringRecord(recordId) {
    if (!confirm('Delete this proctoring record?')) return;
    try {
      const res = await fetch(`/api/admin/proctoring/${recordId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${App.token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      this.loadData();
    } catch (err) {
      alert(err.message || 'Unable to delete proctoring record');
    }
  },

  async updateCredentials(e) {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    try {
      const res = await fetch('/api/admin/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${App.token}` },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      App.user.rollNumber = data.username;
      localStorage.setItem('scoreexam_user', JSON.stringify(App.user));
      document.getElementById('adminPassword').value = '';
      alert(data.message);
    } catch (err) {
      alert(err.message || 'Unable to update credentials');
    }
  },

  async deleteCandidate(userId) {
    if (confirm('Permanently delete this candidate account?')) {
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
    if (confirm('Permanently delete this exam paper?')) {
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
    document.getElementById('createExamForm').onsubmit = (e) => this.handleSaveExam(e);
    document.getElementById('cancelEditBtn').onclick = () => this.cancelEdit();
    document.getElementById('adminCredentialsForm').onsubmit = (e) => this.updateCredentials(e);

    const csvInput = document.getElementById('csvFileInput');
    if (csvInput) {
      csvInput.onchange = (e) => this.handleCSVUpload(e);
    }
  },

  handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        if (!rows.length) return alert('CSV file is empty!');

        if (this.questionCount === 1) {
          const firstInput = document.querySelector('.q-text');
          if (firstInput && !firstInput.value) this.resetQuestionBuilder();
        }

        rows.forEach((row) => {
          if (row.length >= 5) {
            this.addQuestionBlock({
              questionText: row[0],
              options: [row[1], row[2], row[3], row[4]],
              correctOptionIndex: parseInt(row[5]) || 0,
              explanation: row[6] || ''
            });
          }
        });

        alert(`Successfully imported ${rows.length} questions from CSV!`);
      }
    });
  },

  resetQuestionBuilder() {
    document.getElementById('dynamicQuestionsContainer').innerHTML = '';
    this.questionCount = 0;
  },

  addQuestionBlock(data = null) {
    this.questionCount++;
    const container = document.getElementById('dynamicQuestionsContainer');
    const qDiv = document.createElement('div');
    qDiv.className = 'q-block bg-slate-50 p-4 rounded-xl border space-y-3';
    qDiv.innerHTML = `
      <div class="flex justify-between items-center">
        <h4 class="font-bold text-xs text-slate-500 uppercase">Question #${this.questionCount}</h4>
        <button type="button" class="q-remove text-rose-600 hover:text-rose-700 text-xs font-bold">Remove</button>
      </div>
      <input type="text" class="q-text w-full p-2.5 border rounded-lg text-sm" placeholder="Question Text" value="${data ? data.questionText : ''}" required>
      <div class="grid grid-cols-2 gap-2">
        <input type="text" class="q-opt-0 p-2 border rounded-lg text-xs" placeholder="Option A" value="${data ? data.options[0] : ''}" required>
        <input type="text" class="q-opt-1 p-2 border rounded-lg text-xs" placeholder="Option B" value="${data ? data.options[1] : ''}" required>
        <input type="text" class="q-opt-2 p-2 border rounded-lg text-xs" placeholder="Option C" value="${data ? data.options[2] : ''}" required>
        <input type="text" class="q-opt-3 p-2 border rounded-lg text-xs" placeholder="Option D" value="${data ? data.options[3] : ''}" required>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <select class="q-correct p-2 border rounded-lg text-xs font-semibold">
          <option value="0" ${data && data.correctOptionIndex === 0 ? 'selected' : ''}>Correct Choice: Option A</option>
          <option value="1" ${data && data.correctOptionIndex === 1 ? 'selected' : ''}>Correct Choice: Option B</option>
          <option value="2" ${data && data.correctOptionIndex === 2 ? 'selected' : ''}>Correct Choice: Option C</option>
          <option value="3" ${data && data.correctOptionIndex === 3 ? 'selected' : ''}>Correct Choice: Option D</option>
        </select>
        <input type="text" class="q-exp p-2 border rounded-lg text-xs" placeholder="Explanation (Optional)" value="${data ? data.explanation : ''}">
      </div>
    `;
    container.appendChild(qDiv);
    qDiv.querySelector('.q-remove').onclick = () => {
      qDiv.remove();
      container.querySelectorAll('.q-block').forEach((block, index) => {
        block.querySelector('h4').textContent = `Question #${index + 1}`;
      });
      this.questionCount = container.querySelectorAll('.q-block').length;
    };
  },

  async handleSaveExam(e) {
    e.preventDefault();

    const editingId = document.getElementById('editingExamId').value;
    const title = document.getElementById('examTitle').value;
    const subject = document.getElementById('examSubject').value;
    const topic = document.getElementById('examTopic').value;
    const durationMinutes = parseInt(document.getElementById('examDuration').value);
    const totalMarks = parseInt(document.getElementById('examTotalMarks').value);
    const scheduledStartTime = document.getElementById('examStartTime').value;
    const scheduledEndTime = document.getElementById('examEndTime').value;
    const isPublished = document.getElementById('examIsPublished').checked;
    const allowRetry = document.getElementById('examAllowRetry').checked;

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
    if (!questions.length) return alert('Add at least one question before saving the exam.');

    const endpoint = editingId ? `/api/admin/exams/${editingId}` : '/api/admin/exams';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${App.token}`
        },
        body: JSON.stringify({
          title, subject, topic, durationMinutes, totalMarks, questions,
          scheduledStartTime: scheduledStartTime ? new Date(scheduledStartTime).toISOString() : null,
          scheduledEndTime: scheduledEndTime ? new Date(scheduledEndTime).toISOString() : null,
          isPublished, allowRetry
        })
      });

      if (!res.ok) throw new Error('Failed to save exam paper');

      alert(editingId ? 'Exam paper updated successfully!' : 'Exam paper published successfully!');
      this.cancelEdit();
      this.loadData();
    } catch (err) {
      alert(err.message);
    }
  }
};