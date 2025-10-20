import { API_BASE_URL } from "./config.js";

if (typeof window !== 'undefined') {
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.confirmAddFromModal = confirmAddFromModal;
  window.addCustomRow = addCustomRow;
  window.removeRow = removeRow;
}

/* === 讀取使用者輸入的數值與日期資訊 === */
  function getVal(id){ 
    const el=document.getElementById(id); 
    if (!el) return 0;
    const raw = el.value.replace(/,/g, '');  // 去掉逗號
    const v = parseFloat(raw);
    return isNaN(v) ? 0 : v;
  }
  function fmtDate(id){   // 取得日期輸入欄位的值
    const el=document.getElementById(id); 
    return el && el.value ? el.value : ''; 
  }
  function yearFromDateStr(s, fallback){   // 從日期字串中擷取年份
    if(!s) return fallback; 
    const d=new Date(s); 
    const y=d.getFullYear(); 
    return isFinite(y)?y:fallback; 
  }

/* === 讀取使用者輸入的預期比例 === */
  function readAssumptionsFromUI(){
    return {
      taxRate:  (getVal('ass_tax_rate')/100),   // 有效稅率
      depRate:  (getVal('ass_dep_rate')/100),   // 折舊率：計算當年度折舊額 (Dep = PPE × 折舊率)
      capexRate:(getVal('ass_capex_rate')/100),   // 資本支出比率：計算 CapEx = 營收 × 資本支出比率
      arPct:    (getVal('ass_ar_pct')/100),   // 應收帳款比例：計算應收帳款 = 營收 × 比率
      invPct:   (getVal('ass_inv_pct')/100),   // 存貨比例：存貨 = 銷貨成本 × 比率
      apPct:    (getVal('ass_ap_pct')/100),   // 應付帳款比例：應付帳款 = 銷貨成本 × 比率
    };
  }
  function validate(){ 
    const req=['revenue','cogs','op_expense','tax_expense','re_begin','cash_end','ar_end','inventory_end','ppe_end','ap_end','debt_end','capital_end'];
    for(const id of req){
      const el = document.getElementById(id);
      if(!el || String(el.value).trim()===''){
        alert('★ 必填欄位不可留空：'+id); return false;
      }
    }
    return true;
  }

/* === 核心預測 === */
  function runForecast(years, gArr, ass){

    // === 基期損益 ===
    const rev0=getVal('revenue'), 
          cogs0=getVal('cogs'), 
          opex0=getVal('op_expense'), 
          oi0=getVal('other_income');
    const int0=getVal('interest_expense'), 
          tax0=getVal('tax_expense');
    const opInc0=rev0-cogs0-opex0+oi0, pretax0=opInc0-int0, net0=(pretax0 - tax0);

    // === 基期資產負債 ===
    const RE0=getVal('re_begin') + net0;
    let CASH=getVal('cash_end'), AR=getVal('ar_end'), INV=getVal('inventory_end'), PPE=getVal('ppe_end');
    let AP=getVal('ap_end'), DEBT0=getVal('debt_end');
    const CAPITAL0 = getVal('capital_end');

    // === 自訂科目合計 ===
    const staticAssets=[{name:'Other Assets',val:getVal('other_assets')}];
    const staticLiabs=[{name:'Other Liabilities',val:getVal('other_liabs')}];
    const staticEquity=[{name:'Other Equity',val:getVal('other_equity')}];

    const cogsPct = rev0>0 ? cogs0/rev0 : 0;
    const opexPct = rev0>0 ? opex0/rev0 : 0;
    const oiPct   = rev0>0 ? oi0/rev0   : 0;

    let NWC_prev = (AR + INV - AP);
    let RE=RE0;

    const rows=[];
    const baseYear=yearFromDateStr(fmtDate('period_end'), (new Date()).getFullYear());

    // === 動態週轉率假設參數 ===
    const baseDSO = ass.baseDSO || 50;   // 基期 DSO
    const baseDIO = ass.baseDIO || 40;   // 基期 DIO
    const baseDPO = ass.baseDPO || 30;   // 基期 DPO
    const α = 0.05, β = 0.1, γ = 0.3, δ = 0.05; // 可調整參數

    // === Step 1: 存入基期年 (Year 0) ===
    const baseDSOVal = baseDSO;
    const baseDIOVal = baseDIO;
    const baseDPOVal = baseDPO;
    const baseCCC    = baseDSOVal + baseDIOVal - baseDPOVal;

    rows.push({
      year: baseYear,
      revenue: rev0,
      cogs: cogs0,
      opex: opex0,
      oi: oi0,
      Dep: 0, CapEx: 0, intExp: int0,
      pretax: pretax0, tax: tax0, net: net0,
      CFO: 0, CFI: 0, CFF: 0,
      cash: CASH, AR, INV, AP, PPE, RE: RE0, dNWC: 0,
      DSO: baseDSOVal, DIO: baseDIOVal, DPO: baseDPOVal, CCC: baseCCC
    });

    // === Step 2: 預測未來 N 年 (Year 1 → Year N) ===
    for(let i=1;i<=years;i++){
      const growth = gArr[i-1] ?? 0;
      const year = baseYear + i;

      // 損益表項目
      const revenue = (i===1 ? rev0 : rows[i-1].revenue) * (1+growth);
      const cogs = revenue * cogsPct;
      const opex = revenue * opexPct;
      const oi   = revenue * oiPct;

      const Dep  = PPE * ass.depRate;
      const CapEx= revenue * ass.capexRate;
      const intExp = int0;
      const pretax = revenue - cogs - opex - Dep + oi - intExp;
      const tax = Math.max(0, pretax) * ass.taxRate;
      const net = pretax - tax;

      RE = RE + net;

      // 動態週轉率
      const DSO = baseDSO * (1 + α * (i/years));
      const DIO = baseDIO * (1 + β * Math.exp(-γ*i));
      const DPO = baseDPO * (1 + δ * Math.log(1+i));
      const CCC = DSO + DIO - DPO;

      // 應收 / 存貨 / 應付
      AR  = (revenue/365) * DSO;
      INV = (cogs/365) * DIO;
      AP  = (cogs/365) * DPO;

      // 營運資金
      const NWC = AR + INV - AP;
      const dNWC = NWC - NWC_prev;
      NWC_prev = NWC;

      // 現金流
      const CFO = net + Dep - dNWC;
      const CFI = -CapEx;
      const CFF = 0;
      CASH = CASH + CFO + CFI + CFF;
      PPE  = PPE + CapEx - Dep;

      // 存入年度結果
      rows.push({
        year, revenue, cogs, opex, oi, Dep, CapEx, intExp, pretax, tax, net,
        CFO, CFI, CFF, cash:CASH, AR, INV, AP, PPE, RE, dNWC,
        DSO, DIO, DPO, CCC
      });
    }

    return { rows, constants:{ DEBT: DEBT0, CAPITAL: CAPITAL0, staticAssets, staticLiabs, staticEquity } };
  }


/* ---------- 千分位格式化 ---------- */
  function formatWithCommas(value) {
    if (value === '' || isNaN(value)) return '';
    return Number(value).toLocaleString('en-US');
  }
  function bindThousandsFormat() {
    document.querySelectorAll('input[type="number"], input.onecol-val').forEach(input => {
      input.type = "text"; // 改成 text 才能顯示逗號
      input.addEventListener('input', (e) => {
        const raw = e.target.value.replace(/,/g, '');
        if (raw === '' || isNaN(raw)) {
          e.target.value = '';
        } else {
          e.target.value = formatWithCommas(raw);
        }
      });
      if (input.value) {
        input.value = formatWithCommas(input.value);
      }
    });
  }

  

/* ---------- 自訂列加總 ---------- */
function addCustomRow(section){
  const map = {
    assets: {tbody:'assets_body',  extraKey:'assets'},
    liabs:  {tbody:'liabs_body',   extraKey:'liabs'},
    equity: {tbody:'equity_body',  extraKey:'equity'},
    pl:     {tbody:'pl_body',      extraKey:'pl'}
  };
  const cfg = map[section]; if(!cfg) return;
  const tr = document.createElement('tr');
  tr.setAttribute('data-extra', cfg.extraKey);
  tr.innerHTML = `
    <td class="left"><input type="text" class="name-input" placeholder="自訂科目" /></td>
    ${section==='pl'
      ? `<td><input type="number" class="onecol-val" value="0" step="1000"></td>`
      : `<td><input type="number" class="beg" value="0" step="1000"></td>
         <td><input type="number" class="end" value="0" step="1000"></td>`}
    <td class="act"><button class="link" type="button" onclick="removeRow(this)">刪除</button></td>
  `;
  document.getElementById(cfg.tbody).appendChild(tr);
  tr.addEventListener('input', computeAggregates);
  bindThousandsFormat();
  computeAggregates();
}
function removeRow(btn){ const tr = btn.closest('tr'); tr?.parentNode?.removeChild(tr); computeAggregates(); }
function computeAggregates(){
  const num = (el) => {
    const raw = (el?.value || '').replace(/,/g,'');
    const v = parseFloat(raw);
    return isNaN(v) ? 0 : v;
  };
  const sumOf = (selector) => {
    let s = 0;
    document.querySelectorAll(selector).forEach(tr=>{
      const end = tr.querySelector('input.end');
      s += num(end);
    });
    return s;
  };

  document.getElementById('other_assets').value = String(sumOf('tr[data-extra="assets"]'));
  document.getElementById('other_liabs').value  = String(sumOf('tr[data-extra="liabs"]'));
  document.getElementById('other_equity').value = String(sumOf('tr[data-extra="equity"]'));
}

/* ---------- Modal（含防重複） ---------- */
function openModal(id){
  const m=document.getElementById(id);
  if(!m) return;
  const section = m.getAttribute('data-section');
  prepareModalSelections(m, section);
  m.style.display='flex';
}
function closeModal(id){
  const m=document.getElementById(id);
  if(!m) return;
  m.querySelectorAll('input[type=checkbox]:not(:disabled)').forEach(cb=>cb.checked=false);
  m.style.display='none';
}
function prepareModalSelections(modalEl, section){
  const tbodyIdMap = { assets:'assets_body', liabs:'liabs_body', equity:'equity_body', pl:'pl_body' };
  const tbody = document.getElementById(tbodyIdMap[section]);
  const existNames = new Set();
  if (tbody) {
    tbody.querySelectorAll('td.left').forEach(td=>{
      const name = td.textContent.trim();
      if (name) existNames.add(name);
    });
  }
  modalEl.querySelectorAll('label.ck').forEach(label=>{
    const cb = label.querySelector('input[type=checkbox]');
    const hint = label.querySelector('.exists-hint');
    const name = cb.value.trim();
    if (existNames.has(name)) {
      cb.checked = true; cb.disabled = true;
      label.classList.add('ck-disabled'); if (hint) hint.hidden = false;
      label.setAttribute('title','該科目已在清單中，不能重複新增');
    } else {
      cb.disabled = false; cb.checked  = false;
      label.classList.remove('ck-disabled'); if (hint) hint.hidden = true;
      label.removeAttribute('title');
    }
  });
}
window.addEventListener('click', (e)=>{
  document.querySelectorAll('.modal').forEach(m=>{ if(e.target===m){ closeModal(m.id); } });
});
function confirmAddFromModal(section){
  const ids = {
    assets: { modal:'assetModal',  tbody:'assets_body', extra:'assets' },
    liabs:  { modal:'liabModal',   tbody:'liabs_body',  extra:'liabs'  },
    equity: { modal:'equityModal', tbody:'equity_body', extra:'equity' },
    pl:     { modal:'plModal',     tbody:'pl_body',     extra:'pl'     },
  };
  const cfg=ids[section]; if(!cfg) return;
  const modal = document.getElementById(cfg.modal);
  const checks = [...modal.querySelectorAll('input[type=checkbox]:checked:not(:disabled)')];

  /* ===== 修正處：PL（損益）勾選項目改為直接插入輸入列 ===== */
  if(section==='pl'){
    let createdInfo=false;

    // 在 PL 表尾新增一列（若已存在相同 id 就不重複新增）
    const ensurePLRow = (id, label) => {
      if (document.getElementById(id)) return; // 已存在就不再新增
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="left">${label}</td>
        <td><input type="number" id="${id}" value="0" step="1000"></td>
        <td class="act">
          <button class="link" type="button" onclick="removeRow(this)">刪除</button>
        </td>`;
      document.getElementById('pl_body').appendChild(tr);
      bindThousandsFormat(); 
    };

    checks.forEach(cb=>{
      const v = cb.value.trim();
      if(v.includes('折舊')) {
        createdInfo = true; // 折舊依折舊率自動計算，不需輸入列
      } else if (v.includes('利息')) {
        ensurePLRow('interest_expense','利息費用');
      } else { // 其他收益/費損
        ensurePLRow('other_income','其他收益/費損');
      }
      cb.checked=false;
    });

    closeModal(cfg.modal);
    if(createdInfo){ alert('「折舊費用」將依「折舊率（Dep / 期初 PPE）」自動計算，無需輸入。'); }
    return;
  }
  /* ===== 修正處結束 ===== */

  const tbody=document.getElementById(cfg.tbody);
  checks.forEach(cb=>{
    const tr=document.createElement('tr');
    tr.setAttribute('data-extra', cfg.extra);
    tr.innerHTML=`
      <td class="left">${cb.value}</td>
      <td><input type="number" class="beg" value="0" step="1000"></td>
      <td><input type="number" class="end" value="0" step="1000"></td>
      <td class="act"><button class="link" type="button" onclick="removeRow(this)">刪除</button></td>`;
    tbody.appendChild(tr);
    tr.addEventListener('input', computeAggregates);
    bindThousandsFormat();
    cb.checked=false;
  });
  computeAggregates();
  closeModal(cfg.modal);
}

/* ---------- 成長率 UI ---------- */
function renderGrowthInputs(){
  const wrap=document.getElementById('growth_inputs');
  const years=parseInt(document.getElementById('fc_years').value,10)||3;
  const mode=document.getElementById('growth_mode').value;
  if(mode==='fixed'){
    wrap.innerHTML=`
      <label>固定年成長率（%）</label>
      <input type="number" id="growth_fixed" value="10" step="0.1">
    `;
  }else{
    let html='';
    for(let i=1;i<=years;i++){
      html+=`<label>Y+${i} 成長率（%）</label><input type="number" id="growth_y${i}" value="10" step="0.1">`;
    }
    wrap.innerHTML=html;
  }
}
function readGrowthArray(n){
  const mode=document.getElementById('growth_mode').value;
  if(mode==='fixed'){
    const g=(parseFloat(document.getElementById('growth_fixed')?.value)||0)/100;
    return Array.from({length:n}, ()=>g);
  }else{
    const arr=[];
    for(let i=1;i<=n;i++){
      const v=(parseFloat(document.getElementById(`growth_y${i}`)?.value)||0)/100;
      arr.push(v);
    }
    return arr;
  }
}






/* ---------- 圖表/表格輸出 ---------- */
let _revChart=null, _cfStackChart=null, _cccChart=null;

/* ---------- 柱狀圖 ---------- */
function makeChart(canvasId, rows){
  const ctx = document.getElementById(canvasId).getContext('2d');
  if(_revChart){_revChart.destroy()}

  const labels = rows.map(r=>r.year);
  const revenue = rows.map(r=>r.revenue);

  // 灰色：基期；藍色：預測期
  const colors = revenue.map((_, i) => i === 0 ? 'rgba(128,128,128,0.7)' : 'rgba(54,162,235,0.7)');

  _revChart = new Chart(ctx, {
    type:'bar',
    data:{ 
      labels, 
      datasets:[
        {
          label:'營業收入',
          data:revenue,
          backgroundColor:colors,
          yAxisID:'y'
        }
      ]
    },
    options:{ 
      responsive:true, 
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{
          labels:{
            generateLabels(chart){
              return [
                {text:'基期', fillStyle:'rgba(128,128,128,0.7)', strokeStyle:'transparent', lineWidth:0},
                {text:'預測', fillStyle:'rgba(54,162,235,0.7)', strokeStyle:'transparent', lineWidth:0}
              ];
            }
          }
        },
        datalabels:{
          anchor:'end',
          align:'end',
          formatter:function(value, context){
            const i = context.dataIndex;
            if(i===0) return ''; // 基期不顯示成長率
            const prev = revenue[i-1];
            const growth = ((revenue[i]/prev-1)*100).toFixed(1);
            return `成長率: ${growth}%`;
          },
          color: '#E4745E',              // ★ 字體顏色紅色
          font:{weight:'bold'}
        }
      },
      scales:{
        y:{ ticks:{ callback:(v)=>formatNumberCustom(v) } }
    }
    },
    plugins:[ChartDataLabels] // ★ 啟用 datalabels plugin
  });
}
/* ---------- 柱狀圖下面小表格 ---------- */
function makeKPI(container, baseRevenue, baseNet, rows){
  const last=rows[rows.length-1];
  const FCF = last.CFO - Math.abs(last.CFI);
  const lastYear = last.year;   // ★ 最新年度的年份

  container.innerHTML = `
    <div class="kpi">
      <div class="card"><div class="title">${lastYear} 營業收入</div><div class="value">${formatNumberCustom(last.revenue)}</div><div class="sub">vs 基期 ${formatNumberCustom(baseRevenue)}</div></div>
      <div class="card"><div class="title">${lastYear} 淨利</div><div class="value">${formatNumberCustom(last.net)}</div><div class="sub">vs 基期 ${formatNumberCustom(baseNet)}</div></div>
      <div class="card"><div class="title">${lastYear} 營運現金流（CFO）</div><div class="value">${formatNumberCustom(last.CFO)}</div><div class="sub">CFO</div></div>
      <div class="card"><div class="title">${lastYear} 自由現金流（FCF）</div><div class="value">${formatNumberCustom(FCF)}</div><div class="sub">CFO − CapEx</div></div>
    </div>`;
}

/* ---------- 各年度報表比較 ---------- */
function renderSummaryMatrix(container, rows, constants){
  const SA   = constants.staticAssets[0].val || 0;
  const SL   = constants.staticLiabs[0].val  || 0;
  const EQO  = constants.staticEquity[0].val || 0;
  const DEBT = constants.DEBT || 0;
  const CAP  = constants.CAPITAL || 0;
  const headers = rows.map(r=>`<th>${r.year}</th>`).join('');
  const line = (name, getter, fmt=(v)=>formatNumberCustom(v)) =>
    `<tr><td>${name}</td>${rows.map(r=>`<td>${fmt(getter(r))}</td>`).join('')}</tr>`;

    container.innerHTML = `
    <div class="matrix-wrap">
       <div class="matrix-section">
         <h4 class="subttl">損益表類</h4>
         <table class="matrix">

        <tr><th>欄位</th>${headers}</tr>
        ${line('營業收入', r=>r.revenue)}
        ${line('營業成本', r=>r.cogs)}
        ${line('營業費用', r=>r.opex)}
        ${line('其他收益', r=>r.oi)}
        ${line('折舊',     r=>r.Dep)}
        ${line('利息費用', r=>r.intExp)}
        ${line('稅前淨利', r=>r.pretax)}
        ${line('所得稅費用', r=>r.tax)}
        ${line('本期淨利', r=>r.net)}
      </table>
    </div>

      <div class="matrix-section">
         <h4 class="subttl">資產負債表類</h4>
         <table class="matrix">
        <tr><th>欄位</th>${headers}</tr>
        ${line('現金',  r=>r.cash)}
        ${line('應收帳款', r=>r.AR)}
        ${line('存貨',    r=>r.INV)}
        ${line('不動產、廠房及設備（PPE）', r=>r.PPE)}
        ${line('其他資產',        _=>SA)}
        ${line('總資產',          r=>r.cash+r.AR+r.INV+r.PPE+SA)}
        ${line('應付帳款',        r=>r.AP)}
        ${line('借款',            _=>DEBT)}
        ${line('其他負債',        _=>SL)}
        ${line('股本',            _=>CAP)}
        ${line('保留盈餘',        r=>r.RE)}
        ${line('其他權益',        _=>EQO)}
        ${line('負債＋權益',      r=>r.AP+DEBT+SL+CAP+r.RE+EQO)}
      </table>
    </div>

      <div class="matrix-section">
         <h4 class="subttl">現金流量表類</h4>
         <table class="matrix">
        <tr><th>欄位</th>${headers}</tr>
        ${line('本期淨利',              r=>r.net)}
        ${line('(+) 折舊',             r=>r.Dep)}
        ${line('(−/+) 營運資金變動',    r=>r.dNWC)}
        ${line('營運現金流（CFO）',     r=>r.CFO)}
        ${line('(−) 資本支出（CapEx）', r=>Math.abs(r.CapEx))}
        ${line('投資現金流（CFI）',     r=>r.CFI)}
        ${line('期末現金',              r=>r.cash)}
      </table>
    </div>
  </div>
  `;
}


function renderYearSections(root, rows, constants){
  rows.forEach(r=>{
    const sec=document.createElement('details');
    sec.open=false;
    sec.innerHTML = `
      <summary>${r.year} 年度三表</summary>
      <div class="year-grid">
        <div class="card">
          <h3>損益表（${r.year}）</h3>
          <table>
            <tr><td>營業收入</td><td>${formatNumberCustom(r.revenue)}</td></tr>
            <tr><td>營業成本</td><td>${formatNumberCustom(r.cogs)}</td></tr>
            <tr><td>營業費用</td><td>${formatNumberCustom(r.opex)}</td></tr>
            <tr><td>其他收益</td><td>${formatNumberCustom(r.oi)}</td></tr>
            <tr><td>折舊</td><td>${formatNumberCustom(r.Dep)}</td></tr>
            <tr><td>利息費用</td><td>${formatNumberCustom(r.intExp)}</td></tr>
            <tr class="total-row"><td>稅前淨利</td><td>${formatNumberCustom(r.pretax)}</td></tr>
            <tr><td>所得稅費用</td><td>${formatNumberCustom(r.tax)}</td></tr>
            <tr class="total-row"><td>本期淨利</td><td>${formatNumberCustom(r.net)}</td></tr>
          </table>
        </div>
        <div class="card">
            <h3>資產負債表（${r.year} 期末）</h3>
            <table>
                <tr><td>現金</td><td>${formatNumberCustom(r.cash)}</td></tr>
                <tr><td>應收帳款</td><td>${formatNumberCustom(r.AR)}</td></tr>
                <tr><td>存貨</td><td>${formatNumberCustom(r.INV)}</td></tr>
                <tr><td>不動產、廠房及設備（PPE）</td><td>${formatNumberCustom(r.PPE)}</td></tr>
                <tr><td>其他資產</td><td>${formatNumberCustom(constants.staticAssets[0].val)}</td></tr>
                <tr class="total-row"><td>總資產</td><td>${
                    formatNumberCustom(r.cash + r.AR + r.INV + r.PPE + constants.staticAssets[0].val)
                }</td></tr>
                <tr><td>應付帳款</td><td>${formatNumberCustom(r.AP)}</td></tr>
                <tr><td>借款</td><td>${formatNumberCustom(constants.DEBT)}</td></tr>
                <tr><td>其他負債</td><td>${formatNumberCustom(constants.staticLiabs[0].val)}</td></tr>
                <tr><td>股本</td><td>${formatNumberCustom(constants.CAPITAL)}</td></tr>
                <tr><td>保留盈餘</td><td>${formatNumberCustom(r.RE)}</td></tr>
                <tr><td>其他權益</td><td>${formatNumberCustom(constants.staticEquity[0].val)}</td></tr>
                <tr class="total-row"><td>負債＋權益</td><td>${
                    formatNumberCustom(r.AP + constants.DEBT + constants.staticLiabs[0].val + constants.CAPITAL + r.RE + constants.staticEquity[0].val)
                }</td></tr>
            </table>
        </div>
        <div class="card">
            <h3>現金流量表（${r.year}）</h3>
            <table>
                <tr><td>本期淨利</td><td>${formatNumberCustom(r.net)}</td></tr>
                <tr><td>(+) 折舊</td><td>${formatNumberCustom(r.Dep)}</td></tr>
                <tr><td>(−/+) 營運資金變動</td><td>${formatNumberCustom(-r.dNWC)}</td></tr>
                <tr class="total-row"><td>營運現金流（CFO）</td><td>${formatNumberCustom(r.CFO)}</td></tr>
                <tr><td>(−) 資本支出（CapEx）</td><td>${formatNumberCustom(Math.abs(r.CFI))}</td></tr>
                <tr class="total-row"><td>投資現金流（CFI）</td><td>${formatNumberCustom(r.CFI)}</td></tr>
                <tr class="total-row"><td>期末現金</td><td>${formatNumberCustom(r.cash)}</td></tr>
            </table>
            </div>
      </div>
    `;
    root.appendChild(sec);
  });
}

/* ---------- 其他圖表與分析 ---------- */
function makeStackedCFChart(canvasId, rows){
  const labels=rows.map(r=>r.year);
  const data={labels, datasets:[
    {label:'營運現金流（CFO）', data:rows.map(r=>r.CFO), stack:'cf'},
    {label:'投資現金流（CFI）', data:rows.map(r=>r.CFI), stack:'cf'},
  ]};
  const ctx=document.getElementById(canvasId).getContext('2d');
  if(_cfStackChart){_cfStackChart.destroy()}
  _cfStackChart=new Chart(ctx,{type:'bar',data,options:{
    responsive:true,interaction:{mode:'index',intersect:false},
    scales:{x:{stacked:true},y:{stacked:true,ticks:{callback:(v)=>formatNumberCustom(v)}}}
  }});
}
function renderCCC(kpiId, chartId, rows){
  const labels = rows.map(r => r.year);
  const DSO = rows.map(r => r.revenue > 0 ? (r.AR/r.revenue*365) : 0);
  const DIO = rows.map(r => r.cogs > 0 ? (r.INV/r.cogs*365) : 0);
  const DPO = rows.map(r => r.cogs > 0 ? (r.AP/r.cogs*365) : 0);
  const CCC = DSO.map((_, i) => DSO[i] + DIO[i] - DPO[i]);

  // 最新年度 KPI 卡片
  const last = rows.length - 1;
  const lastYear = rows[last].year;
  document.getElementById(kpiId).innerHTML = `
    <div class="kpi">
      <div class="card"><div class="title">${lastYear} DSO</div><div class="value">${DSO[last].toFixed(1)} 天</div><div class="sub">應收天數</div></div>
      <div class="card"><div class="title">${lastYear} DIO</div><div class="value">${DIO[last].toFixed(1)} 天</div><div class="sub">存貨天數</div></div>
      <div class="card"><div class="title">${lastYear} DPO</div><div class="value">${DPO[last].toFixed(1)} 天</div><div class="sub">應付天數</div></div>
      <div class="card"><div class="title">${lastYear} CCC</div><div class="value">${CCC[last].toFixed(1)} 天</div><div class="sub">越低越好</div></div>
    </div>`;

  const ctx = document.getElementById(chartId).getContext('2d');
  if (_cccChart) { _cccChart.destroy(); }

  _cccChart = new Chart(ctx, {
    type: 'bar', // 整體預設為 bar
    data: {
      labels,
      datasets: [
        {
          label: 'DSO',
          data: DSO,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          yAxisID: 'y'
        },
        {
          label: 'DIO',
          data: DIO,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          yAxisID: 'y'
        },
        {
          label: 'DPO',
          data: DPO,
          backgroundColor: 'rgba(255, 206, 86, 0.6)',
          yAxisID: 'y'
        },
        {
          label: 'CCC',
          type: 'line',   // 單獨指定為折線
          data: CCC,
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 2,
          fill: false,
          tension: 0.2,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function renderRatios(containerId, rows, constants){
  const el=document.getElementById(containerId);
  const labels = rows.map(r=>`<th>${r.year}</th>`).join('');

  // 計算比率序列
  const series = (arr)=>arr.map(v=>`<td>${(v*100).toFixed(1)}%</td>`).join('');
  const grossSeries  = rows.map(r=> r.revenue>0 ? (r.revenue-r.cogs)/r.revenue : 0);
  const netSeries    = rows.map(r=> r.revenue>0 ? r.net/r.revenue : 0);
  const fcfSeries    = rows.map(r=> r.revenue>0 ? (r.CFO - Math.abs(r.CFI))/r.revenue : 0);
  const debtSeries   = rows.map((r,i)=> { 
    const totAssets=r.cash+r.AR+r.INV+r.PPE+(constants.staticAssets[0].val||0); 
    return totAssets>0 ? (constants.DEBT||0)/totAssets : 0; 
  });

  el.innerHTML = `
    <div class="matrix-wrap">
      <table class="matrix">
        <tr><th>指標</th>${labels}</tr>
        <tr><td>毛利率</td>${series(grossSeries)}</tr>
        <tr><td>淨利率</td>${series(netSeries)}</tr>
        <tr><td>自由現金流率</td>${series(fcfSeries)}</tr>
        <tr><td>負債比率</td>${series(debtSeries)}</tr>
      </table>
    </div>`;
}
function renderCommonSize(containerId, rows, constants){
  const el=document.getElementById(containerId);
  const headers = rows.map(r=>`<th>${r.year}</th>`).join('');
  const pct = (num,den)=> den>0 ? (num/den*100).toFixed(1)+'%' : 'N/A';
  const mk = (label, getter) => `<tr><td>${label}</td>${rows.map((r,i)=>`<td>${getter(r,i)}</td>`).join('')}</tr>`;

  const totArr = rows.map(r=> r.cash + r.AR + r.INV + r.PPE + (constants.staticAssets[0].val||0));

  // 損益表
  const PNL = `
    <table class="matrix">
      <tr><th>損益表（佔營收 %）</th>${headers}</tr>
      <tr><td>營業收入</td>${rows.map(_=>'<td>100.0%</td>').join('')}</tr>
      ${mk('營業成本',(r)=>pct(r.cogs,r.revenue))}
      ${mk('營業費用',(r)=>pct(r.opex,r.revenue))}
      ${mk('EBITDA',(r)=>{const e=(r.revenue-r.cogs-r.opex+r.oi)+r.Dep;return pct(e,r.revenue)})}
      ${mk('本期淨利',(r)=>pct(r.net,r.revenue))}
    </table>`;

  // 資產負債表
  const BS = `
    <table class="matrix" style="margin-top:10px">
      <tr><th>資產負債表（佔總資產 %）</th>${headers}</tr>
      ${mk('現金',(r,i)=>pct(r.cash, totArr[i]))}
      ${mk('應收帳款',(r,i)=>pct(r.AR, totArr[i]))}
      ${mk('存貨',(r,i)=>pct(r.INV, totArr[i]))}
      ${mk('不動產、廠房及設備（PPE）',(r,i)=>pct(r.PPE, totArr[i]))}
      ${mk('應付帳款',(r,i)=>pct(r.AP, totArr[i]))}
      ${mk('借款',(r,i)=>pct(constants.DEBT||0, totArr[i]))}
      ${mk('保留盈餘',(r,i)=>pct(r.RE, totArr[i]))}
      ${mk('其他權益',(r,i)=>pct(constants.staticEquity[0].val||0, totArr[i]))}
    </table>`;

  el.innerHTML = `<div class="matrix-wrap">${PNL}${BS}</div>`;
}


/* ---------- 匯出 PDF ---------- */
async function exportForecastPDF(){
  if (!window.lastForecast) {
    alert('請先生成預測');
    return;
  }

  const src = document.getElementById('results');
  if (!src) { alert('找不到分析結果區塊'); return; }

  /* ---------- 1) 先把原始 canvas 擷取成 dataURL（clone 會是空白 canvas） ---------- */
  const srcCanvases = Array.from(src.querySelectorAll('canvas'));
  const canvasSnapshots = srcCanvases.map(cv => {
    try { return cv.toDataURL('image/png', 1.0); }
    catch (e) { return null; }
  });

  /* ---------- 2) 複製 DOM 作為輸出來源，並展開 <details> ---------- */
  const printable = src.cloneNode(true);
  printable.querySelectorAll('details').forEach(d => d.open = true);

  // PDF 專用樣式（字體縮小、你可在 CSS 加上 .pdf-root { font-size:12px; }）
  printable.classList.add('pdf-root');

  /* ---------- 3) 固定 clone 寬度 = A4 內容寬（避免以螢幕寬輸出而放大/裁切） ---------- */
  const opt = {
    margin:       [10, 10, 12, 10], // 上右下左（mm）
    filename:     (() => {
      const rows = window.lastForecast.rows || [];
      const firstYear = rows.length ? rows[0].year : '';
      const lastYear  = rows.length ? rows[rows.length - 1].year : '';
      return (firstYear && lastYear) ? `財報分析_${firstYear}～${lastYear}.pdf` : '財報分析.pdf';
    })(),
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, background: '#FFFFFF', logging: false, scrollY: 0 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: ['css', 'legacy'], avoid: ['.pdf-block', '.card', '.chart-wrap', 'table'] }
  };

  const a4WidthMm     = 210;
  const innerWidthMm  = a4WidthMm - opt.margin[1] - opt.margin[3];        // 扣掉左右邊界
  const innerWidthPx  = Math.round((innerWidthMm / 25.4) * 96);           // mm→px（96DPI）

  printable.style.width     = innerWidthPx + 'px';
  printable.style.maxWidth  = 'none';
  printable.style.boxSizing = 'border-box';

  /* ---------- 4) 在 clone 內把 canvas 換成 <img>，用 100% 自適應 A4 內容寬 ---------- */
  const cloneCanvases = Array.from(printable.querySelectorAll('canvas'));
  cloneCanvases.forEach((cv, i) => {
    const url = canvasSnapshots[i];
    if (!url) return;
    const img = new Image();
    img.src = url;
    img.style.width   = '100%';
    img.style.height  = 'auto';
    img.style.display = 'block';
    cv.replaceWith(img);
  });

  // 盡量避免被切頁
  printable.querySelectorAll('.pdf-block, .card, .chart-wrap, table').forEach(el => {
    el.style.breakInside     = 'avoid';
    el.style.pageBreakInside = 'avoid';
    el.style.marginBottom    = '12px';
  });

  /* ---------- 5) 建立看不見但參與排版的容器承載 clone（避免 display:none 導致尺寸為 0） ---------- */
  const holder = document.createElement('div');
  holder.style.position   = 'absolute';
  holder.style.left       = '0';
  holder.style.top        = '0';
  holder.style.width      = innerWidthPx + 'px';
  holder.style.background = '#fff';
  holder.style.visibility = 'hidden';
  holder.appendChild(printable);
  document.body.appendChild(holder);

  /* ---------- 6) 產生 PDF 並下載 ---------- */
  html2pdf().set(opt).from(printable).save().then(() => {
    document.body.removeChild(holder);
  }).catch(() => {
    document.body.removeChild(holder);
  });

  /* ---------- 7) 生成 PDF 並上傳 ---------- */
  html2pdf().set(opt).from(printable).toPdf().get('pdf').then(async (pdf) => {
    // 將 PDF 轉換為 Blob
    const pdfBlob = pdf.output('blob');
    
    // 上傳 PDF
    await uploadForecastPDF(pdfBlob, opt.filename);
  }).catch((error) => {
    console.error('Failed to generate PDF for upload:', error);
  });
}

async function uploadForecastPDF(pdf, pdf_filename){
  try {
    console.log('Uploading PDF to server...');
    
    // 方法1: 使用 FormData 包装 PDF
    const formData = new FormData();
    formData.append('file', pdf);
    formData.append('title', pdf_filename);
    formData.append('type', 'forecast'); // 添加类型标识
    
    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        'ngrok-skip-browser-warning': 'true'
        // 注意：使用 FormData 时不要设置 Content-Type，让浏览器自动设置
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('PDF uploaded successfully:', result);
    alert('PDF 匯出成功');
    return result;

  } catch (error) {
    console.error('Error uploading forecast PDF:', error);
    alert('Failed to upload forecast PDF: ' + error.message);
  }
}


/* ---------- 主流程 ---------- */
function generateForecast(){

  console.log('Generating forecast...');
  if(!validate()) return;
  computeAggregates();

  const years = parseInt(document.getElementById('fc_years').value,10)||3;
  const gArr = readGrowthArray(years);
  const ass = readAssumptionsFromUI();

  const root = document.getElementById('results');
  root.innerHTML = '';

  const { rows, constants } = runForecast(years, gArr, ass);

  const dStart=fmtDate('period_start'), dEnd=fmtDate('period_end');
  const wrap=document.createElement('section');
  const firstYear = rows[0].year;
  const lastYear  = rows[rows.length-1].year;
  wrap.className='card';
  wrap.innerHTML = `
    <div id="analysis_sections">
      <div class="draggable pdf-block" id="sec_revenue">
        <h3>各年度營業收入（${firstYear} → ${lastYear}）</h3>
        <div class="chart-wrap"><canvas id="rev_chart_${years}"></canvas></div>
        <div id="kpi_${years}" style="margin-top:10px"></div>
      </div>

      <div class="draggable pdf-block" id="sec_summary">
        <h3 style="margin-top:14px">重點彙整（多年度）</h3>
        <div id="matrix_${years}"></div>
      </div>

      <div class="draggable pdf-block" id="sec_cf">
        <h3>現金流結構</h3>
        <div class="chart-wrap"><canvas id="cf_stack_${years}"></canvas></div>
      </div>

      <div class="draggable pdf-block" id="sec_eff">
        <h3 style="margin-top:14px">營運效率（CCC）</h3>
        <div id="ccc_kpi_${years}"></div>
        <div class="chart-wrap"><canvas id="ccc_chart_${years}"></canvas></div>
      </div>

      <div class="draggable pdf-block" id="sec_ratios">
        <h3 style="margin-top:14px">常用比率（核心指標）</h3>
        <div id="ratio_${years}"></div>
      </div>

      <div class="draggable pdf-block" id="sec_common">
        <h3 style="margin-top:14px">共同比報表</h3>
        <div id="common_${years}"></div>
      </div>

      <div class="draggable pdf-block" id="sec_bscheck">
        <h3 style="margin-top:14px">資產負債平衡檢查</h3>
        <div id="bscheck_${years}"></div>
      </div>
    </div>
  `;

  root.appendChild(wrap);

  new Sortable(document.getElementById('analysis_sections'), {
    animation: 150, // 拖曳時有動畫效果
    ghostClass: 'sortable-ghost', // 被拖曳時的樣式
    handle: 'h3', // 限定用 h3 標題區塊拖曳（避免誤拖）
  });

  makeChart(`rev_chart_${years}`, rows, gArr);
  const baseNet = (getVal('revenue')-getVal('cogs')-getVal('op_expense')+getVal('other_income')-getVal('interest_expense')-getVal('tax_expense'));
  makeKPI(document.getElementById(`kpi_${years}`), getVal('revenue'), baseNet, rows);
  renderSummaryMatrix(document.getElementById(`matrix_${years}`), rows, constants);

  makeStackedCFChart(`cf_stack_${years}`, rows);
  renderCCC(`ccc_kpi_${years}`, `ccc_chart_${years}`, rows);
  renderRatios(`ratio_${years}`, rows, constants);
  renderCommonSize(`common_${years}`, rows, constants);
  renderBalanceCheck(`bscheck_${years}`, rows, constants);

  renderYearSections(root, rows, constants);

  window.lastForecast={rows, constants};
}


// 依你的三表輸出邏輯計總額與差額
function _bstot(r, constants){
  const SA = constants.staticAssets[0].val || 0;
  const SL = constants.staticLiabs[0].val  || 0;
  const EQ = constants.staticEquity[0].val || 0;
  const DEBT = constants.DEBT || 0;
  const CAP  = constants.CAPITAL || 0;
  const totalA  = r.cash + r.AR + r.INV + r.PPE + SA;
  const totalLE = r.AP + DEBT + SL + CAP + r.RE + EQ;
  return { totalA, totalLE, diff: totalA - totalLE, SA, SL, EQ, DEBT, CAP };
}

// 渲染「平衡檢查」區塊（顯示差額與建議修正）
function renderBalanceCheck(containerId, rows, constants){
  const el = document.getElementById(containerId);
  const header = rows.map(r=>`<th>${r.year}</th>`).join('');
  const row = (name, get)=>`<tr><td>${name}</td>${
   rows.map(r=>`<td>${formatNumberCustom(get(r))}</td>`).join('')
 }</tr>`;

  // 逐年計算
  const calc = rows.map(r => {
    const t = _bstot(r, constants);
    const RE_should = t.totalA - (r.AP + t.DEBT + t.SL + t.CAP + t.EQ); // 讓等式成立的 RE
    const cash_plug = -t.diff; // 若以「現金」作 plug，需調整的金額
    return { year:r.year, ...t, RE_should, cash_plug };
  });

  // 最新年度摘要
  const last = calc[calc.length-1];

  el.innerHTML = `
    <div class="matrix-wrap">
      <h4 class="subttl">資產負債表平衡檢查</h4>
      <table class="matrix">
        <tr><th>欄位</th>${header}</tr>
        ${row('總資產', r=>_bstot(r, constants).totalA)}
        ${row('負債＋權益', r=>_bstot(r, constants).totalLE)}
        ${row('差額（資產 − 負債權益）', r=>_bstot(r, constants).diff)}
      </table>
    </div>`;
}

/* ---------- 初始化 ---------- */
(function init(){
  const now=new Date(), y=now.getFullYear();
  document.getElementById('period_start').value = `${y}-01-01`;
  document.getElementById('period_end').value   = `${y}-12-31`;
  ['assets_body','liabs_body','equity_body','pl_body'].forEach(id=>{
    const el=document.getElementById(id);
    el.addEventListener('input', computeAggregates);
  });
  renderGrowthInputs();
  bindThousandsFormat();
})();

function formatNumberCustom(value) {
  if (typeof value !== 'number' || isNaN(value)) return '—';

  const decimals = parseInt(document.getElementById('decimal_places')?.value || 0, 10);
  const mode = document.getElementById('round_mode')?.value || 'round';

  let factor = Math.pow(10, decimals);
  let v = value;

  if (mode === 'round') v = Math.round(v * factor) / factor;
  else if (mode === 'ceil') v = Math.ceil(v * factor) / factor;
  else if (mode === 'floor') v = Math.floor(v * factor) / factor;

  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // 預設先格式化輸入框
  bindThousandsFormat(); 

  // 預設生成一次預測
  generateForecast();    

  // 監聽小數位數選單
  const dp = document.getElementById('decimal_places');
  if (dp) {
    dp.addEventListener('change', () => {
      if (window.lastForecast) generateForecast();
    });
  }

  // 監聽進位方式選單
  const rm = document.getElementById('round_mode');
  if (rm) {
    rm.addEventListener('change', () => {
      if (window.lastForecast) generateForecast();
    });
  }
});

window.exportForecastPDF = exportForecastPDF
window.generateForecast = generateForecast
window.openModal = openModal;
window.closeModal = closeModal;
window.confirmAddFromModal = confirmAddFromModal;
window.addCustomRow = addCustomRow;
window.removeRow = removeRow;
