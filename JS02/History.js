import { API_BASE_URL } from "../config.js";

/* =========================
   i18n helper
   ========================= */

/**
 * 取得多語系字串：
 * - 若 window.I18N.t 存在且有對應翻譯 → 用翻譯
 * - 否則若 window.t 存在且有對應翻譯 → 用翻譯
 * - 否則用 fallback（若提供）或 key 本身
 */
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
    if (typeof window !== "undefined" && typeof window.t === "function") {
      const val = window.t(key);
      if (val && val !== key) return val;
    }
  } catch (e) {
    console.warn("[i18n] lookup failed:", key, e);
  }
  return fallback !== undefined ? fallback : key;
}

/**
 * 讓動態插入、帶 data-i18n 的元素，也能吃到目前語系。
 * 嘗試呼叫常見名稱（包含 I18N 的 applyTranslations），
 * 若專案以不同名稱實作可再擴充此處。
 */
function applyI18nIfAvailable() {
  try {
    if (
      typeof window !== "undefined" &&
      window.I18N &&
      typeof window.I18N.applyTranslations === "function"
    ) {
      window.I18N.applyTranslations();
    } else if (typeof window.applyTranslations === "function") {
      window.applyTranslations();
    } else if (typeof window.updateTranslations === "function") {
      window.updateTranslations();
    } else if (typeof window.initI18n === "function") {
      window.initI18n();
    } else if (typeof window.translatePage === "function") {
      window.translatePage();
    }
  } catch (e) {
    console.warn("[i18n] applyI18nIfAvailable failed:", e);
  }
}

/* =========================
   共用 Modal（取代 alert / confirm）
   ========================= */

function openAppModal({ title = "", message = "", showCancel = false }) {
  return new Promise((resolve) => {
    const backdrop = document.getElementById("app-modal-backdrop");
    const titleEl = document.getElementById("app-modal-title");
    const msgEl = document.getElementById("app-modal-message");
    const okBtn = document.getElementById("app-modal-ok");
    const cancelBtn = document.getElementById("app-modal-cancel");

    if (!backdrop || !titleEl || !msgEl || !okBtn || !cancelBtn) {
      console.error("[Modal] element missing");
      console.error(title, message);
      return resolve(showCancel ? false : true);
    }

    // 標題：有值才顯示，否則隱藏
    if (title && title.trim() !== "") {
      titleEl.textContent = title;
      titleEl.style.display = "block";
    } else {
      titleEl.textContent = "";
      titleEl.style.display = "none";
    }

    msgEl.textContent = message || "";

    if (showCancel) {
      cancelBtn.classList.remove("hidden");
    } else {
      cancelBtn.classList.add("hidden");
    }

    backdrop.classList.remove("hidden");

    const cleanup = () => {
      backdrop.classList.add("hidden");
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      backdrop.onclick = null;
    };

    okBtn.onclick = (e) => {
      e.stopPropagation();
      cleanup();
      resolve(true);
    };

    cancelBtn.onclick = (e) => {
      e.stopPropagation();
      cleanup();
      resolve(false);
    };

    // 點背景 = 取消（只有在 showCancel 時）
    backdrop.onclick = (e) => {
      if (e.target === backdrop && showCancel) {
        cleanup();
        resolve(false);
      }
    };
  });
}

/** 顯示錯誤訊息（直接給 key＋fallback，在這裡轉成字串） */
async function showError(messageKey, messageFallback) {
  const title = tr("history.errorTitle", "錯誤");
  const message = tr(messageKey, messageFallback || messageKey);
  return openAppModal({ title, message, showCancel: false });
}

/** 顯示刪除確認（這裡就產出「已翻譯的字串」，不再傳 key 給 modal） */
async function showDeleteConfirm() {
  const title = tr("history.confirmDeleteTitle", "刪除確認");
  const message = tr(
    "history.confirmDeleteMsg",
    "確定要刪除這份報告嗎？刪除後將無法復原。"
  );
  return openAppModal({ title, message, showCancel: true });
}

/* =========================
   歷史紀錄 API 與渲染
   ========================= */

async function getHistory() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/reports/?limit=50&offset=0`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          accept: "application/json",
          "ngrok-skip-browser-warning": "true"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    displayHistory(data);
  } catch (error) {
    console.error("Error fetching history:", error);
    const prefix = tr("history.loadError", "無法載入歷史紀錄：");
    displayError(prefix + (error.message || ""));
    await openAppModal({
      title: tr("history.errorTitle", "錯誤"),
      message: prefix + (error.message || ""),
      showCancel: false
    });
  }
}

function displayHistory(historyData) {
  const tbody = document.querySelector("tbody");
  if (!tbody) {
    console.error("Table body not found");
    return;
  }

  tbody.innerHTML = "";

  if (!historyData || !Array.isArray(historyData) || historyData.length === 0) {
    tbody.innerHTML = `
      <tr class="border-t border-t-[#dbe0e6]">
        <td colspan="3"
            class="h-[72px] px-4 py-2 text-center text-[#60758a] text-sm font-normal leading-normal"
            data-i18n="history.none">
          ${tr("history.none", "目前尚無歷史紀錄")}
        </td>
      </tr>
    `;
    applyI18nIfAvailable();
    return;
  }

  historyData.forEach((item) => {
    const row = createHistoryRow(item);
    tbody.appendChild(row);
  });

  // 讓動態產生的 data-i18n 元件套用目前語系
  applyI18nIfAvailable();
}

/* =========================
   建立單列
   ========================= */

function createHistoryRow(item) {
  const row = document.createElement("tr");
  row.className = "border-t border-t-[#dbe0e6]";

  const rawTime = item.upload_time || item.created_at || item.timestamp;
  const uploadTimeText = formatTime(rawTime);

  const fileName = formatReportNameFromItem(item);

  // 這裡先用 tr 依目前語系塞字串，同時保留 data-i18n，之後切語系時可被 i18n.js 覆蓋
  const openLabel = tr("history.openPdf", "開啟 PDF");
  const deleteLabel = tr("history.delete", "刪除");

  row.innerHTML = `
    <td class="h-[72px] px-4 py-2 w-[400px] text-[#60758a] text-sm font-normal leading-normal">
      ${uploadTimeText}
    </td>
    <td class="h-[72px] px-4 py-2 w-[400px] text-[#60758a] text-sm font-normal leading-normal">
      ${fileName}
    </td>
    <td class="h-[72px] px-4 py-2 w-60 text-[#60758a] text-sm font-bold leading-normal tracking-[0.015em]">
      <button class="action-btn action-open" data-i18n="history.openPdf">
        ${openLabel}
      </button>
      <button class="action-btn action-delete" data-i18n="history.delete">
        ${deleteLabel}
      </button>
    </td>
  `;

  // Open PDF
  const openBtn = row.querySelector(".action-open");
  if (openBtn) {
    openBtn.addEventListener("click", async () => {
      if (!item.id) {
        await showError(
          "history.missingIdOpen",
          "找不到報告 ID，無法開啟檔案。"
        );
        return;
      }
      try {
        await openReportPdf(item.id);
      } catch (e) {
        console.error("Open PDF failed:", e);
        const prefix = tr("history.openFail", "PDF 開啟失敗：");
        await openAppModal({
          title: tr("history.errorTitle", "錯誤"),
          message: prefix + (e.message || ""),
          showCancel: false
        });
      }
    });
  }

  // Delete
  const deleteBtn = row.querySelector(".action-delete");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      if (!item.id) {
        await showError(
          "history.missingIdDelete",
          "找不到報告 ID，無法刪除。"
        );
        return;
      }

      const ok = await showDeleteConfirm();
      if (!ok) return;

      try {
        await deleteReport(item.id);
        await getHistory(); // 成功後刷新列表，不再跳成功訊息
      } catch (e) {
        console.error("Delete failed:", e);
        const prefix = tr("history.deleteError", "刪除失敗：");
        await openAppModal({
          title: tr("history.errorTitle", "錯誤"),
          message: prefix + (e.message || ""),
          showCancel: false
        });
      }
    });
  }

  return row;
}

/* =========================
   檔名：財報預測_基期~預測最後一年 / Forecast_YYYY~YYYY
   ========================= */

function formatReportNameFromItem(item) {
  const rawName =
    (item && (item.title || item.filename || item.file_name)) || "";

  const prefix = tr("history.reportPrefix", "Forecast");

  if (rawName) {
    const nameWithoutExt = rawName.replace(/\.[^.]+$/, "");
    // 例如 state.export.reportTitle_2025~2028 → 抓 2025、2028
    const m = nameWithoutExt.match(/(20\d{2})\D{0,3}(20\d{2})$/);
    if (m) {
      const startYear = m[1];
      const endYear = m[2];
      return `${prefix}_${startYear}~${endYear}`;
    }
  }

  return prefix;
}

/* =========================
   時間處理
   ========================= */

function parseTime(timeString) {
  if (!timeString) return null;
  try {
    let adjusted = timeString.trim();
    // 去掉多餘微秒
    adjusted = adjusted.replace(/\.\d{3,6}$/, "");
    // 沒時區 → 預設 +08:00
    if (!/Z|[+-]\d{2}:\d{2}$/.test(adjusted)) {
      adjusted += "+08:00";
    }
    return new Date(adjusted);
  } catch (error) {
    console.error("Error parsing time:", error, timeString);
    return null;
  }
}

function formatTime(timeString) {
  const date = parseTime(timeString);
  if (!date || isNaN(date.getTime())) {
    return tr("history.unknownTime", "未知時間");
  }

  try {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  } catch (error) {
    console.error("Error formatting time:", error, timeString);
    return timeString || tr("history.unknownTime", "未知時間");
  }
}

/* =========================
   錯誤列 & API
   ========================= */

function displayError(message) {
  const tbody = document.querySelector("tbody");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr class="border-t border-t-[#dbe0e6]">
      <td colspan="3"
          class="h-[72px] px-4 py-2 text-center text-red-500 text-sm font-normal leading-normal">
        ${message}
      </td>
    </tr>
  `;
}

async function openReportPdf(id) {
  const url = `${API_BASE_URL}/reports/${id}/pdf?download=false`;
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      accept: "application/pdf",
      "ngrok-skip-browser-warning": "true"
    }
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status} ${text}`);
  }
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
}

async function deleteReport(id) {
  const url = `${API_BASE_URL}/reports/${id}`;
  const resp = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      accept: "application/json"
    }
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status} ${text}`);
  }
  return await resp.json().catch(() => ({ ok: true }));
}

/* =========================
   初始化
   ========================= */

document.addEventListener("DOMContentLoaded", () => {
  getHistory();
});

export { getHistory, displayHistory };