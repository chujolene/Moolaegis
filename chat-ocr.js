// chat-ocr.js
"use strict";

import { API_BASE_URL } from './config.js';
import { apiFetch } from './auth.js';

const ocrUploadURL = `${API_BASE_URL}/ocr/upload`;

(() => {
  const OCR_API = ocrUploadURL;
  const HIDDEN  = "hidden";
  const token = localStorage.getItem("access_token")
  
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const els = {
      chatInput:        document.querySelector(".chat-input"),
      uploadInput:      document.getElementById("receipt-upload"),

      modal:            document.getElementById("ocr-modal"),
      // preview
      previewBlock:     document.getElementById("preview-block"),
      previewImg:       document.getElementById("ocr-image-preview"),
      // step1
      step1Actions:     document.getElementById("step1-actions"),
      confirmBtn:       document.getElementById("confirm-upload-btn"),
      closeTopBtn:      document.getElementById("close-modal-btn-top"),
      step1Divider:     document.getElementById("step1-divider"),
      // step2
      resultSection:    document.getElementById("ocr-result-section"),
      resultText:       document.getElementById("ocr-result-text"),
      useBtn:           document.getElementById("use-ocr-btn"),
      closeBottomBtn:   document.getElementById("close-modal-btn-bottom"),
    };

    if (Object.values(els).some(el => !el)) {
      console.error("[chat-ocr] Missing DOM node(s).");
      return;
    }

    let currentFile = null;

    // 選檔 → 顯示 Step1
    els.uploadInput.addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;

      currentFile = file;
      const reader = new FileReader();
      reader.onload = ev => {
        els.previewImg.src = ev.target.result;

        // 初始顯示：預覽 + step1，隱藏 step2
        show(els.previewBlock);
        show(els.step1Actions);
        show(els.step1Divider);
        hide(els.resultSection);

        show(els.modal);
      };
      reader.readAsDataURL(file);
    });

    // Confirm Upload → OCR → 切到 Step2（但保留預覽）
    els.confirmBtn.addEventListener("click", async () => {
      if (!currentFile) return;

      toggleLoading(els.confirmBtn, true);
      try {
        const formData = new FormData();
        formData.append("receipt", currentFile);
        
        // use apiFetch to handle auth(refresh token)
        const res = await apiFetch(OCR_API, 
          { method: "POST", 
            headers: {"Authorization": `Bearer ${token}`},
            body: formData 
          }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        els.resultText.value = (data.status === "success")
          ? formatSummary(data.summary)
          : `Error: ${data.message || "Could not process receipt."}`;
      } catch (err) {
        console.error("OCR Error:", err);
        els.resultText.value = "Error: Could not process receipt.";
      } finally {
        toggleLoading(els.confirmBtn, false);

        // 只藏掉 step1 的按鈕 & hr，不藏預覽
        hide(els.step1Actions);
        hide(els.step1Divider);
        show(els.resultSection);
      }
    });

    // Use This
    els.useBtn.addEventListener("click", () => {
      els.chatInput.value = els.resultText.value;
      closeModal();
    });

    // Close（兩顆）
    els.closeTopBtn.addEventListener("click", closeModal);
    els.closeBottomBtn.addEventListener("click", closeModal);

    // ESC / click overlay
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !has(els.modal, HIDDEN)) closeModal();
    });
    els.modal.addEventListener("click", e => {
      if (e.target === els.modal) closeModal();
    });

    function closeModal(){
      hide(els.modal);

      // reset
      els.uploadInput.value = "";
      currentFile = null;
      els.resultText.value = "";

      show(els.step1Actions);
      show(els.step1Divider);
      hide(els.resultSection);
    }
  }

  // Helpers
  function formatSummary(summary) {
    try {
      const data = JSON.parse(summary);
      const itemsList = data.items.map(i => `${i.name} ($${i.price})`).join(", ");
      return `Vendor: ${data.vendor}, \nDate: ${data.date}, \nItems: ${itemsList}, \nTotal: $${data.total}`;
    } catch {
      return summary;
    }
  }
  function show(el){ el.classList.remove(HIDDEN); }
  function hide(el){ el.classList.add(HIDDEN); }
  function has(el, cls){ return el.classList.contains(cls); }

  function toggleLoading(btn, isLoading){
    btn.disabled = isLoading;
    btn.innerText = isLoading ? "Processing..." : "Confirm Upload";
  }
})();
