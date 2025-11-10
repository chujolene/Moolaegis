// login.js
import { API_BASE_URL } from '../config.js';
const loginURL = `${API_BASE_URL}/auth/login`;

const modalLayer = document.getElementById('modalLayer');
const modalTitle = document.getElementById('modalTitle');
const modalMsg   = document.getElementById('modalMsg');
const modalBtn   = document.getElementById('modalBtn');

// 簡化存取翻譯：未載入 I18N 時回傳 key 本身，避免 JS 出錯
const t = (key, vars) =>
  (window.I18N && typeof window.I18N.t === 'function') ? window.I18N.t(key, vars) : key;

// 以「翻譯 key」來顯示 Modal
function showModalKey(titleKey, msgKey, cb) {
  modalTitle.textContent = t(titleKey);
  modalMsg.textContent   = t(msgKey);
  modalLayer.style.display = 'flex';
  modalBtn.onclick = () => {
    modalLayer.style.display = 'none';
    if (typeof cb === 'function') cb();
  };
}

// 把常見後端錯誤字串對應到翻譯 key（沒有就回空字串）
function mapApiDetailToKey(detail) {
  if (!detail || typeof detail !== 'string') return '';
  const d = detail.toLowerCase();
  if (d.includes('incorrect password') || d.includes('wrong password') || d.includes('invalid credentials')) {
    return 'auth.incorrectPassword';
  }
  if (d.includes('user not found')) return 'auth.userNotFound';
  return '';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = e.target.username.value.trim();
  const password = e.target.password.value;

  if (!username || !password) {
    // 「請填寫所有欄位」
    showModalKey('modal.warningTitle', 'form.fillAllFields');
    return;
  }

  try {
    const response = await fetch(loginURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);

      // 成功：「成功 / 登入成功」
      showModalKey('modal.successTitle', 'auth.loginSuccess', () => {
        window.location.href = 'Home.html';
      });
    } else {
      // 失敗：若能辨識具體錯誤（如 Incorrect Password），顯示對應翻譯；否則顯示通用「登入失敗」
      const specific = mapApiDetailToKey(data?.detail);
      showModalKey('modal.errorTitle', specific || 'auth.loginFailed');
    }
  } catch (error) {
    console.error(error);
    // 網路錯誤
    showModalKey('modal.errorTitle', 'net.cannotConnect');
  }
});

