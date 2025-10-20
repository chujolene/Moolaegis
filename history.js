import { API_BASE_URL } from "./config.js";

async function getHistory() {
    try {
        console.log('Getting upload history...');
        const response = await fetch(`${API_BASE_URL}/reports/?limit=50&offset=0`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'accept': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('History data received:', data);
        displayHistory(data);

    } catch (error) {
        console.error('Error fetching history:', error);
        displayError('Failed to load history: ' + error.message);
    }
}

function displayHistory(historyData) {
    const tbody = document.querySelector('tbody');
    if (!tbody) {
        console.error('Table body not found');
        return;
    }

    // 清空现有数据
    tbody.innerHTML = '';

    if (!historyData || !Array.isArray(historyData) || historyData.length === 0) {
        tbody.innerHTML = `
            <tr class="border-t border-t-[#dbe0e6]">
                <td colspan="3" class="h-[72px] px-4 py-2 text-center text-[#60758a] text-sm font-normal leading-normal">
                    No upload history found
                </td>
            </tr>
        `;
        return;
    }

    // 生成历史记录行
    historyData.forEach(item => {
        const row = createHistoryRow(item);
        tbody.appendChild(row);
    });
}

function createHistoryRow(item) {
  const row = document.createElement('tr');
  row.className = 'border-t border-t-[#dbe0e6]';
  
  // 格式化时间
  const uploadTime = formatTime(item.upload_time || item.created_at || item.timestamp);
  
  // 获取文件名
  const fileName = item.title || item.filename || 'Unknown report';
  
  row.innerHTML = `
      <td class="table-adbebf96-cf51-4bae-938a-38c514f2e0d4-column-120 h-[72px] px-4 py-2 w-[400px] text-[#60758a] text-sm font-normal leading-normal">
          ${uploadTime}
      </td>
      <td class="table-adbebf96-cf51-4bae-938a-38c514f2e0d4-column-240 h-[72px] px-4 py-2 w-[400px] text-[#60758a] text-sm font-normal leading-normal">
          ${fileName}
      </td>
      <td class="table-adbebf96-cf51-4bae-938a-38c514f2e0d4-column-480 h-[72px] px-4 py-2 w-60 text-[#60758a] text-sm font-bold leading-normal tracking-[0.015em] flex items-center gap-3">
        <button class="action-btn action-open">Open PDF</button>
        <button class="action-btn action-delete">Delete</button>
      </td>
  `;
    
    const openBtn = row.querySelector('.action-open');
    if (openBtn) {
      openBtn.addEventListener('click', async () => {
        if (!item.id) {
          alert('Missing report id');
          return;
        }
        try {
          await openReportPdf(item.id);
        } catch (e) {
          console.error('Open PDF failed:', e);
          alert('Failed to open PDF: ' + e.message);
        }
      });
    }

    const deleteBtn = row.querySelector('.action-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!item.id) {
          alert('Missing report id');
          return;
        }
        if (!confirm('Are you sure you want to delete this report?')) return;
        try {
          await deleteReport(item.id);
          await getHistory();
        } catch (e) {
          console.error('Delete failed:', e);
          alert('Failed to delete report: ' + e.message);
        }
      });
    }
    
    return row;
}

function formatTime(timeString) {
  if (!timeString) return 'Unknown Time';
  try {
    // 修正伺服器未附時區的時間格式
    let adjustedTime = timeString.trim();

    // 移除微秒（瀏覽器 new Date() 會不支援 6 位小數）
    adjustedTime = adjustedTime.replace(/\.\d{3,6}$/, '');

    // 若沒有 Z 或 +08:00，補上台灣時區
    if (!/Z|[+-]\d{2}:\d{2}$/.test(adjustedTime)) {
      adjustedTime += '+08:00';
    }

    const date = new Date(adjustedTime);

    return date.toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (error) {
    console.error('Error formatting time:', error, timeString);
    return timeString;
  }
}

function displayError(message) {
    const tbody = document.querySelector('tbody');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr class="border-t border-t-[#dbe0e6]">
            <td colspan="3" class="h-[72px] px-4 py-2 text-center text-red-500 text-sm font-normal leading-normal">
                ${message}
            </td>
        </tr>
    `;
}

async function openReportPdf(id){
  const url = `${API_BASE_URL}/reports/${id}/pdf?download=false`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      'accept': 'application/pdf',
      'ngrok-skip-browser-warning': 'true'
    }
  });
  if (!resp.ok) {
    const text = await resp.text().catch(()=> '');
    throw new Error(`HTTP ${resp.status} ${text}`);
  }
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener');
  // 可延後釋放以避免立即關閉
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
}

async function deleteReport(id){
  const url = `${API_BASE_URL}/reports/${id}`;
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      'accept': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text().catch(()=>'');
    throw new Error(`HTTP ${resp.status} ${text}`);
  }
  return await resp.json().catch(()=>({ ok: true }));
}

// 页面加载时自动获取历史数据
document.addEventListener('DOMContentLoaded', () => {
    getHistory();
});

// 导出函数供外部使用
export { getHistory, displayHistory };

