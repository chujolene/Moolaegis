// register.js
import { API_BASE_URL } from '../config.js';
const RegisterURL = `${API_BASE_URL}/auth/register`;

const modalLayer = document.getElementById('modalLayer');
const modalTitle = document.getElementById('modalTitle');
const modalMsg   = document.getElementById('modalMsg');
const modalBtn   = document.getElementById('modalBtn');

// 簡化存取翻譯（i18n 尚未載入時，回傳 key 以避免報錯）
const t = (key, vars) =>
  (window.I18N && typeof window.I18N.t === 'function') ? window.I18N.t(key, vars) : key;

// 以「翻譯 key」來顯示 Modal（訊息可帶變數）
function showModalKey(titleKey, msgKey, vars, cb) {
  modalTitle.textContent = t(titleKey);
  modalMsg.textContent   = t(msgKey, vars);
  modalLayer.style.display = 'flex';
  modalBtn.onclick = () => {
    modalLayer.style.display = 'none';
    if (typeof cb === 'function') cb();
  };
}

// 把常見後端訊息或錯誤碼對應到翻譯 key
function mapApiMessageToKey(message, code) {
  // 若後端有提供結構化錯誤碼，優先判斷 code
  if (code) {
    const c = String(code).toUpperCase();
    if (c === 'EMAIL_TAKEN')    return 'auth.emailTaken';
    if (c === 'USERNAME_TAKEN') return 'auth.usernameTaken';
    if (c === 'WEAK_PASSWORD')  return 'form.passwordMin';
    if (c === 'INVALID_EMAIL')  return 'form.invalidEmail';
  }

  // 否則嘗試從 message 文字判斷
  if (!message) return '';
  const m = String(message).toLowerCase();
  if (m.includes('email') && (m.includes('exists') || m.includes('already'))) return 'auth.emailTaken';
  if (m.includes('username') && (m.includes('exists') || m.includes('already'))) return 'auth.usernameTaken';
  if (m.includes('invalid') && m.includes('email')) return 'form.invalidEmail';
  if (m.includes('weak password') || m.includes('password too short') || m.includes('at least')) return 'form.passwordMin';
  return '';
}

document.getElementById('regForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email    = document.getElementById('email').value.trim();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  // 基本前端檢查
  const MIN = 6;
  if (!email || !username || password.length < MIN) {
    // 「請填寫所有欄位，且密碼長度需 ≥ {n} 字元」
    showModalKey('modal.warningTitle', 'form.fillAllFieldsOrMin', { n: MIN });
    return;
  }

  try {
    const res = await fetch(RegisterURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      // 成功：如果後端有給 message 就保留；否則用我們的預設文案
        showModalKey('modal.successTitle', 'auth.registerSuccess', null, () => {
            window.location.href = 'login.html';
        });

    } else {
      // 失敗：盡量對應到更具體的 key；否則用通用「註冊失敗」
      const specificKey = mapApiMessageToKey(data?.message || data?.detail, data?.code);
      showModalKey('modal.errorTitle', specificKey || 'auth.registerFailed', { n: MIN });
    }
  } catch (err) {
    console.error(err);
    // 網路/伺服器錯誤
    showModalKey('modal.errorTitle', 'net.serverErrorTryAgain');
  }
});
