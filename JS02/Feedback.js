import { API_BASE_URL } from "../config.js";

const FEEDBACK_ENDPOINT = `${API_BASE_URL}/feedback/`;

if (!localStorage.getItem('access_token')) {
    window.location.href = 'login.html';
  }



// ===== Modal =====
const modalLayer = document.getElementById("modalLayer");
const modalTitle = document.getElementById("modalTitle");
const modalMsg = document.getElementById("modalMsg");
const modalBtn = document.getElementById("modalBtn");

// i18n wrapper
function tr(key, fallback) {
  try {
    if (
      typeof window !== "undefined" &&
      window.I18N &&
      typeof window.I18N.t === "function"
    ) {
      const val = window.I18N.t(key);
      // i18n 找到字就用，多語內容來自 zh.json / en.json
      if (val && val !== key) return val;
    }
  } catch (e) {
    console.warn("i18n not ready:", e);
  }
  // 沒載到 I18N 或沒對應 key 時，用備用文字，避免整個爆掉
  return fallback;
}

function showModal(title, msg, cb) {
  modalTitle.textContent = title || tr("modal.title", "Notice");
  modalMsg.textContent = msg || "";
  modalLayer.style.display = "flex";
  modalLayer.removeAttribute("hidden");
  modalBtn.textContent = tr("modal.ok", "OK");
  modalBtn.onclick = () => {
    modalLayer.style.display = "none";
    if (typeof cb === "function") cb();
  };
}

// ===== Confirm Modal =====
const confirmLayer = document.getElementById("confirmLayer");
const confirmTitle = document.getElementById("confirmTitle");
const confirmMsg = document.getElementById("confirmMsg");
const confirmCancel = document.getElementById("confirmCancel");
const confirmOk = document.getElementById("confirmOk");

function showConfirm(title, msg) {
  return new Promise((resolve) => {
    confirmTitle.textContent =
      title || tr("modal.warningTitle", "Warning");
    confirmMsg.textContent =
      msg || tr("feedback.confirmDeleteMsg", "Are you sure?");
    confirmLayer.style.display = "flex";
    confirmLayer.removeAttribute("hidden");

    confirmCancel.textContent = tr("ui.close", "Cancel");
    confirmOk.textContent = tr("modal.ok", "OK");

    const close = (result) => {
      confirmLayer.style.display = "none";
      resolve(result);
    };

    confirmCancel.onclick = () => close(false);
    confirmOk.onclick = () => close(true);
  });
}

// ===== DOM =====
const textarea = document.getElementById("comment");
const submitBtn = document.getElementById("submitBtn");
const listContainer = document.getElementById("feedbackContainer");

// ===== Auth / Headers =====
function getAccessToken() {
  return localStorage.getItem("access_token") || "";
}

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

// ===== UI helpers =====
function setLoading() {
  listContainer.classList.remove("no-feedback");
  listContainer.innerHTML = `<div class="loading">${tr(
    "feedback.loading",
    "Loading..."
  )}</div>`;
}

function setEmpty() {
  listContainer.classList.add("no-feedback");
  listContainer.innerHTML = tr("feedback.none", "No feedback yet");
}

// 24h time format yyyy/mm/dd HH:MM:SS
function formatTimeISOToLocal(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "-";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  const second = String(d.getSeconds()).padStart(2, "0");
  return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== API: GET /feedback/ =====
async function fetchMyFeedback() {
  setLoading();
  try {
    const res = await fetch(FEEDBACK_ENDPOINT, {
      method: "GET",
      headers: authHeaders({ json: false }),
    });

    if (res.status === 401) {
      listContainer.innerHTML = `<div class="error">${tr(
        "feedback.authExpired",
        "Not logged in or session expired (401)."
      )}</div>`;
      return;
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status} ${txt}`);
    }

    const items = await res.json();
    renderList(Array.isArray(items) ? items : []);
  } catch (err) {
    console.error(err);
    listContainer.innerHTML = `<div class="error">${tr(
      "feedback.loadError",
      "Failed to load feedback"
    )}${err.message ? `: ${err.message}` : ""}</div>`;
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
            <button class="feedback-delete" data-del-id="${it.id}">
              ${tr("history.delete", "Delete")}
            </button>
          </div>
        </div>
        <div class="feedback-comment">${escapeHTML(it.comment ?? "")}</div>
      </div>`
    )
    .join("");

  listContainer.innerHTML = `<div class="feedback-list">${rows}</div>`;

  listContainer.querySelectorAll("[data-del-id]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = Number(
        e.currentTarget.getAttribute("data-del-id")
      );
      await deleteFeedback(id);
    });
  });
}

// ===== API: POST /feedback/ =====
async function createFeedback(comment) {
  const content = String(comment || "").trim();
  if (!content) {
    showModal(
      tr("modal.warningTitle", "Warning"),
      tr("feedback.submitRequired", "Please enter your feedback first.")
    );
    return;
  }

  submitBtn.disabled = true;
  const prevText = submitBtn.textContent;
  submitBtn.textContent = tr("feedback.submitting", "Submitting...");

  try {
    const res = await fetch(FEEDBACK_ENDPOINT, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ comment: content }),
    });

    if (res.status === 401) {
      showModal(
        tr("modal.errorTitle", "Error"),
        tr("feedback.authExpired", "Not logged in or session expired (401).")
      );
      return;
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status} ${txt}`);
    }

    textarea.value = "";
    await fetchMyFeedback();
  } catch (err) {
    console.error(err);
    showModal(
      tr("modal.errorTitle", "Error"),
      tr("feedback.submitError", "Failed to submit feedback") +
        (err.message ? `: ${err.message}` : "")
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = prevText;
  }
}

// ===== API: DELETE /feedback/{id} =====
async function deleteFeedback(id) {
  if (!Number.isFinite(id)) return;

  const ok = await showConfirm(
    tr("feedback.confirmDeleteTitle", "Delete Feedback"),
    tr(
      "feedback.confirmDeleteMsg",
      "Are you sure you want to delete this feedback?"
    )
  );
  if (!ok) return;

  try {
    const res = await fetch(`${FEEDBACK_ENDPOINT}${id}`, {
      method: "DELETE",
      headers: authHeaders({ json: false }),
    });

    if (res.status === 401) {
      showModal(
        tr("modal.errorTitle", "Error"),
        tr("feedback.authExpired", "Not logged in or session expired (401).")
      );
      return;
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status} ${txt}`);
    }

    await fetchMyFeedback();
  } catch (err) {
    console.error(err);
    showModal(
      tr("modal.errorTitle", "Error"),
      tr("feedback.deleteError", "Failed to delete feedback") +
        (err.message ? `: ${err.message}` : "")
    );
  }
}

// ===== Bind & init =====
if (submitBtn) {
  submitBtn.addEventListener("click", () =>
    createFeedback(textarea.value)
  );
}

document.addEventListener("DOMContentLoaded", fetchMyFeedback);
