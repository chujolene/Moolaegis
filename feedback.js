// feedback.js － ES Module 版本
import { API_BASE_URL } from "./config.js";

const FEEDBACK_ENDPOINT = `${API_BASE_URL}/feedback/`;

// DOM 節點
const textarea = document.getElementById("comment");
const submitBtn = document.getElementById("submitBtn");
const listContainer = document.getElementById("feedbackContainer");

// 讀取 JWT
function getAccessToken() {
  return localStorage.getItem("access_token") || "";
}

// 共用 headers（帶 JWT；POST 會加 JSON）
function authHeaders({ json = true } = {}) {
  const headers = {
    Authorization: `Bearer ${getAccessToken()}`,
    "ngrok-skip-browser-warning": "true",
  };
  if (json) {
    headers["Content-Type"] = "application/json";
    headers["Accept"] = "application/json";
  }
  return headers;
}

// UI：Loading／Empty
function setLoading() {
  listContainer.classList.remove("no-feedback");
  listContainer.innerHTML = `<div class="loading">載入中...</div>`;
}
function setEmpty() {
  listContainer.classList.add("no-feedback");
  listContainer.innerHTML = `目前尚無回饋`;
}

// 時間轉台灣本地顯示
function formatTimeISOToLocal(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "-";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  const second = String(d.getSeconds()).padStart(2, "0");

  // ✅ 統一為 yyyy/mm/dd HH:MM:SS 24小時制
  return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
}


// XSS 簡單轉義
function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// 取得清單：GET /feedback/
async function fetchMyFeedback() {
  setLoading();
  try {
    const res = await fetch(FEEDBACK_ENDPOINT, {
      method: "GET",
      headers: authHeaders({ json: false }),
    });

    if (res.status === 401) {
      listContainer.innerHTML = `<div class="error">尚未登入或憑證過期（401）。</div>`;
      return;
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`讀取失敗：HTTP ${res.status} ${txt}`);
    }

    const items = await res.json();
    renderList(Array.isArray(items) ? items : []);
  } catch (err) {
    console.error(err);
    listContainer.innerHTML = `<div class="error">載入失敗：${err.message}</div>`;
  }
}

function renderList(items) {
  if (!items.length) {
    setEmpty();
    return;
  }

  listContainer.classList.remove("no-feedback");

  const rows = items
    .map(
      (it) => `
      <div class="feedback-item" data-id="${it.id}">
        <div class="feedback-header">
          <span class="feedback-time">${formatTimeISOToLocal(it.time)}</span>
          <div class="feedback-actions">
            <button class="feedback-delete" data-del-id="${it.id}">刪除</button>
          </div>
        </div>
        <div class="feedback-comment">${escapeHTML(it.comment ?? "")}</div>
      </div>`
    )
    .join("");

  // ✅ 不再放 <h3> 標題，避免和 HTML 的標題重複
  listContainer.innerHTML = `<div class="feedback-list">${rows}</div>`;

  // 綁定刪除按鈕
  listContainer.querySelectorAll("[data-del-id]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = Number(e.currentTarget.getAttribute("data-del-id"));
      await deleteFeedback(id);
    });
  });
}


// 建立新回饋：POST /feedback/
async function createFeedback(comment) {
  const content = String(comment || "").trim();
  if (!content) {
    alert("請先輸入您的意見");
    return;
  }

  submitBtn.disabled = true;
  const prevText = submitBtn.textContent;
  submitBtn.textContent = "送出中...";

  try {
    const res = await fetch(FEEDBACK_ENDPOINT, {
      method: "POST",
      headers: authHeaders(),
      // 未提供 time 時，後端會預設為現在（UTC）
      body: JSON.stringify({ comment: content }),
    });

    if (res.status === 401) {
      alert("尚未登入或憑證過期（401）。");
      return;
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`送出失敗：HTTP ${res.status} ${txt}`);
    }

    textarea.value = "";
    await fetchMyFeedback();
  } catch (err) {
    console.error(err);
    alert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = prevText;
  }
}

// 刪除：DELETE /feedback/{id}
async function deleteFeedback(id) {
  if (!Number.isFinite(id)) return;
  const ok = confirm("確定要刪除這筆回饋嗎？");
  if (!ok) return;

  try {
    const res = await fetch(`${FEEDBACK_ENDPOINT}${id}`, {
      method: "DELETE",
      headers: authHeaders({ json: false }),
    });

    if (res.status === 401) {
      alert("尚未登入或憑證過期（401）。");
      return;
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`刪除失敗：HTTP ${res.status} ${txt}`);
    }

    await fetchMyFeedback();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

// 綁定送出
if (submitBtn) {
  submitBtn.addEventListener("click", () => createFeedback(textarea.value));
}

// 初始化
document.addEventListener("DOMContentLoaded", fetchMyFeedback);
