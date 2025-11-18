// forget.js
import { API_BASE_URL } from '../config.js';
const forgetPasswordURL = `${API_BASE_URL}/auth/forget-password`;

const modalLayer = document.getElementById('modalLayer');
const modalTitle = document.getElementById('modalTitle');
const modalMsg   = document.getElementById('modalMsg');
const modalBtn   = document.getElementById('modalBtn');

// ✅ 多語系安全取用（與 Login.js 相同）
const t = (key, vars) =>
  (window.I18N && typeof window.I18N.t === 'function') ? window.I18N.t(key, vars) : key;

// ✅ 用翻譯 key 顯示 Modal
function showModalKey(titleKey, msgKey, cb) {
  modalTitle.textContent = t(titleKey);
  modalMsg.textContent   = t(msgKey);
  modalLayer.style.display = 'flex';
  modalBtn.onclick = () => {
    modalLayer.style.display = 'none';
    if (typeof cb === 'function') cb();
  };
}

// ✅ form submit 事件
document.getElementById('forgetForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = e.target.email.value.trim();
  const newPassword = e.target.new_password.value;

  if (!email || newPassword.length < 6) {
    showModalKey('modal.warningTitle', 'form.fillAllFieldsOrMin');
    return;
  }

  try {
    const response = await fetch(forgetPasswordURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, new_password: newPassword })
    });

    const data = await response.json();

    if (data.status === 'success') {
      showModalKey('modal.successTitle', 'auth.passwordResetSuccess', () => {
        window.location.href = 'login.html';
      });
    } else {
      // 若後端提供 message，可嘗試 map 出對應翻譯 key
      const msgKey =
        data.message?.toLowerCase().includes('not found')
          ? 'auth.userNotFound'
          : 'auth.passwordResetFailed';
      showModalKey('modal.errorTitle', msgKey);
    }
  } catch (error) {
    console.error('Error:', error);
    showModalKey('modal.errorTitle', 'net.cannotConnect');
  }
});
