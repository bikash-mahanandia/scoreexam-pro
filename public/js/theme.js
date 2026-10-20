const Theme = {
  storageKey: 'scoreexam_theme',

  init() {
    const savedTheme = localStorage.getItem(this.storageKey);
    this.setTheme(savedTheme === 'dark' ? 'dark' : 'light');
    const toggle = document.getElementById('themeToggleBtn');
    if (toggle) {
      toggle.addEventListener('click', () => {
        this.setTheme(document.body.classList.contains('dark-theme') ? 'light' : 'dark');
      });
    }
  },

  setTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-theme', isDark);
    localStorage.setItem(this.storageKey, isDark ? 'dark' : 'light');

    const toggle = document.getElementById('themeToggleBtn');
    const icon = document.getElementById('themeToggleIcon');
    if (toggle) toggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
    if (icon) icon.className = `fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}`;
  }
};

Theme.init();