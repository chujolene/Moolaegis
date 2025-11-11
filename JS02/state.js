import { API_BASE_URL } from "../config.js";

if (!localStorage.getItem('access_token')) {
    window.location.href = 'login.html';
  }

/* =========================================
 *  i18n：偵測 & 管理語言
 *  優先順序：
 *    1. localStorage.lang（Main.html / header 選擇）
 *    2. window.I18N 目前語言
 *    3. <html lang="">
 *    4. navigator.language
 *    5. 預設 zh
 * =======================================*/

const i18nData = { zh: {}, en: {} };

function detectInitialLanguage() {
  if (typeof window === "undefined") return "zh";

  // 1) localStorage
  const stored = localStorage.getItem("lang");
  if (stored === "zh" || stored === "en") return stored;

  // 2) global I18N（若有）
  if (window.I18N) {
    if (typeof window.I18N.getLanguage === "function") {
      const g = window.I18N.getLanguage();
      if (g === "zh" || g === "en") return g;
    }
    if (typeof window.I18N.lang === "string") {
      const g = window.I18N.lang;
      if (g === "zh" || g === "en") return g;
    }
  }

  // 3) <html lang="">
  const htmlLang = (document.documentElement.lang || "").toLowerCase();
  if (htmlLang.startsWith("zh")) return "zh";
  if (htmlLang.startsWith("en")) return "en";

  // 4) navigator.language
  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("en")) return "en";

  // 5) fallback
  return "zh";
}

let currentLang = detectInitialLanguage();

function getNested(obj, path) {
  return path.split(".").reduce((o, k) => (o && k in o ? o[k] : undefined), obj);
}

// 嘗試載入本地 zh.json / en.json（只在沒有全域 I18N 時當後備）
async function loadI18n() {
  if (typeof window !== "undefined" && window.I18N && typeof window.I18N.t === "function") {
    // 已有共用 I18N，不重複載
    return;
  }

  const langs = ["zh", "en"];
  const bases = [
    "./",
    "../",
    "./language/lang/",
    "../language/lang/",
    "/language/lang/",
  ];

  for (const lang of langs) {
    if (Object.keys(i18nData[lang]).length) continue;

    for (const base of bases) {
      const url = `${base}${lang}.json`;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;

        const text = await res.text();
        const looksJson =
          (res.headers.get("content-type") || "").includes("application/json") ||
          text.trim().startsWith("{") ||
          text.trim().startsWith("[");

        if (!looksJson) continue;

        i18nData[lang] = JSON.parse(text);
        console.log(`[i18n] loaded ${lang} from ${url}`);
        break;
      } catch (e) {
        console.warn(`[i18n] load failed for ${lang} from ${url}`, e);
      }
    }
  }
}

// 主翻譯函式：優先 window.I18N，再用本地 i18nData，最後 fallback
function tr(key, fallback) {
  try {
    if (
      typeof window !== "undefined" &&
      window.I18N &&
      typeof window.I18N.t === "function"
    ) {
      const val = window.I18N.t(key);
      if (val && val !== key) return val;
    }
  } catch (e) {
    console.warn("i18n(global) not ready:", e);
  }

  const lang = currentLang || "zh";

  if (i18nData[lang] && Object.keys(i18nData[lang]).length) {
    const v = getNested(i18nData[lang], key);
    if (typeof v === "string") return v;
  }

  const other = lang === "zh" ? "en" : "zh";
  if (i18nData[other] && Object.keys(i18nData[other]).length) {
    const v2 = getNested(i18nData[other], key);
    if (typeof v2 === "string") return v2;
  }

  return fallback !== undefined ? fallback : key;
}

function i18nString(key, fallback) {
  return tr(key, fallback);
}

// 掃描 data-i18n* attribute，動態更新畫面文字
function updateTranslations() {
  const q = (sel) => document.querySelectorAll(sel);

  q("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    el.textContent = tr(key, el.textContent);
  });

  q("[data-i18n-html]").forEach((el) => {
    const key = el.dataset.i18nHtml;
    el.innerHTML = tr(key, el.innerHTML);
  });

  q("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    el.placeholder = tr(key, el.placeholder);
  });

  q("[data-i18n-value]").forEach((el) => {
    const key = el.dataset.i18nValue;
    el.value = tr(key, el.value);
  });

  q("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle;
    el.title = tr(key, el.title);
  });

  q("[data-i18n-alt]").forEach((el) => {
    const key = el.dataset.i18nAlt;
    el.alt = tr(key, el.alt);
  });

  const title = tr("state.pageTitle", document.title);
  if (title) document.title = title;
}

// 切換語系：更新 currentLang / localStorage / 全域 I18N / 畫面
async function setLanguage(lang) {
  if (lang !== "zh" && lang !== "en") return;

  currentLang = lang;
  if (typeof window !== "undefined") {
    localStorage.setItem("lang", lang);
  }

  try {
    if (typeof window !== "undefined" && window.I18N) {
      if (typeof window.I18N.setLanguage === "function") {
        await window.I18N.setLanguage(lang);
      } else if (typeof window.I18N.setLang === "function") {
        await window.I18N.setLang(lang);
      }
    } else {
      await loadI18n();
    }
  } catch (e) {
    console.warn("setLanguage global I18N error:", e);
  }

  updateTranslations();
  bindThousandsFormat();
  if (window.lastForecast) {
    generateForecast();
  }
}

/* =========================================
 *  基本工具
 * =======================================*/

function getVal(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const raw = String(el.value || "").replace(/,/g, "");
  const v = parseFloat(raw);
  return Number.isNaN(v) ? 0 : v;
}

function fmtDate(id) {
  const el = document.getElementById(id);
  return el && el.value ? el.value : "";
}

function yearFromDateStr(s, fallback) {
  if (!s) return fallback;
  const d = new Date(s);
  const y = d.getFullYear();
  return Number.isFinite(y) ? y : fallback;
}

/* =========================================
 *  假設值 & 驗證
 * =======================================*/

function readAssumptionsFromUI() {
  return {
    taxRate: getVal("ass_tax_rate") / 100,
    depRate: getVal("ass_dep_rate") / 100,
    capexRate: getVal("ass_capex_rate") / 100,
    arPct: getVal("ass_ar_pct") / 100,
    invPct: getVal("ass_inv_pct") / 100,
    apPct: getVal("ass_ap_pct") / 100,
  };
}

function validate() {
  const req = [
    "revenue",
    "cogs",
    "op_expense",
    "tax_expense",
    "re_begin",
    "cash_end",
    "ar_end",
    "inventory_end",
    "ppe_end",
    "ap_end",
    "debt_end",
    "capital_end",
  ];
  for (const id of req) {
    const el = document.getElementById(id);
    if (!el || String(el.value).trim() === "") {
      alert(
        "★ " +
          i18nString(
            "state.alert.requiredField",
            "必填欄位不可留空 (Required field)"
          )
      );
      return false;
    }
  }
  return true;
}

/* =========================================
 *  數字格式
 * =======================================*/

function formatNumberCustom(value) {
  if (typeof value !== "number" || isNaN(value)) return "—";
  const decimals = parseInt(
    document.getElementById("decimal_places")?.value || "0",
    10
  );
  const mode = document.getElementById("round_mode")?.value || "round";
  const factor = Math.pow(10, decimals);
  let v = value;

  if (mode === "round") v = Math.round(v * factor) / factor;
  else if (mode === "ceil") v = Math.ceil(v * factor) / factor;
  else if (mode === "floor") v = Math.floor(v * factor) / factor;

  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatNumberParens(value) {
  if (typeof value !== "number" || isNaN(value)) return "—";
  if (value < 0) return "(" + formatNumberCustom(Math.abs(value)) + ")";
  return formatNumberCustom(value);
}

function formatWithCommas(value) {
  if (value === "" || isNaN(value)) return "";
  return Number(value).toLocaleString("en-US");
}

function bindThousandsFormat() {
  document
    .querySelectorAll('input[type="number"], input.onecol-val')
    .forEach((input) => {
      input.type = "text";
      if (input.value) {
        input.value = formatWithCommas(input.value.replace(/,/g, ""));
      }

      let isComposing = false;

      // Handle 'compositionstart' to flag when the user starts composing
      input.addEventListener("compositionstart", () => {
        isComposing = true;
      });

      // Handle 'compositionend' to apply formatting once composition ends
      input.addEventListener("compositionend", (e) => {
        isComposing = false;
        const raw = e.target.value.replace(/,/g, "");
        if (raw === "" || isNaN(raw)) {
          e.target.value = "";
        } else {
          e.target.value = formatWithCommas(raw);
        }
      });

      // Real-time input event formatting, but only if not composing
      input.addEventListener("input", (e) => {
        if (!isComposing) {
          const raw = e.target.value.replace(/,/g, "");
          if (raw === "" || isNaN(raw)) {
            e.target.value = "";
          } else {
            e.target.value = formatWithCommas(raw);
          }
        }
      });
    });
}

/* =========================================
 *  Forecast 核心計算
 * =======================================*/

function runForecast(years, gArr, ass) {
  const rev0 = getVal("revenue");
  const cogs0 = getVal("cogs");
  const opex0 = getVal("op_expense");
  const int0 = getVal("interest_expense");
  const tax0 = getVal("tax_expense");
  const CAPITAL0 = getVal("capital_end");

  let CASH = getVal("cash_end");
  let AR = getVal("ar_end");
  let INV = getVal("inventory_end");
  let PPE = getVal("ppe_end");
  let AP = getVal("ap_end");
  const DEBT0 = getVal("debt_end");

  const grossProfit0 = rev0 - cogs0;
  const pretax0 = grossProfit0 - opex0 - int0;
  const net0 = pretax0 - tax0;
  const RE0 = getVal("re_begin") + net0;

  const AR_begin = getVal("ar_begin");
  const INV_begin = getVal("inventory_begin");
  const AP_begin = getVal("ap_begin");
  const PPE_begin = getVal("ppe_begin");
  const DEBT_begin = getVal("debt_begin");
  const CAPITAL_begin = getVal("capital_begin");

  const arflow = AR_begin - AR;
  const invenflow = INV_begin - INV;
  const apflow = AP - AP_begin;
  const CFO0 = net0 + arflow + invenflow + apflow;

  const ppeflow = PPE - PPE_begin;
  const CFI0 = -ppeflow;

  const debtflow = DEBT0 - DEBT_begin;
  const capflow = CAPITAL0 - CAPITAL_begin;
  const CFF0 = debtflow + capflow;

  const cogsPct = rev0 > 0 ? cogs0 / rev0 : 0;
  const opexPct = rev0 > 0 ? opex0 / rev0 : 0;

  const NWC_begin = AR_begin + INV_begin - AP_begin;
  const NWC_end = AR + INV - AP;
  const dNWC0 = NWC_end - NWC_begin;

  let NWC_prev = NWC_end;
  let RE = RE0;

  const rows = [];
  const baseYear = yearFromDateStr(
    fmtDate("period_end"),
    new Date().getFullYear()
  );

  // Base year: set beginning cash to 0 (按照需求)
  rows.push({
    year: baseYear,
    revenue: rev0,
    cogs: cogs0,
    opex: opex0,
    Dep: 0,
    CapEx: 0,
    intExp: int0,
    pretax: pretax0,
    tax: tax0,
    net: net0,
    CFO: CFO0,
    CFI: CFI0,
    CFF: CFF0,
    cash: CASH,
    AR,
    INV,
    AP,
    PPE,
    RE: RE0,
    dNWC: dNWC0,
    deltaAR: AR - AR_begin,
    deltaInventory: INV - INV_begin,
    deltaAP: AP - AP_begin,
    deltaDebt: debtflow,
    dividend: capflow,
    // 基期 beginningCash 固定為 0（依使用者要求）
    beginningCash: 0,
  });

  // Forecast years
  for (let i = 1; i <= years; i++) {
    const growth = gArr[i - 1] ?? 0;
    const year = baseYear + i;

    const prev = rows[i - 1];
    const revenue = prev.revenue * (1 + growth);
    const cogs = revenue * cogsPct;
    const opex = revenue * opexPct;

    const Dep = PPE * ass.depRate;
    const CapEx = revenue * ass.capexRate;
    const intExp = int0;

    const pretax = revenue - cogs - opex - Dep - intExp;
    const tax = Math.max(0, pretax) * ass.taxRate;
    const net = pretax - tax;
    RE += net;

    const AR_prev = AR;
    const INV_prev = INV;
    const AP_prev = AP;

    AR = revenue * ass.arPct;
    INV = cogs * ass.invPct;
    AP = cogs * ass.apPct;

    const deltaAR = AR - AR_prev;
    const deltaInventory = INV - INV_prev;
    const deltaAP = AP - AP_prev;

    const NWC = AR + INV - AP;
    const dNWC = NWC - NWC_prev;
    NWC_prev = NWC;

    const CFO = net + Dep - dNWC;
    const CFI = -CapEx;
    const CFF = 0;

    // Set beginning cash to the previous year's ending cash
    const beginningCash = prev.cash;

    // Update cash flow calculation
    CASH = beginningCash + CFO + CFI + CFF;

    PPE = PPE + CapEx - Dep;

    rows.push({
      year,
      revenue,
      cogs,
      opex,
      Dep,
      CapEx,
      intExp,
      pretax,
      tax,
      net,
      CFO,
      CFI,
      CFF,
      cash: CASH,
      AR,
      INV,
      AP,
      PPE,
      RE,
      dNWC,
      deltaAR,
      deltaInventory,
      deltaAP,
      deltaDebt: 0,
      dividend: 0,
      // 每年 beginningCash 為上一年 ending cash
      beginningCash: beginningCash,
    });
  }

  return {
    rows,
    constants: { DEBT: DEBT0, CAPITAL: CAPITAL0 },
  };
}



/* =========================================
 *  成長率輸入
 * =======================================*/

function renderGrowthInputs() {
  const wrap = document.getElementById("growth_inputs");
  if (!wrap) return;

  const years = parseInt(document.getElementById("fc_years")?.value, 10) || 3;
  const mode = document.getElementById("growth_mode")?.value || "fixed";

  if (mode === "fixed") {
    wrap.innerHTML = `
      <label>${i18nString(
        "state.optionFixedGrowth",
        "固定年度成長率"
      )} (%)</label>
      <input type="number" id="growth_fixed" value="10" step="0.1">
    `;
  } else {
    let html = "";
    for (let i = 1; i <= years; i++) {
      const label = `Y+${i} ${i18nString(
        "state.labels.growth",
        "成長率"
      )} (%)`;
      html += `<label>${label}</label><input type="number" id="growth_y${i}" value="10" step="0.1">`;
    }
    wrap.innerHTML = html;
  }
}

function readGrowthArray(n) {
  const mode = document.getElementById("growth_mode")?.value || "fixed";
  if (mode === "fixed") {
    const g =
      (parseFloat(document.getElementById("growth_fixed")?.value) || 0) / 100;
    return Array.from({ length: n }, () => g);
  }

  const arr = [];
  for (let i = 1; i <= n; i++) {
    const v =
      (parseFloat(document.getElementById(`growth_y${i}`)?.value) || 0) / 100;
    arr.push(v);
  }
  return arr;
}

/* =========================================
 *  圖表：營收 + KPI + CF + CCC
 * =======================================*/

let _revChart = null;
let _cfStackChart = null;
let _cccChart = null;

function makeChart(canvasId, rows) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return;
  const ctx = canvas.getContext("2d");
  if (_revChart) _revChart.destroy();

  const labels = rows.map((r) => r.year);
  const revenue = rows.map((r) => r.revenue);
  const colors = revenue.map((_, i) =>
    i === 0 ? "rgba(128,128,128,0.7)" : "rgba(54,162,235,0.7)"
  );

  _revChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: i18nString("state.pl.revenue", "Revenue"),
          data: revenue,
          backgroundColor: colors,
          yAxisID: "y",
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: {
            generateLabels() {
              return [
                {
                  text: i18nString("state.labels.base", "Base"),
                  fillStyle: "rgba(128,128,128,0.7)",
                },
                {
                  text: i18nString("state.labels.forecast", "Forecast"),
                  fillStyle: "rgba(54,162,235,0.7)",
                },
              ];
            },
          },
        },
        datalabels: {
          anchor: "end",
          align: "end",
          formatter(value, ctx2) {
            const i = ctx2.dataIndex;
            if (i === 0) return "";
            const prev = revenue[i - 1] || 1;
            const growth = ((revenue[i] / prev - 1) * 100).toFixed(1);
            return `${i18nString("state.labels.growth", "Growth")}: ${growth}%`;
          },
          color: "#E4745E",
          font: { weight: "bold" },
        },
      },
      scales: {
        y: {
          ticks: {
            callback(v) {
              return formatNumberCustom(v);
            },
          },
        },
      },
    },
    plugins: typeof ChartDataLabels !== "undefined" ? [ChartDataLabels] : [],
  });
}

function makeKPI(container, baseRevenue, baseNet, rows) {
  if (!container || !rows.length) return;
  const last = rows[rows.length - 1];
  const FCF = last.CFO - Math.abs(last.CFI);
  const y = last.year;

  container.innerHTML = `
    <div class="kpi">
      <div class="card">
        <div class="title">${y} ${i18nString(
          "state.pl.revenue",
          "Revenue"
        )}</div>
        <div class="value">${formatNumberParens(last.revenue)}</div>
        <div class="sub">${i18nString(
          "state.labels.base",
          "vs Base"
        )} ${formatNumberParens(baseRevenue)}</div>
      </div>
      <div class="card">
        <div class="title">${y} ${i18nString(
          "state.labels.netProfit",
          "Net Profit"
        )}</div>
        <div class="value">${formatNumberParens(last.net)}</div>
        <div class="sub">${i18nString(
          "state.labels.base",
          "vs Base"
        )} ${formatNumberParens(baseNet)}</div>
      </div>
      <div class="card">
        <div class="title">${y} ${i18nString(
          "state.labels.cfoTitle",
          "Operating Cash Flow (CFO)"
        )}</div>
        <div class="value">${formatNumberParens(last.CFO)}</div>
        <div class="sub">CFO</div>
      </div>
      <div class="card">
        <div class="title">${y} ${i18nString(
          "state.labels.endingCash",
          "Ending Cash"
        )}</div>
        <div class="value">${formatNumberParens(FCF)}</div>
        <div class="sub">${i18nString(
          "state.labels.cashSub",
          "CFO + CFI + CFF"
        )}</div>
      </div>
    </div>
  `;
}

/* =========================================
 *  Summary / Balance / CF / CCC / 比率 / Common-size
 * =======================================*/

function renderSummaryMatrix(container, rows, constants) {
  if (!container || !rows.length) return;
  const DEBT = constants.DEBT || 0;
  const CAP = constants.CAPITAL || 0;
  const headers = rows.map((r) => `<th>${r.year}</th>`).join("");

  const line = (label, getter) =>
    `<tr><td>${label}</td>${rows
      .map((r) => `<td>${formatNumberParens(getter(r))}</td>`)
      .join("")}</tr>`;

  container.innerHTML = `
    <div class="matrix-wrap">
      <div class="matrix-section">
        <h4 class="subttl">${i18nString(
          "state.analysis.summaryIS",
          "Income Statement Overview"
        )}</h4>
        <table class="matrix">
          <tr><th>${i18nString("common.field", "Field")}</th>${headers}</tr>
          ${line(i18nString("state.pl.revenue", "Revenue"), (r) => r.revenue)}
          ${line(i18nString("state.pl.cogs", "COGS"), (r) => r.cogs)}
          ${line(
            i18nString("state.pl.expense", "Operating expense"),
            (r) => r.opex
          )}
          ${line(
            i18nString("state.labels.depreciation", "Depreciation"),
            (r) => r.Dep
          )}
          ${line(
            i18nString("state.labels.interest", "Interest"),
            (r) => r.intExp
          )}
          ${line(i18nString("state.pl.tax", "Income tax"), (r) => r.tax)}
          ${line(
            `<strong style="color:#0b4b8a">${i18nString(
              "state.labels.netProfit",
              "Net Profit"
            )}</strong>`,
            (r) => r.net
          )}
        </table>
      </div>

      <div class="matrix-section">
        <h4 class="subttl">${i18nString(
          "state.analysis.summaryBS",
          "Balance Sheet Overview"
        )}</h4>

        <table class="matrix">
          <tr>
            <th>${i18nString("common.field", "Field")}</th>
            ${headers}
          </tr>

          ${line(i18nString("state.asset.cash", "Cash"), (r) => r.cash)}
          ${line(
            i18nString("state.asset.receivable", "Accounts receivable"),
            (r) => r.AR
          )}
          ${line(
            i18nString("state.asset.inventory", "Inventory"),
            (r) => r.INV
          )}
          ${line(i18nString("state.asset.ppe", "PPE"), (r) => r.PPE)}

          ${line(
            `<strong class="bs-total" style="color:#0b4b8a">${i18nString(
              "state.labels.totalAssets",
              "Total Assets"
            )}</strong>`,
            (r) => r.cash + r.AR + r.INV + r.PPE
          )}

          ${line(
            i18nString("state.liability.payable", "Accounts payable"),
            (r) => r.AP
          )}
          ${line(
            i18nString("state.liability.debt", "Debt"),
            () => DEBT
          )}
          ${line(
            i18nString("state.equity.capital", "Capital"),
            () => CAP
          )}
          ${line(
            i18nString("state.equity.retainedEarnings", "RE"),
            (r) => r.RE
          )}

          ${line(
            `<strong class="bs-total" style="color:#0b4b8a">${i18nString(
              "state.labels.totalLiabilitiesEquity",
              "Total Liabilities + Equity"
            )}</strong>`,
            (r) => r.AP + DEBT + CAP + r.RE
          )}
        </table>
      </div>
  `;
}

function _bstot(r, constants) {
  const DEBT = constants.DEBT || 0;
  const CAP = constants.CAPITAL || 0;
  const totalA = r.cash + r.AR + r.INV + r.PPE;
  const totalLE = r.AP + DEBT + CAP + r.RE;
  return { totalA, totalLE, diff: totalA - totalLE, DEBT, CAP };
}

function renderBalanceCheck(containerId, rows, constants) {
  const el = document.getElementById(containerId);
  if (!el || !rows.length) return;
  const headers = rows.map((r) => `<th>${r.year}</th>`).join("");

  const row = (label, getter) =>
    `<tr><td>${label}</td>${rows
      .map((r) => `<td>${formatNumberCustom(getter(r))}</td>`)
      .join("")}</tr>`;

  el.innerHTML = `
    <div class="matrix-wrap">
      <h4 class="subttl">${i18nString(
        "state.analysis.bscheckTitle",
        "Balance Check"
      )}</h4>
      <table class="matrix">
        <tr><th>${i18nString("common.field", "Field")}</th>${headers}</tr>
        ${row(
          i18nString("state.labels.totalAssets", "Total Assets"),
          (r) => _bstot(r, constants).totalA
        )}
        ${row(
          i18nString(
            "state.labels.totalLiabilitiesEquity",
            "Total Liabilities + Equity"
          ),
          (r) => _bstot(r, constants).totalLE
        )}
        ${row(
          i18nString("state.labels.diff", "Difference"),
          (r) => _bstot(r, constants).diff
        )}
      </table>
    </div>
  `;
}

/* Yearly detail (IS/BS/CF cards) */
function renderYearSections(root, rows, constants) {
  rows.forEach((r) => {
    const sec = document.createElement("details");
    sec.open = false;
    sec.innerHTML = `
      <summary>${r.year} ${i18nString(
        "state.pl.title",
        "Yearly Statements"
      )}</summary>
      <div class="year-grid">

        <div class="card">
          <h3>${i18nString(
            "state.pl.IS",
            "Income Statement"
          )}（${r.year}）</h3>
          <table class="ie-table">
            <tr><td>${i18nString(
              "state.pl.revenue",
              "Revenue"
            )}</td><td>${formatNumberParens(r.revenue)}</td></tr>
            <tr><td>${i18nString(
              "state.pl.cogs",
              "COGS"
            )}</td><td>${formatNumberParens(-r.cogs)}</td></tr>
            <tr class="total-row"><td>${i18nString(
              "state.labels.grossProfit",
              "Gross Profit"
            )}</td><td>${formatNumberParens(
              r.revenue - r.cogs
            )}</td></tr>
            <tr><td>${i18nString(
              "state.pl.expense",
              "Operating expense"
            )}</td><td>${formatNumberParens(-r.opex)}</td></tr>
            <tr><td>${i18nString(
              "state.labels.depreciation",
              "Depreciation"
            )}</td><td>${formatNumberParens(-r.Dep)}</td></tr>
            <tr><td>${i18nString(
              "state.labels.interest",
              "Interest"
            )}</td><td>${formatNumberParens(-r.intExp)}</td></tr>
            <tr class="total-row"><td>${i18nString(
              "state.labels.pretax",
              "Pretax profit"
            )}</td><td>${formatNumberParens(r.pretax)}</td></tr>
            <tr><td>${i18nString(
              "state.pl.tax",
              "Income tax"
            )}</td><td>${formatNumberParens(-r.tax)}</td></tr>
            <tr class="total-row"><td>${i18nString(
              "state.labels.netProfit",
              "Net Profit"
            )}</td><td>${formatNumberParens(r.net)}</td></tr>
          </table>
        </div>

        <div class="card">
          <h3>${i18nString(
            "state.bs.title",
            "Balance Sheet"
          )}（${r.year} ${i18nString(
              "state.labels.ending",
              "ending"
            )}）</h3>
          <table class="ie-table">
            <tr><td>${i18nString(
              "state.asset.cash",
              "Cash"
            )}</td><td>${formatNumberParens(r.cash)}</td></tr>
            <tr><td>${i18nString(
              "state.asset.receivable",
              "Accounts receivable"
            )}</td><td>${formatNumberParens(r.AR)}</td></tr>
            <tr><td>${i18nString(
              "state.asset.inventory",
              "Inventory"
            )}</td><td>${formatNumberParens(r.INV)}</td></tr>
            <tr><td>${i18nString(
              "state.asset.ppe",
              "PPE"
            )}</td><td>${formatNumberParens(r.PPE)}</td></tr>
            <tr class="total-row"><td>${i18nString(
              "state.labels.totalAssets",
              "Total Assets"
            )}</td><td>${formatNumberParens(
              r.cash + r.AR + r.INV + r.PPE
            )}</td></tr>
            <tr><td>${i18nString(
              "state.liability.payable",
              "Accounts payable"
            )}</td><td>${formatNumberParens(r.AP)}</td></tr>
            <tr><td>${i18nString(
              "state.liability.debt",
              "Borrowings"
            )}</td><td>${formatNumberParens(constants.DEBT)}</td></tr>
            <tr><td>${i18nString(
              "state.equity.capital",
              "Share capital"
            )}</td><td>${formatNumberParens(constants.CAPITAL)}</td></tr>
            <tr><td>${i18nString(
              "state.equity.retainedEarnings",
              "Retained earnings"
            )}</td><td>${formatNumberParens(r.RE)}</td></tr>
            <tr class="total-row"><td>${i18nString(
              "state.labels.totalLiabilitiesEquity",
              "Total Liabilities + Equity"
            )}</td><td>${formatNumberParens(
              r.AP + constants.DEBT + constants.CAPITAL + r.RE
            )}</td></tr>
          </table>
        </div>

        <div class="card">
  <h3>${i18nString(
    "state.cf.title",
    "Cash Flow Statement"
  )}（${r.year}）</h3>
  <table class="ie-table">
    <tr><td colspan="2" class="section-header">${i18nString(
      "state.cf.operating",
      "Operating activities"
    )}</td></tr>
    <tr><td>${i18nString(
      "state.labels.netProfit",
      "Net Profit"
    )}</td><td>${formatNumberParens(r.net)}</td></tr>
    <tr><td>${i18nString(
      "state.labels.adjustments",
      "Adjustments"
    )}</td><td></td></tr>
    <tr><td>　${i18nString(
      "state.asset.receivable",
      "Accounts receivable"
    )}</td><td>${formatNumberParens(-r.deltaAR)}</td></tr>
    <tr><td>　${i18nString(
      "state.asset.inventory",
      "Inventory"
    )}</td><td>${formatNumberParens(-r.deltaInventory)}</td></tr>
    <tr><td>　${i18nString(
      "state.liability.payable",
      "Accounts payable"
    )}</td><td>${formatNumberParens(r.deltaAP)}</td></tr>
    <tr><td>　${i18nString(
      "state.labels.depreciation",
      "Depreciation"
    )}</td><td>${formatNumberParens(r.Dep)}</td></tr>
    <tr class="total-row"><td><b>${i18nString(
      "state.cf.cfoTitle",
      "Operating Cash Flow (CFO)"
    )}</b></td><td><b>${formatNumberParens(r.CFO)}</b></td></tr>

    <tr><td colspan="2" class="section-header">${i18nString(
      "state.cf.investing",
      "Investing activities"
    )}</td></tr>
    <tr><td>${i18nString(
      "state.asset.ppe",
      "PPE"
    )}</td><td>${formatNumberParens(r.CFI)}</td></tr>
    <tr class="total-row"><td><b>${i18nString(
      "state.cf.cfiTitle",
      "Investing Cash Flow (CFI)"
    )}</b></td><td>${formatNumberParens(r.CFI)}</td></tr>

    <tr><td colspan="2" class="section-header">${i18nString(
      "state.cf.financing",
      "Financing activities"
    )}</td></tr>
    <tr><td>${i18nString(
      "state.liability.debt",
      "Borrowings"
    )}</td><td>${formatNumberParens(r.deltaDebt)}</td></tr>
    <tr><td>${i18nString(
      "state.labels.dividend",
      "Cash dividend"
    )}</td><td>${formatNumberParens(r.dividend)}</td></tr>
    <tr class="total-row"><td><b>${i18nString(
      "state.cf.cffTitle",
      "Financing Cash Flow (CFF)"
    )}</b></td><td>${formatNumberParens(r.CFF)}</td></tr>

    <tr><td colspan="2"><hr class="soft"></td></tr>

    <!-- 新增期初現金顯示欄位 -->
    <tr class="total-row"><td><b>${i18nString(
      "state.labels.beginningCash",
      "Beginning Cash"
    )}</b></td><td><b>${formatNumberParens(r.beginningCash)}</b></td></tr>

    <tr class="total-row"><td><b>${i18nString(
      "state.labels.endingCash",
      "Ending cash & equivalents"
    )}</b></td><td><b>${formatNumberParens(r.cash)}</b></td></tr>
  </table>
</div>


      </div>
    `;
    root.appendChild(sec);
  });
}

/* Stacked CF */
function makeStackedCFChart(canvasId, rows) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return;
  const ctx = canvas.getContext("2d");
  if (_cfStackChart) _cfStackChart.destroy();

  const labels = rows.map((r) => r.year);
  _cfStackChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: i18nString("state.labels.cfoTitle", "CFO"),
          data: rows.map((r) => r.CFO),
          stack: "cf",
        },
        {
          label: i18nString("state.cf.cfiTitle", "CFI"),
          data: rows.map((r) => r.CFI),
          stack: "cf",
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          ticks: { callback: (v) => formatNumberCustom(v) },
        },
      },
    },
  });
}

/* CCC 圖表 + KPI */
function renderCCC(kpiId, chartId, rows) {
  const labels = rows.map((r) => r.year);
  const DSO = rows.map((r) =>
    r.revenue > 0 ? (r.AR / r.revenue) * 365 : 0
  );
  const DIO = rows.map((r) =>
    r.cogs > 0 ? (r.INV / r.cogs) * 365 : 0
  );
  const DPO = rows.map((r) =>
    r.cogs > 0 ? (r.AP / r.cogs) * 365 : 0
  );
  const CCC = DSO.map((_, i) => DSO[i] + DIO[i] - DPO[i]);

  const last = rows.length - 1;
  const y = rows[last].year;

  const kpiEl = document.getElementById(kpiId);
  if (kpiEl) {
    kpiEl.innerHTML = `
      <div class="kpi">
        <div class="card">
          <div class="title">${y} ${i18nString(
            "state.labels.dso",
            "DSO"
          )}</div>
          <div class="value">${DSO[last].toFixed(1)} ${i18nString(
            "state.labels.days",
            "days"
          )}</div>
          <div class="sub">${i18nString(
            "state.labels.dsoSub",
            "Days Sales Outstanding"
          )}</div>
        </div>
        <div class="card">
          <div class="title">${y} ${i18nString(
            "state.labels.dio",
            "DIO"
          )}</div>
          <div class="value">${DIO[last].toFixed(1)} ${i18nString(
            "state.labels.days",
            "days"
          )}</div>
          <div class="sub">${i18nString(
            "state.labels.dioSub",
            "Days Inventory Outstanding"
          )}</div>
        </div>
        <div class="card">
          <div class="title">${y} ${i18nString(
            "state.labels.dpo",
            "DPO"
          )}</div>
          <div class="value">${DPO[last].toFixed(1)} ${i18nString(
            "state.labels.days",
            "days"
          )}</div>
          <div class="sub">${i18nString(
            "state.labels.dpoSub",
            "Days Payable Outstanding"
          )}</div>
        </div>
        <div class="card">
          <div class="title">${y} ${i18nString(
            "state.labels.ccc",
            "CCC"
          )}</div>
          <div class="value">${CCC[last].toFixed(1)} ${i18nString(
            "state.labels.days",
            "days"
          )}</div>
          <div class="sub">${i18nString(
            "state.labels.cccSub",
            "Lower is better"
          )}</div>
        </div>
      </div>
    `;
  }

  const canvas = document.getElementById(chartId);
  if (!canvas || typeof Chart === "undefined") return;
  const ctx = canvas.getContext("2d");
  if (_cccChart) _cccChart.destroy();

  _cccChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: i18nString("state.labels.dso", "DSO"),
          data: DSO,
        },
        {
          label: i18nString("state.labels.dio", "DIO"),
          data: DIO,
        },
        {
          label: i18nString("state.labels.dpo", "DPO"),
          data: DPO,
        },
        {
          label: i18nString("state.labels.ccc", "CCC"),
          type: "line",
          data: CCC,
          borderWidth: 2,
          fill: false,
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      scales: { y: { beginAtZero: true } },
    },
  });
}

/* 比率 / Common-size */
function renderRatios(containerId, rows, constants) {
  const el = document.getElementById(containerId);
  if (!el || !rows.length) return;
  const labels = rows.map((r) => `<th>${r.year}</th>`).join("");

  const asPctRow = (label, values) =>
    `<tr><td>${label}</td>${values
      .map((v) => `<td>${(v * 100).toFixed(1)}%</td>`)
      .join("")}</tr>`;

  const gross = rows.map((r) =>
    r.revenue > 0 ? (r.revenue - r.cogs) / r.revenue : 0
  );
  const net = rows.map((r) =>
    r.revenue > 0 ? r.net / r.revenue : 0
  );
  const fcf = rows.map((r) =>
    r.revenue > 0 ? (r.CFO - Math.abs(r.CFI)) / r.revenue : 0
  );
  const debtRatio = rows.map((r) => {
    const totA = r.cash + r.AR + r.INV + r.PPE;
    return totA > 0 ? (constants.DEBT || 0) / totA : 0;
  });

  el.innerHTML = `
    <div class="matrix-wrap">
      <table class="matrix">
        <tr><th>${i18nString(
          "state.analysis.ratioTitle",
          "Key Ratios"
        )}</th>${labels}</tr>
        ${asPctRow(
          i18nString("state.labels.grossMargin", "Gross margin"),
          gross
        )}
        ${asPctRow(
          i18nString("state.labels.netMargin", "Net margin"),
          net
        )}
        ${asPctRow(
          i18nString("state.labels.fcfMargin", "Free cash flow margin"),
          fcf
        )}
        ${asPctRow(
          i18nString("state.labels.debtRatio", "Debt ratio"),
          debtRatio
        )}
      </table>
    </div>
  `;
}

function renderCommonSize(containerId, rows, constants) {
  const el = document.getElementById(containerId);
  if (!el || !rows.length) return;
  const headers = rows.map((r) => `<th>${r.year}</th>`).join("");
  const pct = (num, den) =>
    den > 0 ? (num / den) * 100.0.toFixed(1) + "%" : "N/A";

  const mkRow = (label, getter) =>
    `<tr><td>${label}</td>${rows
      .map((r, i) => `<td>${getter(r, i)}</td>`)
      .join("")}</tr>`;

  const tot = rows.map((r) => r.cash + r.AR + r.INV + r.PPE);

  const pnlTable = `
    <table class="matrix">
      <tr><th>${i18nString(
        "state.pl.IS",
        "PNL (% of Revenue)"
      )}</th>${headers}</tr>
      <tr><td>${i18nString("state.pl.revenue", "Revenue")}</td>${rows
        .map(() => "<td>100.0%</td>")
        .join("")}</tr>
      ${mkRow(
        i18nString("state.pl.cogs", "COGS"),
        (r) => (r.revenue > 0 ? ((r.cogs / r.revenue) * 100).toFixed(1) + "%" : "N/A")
      )}
      ${mkRow(
        i18nString("state.pl.expense", "Operating expense"),
        (r) => (r.revenue > 0 ? ((r.opex / r.revenue) * 100).toFixed(1) + "%" : "N/A")
      )}
      ${mkRow(
        i18nString("state.labels.netProfit", "Net profit"),
        (r) => (r.revenue > 0 ? ((r.net / r.revenue) * 100).toFixed(1) + "%" : "N/A")
      )}
    </table>
  `;

  const bsTable = `
    <table class="matrix" style="margin-top:10px">
      <tr><th>${i18nString(
        "state.bs.title",
        "Balance Sheet (% of Total Assets)"
      )}</th>${headers}</tr>
      ${mkRow(
        i18nString("state.asset.cash", "Cash"),
        (r, i) => (tot[i] > 0 ? ((r.cash / tot[i]) * 100).toFixed(1) + "%" : "N/A")
      )}
      ${mkRow(
        i18nString("state.asset.receivable", "AR"),
        (r, i) => (tot[i] > 0 ? ((r.AR / tot[i]) * 100).toFixed(1) + "%" : "N/A")
      )}
      ${mkRow(
        i18nString("state.asset.inventory", "Inventory"),
        (r, i) => (tot[i] > 0 ? ((r.INV / tot[i]) * 100).toFixed(1) + "%" : "N/A")
      )}
      ${mkRow(
        i18nString("state.asset.ppe", "PPE"),
        (r, i) => (tot[i] > 0 ? ((r.PPE / tot[i]) * 100).toFixed(1) + "%" : "N/A")
      )}
      ${mkRow(
        i18nString("state.liability.payable", "AP"),
        (r, i) => (tot[i] > 0 ? ((r.AP / tot[i]) * 100).toFixed(1) + "%" : "N/A")
      )}
      ${mkRow(
        i18nString("state.liability.debt", "Debt"),
        (_, i) =>
          tot[i] > 0 ? (((constants.DEBT || 0) / tot[i]) * 100).toFixed(1) + "%" : "N/A"
      )}
      ${mkRow(
        i18nString("state.equity.retainedEarnings", "Retained earnings"),
        (r, i) => (tot[i] > 0 ? ((r.RE / tot[i]) * 100).toFixed(1) + "%" : "N/A")
      )}
    </table>
  `;

  el.innerHTML = `<div class="matrix-wrap">${pnlTable}${bsTable}</div>`;
}

/* =========================================
 *  匯出 PDF + 上傳
 * =======================================*/

async function exportForecastPDF() {
  if (!window.lastForecast) {
    alert(
      i18nString(
        "state.alert.generateFirst",
        "請先產生預測報表 (Generate forecast first)"
      )
    );
    return;
  }
  if (typeof html2pdf === "undefined") {
    alert("html2pdf.js not loaded");
    return;
  }

  const src = document.getElementById("results");
  if (!src) {
    alert(
      i18nString("net.cannotConnect", "Cannot find results area")
    );
    return;
  }

  const srcCanvases = Array.from(src.querySelectorAll("canvas"));
  const canvasSnapshots = srcCanvases.map((cv) => {
    try {
      return cv.toDataURL("image/png", 1.0);
    } catch {
      return null;
    }
  });

  const printable = src.cloneNode(true);
  printable.querySelectorAll("details").forEach((d) => (d.open = true));
  printable.classList.add("pdf-root");

  const rows = window.lastForecast.rows || [];
  const firstYear = rows[0]?.year || "";
  const lastYear = rows[rows.length - 1]?.year || "";
  const baseTitle = i18nString(
    "state.export.reportTitle",
    i18nString("state.pageTitle", "Forecast Report")
  );
  const filename =
    firstYear && lastYear
      ? `${baseTitle}_${firstYear}-${lastYear}.pdf`
      : `${baseTitle}.pdf`;

  const opt = {
    margin: [10, 10, 12, 10],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      background: "#FFFFFF",
      scrollY: 0,
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: {
      mode: ["css", "legacy"],
      avoid: [".pdf-block", ".card", ".chart-wrap", "table"],
    },
  };

  const a4WidthMm = 210;
  const innerWidthMm = a4WidthMm - opt.margin[1] - opt.margin[3];
  const innerWidthPx = Math.round((innerWidthMm / 25.4) * 96);
  printable.style.width = innerWidthPx + "px";
  printable.style.maxWidth = "none";
  printable.style.boxSizing = "border-box";

  const cloneCanvases = Array.from(printable.querySelectorAll("canvas"));
  cloneCanvases.forEach((cv, i) => {
    const url = canvasSnapshots[i];
    if (!url) return;
    const img = new Image();
    img.src = url;
    img.style.width = "100%";
    img.style.height = "auto";
    img.style.display = "block";
    cv.replaceWith(img);
  });

  printable
    .querySelectorAll(".pdf-block, .card, .chart-wrap, table")
    .forEach((el) => {
      el.style.breakInside = "avoid";
      el.style.pageBreakInside = "avoid";
      el.style.marginBottom = "12px";
    });

  const holder = document.createElement("div");
  holder.style.position = "absolute";
  holder.style.left = "0";
  holder.style.top = "0";
  holder.style.width = innerWidthPx + "px";
  holder.style.background = "#fff";
  holder.style.visibility = "hidden";
  holder.appendChild(printable);
  document.body.appendChild(holder);

  try {
    await html2pdf().set(opt).from(printable).save();
  } catch (e) {
    console.error("html2pdf save failed:", e);
  } finally {
    document.body.removeChild(holder);
  }

  // 上傳到後端
  try {
    const pdfInstance = await html2pdf()
      .set(opt)
      .from(printable)
      .toPdf()
      .get("pdf");
    const pdfBlob = pdfInstance.output("blob");
    await uploadForecastPDF(pdfBlob, filename);
  } catch (e) {
    console.error("Failed to generate/upload PDF:", e);
  }
}

async function uploadForecastPDF(pdf, pdf_filename) {
  try {
    const formData = new FormData();
    formData.append("file", pdf);
    formData.append("title", pdf_filename);
    formData.append("type", "forecast");

    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization:
          "Bearer " + (localStorage.getItem("access_token") || ""),
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status} - ${text}`);
    }

    alert(
      i18nString(
        "state.alert.pdfSuccess",
        "PDF exported successfully"
      )
    );
  } catch (e) {
    console.error(e);
    alert(
      i18nString(
        "state.alert.pdfFail",
        "PDF export/upload failed"
      ) + ": " + (e.message || e)
    );
  }
}

/* =========================================
 *  主流程：generateForecast
 * =======================================*/

function generateForecast() {
  if (!validate()) return;
  computeAggregates();

  const years =
    parseInt(document.getElementById("fc_years")?.value, 10) || 3;
  const gArr = readGrowthArray(years);
  const ass = readAssumptionsFromUI();

  const root = document.getElementById("results");
  if (!root) return;
  root.innerHTML = "";

  const { rows, constants } = runForecast(years, gArr, ass);
  const firstYear = rows[0].year;
  const lastYear = rows[rows.length - 1].year;

  const wrap = document.createElement("section");
  wrap.className = "card";
  wrap.innerHTML = `
    <div id="analysis_sections">
      <div class="draggable pdf-block" id="sec_revenue">
        <h3>${i18nString(
          "state.analysis.revenueTitle",
          "Revenue Projection"
        )}（${firstYear} → ${lastYear}）</h3>
        <div class="chart-wrap"><canvas id="rev_chart_${years}"></canvas></div>
        <div id="kpi_${years}" style="margin-top:10px"></div>
      </div>

      <div class="draggable pdf-block" id="sec_summary">
        <h3 style="margin-top:14px">${i18nString(
          "state.analysis.summaryTitle",
          "Summary"
        )}</h3>
        <div id="matrix_${years}"></div>
      </div>

      <div class="draggable pdf-block" id="sec_cf">
        <h3>${i18nString(
          "state.analysis.cfTitle",
          "Cash Flow Overview"
        )}</h3>
        <div class="chart-wrap"><canvas id="cf_stack_${years}"></canvas></div>
      </div>

      <div class="draggable pdf-block" id="sec_eff">
        <h3 style="margin-top:14px">${i18nString(
          "state.analysis.cccTitle",
          "Working Capital Efficiency"
        )}</h3>
        <div id="ccc_kpi_${years}"></div>
        <div class="chart-wrap"><canvas id="ccc_chart_${years}"></canvas></div>
      </div>

      <div class="draggable pdf-block" id="sec_ratios">
        <h3 style="margin-top:14px">${i18nString(
          "state.analysis.ratioTitle",
          "Key Ratios"
        )}</h3>
        <div id="ratio_${years}"></div>
      </div>

      <div class="draggable pdf-block" id="sec_common">
        <h3 style="margin-top:14px">${i18nString(
          "state.analysis.commonTitle",
          "Common-size Analysis"
        )}</h3>
        <div id="common_${years}"></div>
      </div>

      <div class="draggable pdf-block" id="sec_bscheck">
        <h3 style="margin-top:14px">${i18nString(
          "state.analysis.bscheckTitle",
          "Balance Check"
        )}</h3>
        <div id="bscheck_${years}"></div>
      </div>
    </div>
  `;
  root.appendChild(wrap);

  try {
    if (typeof Sortable !== "undefined") {
      new Sortable(document.getElementById("analysis_sections"), {
        animation: 150,
        ghostClass: "sortable-ghost",
        handle: "h3",
      });
    }
  } catch (e) {
    console.warn("Sortable not available", e);
  }

  makeChart(`rev_chart_${years}`, rows);
  const baseNet =
    getVal("revenue") -
    getVal("cogs") -
    getVal("op_expense") +
    getVal("other_income") -
    getVal("interest_expense") - 
    getVal("tax_expense");
  makeKPI(
    document.getElementById(`kpi_${years}`),
    getVal("revenue"),
    baseNet,
    rows
  );
  renderSummaryMatrix(
    document.getElementById(`matrix_${years}`),
    rows,
    constants
  );
  makeStackedCFChart(`cf_stack_${years}`, rows);
  renderCCC(`ccc_kpi_${years}`, `ccc_chart_${years}`, rows);
  renderRatios(`ratio_${years}`, rows, constants);
  renderCommonSize(`common_${years}`, rows, constants);
  renderBalanceCheck(`bscheck_${years}`, rows, constants);
  renderYearSections(root, rows, constants);

  window.lastForecast = { rows, constants };
}

/* =========================================
 *  自訂列 & Modal & Aggregates
 * =======================================*/

function removeRow(btn) {
  const tr = btn.closest("tr");
  if (tr && tr.parentNode) {
    tr.parentNode.removeChild(tr);
    computeAggregates();
  }
}

function addCustomRow(section) {
  const map = {
    assets: { tbody: "assets_body", extraKey: "assets" },
    liabs: { tbody: "liabs_body", extraKey: "liabs" },
    equity: { tbody: "equity_body", extraKey: "equity" },
    pl: { tbody: "pl_body", extraKey: "pl" },
  };
  const cfg = map[section];
  if (!cfg) return;

  const trEl = document.createElement("tr");
  trEl.dataset.extra = cfg.extraKey;

  if (section === "pl") {
    trEl.innerHTML = `
      <td class="left"><input type="text" class="name-input"
        placeholder="${i18nString(
          "state.modal.asset.other",
          "Custom item"
        )}" /></td>
      <td><input type="text" class="onecol-val" value="0"></td>
      <td class="act">
        <button class="link" type="button" onclick="removeRow(this)">${i18nString(
          "common.delete",
          "Delete"
        )}</button>
      </td>
    `;
  } else {
    trEl.innerHTML = `
      <td class="left"><input type="text" class="name-input"
        placeholder="${i18nString(
          "state.modal.asset.other",
          "Custom item"
        )}" /></td>
      <td><input type="text" class="beg" value="0"></td>
      <td><input type="text" class="end" value="0"></td>
      <td class="act">
        <button class="link" type="button" onclick="removeRow(this)">${i18nString(
          "common.delete",
          "Delete"
        )}</button>
      </td>
    `;
  }

  const tbody = document.getElementById(cfg.tbody);
  if (tbody) tbody.appendChild(trEl);
  trEl.addEventListener("input", computeAggregates);
  bindThousandsFormat();
  computeAggregates();
}

function computeAggregates() {
  const num = (el) => {
    if (!el) return 0;
    const raw = String(el.value || "").replace(/,/g, "");
    const v = parseFloat(raw);
    return Number.isNaN(v) ? 0 : v;
  };

  const sumExtra = (key) => {
    let sum = 0;
    document
      .querySelectorAll(`tr[data-extra="${key}"]`)
      .forEach((tr) => {
        const end =
          tr.querySelector("input.end") ||
          tr.querySelector("input.onecol-val");
        sum += num(end);
      });
    return sum;
  };

  const oa = document.getElementById("other_assets");
  const ol = document.getElementById("other_liabs");
  const oe = document.getElementById("other_equity");

  if (oa) oa.value = sumExtra("assets");
  if (ol) ol.value = sumExtra("liabs");
  if (oe) oe.value = sumExtra("equity");
}

/* Modal 開關 */

function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.style.display = "flex";
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m
    .querySelectorAll('input[type="checkbox"]:not(:disabled)')
    .forEach((cb) => (cb.checked = false));
  m.style.display = "none";
}

function confirmAddFromModal(section) {
  const map = {
    assets: "assetModal",
    liabs: "liabModal",
    equity: "equityModal",
    pl: "plModal",
  };
  const modalId = map[section];
  if (modalId) closeModal(modalId);
}

/* 點擊背景關閉 modal */
window.addEventListener("click", (e) => {
  document
    .querySelectorAll(".modal")
    .forEach((m) => {
      if (e.target === m) {
        m.style.display = "none";
      }
    });
});

/* =========================================
 *  初始化
 * =======================================*/

(function init() {
  const now = new Date();
  const y = now.getFullYear();
  const ps = document.getElementById("period_start");
  const pe = document.getElementById("period_end");
  if (ps && !ps.value) ps.value = `${y}-01-01`;
  if (pe && !pe.value) pe.value = `${y}-12-31`;

  ["assets_body", "liabs_body", "equity_body", "pl_body"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", computeAggregates);
  });

  renderGrowthInputs();
  bindThousandsFormat();
})();

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadI18n();
  } catch (e) {
    console.warn("loadI18n error", e);
  }

  // 根據使用者在其他頁設定或環境自動決定初始語系
  currentLang = detectInitialLanguage();
  await setLanguage(currentLang);

  // 語系切換按鈕
  document
    .querySelectorAll("[data-lang-toggle]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const lang = btn.dataset.langToggle;
        await setLanguage(lang);
        document
          .querySelectorAll("[data-lang-toggle]")
          .forEach((b) =>
            b.classList.toggle(
              "active",
              b.dataset.langToggle === lang
            )
          );
      });
    });

  const dp = document.getElementById("decimal_places");
  if (dp) {
    dp.addEventListener("change", () => {
      if (window.lastForecast) generateForecast();
    });
  }

  const rm = document.getElementById("round_mode");
  if (rm) {
    rm.addEventListener("change", () => {
      if (window.lastForecast) generateForecast();
    });
  }
});

/* =========================================
 *  對外暴露（給 inline onclick 用）
 * =======================================*/

if (typeof window !== "undefined") {
  window.tr = tr;
  window.t = tr;
  window.i18nString = i18nString;
  window.updateTranslations = updateTranslations;
  window.setLanguage = setLanguage;

  window.generateForecast = generateForecast;
  window.exportForecastPDF = exportForecastPDF;

  window.addCustomRow = addCustomRow;
  window.removeRow = removeRow;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.confirmAddFromModal = confirmAddFromModal;
}