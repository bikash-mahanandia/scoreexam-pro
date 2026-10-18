const App = {
  token: localStorage.getItem('scoreexam_token'),
  user: JSON.parse(localStorage.getItem('scoreexam_user') || 'null'),

  init() {
    this.bindEvents();
    this.route();
  },

  bindEvents() {
    document.getElementById('tabLoginBtn').onclick = () => this.switchAuthTab('login');
    document.getElementById('tabRegisterBtn').onclick = () => this.switchAuthTab('register');

    document.getElementById('loginForm').onsubmit = (e) => this.handleLogin(e);
    document.getElementById('registerForm').onsubmit = (e) => this.handleRegister(e);
    document.getElementById('logoutBtn').onclick = () => this.logout();
    document.getElementById('deleteAccBtn').onclick = () => this.deleteAccount();
    document.getElementById('navToggleBtn').onclick = () => this.togglePanel();
  },

  switchAuthTab(tab) {
    if (tab === 'login') {
      document.getElementById('loginForm').classList.remove('hidden');
      document.getElementById('registerForm').classList.add('hidden');
      document.getElementById('tabLoginBtn').className = 'w-1/2 py-2 font-bold text-indigo-600 border-b-2 border-indigo-600';
      document.getElementById('tabRegisterBtn').className = 'w-1/2 py-2 font-bold text-slate-400 border-b-2 border-transparent';
    } else {
      document.getElementById('registerForm').classList.remove('hidden');
      document.getElementById('loginForm').classList.add('hidden');
      document.getElementById('tabRegisterBtn').className = 'w-1/2 py-2 font-bold text-indigo-600 border-b-2 border-indigo-600';
      document.getElementById('tabLoginBtn').className = 'w-1/2 py-2 font-bold text-slate-400 border-b-2 border-transparent';
    }
  },

  route() {
    this.hideAllViews();
    if (!this.token || !this.user) {
      document.getElementById('authHeader').classList.add('hidden');
      document.getElementById('authView').classList.remove('hidden');
      return;
    }

    document.getElementById('authHeader').classList.remove('hidden');
    document.getElementById('userFullName').textContent = this.user.fullName;
    document.getElementById('userRoleBadge').textContent = this.user.role;

    if (this.user.role === 'ADMIN') {
      document.getElementById('deleteAccBtn').classList.add('hidden');
      document.getElementById('adminPanelView').classList.remove('hidden');
      AdminDashboard.loadData();
    } else {
      document.getElementById('deleteAccBtn').classList.remove('hidden');
      document.getElementById('studentDashboardView').classList.remove('hidden');
      ExamEngine.loadAvailableExams();
      ExamEngine.loadCandidateAnalytics();
    }
  },

  hideAllViews() {
    ['authView', 'studentDashboardView', 'cbtEngineView', 'resultScorecardView', 'adminPanelView'].forEach(id => {
      document.getElementById(id).classList.add('hidden');
    });
  },

  async handleLogin(e) {
    e.preventDefault();
    const rollNumber = document.getElementById('loginRoll').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNumber, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      localStorage.setItem('scoreexam_token', data.token);
      localStorage.setItem('scoreexam_user', JSON.stringify(data.user));
      this.token = data.token;
      this.user = data.user;
      this.route();
    } catch (err) {
      const errEl = document.getElementById('authError');
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('regFullName').value;
    const rollNumber = document.getElementById('regRoll').value;
    const password = document.getElementById('regPassword').value;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, rollNumber, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      alert('Account created! Please log in.');
      this.switchAuthTab('login');
    } catch (err) {
      const errEl = document.getElementById('authError');
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  },

  async deleteAccount() {
    if (confirm('Are you sure you want to permanently delete your candidate account and test records?')) {
      try {
        await fetch('/api/auth/delete-account', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.token}` }
        });
        alert('Account deleted.');
        this.logout();
      } catch (err) {
        alert('Failed to delete account');
      }
    }
  },

  logout() {
    localStorage.removeItem('scoreexam_token');
    localStorage.removeItem('scoreexam_user');
    this.token = null;
    this.user = null;
    this.route();
  },

  togglePanel() {
    if (this.user.role === 'ADMIN') {
      const adminView = document.getElementById('adminPanelView');
      if (adminView.classList.contains('hidden')) {
        this.hideAllViews();
        adminView.classList.remove('hidden');
      } else {
        this.hideAllViews();
        document.getElementById('studentDashboardView').classList.remove('hidden');
        ExamEngine.loadAvailableExams();
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());