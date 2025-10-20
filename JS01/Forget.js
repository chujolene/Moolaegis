import { API_BASE_URL } from '../config.js';
const forgetPasswordURL = `${API_BASE_URL}/auth/forget-password`;

const modalLayer = document.getElementById('modalLayer');
const modalTitle = document.getElementById('modalTitle');
const modalMsg   = document.getElementById('modalMsg');
const modalBtn   = document.getElementById('modalBtn');


function showModal(title, msg, cb) {
  modalTitle.textContent = title;
  modalMsg.textContent = msg;
  modalLayer.style.display = 'flex';
  modalBtn.onclick = () => {
    modalLayer.style.display = 'none';
    if (typeof cb === 'function') cb();
  };
}

document.getElementById('forgetForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const newPassword = document.getElementById('new_password').value;

  if (!email || newPassword.length < 6) {
    showModal('Warning', 'Please fill all fields and use at least 6 characters');
    return;
  }

  fetch(forgetPasswordURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, new_password: newPassword })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      showModal('Success', 'Password reset successful', () => {
        window.location.href = 'Login.html';
      });
    } else {
      showModal('Error', data.message || 'User not found');
    }
  })
  .catch(err => {
    console.error("Error:", err);
    showModal('Error', 'Server error. Please try again.');
  });
});
