// pages.js - Refactored MVP Page Renderers and Interaction Setup for iPad (Offline-first, Safe Keying)
import { ClinicDB } from './db.js';

// Helper for element calculation based on birth month
export function getElementByMonth(monthNum) {
  const m = Number(monthNum);
  if ([1, 2, 3].includes(m)) return { name: 'ดิน (ปถวีธาตุ)', key: 'earth', css: 'elem-earth' };
  if ([4, 5, 6].includes(m)) return { name: 'น้ำ (อาโปธาตุ)', key: 'water', css: 'elem-water' };
  if ([7, 8, 9].includes(m)) return { name: 'ลม (วาโยธาตุ)', key: 'wind', css: 'elem-wind' };
  if ([10, 11, 12].includes(m)) return { name: 'ไฟ (เตโชธาตุ)', key: 'fire', css: 'elem-fire' };
  return { name: 'ไม่ระบุ', key: 'unknown', css: 'badge secondary' };
}

// Helpers for checks
function hasSeedData(state) {
  // Check if any store has seed data
  const lists = [
    state.patients, state.queues, state.inventory, state.sales, state.finance,
    state.appointments, state.patient_courses, state.followups, state.stock_movements,
    state.employees
  ];
  return lists.some(list => Array.isArray(list) && list.some(item => item.isSeedData === true));
}

// Render sample data warning banner
function renderSeedDataBanner(state) {
  if (hasSeedData(state)) {
    return `
      <div class="banner warning" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <strong>โหมดสาธิต:</strong> กำลังใช้ข้อมูลจำลองประกอบการทดสอบระบบ คุณสามารถสลับเป็นข้อมูลจริงได้ฟรี
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary btn-sm" id="btn-clear-seed-data" style="color:var(--danger); border-color:var(--danger);">ล้างข้อมูลตัวอย่าง</button>
          <button class="btn btn-primary btn-sm" id="btn-start-real-use">เริ่มใช้งานจริง</button>
        </div>
      </div>
    `;
  }
  return '';
}

// Global active sub-tab for Patients page
let activePatientsTab = 'list'; 
let selectedLogDate = new Date().toISOString().split('T')[0];
let dashboardSelectedDate = new Date().toISOString().split('T')[0];

let reportPeriod = 'all';
let reportStartDate = '';
let reportEndDate = '';

// Walk-in sale temporary cart state
let walkInCart = [];

// Holds items being edited in the Edit Completed Visit Modal
let editModalServices = [];
let editModalPrescriptions = [];

// -------------------------------------------------------------
// 1. DASHBOARD PAGE
// -------------------------------------------------------------
export function renderDashboard(state) {
  const todayStr = dashboardSelectedDate;
  
  // Calculate daily stats from new stores
  const todayIncomes = state.sales.filter(s => s.date === todayStr); // fallback to sales if new store is empty
  // We prefer income_transactions
  const v3Incomes = state.income_transactions?.filter(i => i.date === todayStr) || [];

  // Calculate cash revenue (excluding unpaid ones)
  const paidIncomes = v3Incomes.length > 0 
    ? v3Incomes.filter(i => i.isPaid !== false)
    : todayIncomes.filter(s => s.isPaid !== false);
  const revenueToday = paidIncomes.reduce((sum, i) => sum + (i.netAmount !== undefined ? i.netAmount : (i.total || 0)), 0);

  // Calculate unpaid debt revenue
  const unpaidIncomes = v3Incomes.length > 0
    ? v3Incomes.filter(i => i.isPaid === false)
    : todayIncomes.filter(s => s.isPaid === false);
  const debtToday = unpaidIncomes.reduce((sum, i) => sum + (i.netAmount !== undefined ? i.netAmount : (i.total || 0)), 0);

  const todayExpenses = state.expense_transactions?.filter(e => e.date === todayStr) || [];
  const expenseToday = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const profitToday = revenueToday - expenseToday;

  // Active appointments today
  const apptsTodayCount = state.appointments?.filter(a => a.date === todayStr).length || 0;

  // Alerts counts
  const lowStockCount = state.inventory.filter(i => i.type !== 'service' && i.type !== 'package' && i.stock < 15).length;
  
  // Course alerts
  const expiringCoursesCount = state.patient_courses?.filter(c => c.status === 'active' && c.totalSessions - c.usedSessions <= 1).length || 0;

  return `
    ${renderSeedDataBanner(state)}

    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบสรุปข้อมูลหลักประจำวัน</h2>
        <p>รายงานภาพรวมประจำวันและทางเลือกปุ่มลัดสั่งงานบนหน้าจอ iPad</p>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-secondary btn-sm" id="btn-dash-prev-date" style="padding: 6px 12px; font-weight:700;">◀</button>
        <div style="display:flex; align-items:center; gap:6px; background-color:var(--white); padding:2px 8px; border:1px solid var(--gray-300); border-radius:8px;">
          <!-- Text Input for typing date -->
          <input type="text" id="dash-date-text" class="form-control" style="width:110px; font-weight:600; text-align:center; margin:0; border:none; padding:4px 0;" placeholder="ปปปป-ดด-วว" value="${dashboardSelectedDate}">
          <!-- Date Picker for selecting date -->
          <div style="position:relative; display:flex; align-items:center; width:28px; height:28px;">
            <input type="date" id="dash-date-picker" style="width:100%; height:100%; opacity:0; cursor:pointer; position:absolute; z-index:2; margin:0;" value="${dashboardSelectedDate}">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="position:absolute; left:5px; pointer-events:none; color:var(--primary); z-index:1;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-dash-next-date" style="padding: 6px 12px; font-weight:700;">▶</button>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid-cols-4">
      <div class="card stat-card" style="border-left-color: var(--success);">
        <div class="stat-icon primary">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">รายรับเงินสดวันนี้</span>
          <span class="stat-value" style="color:var(--success);">฿${revenueToday.toLocaleString()}</span>
        </div>
      </div>
      <div class="card stat-card" style="border-left-color: var(--danger);">
        <div class="stat-icon danger" style="background-color: #fee2e2; color: var(--danger);">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">ยอดหนี้ค้างชำระวันนี้</span>
          <span class="stat-value" style="color:var(--danger);">฿${debtToday.toLocaleString()}</span>
        </div>
      </div>
      <div class="card stat-card" style="border-left-color: var(--warning);">
        <div class="stat-icon danger" style="background-color: #ffedd5; color: var(--warning);">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">รายจ่ายดำเนินการวันนี้</span>
          <span class="stat-value" style="color:var(--warning-hover);">฿${expenseToday.toLocaleString()}</span>
        </div>
      </div>
      <div class="card stat-card" style="border-left-color: var(--primary);">
        <div class="stat-icon secondary">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">กำไรเงินสดสุทธิวันนี้</span>
          <span class="stat-value" style="color:var(--primary-hover);">฿${profitToday.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- Quick Shortcuts Grid for iPad -->
    <div class="card">
      <h3 style="font-weight:700; margin-bottom:12px;">ทางลัดจัดการข้อมูลด่วน (Quick Actions)</h3>
      <div class="quick-actions-grid">
        <button class="quick-action-btn" id="shortcut-add-customer">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          ลงทะเบียนลูกค้าใหม่
        </button>
        <button class="quick-action-btn" id="shortcut-add-appt">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/></svg>
          นัดหมายวันตรวจ
        </button>
        <button class="quick-action-btn" id="shortcut-add-service">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          บันทึกบริการลูกค้า
        </button>
        <button class="quick-action-btn" id="shortcut-add-billing">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
          ชำระเงินคิวตรวจ
        </button>
        <button class="quick-action-btn" id="shortcut-add-expense">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
          บันทึกรายจ่ายคลินิก
        </button>
      </div>
    </div>

    <!-- Daily Log and Alerts Row -->
    <div class="grid-cols-2">
      <!-- Current Active Queue board short list (SWAPPED LEFT) -->
      <div class="card">
        <div class="page-header" style="margin-bottom:12px;">
          <h3 style="font-weight:700;">คนไข้รับการรักษาขณะนี้ (${state.queues.filter(q => q.status !== 'completed').length} คน)</h3>
          <button class="btn btn-secondary btn-sm" id="dashboard-go-queue">ดูบอร์ดคิว</button>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ลูกค้า (HN)</th>
                <th>เวลาคิว</th>
                <th>สถานะคิว</th>
              </tr>
            </thead>
            <tbody>
              ${state.queues.filter(q => q.status !== 'completed').length === 0 ? `<tr><td colspan="3" style="text-align:center; color:var(--gray-400);">ขณะนี้ยังไม่มีคิวลูกค้าเข้าระบบ</td></tr>` : 
                state.queues.filter(q => q.status !== 'completed').slice(0, 4).map(q => `
                  <tr>
                    <td><strong>${q.patientName} (HN-${String(q.patientId).padStart(4, '0')})</strong></td>
                    <td>${q.time} น.</td>
                    <td>
                      <span class="badge ${
                        q.status === 'waiting_intake' ? 'warning' :
                        q.status === 'consulting' ? 'primary' :
                        q.status === 'treatment' ? 'info' : 'accent'
                      }">
                        ${
                          q.status === 'waiting_intake' ? 'รอซักประวัติ' :
                          q.status === 'consulting' ? 'ห้องแพทย์' :
                          q.status === 'treatment' ? 'ห้องหัตถการ' : 'รอชำระเงิน'
                        }
                      </span>
                    </td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Alerts & Stock Warnings (SWAPPED RIGHT) -->
      <div class="card">
        <h3 style="font-weight:700; margin-bottom:12px; color:var(--gray-700);">รายการตรวจสอบระบบคลัง & คอร์ส</h3>
        <div class="finance-stats">
          <div class="finance-row">
            <span>สมุนไพร/เวชสำอาง ต่ำกว่าระดับปกติ (น้อยกว่า 15):</span>
            <span style="font-weight:600; color:${lowStockCount > 0 ? 'var(--danger)' : 'var(--success)'}">${lowStockCount} รายการ</span>
          </div>
          <div class="finance-row">
            <span>คอร์สการรักษาใกล้จะหมดอายุ (เหลือ 1 ครั้ง):</span>
            <span style="font-weight:600; color:${expiringCoursesCount > 0 ? 'var(--warning)' : 'var(--success)'}">${expiringCoursesCount} คอร์ส</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function setupDashboardEvents(state, navigate) {
  // Date text typing trigger
  document.getElementById('dash-date-text')?.addEventListener('change', (e) => {
    const val = e.target.value.trim();
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      // Format as YYYY-MM-DD
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      dashboardSelectedDate = `${year}-${month}-${date}`;
      navigate('dashboard');
    } else {
      alert('รูปแบบวันที่ไม่ถูกต้อง กรุณาพิมพ์ในรูปแบบ YYYY-MM-DD (เช่น 2026-07-12)');
      e.target.value = dashboardSelectedDate;
    }
  });

  // Date selection triggers
  document.getElementById('dash-date-picker')?.addEventListener('change', (e) => {
    dashboardSelectedDate = e.target.value;
    navigate('dashboard');
  });

  document.getElementById('btn-dash-prev-date')?.addEventListener('click', () => {
    const d = new Date(dashboardSelectedDate);
    d.setDate(d.getDate() - 1);
    dashboardSelectedDate = d.toISOString().split('T')[0];
    navigate('dashboard');
  });

  document.getElementById('btn-dash-next-date')?.addEventListener('click', () => {
    const d = new Date(dashboardSelectedDate);
    d.setDate(d.getDate() + 1);
    dashboardSelectedDate = d.toISOString().split('T')[0];
    navigate('dashboard');
  });

  document.getElementById('shortcut-add-customer')?.addEventListener('click', () => navigate('customers'));
  document.getElementById('shortcut-add-appt')?.addEventListener('click', () => navigate('appointments'));
  document.getElementById('shortcut-add-service')?.addEventListener('click', () => navigate('service-records'));
  document.getElementById('shortcut-add-billing')?.addEventListener('click', () => navigate('queue'));
  document.getElementById('shortcut-add-expense')?.addEventListener('click', () => navigate('expenses'));
  document.getElementById('dashboard-go-queue')?.addEventListener('click', () => navigate('queue'));

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 2. CUSTOMERS PAGE (ลูกค้า)
// -------------------------------------------------------------
export function renderCustomers(state) {
  return `
    ${renderSeedDataBanner(state)}

    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบทะเบียนลูกค้า / ทะเบียนประวัติ</h2>
        <p>จัดการประวัติส่วนตัวลูกค้า ลงทะเบียนข้อมูล และนำลูกค้าเข้าจุดตรวจบำบัด</p>
      </div>
      <button class="btn btn-primary" id="btn-cust-add">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 5v14M5 12h14"/></svg>
        เพิ่มประวัติลูกค้าใหม่
      </button>
    </div>

    <div class="card">
      <div class="search-wrapper">
        <input type="text" class="form-control" id="search-cust-input" placeholder="ค้นหาชื่อลูกค้า เบอร์โทรศัพท์ หรือธาตุ...">
      </div>

      <div class="table-container">
        <table id="cust-table">
          <thead>
            <tr>
              <th>รหัสลูกค้า (HN)</th>
              <th>ชื่อ-นามสกุล</th>
              <th>เบอร์โทรศัพท์</th>
              <th>เพศ</th>
              <th>ธาตุเจ้าเรือน</th>
              <th>โรคประจำตัว / แพ้ยา</th>
              <th>ตัวเลือกบริการ</th>
            </tr>
          </thead>
          <tbody>
            ${state.patients.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--gray-400);">ไม่พบประวัติลูกค้าในฐานข้อมูล</td></tr>` : 
              state.patients.map(p => {
                const birthMonth = p.birthdate ? new Date(p.birthdate).getMonth() + 1 : 0;
                const elem = getElementByMonth(birthMonth);
                return `
                  <tr data-name="${p.name.toLowerCase()}" data-phone="${p.phone}" data-elem="${elem.name}">
                    <td>HN-${String(p.id).padStart(4, '0')}</td>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.phone}</td>
                    <td>${p.gender || '-'}</td>
                    <td><span class="elem-chip ${elem.css}">${elem.name}</span></td>
                    <td>
                      <span style="color:var(--danger)">${p.congenitalDiseases || 'ไม่มี'}</span> / 
                      <span style="color:var(--danger); font-weight:600;">${p.allergies || 'ไม่มี'}</span>
                    </td>
                    <td>
                      <button class="btn btn-secondary btn-sm btn-cust-medical" data-id="${p.id}">เวชระเบียน</button>
                      <button class="btn btn-secondary btn-sm btn-cust-edit" data-id="${p.id}">แก้ไข</button>
                      <button class="btn btn-secondary btn-sm btn-cust-service" data-id="${p.id}">ทำหัตถการ</button>
                      <button class="btn btn-primary btn-sm btn-cust-send-queue" data-id="${p.id}">ส่งคิวตรวจ</button>
                    </td>
                  </tr>
                `;
              }).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: Register Customer -->
    <div class="modal-backdrop" id="modal-cust" style="display:none;">
      <div class="modal-container">
        <div class="modal-header">
          <h3>ลงทะเบียนข้อมูลประวัติลูกค้าใหม่</h3>
          <button class="close-btn" id="modal-cust-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-cust">
            <div class="form-group">
              <label for="c-name">ชื่อ - นามสกุล *</label>
              <input type="text" class="form-control" id="c-name" required placeholder="ชื่อ-นามสกุล">
            </div>
            <div class="form-group">
              <label for="c-phone">เบอร์โทรศัพท์ * (บังคับกรอกสำหรับความปลอดภัยในการติดต่อ)</label>
              <input type="tel" class="form-control" id="c-phone" required placeholder="08XXXXXXXX">
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="c-birthdate">วันเดือนปีเกิด (ประเมินธาตุเจ้าเรือน) *</label>
                <input type="date" class="form-control" id="c-birthdate" required>
              </div>
              <div class="form-group">
                <label for="c-gender">เพศ</label>
                <select id="c-gender">
                  <option value="หญิง">หญิง</option>
                  <option value="ชาย">ชาย</option>
                  <option value="ไม่ระบุ">ไม่ระบุ</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="c-congenital">โรคประจำตัว</label>
              <input type="text" class="form-control" id="c-congenital" placeholder="ไม่มี / ระบุโรคประจำตัว">
            </div>
            <div class="form-group">
              <label for="c-allergies">แพ้ยา / แพ้สมุนไพร / ข้อควรระวังพิเศษ</label>
              <input type="text" class="form-control" id="c-allergies" placeholder="ไม่มี / ระบุประวัติการแพ้หรือระวัง">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-cust-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-cust" type="submit">บันทึกเวชระเบียนลูกค้า</button>
        </div>
      </div>
    </div>
  `;
}

export function setupCustomersEvents(state, navigate) {
  const modal = document.getElementById('modal-cust');
  const searchInput = document.getElementById('search-cust-input');

  searchInput?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#cust-table tbody tr');
    rows.forEach(row => {
      if (row.cells.length < 2) return;
      const name = row.dataset.name || '';
      const phone = row.dataset.phone || '';
      const elem = row.dataset.elem || '';
      if (name.includes(term) || phone.includes(term) || elem.toLowerCase().includes(term)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });

  document.getElementById('btn-cust-add')?.addEventListener('click', () => {
    window.editingPatientId = null;
    modal.querySelector('h3').textContent = 'ลงทะเบียนข้อมูลประวัติลูกค้าใหม่';
    document.getElementById('form-cust').reset();
    modal.style.display = 'flex';
  });

  document.querySelectorAll('.btn-cust-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.closest('button').dataset.id);
      const patient = state.patients.find(p => p.id === id);
      window.editingPatientId = id;
      modal.querySelector('h3').textContent = `แก้ไขประวัติลูกค้า HN-${String(id).padStart(4, '0')}`;
      
      document.getElementById('c-name').value = patient.name;
      document.getElementById('c-phone').value = patient.phone;
      document.getElementById('c-birthdate').value = patient.birthdate || '';
      document.getElementById('c-gender').value = patient.gender || 'หญิง';
      document.getElementById('c-congenital').value = patient.congenitalDiseases || '';
      document.getElementById('c-allergies').value = patient.allergies || '';
      
      modal.style.display = 'flex';
    });
  });

  const closeM = () => modal.style.display = 'none';
  document.getElementById('modal-cust-close')?.addEventListener('click', closeM);
  document.getElementById('btn-cust-cancel')?.addEventListener('click', closeM);

  document.getElementById('form-cust')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // VALIDATIONS
    const phone = document.getElementById('c-phone').value.trim();
    if (!phone) {
      alert('ข้อผิดพลาด: เบอร์โทรศัพท์ลูกค้าต้องไม่เป็นค่าว่าง!');
      return;
    }

    const birthdate = document.getElementById('c-birthdate').value;
    const m = birthdate ? new Date(birthdate).getMonth() + 1 : 0;
    const elemObj = getElementByMonth(m);

    const patient = {
      name: document.getElementById('c-name').value,
      phone: phone,
      birthdate: birthdate,
      gender: document.getElementById('c-gender').value,
      element: elemObj.name,
      congenitalDiseases: document.getElementById('c-congenital').value,
      allergies: document.getElementById('c-allergies').value
    };

    if (window.editingPatientId) {
      patient.id = window.editingPatientId;
      await ClinicDB.updatePatient(patient);
      alert('แก้ไขข้อมูลลูกค้าเรียบร้อยแล้ว!');
    } else {
      await ClinicDB.addPatient(patient);
      alert('ลงทะเบียนลูกค้าใหม่เรียบร้อยแล้ว!');
    }
    
    state.patients = await ClinicDB.getPatients();
    closeM();
    navigate('customers');
  });

  document.querySelectorAll('.btn-cust-medical').forEach(btn => {
    btn.addEventListener('click', (e) => {
      window.activePatientHistoryId = Number(e.target.dataset.id);
      navigate('medical-records');
    });
  });

  document.querySelectorAll('.btn-cust-service').forEach(btn => {
    btn.addEventListener('click', (e) => {
      window.activeServicePatientId = Number(e.target.dataset.id);
      navigate('service-records');
    });
  });

  document.querySelectorAll('.btn-cust-send-queue').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = Number(e.target.dataset.id);
      const patient = state.patients.find(p => p.id === id);

      const todayStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

      const newQueue = {
        patientId: id, // Link using ID instead of name
        patientName: patient.name,
        status: 'waiting_intake',
        date: todayStr,
        time: timeStr,
        element: patient.element,
        vitals: { bp: '', pulse: '', temp: '', weight: '' },
        symptoms: '',
        diagnostics: '',
        treatments: [],
        prescriptions: []
      };

      await ClinicDB.addQueue(newQueue);
      state.queues = await ClinicDB.getQueues();
      alert(`ส่งคนไข้ ${patient.name} เข้าสู่คิวตรวจแล้ว!`);
      navigate('queue');
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 3. APPOINTMENTS PAGE (นัดหมาย)
// -------------------------------------------------------------
export function renderAppointments(state) {
  const list = state.appointments || [];

  return `
    ${renderSeedDataBanner(state)}

    <div class="page-header">
      <div class="page-title-desc">
        <h2>ตารางและการบริหารจัดการนัดหมายลูกค้า</h2>
        <p>บันทึกคิวนัดหมายใช้บริการ บริการตรวจ หรือการทำสปาบำบัดล่วงหน้า</p>
      </div>
      <button class="btn btn-primary" id="btn-appt-add">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 5v14M5 12h14"/></svg>
        สร้างรายการนัดหมายใหม่
      </button>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>วันที่นัด</th>
              <th>เวลานัด</th>
              <th>ลูกค้า (HN)</th>
              <th>รายละเอียดนัดหมาย</th>
              <th>สถานะนัด</th>
              <th style="width:260px; text-align:center;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--gray-400);">ไม่มีรายการนัดหมายสุขภาพล่วงหน้าในระบบ</td></tr>` : 
              list.map(a => `
                <tr>
                  <td>${new Date(a.date).toLocaleDateString('th-TH')}</td>
                  <td><strong>${a.time} น.</strong></td>
                  <td><strong>${a.patientName} (HN-${String(a.patientId).padStart(4, '0')})</strong></td>
                  <td>
                    ${a.complaint ? `<div><strong>อาการ:</strong> ${a.complaint}</div>` : ''}
                    <div><strong>บริการที่จอง:</strong> ${a.notes || '-'}</div>
                  </td>
                  <td>
                    <span class="badge ${
                      a.status === 'completed' ? 'success' :
                      a.status === 'confirmed' ? 'primary' :
                      a.status === 'arrived' ? 'info' :
                      a.status === 'waiting' ? 'warning' : 'danger'
                    }">
                      ${
                        a.status === 'scheduled' ? 'จองล่วงหน้า' :
                        a.status === 'confirmed' ? 'ยืนยันนัด' :
                        a.status === 'arrived' ? 'มาถึงแล้ว' :
                        a.status === 'waiting' ? 'กำลังรอรับบริการ' :
                        a.status === 'completed' ? 'ตรวจเสร็จแล้ว' : 'ยกเลิกนัด'
                      }
                    </span>
                  </td>
                  <td style="white-space: nowrap; text-align:center;">
                    <div style="display:flex; gap:6px; justify-content:center;">
                      ${a.status !== 'completed' && a.status !== 'arrived' && a.status !== 'cancelled' ? `
                        <button class="btn btn-primary btn-sm btn-appt-arrive" data-id="${a.id}">เช็กอิน</button>
                      ` : ''}
                      <button class="btn btn-secondary btn-sm btn-appt-details" data-id="${a.id}">รายละเอียด</button>
                      <button class="btn btn-secondary btn-sm btn-appt-edit" data-id="${a.id}">แก้ไข</button>
                      <button class="btn btn-danger btn-sm btn-appt-delete" data-id="${a.id}">ลบ</button>
                    </div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Add Appt -->
    <div class="modal-backdrop" id="modal-appt" style="display:none;">
      <div class="modal-container">
        <div class="modal-header">
          <h3>ลงทะเบียนสร้างนัดหมายลูกค้าล่วงหน้า</h3>
          <button class="close-btn" id="modal-appt-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-appt">
            <input type="hidden" id="appt-editing-id" value="">
            <div class="form-group">
              <label for="a-pat-id">รายชื่อลูกค้า *</label>
              <select id="a-pat-id" required>
                <option value="">-- เลือกลูกค้า --</option>
                ${state.patients.map(p => `<option value="${p.id}">${p.name} (HN-${String(p.id).padStart(4, '0')} - เบอร์โทร: ${p.phone})</option>`).join('')}
              </select>
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="a-date">วันที่นัดหมาย *</label>
                <input type="date" class="form-control" id="a-date" required>
              </div>
              <div class="form-group">
                <label for="a-time">เวลานัดหมาย *</label>
                <input type="time" class="form-control" id="a-time" required>
              </div>
            </div>
            <div class="form-group">
              <label for="a-complaint">อาการปวด / ปัญหา / ความต้องการ</label>
              <textarea id="a-complaint" rows="2" placeholder="ระบุอาการสำคัญ เช่น ปวดบ่าไหล่ร้าวขึ้นเบ้าตา, มีอาการนอนไม่หลับ"></textarea>
            </div>
            <div class="form-group">
              <label for="a-notes">บริการหลักที่จอง</label>
              <textarea id="a-notes" rows="2" placeholder="ระบุนวดไทยนวดบำบัดรักษา หรือบริการหลักอื่นที่ลูกค้าจอง"></textarea>
            </div>
            <div class="form-group">
              <label for="a-add-notes">โน๊ตเพิ่มเติม</label>
              <textarea id="a-add-notes" rows="2" placeholder="ระบุความต้องการเพิ่มเติมของหมอหรือข้อมูลอื่นๆ"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-appt-cancel-modal">ยกเลิก</button>
          <button class="btn btn-primary" form="form-appt" type="submit">บันทึกนัดหมาย</button>
        </div>
      </div>
    </div>
  `;
}

export function setupAppointmentsEvents(state, navigate) {
  const modal = document.getElementById('modal-appt');

  document.getElementById('btn-appt-add')?.addEventListener('click', () => {
    document.getElementById('form-appt').reset();
    document.getElementById('appt-editing-id').value = '';
    document.getElementById('a-date').value = new Date().toISOString().split('T')[0];
    modal.querySelector('h3').textContent = 'ลงทะเบียนสร้างนัดหมายลูกค้าล่วงหน้า';
    modal.style.display = 'flex';
  });

  const closeM = () => modal.style.display = 'none';
  document.getElementById('modal-appt-close')?.addEventListener('click', closeM);
  document.getElementById('btn-appt-cancel-modal')?.addEventListener('click', closeM);

  document.getElementById('form-appt')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const patId = Number(document.getElementById('a-pat-id').value);
    const patientObj = state.patients.find(p => p.id === patId);
    const editingId = document.getElementById('appt-editing-id').value;

    const appt = {
      patientId: patId, // Safe ID linkage
      patientName: patientObj.name,
      date: document.getElementById('a-date').value,
      time: document.getElementById('a-time').value,
      complaint: document.getElementById('a-complaint').value,
      notes: document.getElementById('a-notes').value,
      additionalNotes: document.getElementById('a-add-notes').value,
      status: 'scheduled'
    };

    if (editingId) {
      appt.id = Number(editingId);
      const existing = state.appointments.find(a => a.id === appt.id);
      appt.status = existing ? existing.status : 'scheduled';
      await ClinicDB.putStoreData('appointments', appt);
      alert('แก้ไขรายการนัดหมายสำเร็จ!');
    } else {
      await ClinicDB.addStoreData('appointments', appt);
      alert('สร้างนัดหมายใหม่สำเร็จ!');
    }

    state.appointments = await ClinicDB.getStoreData('appointments');
    closeM();
    navigate('appointments');
  });

  document.querySelectorAll('.btn-appt-arrive').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = Number(e.target.dataset.id);
      const appt = state.appointments.find(a => a.id === id);
      appt.status = 'arrived';
      await ClinicDB.putStoreData('appointments', appt);
      
      const patient = state.patients.find(p => p.id === appt.patientId) || { id: appt.patientId, name: appt.patientName, element: 'ไม่ระบุ' };
      const todayStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

      const newQueue = {
        patientId: patient.id, // Safe linkage
        patientName: patient.name,
        status: 'waiting_intake',
        date: todayStr,
        time: timeStr,
        element: patient.element,
        vitals: { bp: '', pulse: '', temp: '', weight: '' },
        symptoms: appt.complaint || appt.notes || 'นัดหมายเข้ารับบริการบำบัด',
        diagnostics: '',
        treatments: [],
        prescriptions: [],
        ttmIntake: {
          behaviors: [],
          timeAggravated: 'ไม่ระบุ'
        }
      };

      await ClinicDB.addQueue(newQueue);
      state.queues = await ClinicDB.getQueues();
      state.appointments = await ClinicDB.getStoreData('appointments');
      alert(`ลูกค้ามาถึงแล้ว! ระบบส่งประวัติ ${appt.patientName} เข้าสู่คิวแรกรับตรวจแล้ว`);
      navigate('queue');
    });
  });

  document.querySelectorAll('.btn-appt-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id);
      const appt = state.appointments.find(a => a.id === id);
      alert(`รายละเอียดข้อมูลการนัดหมาย HN-${String(appt.patientId).padStart(4, '0')}:
---------------------------------------
ชื่อคนไข้: ${appt.patientName}
วันที่นัด: ${new Date(appt.date).toLocaleDateString('th-TH')}
เวลานัด: ${appt.time} น.
อาการ/ความต้องการ: ${appt.complaint || 'ไม่มี'}
บริการหลักที่จอง: ${appt.notes || 'ไม่มี'}
โน๊ตเพิ่มเติม: ${appt.additionalNotes || 'ไม่มี'}
สถานะปัจจุบัน: ${appt.status}`);
    });
  });

  document.querySelectorAll('.btn-appt-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id);
      const appt = state.appointments.find(a => a.id === id);
      
      document.getElementById('appt-editing-id').value = id;
      document.getElementById('a-pat-id').value = appt.patientId;
      document.getElementById('a-date').value = appt.date;
      document.getElementById('a-time').value = appt.time;
      document.getElementById('a-complaint').value = appt.complaint || '';
      document.getElementById('a-notes').value = appt.notes || '';
      document.getElementById('a-add-notes').value = appt.additionalNotes || '';
      
      modal.querySelector('h3').textContent = 'แก้ไขรายละเอียดการนัดหมาย';
      modal.style.display = 'flex';
    });
  });

  document.querySelectorAll('.btn-appt-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (confirm('คุณต้องการลบข้อมูลรายการนัดหมายนี้ออกจากระบบเป็นการถาวรใช่หรือไม่?')) {
        const id = Number(e.target.dataset.id);
        await ClinicDB.deleteStoreData('appointments', id);
        state.appointments = await ClinicDB.getStoreData('appointments');
        alert('ลบรายการนัดหมายสำเร็จ!');
        navigate('appointments');
      }
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 4. QUEUE TODAY PAGE (คิววันนี้)
// -------------------------------------------------------------
export function renderQueue(state) {
  return renderQueueOriginal(state); // fallback or direct link
}

function renderQueueOriginal(state) {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayQueues = state.queues.filter(q => q.date === todayStr);
  const filterByStatus = (status) => todayQueues.filter(q => q.status === status);

  return `
    ${renderSeedDataBanner(state)}

    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบจัดการคิวและสถานะงานบริการประจำวัน</h2>
        <p>คนไข้ในระบบขณะนี้แยกตามจุดตรวจของแพทย์และหัตถการรักษา</p>
      </div>
    </div>

    <div class="kanban-board">
      <!-- Column 1: Waiting Intake -->
      <div class="kanban-column">
        <div class="kanban-column-header">
          <span class="kanban-column-title">1. ซักประวัติ & สัญญาณชีพ</span>
          <span class="kanban-count">${filterByStatus('waiting_intake').length}</span>
        </div>
        ${filterByStatus('waiting_intake').length === 0 ? `<div style="text-align:center; padding:24px 10px; border:2px dashed var(--gray-300); border-radius:var(--radius-md); color:var(--gray-400); font-size:12px;">ไม่มีคิว</div>` : 
          filterByStatus('waiting_intake').map(q => `
            <div class="kanban-card">
              <span class="kanban-card-title">${q.patientName}</span>
              <span style="font-size:12px; color:var(--gray-500);">HN-${String(q.patientId).padStart(4, '0')} | คิว: ${q.time} น.</span>
              <button class="btn btn-primary btn-sm btn-intake-act" data-id="${q.id}" style="width:100%; margin-top:8px;">บันทึกอาการแรกรับ</button>
            </div>
          `).join('')
        }
      </div>

      <!-- Column 2: Consulting -->
      <div class="kanban-column">
        <div class="kanban-column-header">
          <span class="kanban-column-title">2. ตรวจรักษาแพทย์แผนไทย</span>
          <span class="kanban-count">${filterByStatus('consulting').length}</span>
        </div>
        ${filterByStatus('consulting').length === 0 ? `<div style="text-align:center; padding:24px 10px; border:2px dashed var(--gray-300); border-radius:var(--radius-md); color:var(--gray-400); font-size:12px;">ไม่มีคิว</div>` : 
          filterByStatus('consulting').map(q => `
            <div class="kanban-card" style="border-left-color: var(--primary);">
              <span class="kanban-card-title">${q.patientName}</span>
              <span style="font-size:12px; color:var(--gray-500);">HN-${String(q.patientId).padStart(4, '0')} | อาการ: ${q.symptoms || '-'}</span>
              <button class="btn btn-primary btn-sm btn-consult-act" data-id="${q.id}" style="width:100%; margin-top:8px;">บันทึกตรวจโรค</button>
            </div>
          `).join('')
        }
      </div>

      <!-- Column 3: Treatment -->
      <div class="kanban-column">
        <div class="kanban-column-header">
          <span class="kanban-column-title">3. จุดหัตถการ & สปาบำบัด</span>
          <span class="kanban-count">${filterByStatus('treatment').length}</span>
        </div>
        ${filterByStatus('treatment').length === 0 ? `<div style="text-align:center; padding:24px 10px; border:2px dashed var(--gray-300); border-radius:var(--radius-md); color:var(--gray-400); font-size:12px;">ไม่มีคิว</div>` : 
          filterByStatus('treatment').map(q => `
            <div class="kanban-card" style="border-left-color: var(--info);">
              <span class="kanban-card-title">${q.patientName}</span>
              <span style="font-size:12px; color:var(--gray-500);">HN-${String(q.patientId).padStart(4, '0')} | วินิจฉัย: ${q.diagnostics || '-'}</span>
              <button class="btn btn-primary btn-sm btn-treatment-act" data-id="${q.id}" style="width:100%; margin-top:8px;">ทำหัตถการเสร็จสิ้น</button>
            </div>
          `).join('')
        }
      </div>

      <!-- Column 4: Billing -->
      <div class="kanban-column">
        <div class="kanban-column-header">
          <span class="kanban-column-title">4. การรับชำระเงิน & รับยาสมุนไพร</span>
          <span class="kanban-count">${filterByStatus('billing').length}</span>
        </div>
        ${filterByStatus('billing').length === 0 ? `<div style="text-align:center; padding:24px 10px; border:2px dashed var(--gray-300); border-radius:var(--radius-md); color:var(--gray-400); font-size:12px;">ไม่มีคิว</div>` : 
          filterByStatus('billing').map(q => `
            <div class="kanban-card" style="border-left-color: var(--accent);">
              <span class="kanban-card-title">${q.patientName}</span>
              <span style="font-size:12px; color:var(--gray-500);">HN-${String(q.patientId).padStart(4, '0')} | รอชำระค่ารักษา</span>
              <button class="btn btn-primary btn-sm btn-billing-act" data-id="${q.id}" style="width:100%; margin-top:8px;">สรุปยอด & จ่ายเงิน</button>
            </div>
          `).join('')
        }
      </div>
    </div>

    <!-- Intake Modal -->
    <div class="modal-backdrop" id="modal-intake" style="display:none;">
      <div class="modal-container">
        <div class="modal-header">
          <h3>บันทึกข้อมูลแรกรับและสัญญาณชีพ</h3>
          <button class="close-btn" id="modal-intake-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-intake">
            <input type="hidden" id="intake-queue-id">
            <div class="form-group">
              <label for="i-symptoms">อาการแรกรับ / บริการที่ต้องการบริการ *</label>
              <textarea id="i-symptoms" rows="3" required placeholder="เช่น ปวดตึงบ่าไหล่ร้าวขึ้นศีรษะ นวดอโรม่า"></textarea>
            </div>
            
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="i-bp">ความดันโลหิต (mmHg)</label>
                <input type="text" class="form-control" id="i-bp" placeholder="120/80">
              </div>
              <div class="form-group">
                <label for="i-pulse">ชีพจร (ครั้ง/นาที)</label>
                <input type="number" class="form-control" id="i-pulse" placeholder="72">
              </div>
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="i-temp">อุณหภูมิร่างกาย (°C)</label>
                <input type="number" step="0.1" class="form-control" id="i-temp" placeholder="36.5">
              </div>
              <div class="form-group">
                <label for="i-weight">น้ำหนักตัว (กก.)</label>
                <input type="number" step="0.1" class="form-control" id="i-weight" placeholder="60">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-intake-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-intake" type="submit">บันทึกส่งต่อเข้าห้องตรวจ</button>
        </div>
      </div>
    </div>
  `;
}

export function setupQueueEvents(state, navigate) {
  const intakeModal = document.getElementById('modal-intake');

  document.querySelectorAll('.btn-intake-act').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const qId = Number(e.target.dataset.id);
      const queueObj = state.queues.find(q => q.id === qId);
      document.getElementById('intake-queue-id').value = qId;
      document.getElementById('i-symptoms').value = queueObj.symptoms || '';
      document.getElementById('i-bp').value = queueObj.vitals?.bp || '';
      document.getElementById('i-pulse').value = queueObj.vitals?.pulse || '';
      document.getElementById('i-temp').value = queueObj.vitals?.temp || '';
      document.getElementById('i-weight').value = queueObj.vitals?.weight || '';

      intakeModal.style.display = 'flex';
    });
  });

  const closeM = () => intakeModal.style.display = 'none';
  document.getElementById('modal-intake-close')?.addEventListener('click', closeM);
  document.getElementById('btn-intake-cancel')?.addEventListener('click', closeM);

  document.getElementById('form-intake')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const qId = Number(document.getElementById('intake-queue-id').value);
    const queueObj = state.queues.find(q => q.id === qId);

    queueObj.symptoms = document.getElementById('i-symptoms').value;
    queueObj.vitals = {
      bp: document.getElementById('i-bp').value,
      pulse: document.getElementById('i-pulse').value,
      temp: document.getElementById('i-temp').value,
      weight: document.getElementById('i-weight').value
    };
    queueObj.status = 'consulting';

    await ClinicDB.updateQueue(queueObj);
    state.queues = await ClinicDB.getQueues();
    closeM();
    navigate('queue');
  });

  document.querySelectorAll('.btn-consult-act').forEach(btn => {
    btn.addEventListener('click', (e) => {
      window.activeConsultQueueId = Number(e.target.dataset.id);
      navigate('consultation');
    });
  });

  document.querySelectorAll('.btn-treatment-act').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const qId = Number(e.target.dataset.id);
      const queueObj = state.queues.find(q => q.id === qId);
      queueObj.status = 'billing';
      await ClinicDB.updateQueue(queueObj);
      state.queues = await ClinicDB.getQueues();
      navigate('queue');
    });
  });

  document.querySelectorAll('.btn-billing-act').forEach(btn => {
    btn.addEventListener('click', (e) => {
      window.activeBillingQueueId = Number(e.target.dataset.id);
      navigate('billing');
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 5. MEDICAL RECORDS PAGE (เวชระเบียน)
// -------------------------------------------------------------
export function renderMedicalRecords(state) {
  const completedTodayList = state.queues.filter(q => q.status === 'completed' && q.date === selectedLogDate);

  return `
    ${renderSeedDataBanner(state)}

    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบเวชระเบียนและประวัติการตรวจรักษารายวัน</h2>
        <p>บันทึกประวัติคนไข้ใหม่ ตรวจเช็กเวชระเบียนประวัติ หรือปรับปรุงบันทึกประวัติการตรวจย้อนหลัง</p>
      </div>
    </div>

    <!-- Tabs inside Patients Page -->
    <div class="card" style="padding: 20px;">
      <div class="tab-container" style="margin-bottom: 20px;">
        <button class="tab-button ${activePatientsTab === 'list' ? 'active' : ''}" id="tab-patient-list">ประวัติคนไข้เดี่ยว</button>
        <button class="tab-button ${activePatientsTab === 'log' ? 'active' : ''}" id="tab-treatment-log">ประวัติการรักษารายวัน (Daily Log)</button>
      </div>

      <!-- Tab Content 1: Medical Records list -->
      <div id="sec-patient-list" style="display: ${activePatientsTab === 'list' ? 'block' : 'none'};">
        <h3 style="margin-bottom:12px;">ค้นหาเวชระเบียนคนไข้เดี่ยว</h3>
        <div class="search-wrapper">
          <select id="sel-history-patient" style="flex-grow:1;">
            <option value="">-- เลือกคนไข้ --</option>
            ${state.patients.map(p => `<option value="${p.id}" ${window.activePatientHistoryId === p.id ? 'selected' : ''}>HN-${String(p.id).padStart(4, '0')} - ${p.name}</option>`).join('')}
          </select>
        </div>
        
        <div id="medical-record-detail-area">
          ${(() => {
            const targetId = window.activePatientHistoryId || (state.patients[0] ? state.patients[0].id : null);
            const patient = state.patients.find(p => p.id === targetId);

            if (!patient) {
              return `<p style="text-align:center; color:var(--gray-400); padding:24px;">กรุณาเลือกชื่อคนไข้ด้านบนเพื่อตรวจสอบเวชระเบียน</p>`;
            }

            const birthMonth = patient.birthdate ? new Date(patient.birthdate).getMonth() + 1 : 0;
            const elem = getElementByMonth(birthMonth);
            const doneVisits = state.queues.filter(q => q.patientId === patient.id && q.status === 'completed');

            return `
              <div class="grid-cols-2" style="grid-template-columns: 280px 1fr; margin-top:20px;">
                <div class="card" style="background-color:var(--gray-50);">
                  <h4 style="font-weight:700; margin-bottom:12px;">ข้อมูลสุขภาพหลัก</h4>
                  <p><strong>ชื่อ-นามสกุล:</strong><br>${patient.name}</p>
                  <p><strong>เบอร์โทรศัพท์:</strong> ${patient.phone}</p>
                  <p><strong>เพศ:</strong> ${patient.gender || '-'}</p>
                  <p><strong>ธาตุเจ้าเรือน:</strong> <span class="elem-chip ${elem.css}">${elem.name}</span></p>
                  <p style="color:var(--danger)"><strong>โรคประจำตัว:</strong><br>${patient.congenitalDiseases || 'ไม่มี'}</p>
                  <p style="color:var(--danger); font-weight:600;"><strong>ประวัติการแพ้:</strong><br>${patient.allergies || 'ไม่มี'}</p>
                </div>

                <div class="card">
                  <h4 style="font-weight:700; margin-bottom:12px;">ประวัติบำบัดรักษาทั้งหมด (${doneVisits.length} ครั้ง)</h4>
                  ${doneVisits.length === 0 ? `<p style="color:var(--gray-400); text-align:center; padding:32px;">ไม่พบประวัติการเข้าตรวจ</p>` : 
                    doneVisits.map((v, index) => {
                      const ttm = v.ttmDiag || {};
                      const intake = v.ttmIntake || {};
                      return `
                        <div style="border:1px solid var(--gray-200); border-radius:var(--radius-md); padding:16px; margin-bottom:12px; font-size:13px; line-height:1.6;">
                          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--gray-100); padding-bottom:8px; margin-bottom:8px;">
                            <strong>ครั้งที่ ${doneVisits.length - index} : ${new Date(v.date).toLocaleDateString('th-TH')} (${v.time} น.)</strong>
                            ${ttm.diseaseGroup ? `<span class="badge primary">${ttm.diseaseGroup}</span>` : ''}
                          </div>
                          <p><strong>อาการแรกรับ:</strong> ${v.symptoms || '-'}</p>
                          <p><strong>วินิจฉัยแพทย์แผนไทย:</strong> <span style="color:var(--primary-hover); font-weight:700;">${v.diagnostics || '-'}</span></p>
                          
                          ${ttm.diseaseGroup ? `
                            <div style="background-color:var(--gray-50); padding:12px; border-radius:var(--radius-sm); margin:10px 0; font-size:12px; display:grid; grid-template-columns:1fr 1fr; gap:6px; border:1px solid var(--gray-100);">
                              <div><strong>ธาตุสมุฏฐาน:</strong> ${ttm.elementState || '-'}</div>
                              <div><strong>ชีพจรแพทย์แผนไทย:</strong> ${ttm.pulse || '-'}</div>
                              <div style="grid-column: span 2;"><strong>เส้นประธานสิบที่สัมพันธ์:</strong> ${ttm.lines && ttm.lines.length > 0 ? ttm.lines.join(', ') : 'ไม่มี'}</div>
                              <div><strong>อุตุสมุฏฐาน (ฤดู):</strong> ${ttm.season || '-'}</div>
                              <div><strong>กาลสมุฏฐาน (เวลา):</strong> ${intake.timeAggravated || 'ไม่ระบุ'}</div>
                              <div style="grid-column: span 2;"><strong>มูลเหตุเกิดโรค (พฤติกรรม):</strong> ${intake.behaviors && intake.behaviors.length > 0 ? intake.behaviors.join(', ') : 'ไม่มี'}</div>
                            </div>
                          ` : ''}

                          <p style="margin-top:6px;"><strong>หัตถการที่ทำ:</strong> ${v.treatments?.map(t => t.name).join(', ') || 'ไม่มี'}</p>
                          <p><strong>ยาสมุนไพรที่ได้รับ:</strong> ${v.prescriptions?.map(p => `${p.name} x${p.qty}`).join(', ') || 'ไม่มี'}</p>
                          
                          <div style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end; border-top:1px dashed var(--gray-200); padding-top:10px;">
                            <button class="btn btn-secondary btn-sm btn-edit-completed-visit" data-id="${v.id}">แก้ไขผลตรวจ</button>
                            <button class="btn btn-danger btn-sm btn-delete-completed-visit" data-id="${v.id}">ลบประวัติ</button>
                          </div>
                        </div>
                      `;
                    }).join('')
                  }
                </div>
              </div>
            `;
          })()}
        </div>
      </div>

      <!-- Tab Content 2: Daily Treatment Log -->
      <div id="sec-treatment-log" style="display: ${activePatientsTab === 'log' ? 'block' : 'none'};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <label for="log-date-picker" style="font-weight:600; font-size:14px;">เลือกวันที่ตรวจรักษา:</label>
            <input type="date" id="log-date-picker" class="form-control" style="width:200px;" value="${selectedLogDate}">
          </div>
          <span class="badge primary" style="font-size:13px; padding:6px 14px;">พบประวัติ ${completedTodayList.length} รายการ</span>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>เวลาตรวจ</th>
                <th>HN</th>
                <th>ชื่อคนไข้</th>
                <th>ธาตุ</th>
                <th>ผลการวินิจฉัย</th>
                <th>หัตถการ / ยาสมุนไพร</th>
                <th style="text-align:right;">ยอดชำระ</th>
                <th style="text-align:center;">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${completedTodayList.length === 0 ? `<tr><td colspan="8" style="text-align:center; color:var(--gray-400); padding:24px;">ไม่พบรายการรักษาที่เสร็จสิ้นในวันที่เลือก</td></tr>` : 
                completedTodayList.map(q => {
                  const saleObj = state.sales.find(s => s.queueId === q.id) || {};
                  // Preference to income_transactions
                  const v3Income = state.income_transactions?.find(inc => inc.queueId === q.id) || {};
                  const totalPaid = v3Income.netAmount !== undefined ? v3Income.netAmount : (saleObj.total || 0);

                  return `
                    <tr>
                      <td>${q.time} น.</td>
                      <td>HN-${String(q.patientId).padStart(4, '0')}</td>
                      <td><strong>${q.patientName}</strong></td>
                      <td><span class="badge secondary">${q.element || 'ไม่ระบุ'}</span></td>
                      <td><span style="font-size:13px;">${q.diagnostics || '-'}</span></td>
                      <td>
                        <div style="font-size:12px; color:var(--gray-700)">
                          <strong>หัตถการ:</strong> ${q.treatments?.map(t => t.name).join(', ') || 'ไม่มี'}<br>
                          <strong>สมุนไพร:</strong> ${q.prescriptions?.map(p => `${p.name} x${p.qty}`).join(', ') || 'ไม่มี'}
                        </div>
                      </td>
                      <td style="text-align:right; font-weight:600; color:var(--primary);">
                        ฿${totalPaid.toLocaleString()}
                      </td>
                      <td style="text-align:center;">
                        <button class="btn btn-primary btn-sm btn-edit-completed-visit" data-id="${q.id}">
                          แก้ไขและปรับแต่งประวัติ
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal: Edit Completed Visit Record -->
    <div class="modal-backdrop" id="modal-edit-visit" style="display:none;">
      <div class="modal-container" style="max-width:700px;">
        <div class="modal-header">
          <h3>แก้ไขและปรับแต่งประวัติการรักษาย้อนหลัง</h3>
          <button class="close-btn" id="modal-edit-visit-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-edit-visit">
            <input type="hidden" id="edit-visit-queue-id">
            
            <div style="background-color:var(--gray-50); padding:12px; border-radius:var(--radius-md); margin-bottom:16px; font-size:13px; line-height:1.6;">
              <span id="edit-visit-patient-meta"></span>
            </div>

            <div class="form-group">
              <label for="e-diagnostics"><strong>การวินิจฉัยแพทย์แผนไทย (Diagnosis) *</strong></label>
              <textarea id="e-diagnostics" rows="2" required></textarea>
            </div>

            <!-- Edit Services -->
            <div style="margin-top:16px;">
              <label><strong>รายการหัตถการ / สปา:</strong></label>
              <div style="display:flex; gap:10px; margin-bottom:8px;">
                <select id="edit-select-service" style="flex-grow:1;">
                  <option value="">-- เพิ่มหัตถการ คอร์ส หรือสปา --</option>
                  <optgroup label="หัตถการบำบัดรักษา">
                    ${state.inventory.filter(i => i.type === 'service').map(s => `<option value="${s.id}">${s.name} - ฿${s.price}</option>`).join('')}
                  </optgroup>
                  <optgroup label="คอร์สการรักษา">
                    ${state.inventory.filter(i => i.type === 'package').map(p => `<option value="${p.id}">${p.name} - ฿${p.price}</option>`).join('')}
                  </optgroup>
                </select>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-edit-add-service">เพิ่ม</button>
              </div>
              <div class="table-container" style="max-height:150px; overflow-y:auto; background-color:var(--gray-50); margin-bottom:12px;">
                <table id="tbl-edit-services">
                  <thead>
                    <tr>
                      <th>รายการหัตถการ</th>
                      <th style="text-align:right;">ราคา</th>
                      <th style="width:60px; text-align:center;">ลบ</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>

            <!-- Edit Prescriptions -->
            <div style="margin-top:16px;">
              <label><strong>ยาสมุนไพรที่ได้รับ:</strong></label>
              <div style="display:grid; grid-template-columns: 1fr 100px; gap:10px; margin-bottom:8px;">
                <select id="edit-select-medicine">
                  <option value="">-- เพิ่มยาสมุนไพร / ผลิตภัณฑ์ --</option>
                  <optgroup label="ยาสมุนไพร">
                    ${state.inventory.filter(i => i.type === 'medicine').map(m => `<option value="${m.id}">${m.name} - ฿${m.price}</option>`).join('')}
                  </optgroup>
                  <optgroup label="ผลิตภัณฑ์สุขภาพ">
                    ${state.inventory.filter(i => i.type === 'product').map(p => `<option value="${p.id}">${p.name} - ฿${p.price}</option>`).join('')}
                  </optgroup>
                </select>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-edit-add-medicine">เพิ่มยา</button>
              </div>
              <div class="table-container" style="max-height:150px; overflow-y:auto; background-color:var(--gray-50); margin-bottom:12px;">
                <table id="tbl-edit-prescriptions">
                  <thead>
                    <tr>
                      <th>ยาสมุนไพร/ผลิตภัณฑ์</th>
                      <th style="text-align:center; width:85px;">จำนวน</th>
                      <th style="text-align:right;">รวม</th>
                      <th style="width:60px; text-align:center;">ลบ</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>

            <!-- Discount Edit -->
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px; margin-top:16px;">
              <div class="form-group">
                <label for="e-discount">ส่วนลด (บาท)</label>
                <input type="number" id="e-discount" class="form-control" min="0">
              </div>
              <div class="form-group">
                <label for="e-discount-reason">โปรโมชั่น/เหตุผลลดราคา</label>
                <input type="text" id="e-discount-reason" class="form-control">
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; background-color:var(--primary-light); padding:12px; border-radius:var(--radius-md); font-weight:700;">
              <span>ยอดสุทธิหลังคำนวณใหม่:</span>
              <span style="color:var(--primary); font-size:16px;" id="lbl-edit-total">฿0</span>
            </div>

          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-cancel-edit-visit">ยกเลิก</button>
          <button class="btn btn-primary" form="form-edit-visit" type="submit">ยืนยันการบันทึกแก้ไข</button>
        </div>
      </div>
    </div>
  `;
}

export function setupMedicalRecordsEvents(state, navigate) {
  const modalEditVisit = document.getElementById('modal-edit-visit');

  // Tab switching
  const tabList = document.getElementById('tab-patient-list');
  const tabLog = document.getElementById('tab-treatment-log');
  const secList = document.getElementById('sec-patient-list');
  const secLog = document.getElementById('sec-treatment-log');

  tabList?.addEventListener('click', () => {
    activePatientsTab = 'list';
    tabList.classList.add('active');
    tabLog.classList.remove('active');
    if (secList) secList.style.display = 'block';
    if (secLog) secLog.style.display = 'none';
  });

  tabLog?.addEventListener('click', () => {
    activePatientsTab = 'log';
    tabLog.classList.add('active');
    tabList.classList.remove('active');
    if (secList) secList.style.display = 'none';
    if (secLog) secLog.style.display = 'block';
  });

  // Select patient
  document.getElementById('sel-history-patient')?.addEventListener('change', (e) => {
    window.activePatientHistoryId = Number(e.target.value);
    navigate('medical-records');
  });

  // Date picker
  document.getElementById('log-date-picker')?.addEventListener('change', (e) => {
    selectedLogDate = e.target.value;
    navigate('medical-records');
  });

  // Close Modals
  const closeEditVisitModal = () => modalEditVisit.style.display = 'none';
  document.getElementById('modal-edit-visit-close')?.addEventListener('click', closeEditVisitModal);
  document.getElementById('btn-cancel-edit-visit')?.addEventListener('click', closeEditVisitModal);

  // Edit Completed Visit tables update
  const updateEditTables = () => {
    const svdTbody = document.querySelector('#tbl-edit-services tbody');
    if (svdTbody) {
      svdTbody.innerHTML = editModalServices.map((s, idx) => `
        <tr>
          <td><strong>${s.name}</strong></td>
          <td style="text-align:right;">฿${s.price}</td>
          <td style="text-align:center;"><button type="button" class="btn btn-danger btn-sm btn-del-edit-svc" data-idx="${idx}">&times;</button></td>
        </tr>
      `).join('');
    }

    const medTbody = document.querySelector('#tbl-edit-prescriptions tbody');
    if (medTbody) {
      medTbody.innerHTML = editModalPrescriptions.map((m, idx) => `
        <tr>
          <td><strong>${m.name}</strong></td>
          <td style="text-align:center; width:85px;">
            <input type="number" value="${m.qty}" min="1" class="form-control input-edit-med-qty" data-idx="${idx}" style="padding:2px 6px; text-align:center;">
          </td>
          <td style="text-align:right;">฿${m.price * m.qty}</td>
          <td style="text-align:center;"><button type="button" class="btn btn-danger btn-sm btn-del-edit-med" data-idx="${idx}">&times;</button></td>
        </tr>
      `).join('');
    }

    const serviceSum = editModalServices.reduce((sum, s) => sum + s.price, 0);
    const prescriptionSum = editModalPrescriptions.reduce((sum, m) => sum + (m.price * m.qty), 0);
    const subtotal = serviceSum + prescriptionSum;
    const discount = Number(document.getElementById('e-discount').value) || 0;
    
    document.getElementById('lbl-edit-total').textContent = `฿${Math.max(0, subtotal - discount).toLocaleString()}`;
  };

  // Open Edit completed
  document.querySelectorAll('.btn-edit-completed-visit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const qId = Number(e.target.dataset.id);
      const queueObj = state.queues.find(q => q.id === qId);
      if (!queueObj) return;

      const saleObj = state.sales.find(s => s.queueId === qId) || {};
      const v3Income = state.income_transactions?.find(inc => inc.queueId === qId) || {};
      const tempSubtotal = (queueObj.treatments || []).reduce((sum, s) => sum + s.price, 0) + (queueObj.prescriptions || []).reduce((sum, m) => sum + (m.price * (m.qty || 1)), 0);
      const finalDiscount = v3Income.netAmount !== undefined ? (tempSubtotal - v3Income.netAmount) : (saleObj.discount || 0);

      document.getElementById('edit-visit-queue-id').value = qId;
      document.getElementById('edit-visit-patient-meta').innerHTML = `
        <strong>คนไข้:</strong> ${queueObj.patientName} (HN-${String(queueObj.patientId).padStart(4, '0')})<br>
        <strong>วันที่ตรวจ:</strong> ${new Date(queueObj.date).toLocaleDateString('th-TH')} | <strong>เวลา:</strong> ${queueObj.time} น.
      `;
      document.getElementById('e-diagnostics').value = queueObj.diagnostics || '';
      document.getElementById('e-discount').value = saleObj.discount || 0;
      document.getElementById('e-discount-reason').value = saleObj.discountReason || '';

      editModalServices = [...(queueObj.treatments || [])];
      editModalPrescriptions = [...(queueObj.prescriptions || [])];

      updateEditTables();
      modalEditVisit.style.display = 'flex';
    });
  });

  document.getElementById('e-discount')?.addEventListener('input', updateEditTables);

  // Add Service in Edit
  document.getElementById('btn-edit-add-service')?.addEventListener('click', () => {
    const sId = document.getElementById('edit-select-service').value;
    if (!sId) return;
    const item = state.inventory.find(i => i.id === Number(sId));
    editModalServices.push({ itemId: item.id, name: item.name, price: item.price, type: item.type });
    updateEditTables();
  });

  // Remove Service in Edit
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-del-edit-svc')) {
      const idx = Number(e.target.dataset.idx);
      editModalServices.splice(idx, 1);
      updateEditTables();
    }
  });

  // Add Medicine in Edit
  document.getElementById('btn-edit-add-medicine')?.addEventListener('click', () => {
    const mId = document.getElementById('edit-select-medicine').value;
    if (!mId) return;
    const item = state.inventory.find(i => i.id === Number(mId));
    
    const existing = editModalPrescriptions.find(p => p.itemId === item.id);
    if (existing) {
      existing.qty += 1;
    } else {
      editModalPrescriptions.push({ itemId: item.id, name: item.name, qty: 1, price: item.price, unit: item.unit });
    }
    updateEditTables();
  });

  // Change Qty in Edit
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('input-edit-med-qty')) {
      const idx = Number(e.target.dataset.idx);
      const val = Number(e.target.value);
      if (val >= 1) {
        editModalPrescriptions[idx].qty = val;
        updateEditTables();
      }
    }
  });

  // Remove Medicine in Edit
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-del-edit-med')) {
      const idx = Number(e.target.dataset.idx);
      editModalPrescriptions.splice(idx, 1);
      updateEditTables();
    }
  });

  // Submit Completed visit edits
  document.getElementById('form-edit-visit')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const qId = Number(document.getElementById('edit-visit-queue-id').value);
    const queueObj = state.queues.find(q => q.id === qId);
    if (!queueObj) return;

    // VALIDATION check discount amount
    const discount = Number(document.getElementById('e-discount').value) || 0;
    if (discount < 0) {
      alert('จำนวนส่วนลดห้ามติดลบ!');
      return;
    }

    // Update Queue
    queueObj.diagnostics = document.getElementById('e-diagnostics').value;
    queueObj.treatments = editModalServices;
    queueObj.prescriptions = editModalPrescriptions;
    await ClinicDB.updateQueue(queueObj);

    // Update Sales & Income Transactions (V3)
    const serviceSum = editModalServices.reduce((sum, s) => sum + s.price, 0);
    const prescriptionSum = editModalPrescriptions.reduce((sum, m) => sum + (m.price * m.qty), 0);
    const subtotal = serviceSum + prescriptionSum;
    const total = Math.max(0, subtotal - discount);

    const saleObj = state.sales.find(s => s.queueId === qId);
    if (saleObj) {
      saleObj.items = [
        ...editModalServices.map(t => ({ name: t.name, price: t.price, qty: 1 })),
        ...editModalPrescriptions.map(p => ({ name: p.name, price: p.price, qty: p.qty }))
      ];
      saleObj.subtotal = subtotal;
      saleObj.discount = discount;
      saleObj.discountReason = document.getElementById('e-discount-reason').value;
      saleObj.total = total;
      await ClinicDB.addSale(saleObj);
    }

    // V3 store edit
    const v3Income = state.income_transactions?.find(inc => inc.queueId === qId);
    if (v3Income) {
      v3Income.netAmount = total;
      await ClinicDB.putStoreData('income_transactions', v3Income);
    }

    state.queues = await ClinicDB.getQueues();
    state.sales = await ClinicDB.getSales();
    state.income_transactions = await ClinicDB.getStoreData('income_transactions');

    alert('บันทึกปรับปรุงข้อมูลประวัติการรักษาและการเงินย้อนหลังเสร็จสิ้น!');
    closeEditVisitModal();
    navigate('medical-records');
  });

  // Delete completed visit record
  document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-delete-completed-visit')) {
      const qId = Number(e.target.dataset.id);
      if (confirm('คุณแน่ใจว่าต้องการลบประวัติการตรวจรักษาและการเงินย้อนหลังรายการนี้ออกจากระบบอย่างถาวร? (การกระทำนี้ไม่สามารถย้อนกลับได้)')) {
        // Delete queue
        await ClinicDB.deleteQueue(qId);
        
        // Delete associated sale
        const saleObj = state.sales.find(s => s.queueId === qId);
        if (saleObj) {
          await ClinicDB.deleteStoreData('sales', saleObj.id);
        }
        
        // Delete associated income transaction
        const v3Income = state.income_transactions?.find(inc => inc.queueId === qId);
        if (v3Income) {
          await ClinicDB.deleteStoreData('income_transactions', v3Income.id);
        }
        
        // Delete associated medical record
        const queueObj = state.queues.find(q => q.id === qId);
        if (queueObj) {
          const medRecord = state.medical_records?.find(m => m.patientId === queueObj.patientId && m.date === queueObj.date);
          if (medRecord) {
            await ClinicDB.deleteStoreData('medical_records', medRecord.id);
          }
        }
        
        state.queues = await ClinicDB.getQueues();
        state.sales = await ClinicDB.getSales();
        state.income_transactions = await ClinicDB.getStoreData('income_transactions');
        state.medical_records = await ClinicDB.getStoreData('medical_records');
        
        alert('ลบประวัติการรักษาย้อนหลังสำเร็จแล้ว!');
        navigate('medical-records');
      }
    }
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 6. SERVICE RECORDS PAGE (บันทึกบริการ)
// -------------------------------------------------------------
export function renderServiceRecords(state) {
  if (state.patients.length === 0) {
    return `
      ${renderSeedDataBanner(state)}
      <div class="page-header">
        <h2>ลงบันทึกข้อมูลบริการสปา / ความงาม</h2>
      </div>
      <div class="card" style="text-align:center; padding:48px; color:var(--gray-500);">
        <h3>กรุณาลงทะเบียนประวัติลูกค้าในหน้ารายชื่อก่อน จึงจะสามารถทำหัตถการได้</h3>
        <button class="btn btn-primary" id="btn-go-cust-spa" style="margin-top:16px;">ไปยังหน้ารายชื่อลูกค้า</button>
      </div>
    `;
  }

  const pId = window.activeServicePatientId || state.patients[0].id;
  const patient = state.patients.find(p => p.id === pId) || state.patients[0];

  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>บันทึกข้อมูลบริการสปาและหัตถการเฉพาะครั้ง</h2>
        <p>บันทึกประวัติการดูแล ความพึงพอใจ และ Pain Score ของ: <strong>${patient.name}</strong></p>
      </div>
      <button class="btn btn-secondary" id="btn-back-cust-spa">กลับหน้ารวมลูกค้า</button>
    </div>

    <!-- Patient Switcher Form -->
    <div class="card" style="max-width:700px; margin: 0 auto 16px auto; padding:16px;">
      <div class="form-group" style="margin-bottom:0; display:flex; align-items:center; gap:12px;">
        <label for="sel-service-patient" style="font-weight:700; margin:0; color:var(--primary); white-space:nowrap;">เลือกประวัติลูกค้าทำหัตถการ:</label>
        <select id="sel-service-patient" class="form-control" style="margin:0;">
          ${state.patients.map(p => `<option value="${p.id}" ${p.id === patient.id ? 'selected' : ''}>HN-${String(p.id).padStart(4, '0')} - ${p.name} (เบอร์: ${p.phone})</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="card" style="max-width:700px; margin: 0 auto;">
      <form id="form-spa-service">
        <input type="hidden" id="s-pat-id" value="${patient.id}">
        
        <div class="form-group">
          <label><strong>1. ระดับความเจ็บปวดก่อนทำบริการ (Pain Score ก่อน - สเกล 0-10)</strong></label>
          <div style="display:flex; align-items:center; gap:16px; margin-top:8px;">
            <input type="range" id="s-pain-before" min="0" max="10" value="5" style="flex-grow:1;">
            <span id="lbl-pain-before" style="font-weight:700; font-size:18px; color:var(--primary);">5</span>
          </div>
        </div>

        <div class="form-group">
          <label><strong>2. ระดับความเจ็บปวดหลังบริการ (Pain Score หลัง - สเกล 0-10)</strong></label>
          <div style="display:flex; align-items:center; gap:16px; margin-top:8px;">
            <input type="range" id="s-pain-after" min="0" max="10" value="2" style="flex-grow:1;">
            <span id="lbl-pain-after" style="font-weight:700; font-size:18px; color:var(--success);">2</span>
          </div>
        </div>

        <div class="form-group">
          <label for="s-symptoms">อาการหลักที่ต้องการบำบัดรักษา / ทำสปา *</label>
          <textarea id="s-symptoms" rows="2" required placeholder="ระบุเช่น นวดหน้ายกกระชับลดเลือนริ้วรอย, นวดคลายกล้ามเนื้อหลังช่วงล่าง"></textarea>
        </div>

        <div class="form-group">
          <label for="s-details">รายละเอียดขั้นตอนการบำบัดบริการที่ทำให้ลูกค้า *</label>
          <textarea id="s-details" rows="3" required placeholder="เช่น นวดไทยเชลยศักดิ์เน้นสะบักจม 30 นาที, ประคบอุ่นด้วยลูกประคบสด 15 นาที"></textarea>
        </div>

        <div class="form-group">
          <label for="s-advice">คำแนะนำในการปฏิบัติตนและดูแลหลังบริการสปา</label>
          <textarea id="s-advice" rows="2" placeholder="เช่น หลีกเลี่ยงการอาบน้ำอุ่นจัดทันที, ดื่มน้ำอุ่นบ่อยๆ งดน้ำเย็นจัด"></textarea>
        </div>

        <div style="margin-top:24px; display:flex; justify-content:flex-end; gap:12px;">
          <button type="submit" class="btn btn-primary" style="width:100%;">
            บันทึกบริการลูกค้าและส่งชำระเงิน
          </button>
        </div>
      </form>
    </div>
  `;
}

export function setupServiceRecordsEvents(state, navigate) {
  document.getElementById('btn-go-cust-spa')?.addEventListener('click', () => navigate('customers'));
  document.getElementById('btn-back-cust-spa')?.addEventListener('click', () => {
    window.activeServicePatientId = null;
    navigate('customers');
  });

  document.getElementById('sel-service-patient')?.addEventListener('change', (e) => {
    window.activeServicePatientId = Number(e.target.value);
    navigate('service-records');
  });

  const painBefore = document.getElementById('s-pain-before');
  const painAfter = document.getElementById('s-pain-after');

  painBefore?.addEventListener('input', (e) => {
    document.getElementById('lbl-pain-before').textContent = e.target.value;
  });
  painAfter?.addEventListener('input', (e) => {
    document.getElementById('lbl-pain-after').textContent = e.target.value;
  });

  document.getElementById('form-spa-service')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pId = Number(document.getElementById('s-pat-id').value);
    const patient = state.patients.find(p => p.id === pId);

    // VALIDATION: pain scores bounds check
    const pBeforeVal = Number(painBefore.value);
    const pAfterVal = Number(painAfter.value);
    if (pBeforeVal < 0 || pBeforeVal > 10 || pAfterVal < 0 || pAfterVal > 10) {
      alert('ข้อผิดพลาด: ค่าความเจ็บปวด Pain Score ต้องอยู่ระหว่าง 0 ถึง 10 เท่านั้น!');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    // Store log to V3 store service_records
    const record = {
      patientId: pId,
      painBefore: pBeforeVal,
      painAfter: pAfterVal,
      symptoms: document.getElementById('s-symptoms').value,
      details: document.getElementById('s-details').value,
      advice: document.getElementById('s-advice').value,
      date: todayStr,
      time: timeStr
    };
    await ClinicDB.addStoreData('service_records', record);

    // Register a completed queue visit for billing
    const newQueue = {
      patientId: pId,
      patientName: patient.name,
      status: 'billing', 
      date: todayStr,
      time: timeStr,
      element: patient.element,
      vitals: { bp: '-', pulse: '-', temp: '-', weight: '-' },
      symptoms: document.getElementById('s-symptoms').value,
      diagnostics: `ทำบริการสปาบำบัด (Pain Score: ${pBeforeVal} -> ${pAfterVal})`,
      treatments: [{ itemId: 0, name: document.getElementById('s-details').value.substring(0, 45) + '...', price: 500, type: 'service' }],
      prescriptions: []
    };

    await ClinicDB.addQueue(newQueue);
    state.queues = await ClinicDB.getQueues();
    state.service_records = await ClinicDB.getStoreData('service_records');
    
    // Set for billing and direct route
    window.activeBillingQueueId = state.queues[state.queues.length - 1].id;
    window.activeServicePatientId = null;
    alert(`บันทึกสปาสำเร็จ! ส่งยอดค่าบริการ ฿500 ของคนไข้ ${patient.name} ไปรอชำระเงิน`);
    navigate('billing');
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 7. CONSULTATION PAGE (ห้องตรวจ)
// -------------------------------------------------------------
export function renderConsultation(state) {
  const activeQId = window.activeConsultQueueId;
  const queueObj = state.queues.find(q => q.id === activeQId);

  if (!queueObj) {
    const consultingQueues = state.queues.filter(q => q.status === 'consulting');
    return `
      ${renderSeedDataBanner(state)}
      <div class="page-header">
        <div class="page-title-desc">
          <h2>ห้องตรวจประเมินโรคแพทย์แผนไทยและการวิเคราะห์ธาตุ</h2>
          <p>พื้นที่สำหรับแพทย์ผู้ประกอบวิชาชีพตรวจวินิจฉัยธาตุเจ้าเรือน ชีพจร และสั่งจ่ายยา/หัตถการแก่คนไข้ในคิว</p>
        </div>
        <button class="btn btn-primary" id="btn-to-queue-board">ไปยังบอร์ดจัดการคิว</button>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <h3 style="font-weight:700; margin-bottom:14px; color:var(--primary); display:flex; align-items:center; gap:8px;">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          รายชื่อคนไข้รอรับการวินิจฉัย (ห้องแพทย์)
        </h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>HN</th>
                <th>ชื่อคนไข้</th>
                <th>อาการแรกรับ</th>
                <th>สัญญาณชีพแรกรับ</th>
                <th style="width:180px; text-align:center;">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              ${consultingQueues.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align:center; padding:36px; color:var(--gray-400);">
                    ไม่มีคิวรอพบแพทย์ขณะนี้ คุณสามารถส่งรายชื่อเข้าพบแพทย์ได้ที่หน้าเมนู "คิววันนี้"
                  </td>
                </tr>
              ` : consultingQueues.map(q => `
                <tr>
                  <td>HN-${String(q.patientId).padStart(4, '0')}</td>
                  <td><strong>${q.patientName}</strong></td>
                  <td><span style="font-style:italic;">"${q.symptoms || '-'}"</span></td>
                  <td>
                    ${q.vitals ? `BP: ${q.vitals.bp || '-'} | PR: ${q.vitals.pulse || '-'} | Temp: ${q.vitals.temp || '-'}°C` : '-'}
                  </td>
                  <td style="text-align:center;">
                    <button class="btn btn-primary btn-sm btn-start-consult-direct" data-id="${q.id}">เริ่มตรวจ / วินิจฉัย</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="background-color:var(--gray-50); border:1px dashed var(--gray-300);">
        <h4 style="font-weight:700; margin-bottom:8px;">💡 คำแนะนำบทบาทห้องตรวจแพทย์แผนไทย</h4>
        <p style="font-size:13px; color:var(--gray-600); line-height:1.6;">
          ห้องตรวจแพทย์แผนไทยเป็นพื้นที่เฉพาะทางสำหรับ **หมอแผนไทย/แพทย์ประยุกต์** เพื่อตรวจจับชีพจรทางแผนไทย, บันทึกเส้นประธานสิบที่สัมพันธ์กับโรค, วิเคราะห์สมุฏฐาน 4 (ธาตุ, อุตุ, อายุ, กาล) และสั่งยาตำรับสมุนไพรเดี่ยว/ตำรับรวมเข้าสู่ห้องบิลเงินสดและหัตถการต่อไป
        </p>
      </div>
    `;
  }

  const patientObj = state.patients.find(p => p.id === queueObj.patientId) || {};
  const medicines = state.inventory.filter(i => i.type === 'medicine');
  const products = state.inventory.filter(i => i.type === 'product');
  const services = state.inventory.filter(i => i.type === 'service');
  const packages = state.inventory.filter(i => i.type === 'package');

  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ห้องตรวจประเมินโรคแพทย์แผนไทยและการวิเคราะห์ธาตุ</h2>
        <p>คนไข้รับการตรวจ: <strong>${queueObj.patientName} (HN-${String(queueObj.patientId).padStart(4, '0')})</strong></p>
      </div>
      <button class="btn btn-secondary" id="btn-consult-exit">กลับบอร์ดคิว</button>
    </div>

    <div class="grid-cols-2" style="grid-template-columns: 300px 1fr;">
      <!-- Patient card info -->
      <div class="card">
        <h4 style="font-weight:700; margin-bottom:12px; border-bottom:1px solid var(--gray-200); padding-bottom:6px;">สรุปเวชระเบียน</h4>
        <div class="finance-stats" style="gap:8px; font-size:13px;">
          <p><strong>ชื่อ-นามสกุล:</strong> ${patientObj.name}</p>
          <p><strong>อายุ:</strong> ${patientObj.birthdate ? new Date().getFullYear() - new Date(patientObj.birthdate).getFullYear() : '-'} ปี</p>
          <p><strong>ธาตุเจ้าเรือน:</strong> ${patientObj.element || 'ไม่ระบุ'}</p>
          <p style="color:var(--danger)"><strong>โรคประจำตัว:</strong> ${patientObj.congenitalDiseases || 'ไม่มี'}</p>
          <p style="color:var(--danger)"><strong>แพ้ยา:</strong> ${patientObj.allergies || 'ไม่มี'}</p>
          <p style="background-color:var(--gray-100); padding:8px; border-radius:var(--radius-sm);"><strong>อาการ:</strong> "${queueObj.symptoms}"</p>
        </div>
      </div>

      <!-- Treatment and Prescription Form -->
      <div class="card">
        <form id="form-consult-med">
          <div class="form-group">
            <label for="c-diag">การวินิจฉัย/วิเคราะห์สาเหตุความเจ็บป่วยตามธาตุเจ้าเรือน *</label>
            <textarea id="c-diag" rows="2" required placeholder="ระบุวินิจฉัย เช่น ลมปลายปัตคาดสัญญาณ 4 บ่าตึง">${queueObj.diagnostics || ''}</textarea>
          </div>

          <!-- TTM Specific Fields Grid -->
          <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
          <!-- TTM Specific Fields Grid -->
          <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
            <div class="form-group">
              <label for="c-ttm-disease">กลุ่มโรคเฉพาะทางแพทย์แผนไทย *</label>
              <input type="text" id="c-ttm-disease" list="dl-disease" class="form-control" placeholder="เลือกหรือพิมพ์กลุ่มโรค..." value="${queueObj.ttmDiag?.diseaseGroup || ''}" required>
              <datalist id="dl-disease">
                ${state.disease_groups.map(g => `<option value="${g}"></option>`).join('')}
              </datalist>
            </div>
            <div class="form-group">
              <label for="c-ttm-element">ธาตุสมุฏฐานที่พิการ / กำเริบ *</label>
              <input type="text" id="c-ttm-element" list="dl-element" class="form-control" placeholder="เลือกหรือพิมพ์สถานะธาตุ..." value="${queueObj.ttmDiag?.elementState || ''}" required>
              <datalist id="dl-element">
                ${state.element_states.map(e => `<option value="${e}"></option>`).join('')}
              </datalist>
            </div>
          </div>

          <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
            <div class="form-group">
              <label for="c-ttm-pulse">การตรวจชีพจรแพทย์แผนไทย (Pulse)</label>
              <input type="text" id="c-ttm-pulse" list="dl-pulse" class="form-control" placeholder="เลือกหรือพิมพ์อาการชีพจร..." value="${queueObj.ttmDiag?.pulse || ''}">
              <datalist id="dl-pulse">
                ${state.pulses.map(p => `<option value="${p}"></option>`).join('')}
              </datalist>
            </div>
            <div class="form-group">
              <label for="c-ttm-season">อุตุสมุฏฐาน (ฤดูกาลที่ส่งผลต่อโรค)</label>
              <input type="text" id="c-ttm-season" list="dl-season" class="form-control" placeholder="เลือกหรือพิมพ์ฤดูกาล..." value="${queueObj.ttmDiag?.season || ''}">
              <datalist id="dl-season">
                ${state.seasons.map(s => `<option value="${s}"></option>`).join('')}
              </datalist>
            </div>
          </div>

          <!-- TTM History/Intake moved from queue -->
          <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
            <div class="form-group">
              <label for="c-gala">กาลสมุฏฐาน (ช่วงเวลาที่ปวด/โรคกำเริบ) *</label>
              <input type="text" id="c-gala" list="dl-gala" class="form-control" placeholder="เลือกหรือพิมพ์ช่วงเวลา..." value="${queueObj.ttmIntake?.timeAggravated || 'ไม่ระบุ'}" required>
              <datalist id="dl-gala">
                ${state.gala_times.map(t => `<option value="${t}"></option>`).join('')}
              </datalist>
            </div>
            <div class="form-group">
              <label>มูลเหตุเกิดโรคแผนไทย (พฤติกรรมก่อโรคหลัก)</label>
              <div style="display: grid; grid-template-columns: 1fr; gap: 4px; margin-top:6px; font-size:12px;">
                <label style="font-weight: 500; display:flex; align-items:center; gap:6px;"><input type="checkbox" class="chk-c-behav" value="เสวยอาหารรสจัด/เกินพิกัด" ${queueObj.ttmIntake?.behaviors?.includes('เสวยอาหารรสจัด/เกินพิกัด') ? 'checked' : ''}> กินอาหารรสจัด/ผิดเวลา</label>
                <label style="font-weight: 500; display:flex; align-items:center; gap:6px;"><input type="checkbox" class="chk-c-behav" value="อดนอน/นอนดึก" ${queueObj.ttmIntake?.behaviors?.includes('อดนอน/นอนดึก') ? 'checked' : ''}> อดนอน/นอนดึก</label>
                <label style="font-weight: 500; display:flex; align-items:center; gap:6px;"><input type="checkbox" class="chk-c-behav" value="ทำงานหักโหมเกินกำลัง" ${queueObj.ttmIntake?.behaviors?.includes('ทำงานหักโหมเกินกำลัง') ? 'checked' : ''}> ทำงานหักโหม/อิริยาบถผิด</label>
                <label style="font-weight: 500; display:flex; align-items:center; gap:6px;"><input type="checkbox" class="chk-c-behav" value="กลั้นปัสสาวะ/อุจจาระ" ${queueObj.ttmIntake?.behaviors?.includes('กลั้นปัสสาวะ/อุจจาระ') ? 'checked' : ''}> กลั้นขับถ่าย</label>
                <label style="font-weight: 500; display:flex; align-items:center; gap:6px;"><input type="checkbox" class="chk-c-behav" value="กระทบเย็นหรือร้อนจัด" ${queueObj.ttmIntake?.behaviors?.includes('กระทบเย็นหรือร้อนจัด') ? 'checked' : ''}> กระทบเย็นหรือร้อนจัด</label>
                <label style="font-weight: 500; display:flex; align-items:center; gap:6px;"><input type="checkbox" class="chk-c-behav" value="อารมณ์เศร้าโศก/โกรธง่าย" ${queueObj.ttmIntake?.behaviors?.includes('อารมณ์เศร้าโศก/โกรธง่าย') ? 'checked' : ''}> โทสะ/โกรธง่ายฉุนเฉียว</label>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>เส้นประธานสิบที่เกี่ยวข้อง / ติดขัด (เลือกได้มากกว่า 1)</label>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; font-size:12px; margin-top:6px; margin-bottom:12px;">
              <label style="font-weight:500; display:flex; align-items:center; gap:4px;"><input type="checkbox" class="chk-ttm-line" value="อิทา"> อิทา</label>
              <label style="font-weight:500; display:flex; align-items:center; gap:4px;"><input type="checkbox" class="chk-ttm-line" value="ปิงคลา"> ปิงคลา</label>
              <label style="font-weight:500; display:flex; align-items:center; gap:4px;"><input type="checkbox" class="chk-ttm-line" value="สุมนา"> สุมนา</label>
              <label style="font-weight:500; display:flex; align-items:center; gap:4px;"><input type="checkbox" class="chk-ttm-line" value="กาลทารี"> กาลทารี</label>
              <label style="font-weight:500; display:flex; align-items:center; gap:4px;"><input type="checkbox" class="chk-ttm-line" value="สหัสรังสี"> สหัสรังสี</label>
              <label style="font-weight:500; display:flex; align-items:center; gap:4px;"><input type="checkbox" class="chk-ttm-line" value="ทวารี"> ทวารี</label>
              <label style="font-weight:500; display:flex; align-items:center; gap:4px;"><input type="checkbox" class="chk-ttm-line" value="จันทภูสัง"> จันทภูสัง</label>
              <label style="font-weight:500; display:flex; align-items:center; gap:4px;"><input type="checkbox" class="chk-ttm-line" value="รุชำ"> รุชำ</label>
              <label style="font-weight:500; display:flex; align-items:center; gap:4px;"><input type="checkbox" class="chk-ttm-line" value="สุขุมัง"> สุขุมัง</label>
              <label style="font-weight:500; display:flex; align-items:center; gap:4px;"><input type="checkbox" class="chk-ttm-line" value="สิขิณี"> สิขิณี</label>
            </div>
          </div>

          <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
            <div class="form-group">
              <label for="c-anatomy">ตำแหน่งของอาการปวดตึง (บริเวณร่างกาย)</label>
              <select id="c-anatomy">
                <option value="บริเวณบ่าและสะบัก">บ่าและสะบัก</option>
                <option value="บริเวณกล้ามเนื้อหลังช่วงล่าง">กล้ามเนื้อหลังช่วงล่าง</option>
                <option value="บริเวณขาทั้งสองข้าง">ขาทั้งสองข้าง</option>
                <option value="บริเวณขมับและศีรษะ">ขมับและศีรษะ</option>
                <option value="บริเวณช่วงหน้าและลำคอ">ช่วงหน้าและลำคอ</option>
              </select>
            </div>
            <div class="form-group">
              <label for="c-symptom-type">ลักษณะอาการสำคัญที่คนไข้แจ้ง</label>
              <select id="c-symptom-type">
                <option value="ปวดตึงหน่วง">ปวดตึงหน่วงเกร็ง</option>
                <option value="ปวดชาบ่อยๆ">ปวดชาเสียวแปลบ</option>
                <option value="ปวดร้าวลงแขน/ขา">ปวดร้าวแผ่ซ่าน</option>
                <option value="อื่นๆ">อาการเจ็บไข้ทั่วไป</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label style="color:var(--danger)">ข้อห้าม / ข้อควรระวังพิเศษทางหัตถการ</label>
            <input type="text" class="form-control" id="c-contraindications" placeholder="เช่น หลีกเลี่ยงแรงกดจุดหัวใจ, สตรีมีครรภ์งดทำหัตถการลึก">
          </div>

          <!-- Add Services -->
          <div class="form-group">
            <label>สั่งรายการบริการบำบัด / คอร์ส:</label>
            <div style="display:flex; gap:10px; margin-bottom:8px;">
              <select id="sel-svc" style="flex-grow:1;">
                <option value="">-- เลือกหัตถการหรือคอร์ส --</option>
                <optgroup label="บริการรายครั้ง">
                  ${services.map(s => `<option value="${s.id}">${s.name} - ฿${s.price}</option>`).join('')}
                </optgroup>
                <optgroup label="ซื้อคอร์สบำบัด">
                  ${packages.map(p => `<option value="${p.id}">${p.name} - ฿${p.price}</option>`).join('')}
                </optgroup>
              </select>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-add-svc">เพิ่ม</button>
            </div>
            <div class="table-container" style="background-color:var(--gray-50);">
              <table id="tbl-consult-svcs">
                <thead>
                  <tr>
                    <th>รายการบริการ</th>
                    <th style="text-align:right;">ราคา</th>
                    <th style="width:60px; text-align:center;">ลบ</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          </div>

          <!-- Add Herbs -->
          <div class="form-group">
            <label>จ่ายยาสมุนไพรและผลิตภัณฑ์สุขภาพ:</label>
            <div style="display:grid; grid-template-columns: 1fr 100px; gap:10px; margin-bottom:8px;">
              <select id="sel-med">
                <option value="">-- เลือกยาหรือผลิตภัณฑ์คลัง --</option>
                ${medicines.map(m => `<option value="${m.id}" ${m.stock < 1 ? 'disabled style="color:red;"' : ''}>${m.name} [คงคลัง ${m.stock}] - ฿${m.price}</option>`).join('')}
                ${products.map(p => `<option value="${p.id}" ${p.stock < 1 ? 'disabled style="color:red;"' : ''}>${p.name} [คงคลัง ${p.stock}] - ฿${p.price}</option>`).join('')}
              </select>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-add-med">จ่ายยา</button>
            </div>
            <div class="table-container" style="background-color:var(--gray-50);">
              <table id="tbl-consult-meds">
                <thead>
                  <tr>
                    <th>ยาสมุนไพร / ยาเดี่ยว</th>
                    <th style="text-align:center; width:80px;">จำนวน</th>
                    <th style="text-align:right;">รวม</th>
                    <th style="width:60px; text-align:center;">ลบ</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          </div>

          <div style="margin-top:24px; display:flex; justify-content:flex-end; gap:12px;">
            <button type="submit" class="btn btn-primary" style="width:100%;">
              บันทึกผลการตรวจและส่งคิวบำบัด / สปา
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function setupConsultationEvents(state, navigate) {
  const activeQId = window.activeConsultQueueId;
  const queueObj = state.queues.find(q => q.id === activeQId);
  if (!queueObj) {
    document.getElementById('btn-to-queue-board')?.addEventListener('click', () => navigate('queue'));
    document.querySelectorAll('.btn-start-consult-direct').forEach(btn => {
      btn.addEventListener('click', (e) => {
        window.activeConsultQueueId = Number(e.target.closest('button').dataset.id);
        navigate('consultation');
      });
    });
    return;
  }

  document.getElementById('btn-consult-exit')?.addEventListener('click', () => {
    window.activeConsultQueueId = null;
    navigate('queue');
  });

  let selectedServices = [...(queueObj.treatments || [])];
  let selectedPrescriptions = [...(queueObj.prescriptions || [])];

  const refreshUI = () => {
    const svcsTbody = document.querySelector('#tbl-consult-svcs tbody');
    if (svcsTbody) {
      svcsTbody.innerHTML = selectedServices.map((s, idx) => `
        <tr>
          <td><strong>${s.name}</strong></td>
          <td style="text-align:right;">฿${s.price}</td>
          <td style="text-align:center;"><button type="button" class="btn btn-danger btn-sm btn-rm-svc" data-idx="${idx}">&times;</button></td>
        </tr>
      `).join('');
    }

    const medsTbody = document.querySelector('#tbl-consult-meds tbody');
    if (medsTbody) {
      medsTbody.innerHTML = selectedPrescriptions.map((m, idx) => `
        <tr>
          <td><strong>${m.name}</strong></td>
          <td style="text-align:center;">${m.qty} ${m.unit}</td>
          <td style="text-align:right;">฿${m.price * m.qty}</td>
          <td style="text-align:center;"><button type="button" class="btn btn-danger btn-sm btn-rm-med" data-idx="${idx}">&times;</button></td>
        </tr>
      `).join('');
    }
  };

  refreshUI();

  document.getElementById('btn-add-svc')?.addEventListener('click', () => {
    const id = document.getElementById('sel-svc').value;
    if (!id) return;
    const item = state.inventory.find(i => i.id === Number(id));
    selectedServices.push({ itemId: item.id, name: item.name, price: item.price, type: item.type });
    document.getElementById('sel-svc').value = '';
    refreshUI();
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-rm-svc')) {
      const idx = Number(e.target.dataset.idx);
      selectedServices.splice(idx, 1);
      refreshUI();
    }
  });

  document.getElementById('btn-add-med')?.addEventListener('click', () => {
    const id = document.getElementById('sel-med').value;
    if (!id) return;
    const item = state.inventory.find(i => i.id === Number(id));
    
    const existing = selectedPrescriptions.find(p => p.itemId === item.id);
    if (existing) {
      existing.qty += 1;
    } else {
      selectedPrescriptions.push({ itemId: item.id, name: item.name, qty: 1, price: item.price, unit: item.unit || 'ชิ้น' });
    }
    document.getElementById('sel-med').value = '';
    refreshUI();
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-rm-med')) {
      const idx = Number(e.target.dataset.idx);
      selectedPrescriptions.splice(idx, 1);
      refreshUI();
    }
  });

  document.getElementById('form-consult-med')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Gather TTM details
    const lines = [];
    document.querySelectorAll('.chk-ttm-line:checked').forEach(el => {
      lines.push(el.value);
    });

    const behaviors = [];
    document.querySelectorAll('.chk-c-behav:checked').forEach(el => {
      behaviors.push(el.value);
    });

    const diseaseVal = document.getElementById('c-ttm-disease').value.trim();
    const elementVal = document.getElementById('c-ttm-element').value.trim();
    const pulseVal = document.getElementById('c-ttm-pulse').value.trim();
    const seasonVal = document.getElementById('c-ttm-season').value.trim();
    const galaVal = document.getElementById('c-gala').value.trim();

    // Check if new and add to datalist suggestions in clinic_settings IndexedDB
    if (diseaseVal && !state.disease_groups.includes(diseaseVal)) {
      state.disease_groups.push(diseaseVal);
      await ClinicDB.putStoreData('clinic_settings', { key: 'disease_groups', list: state.disease_groups });
    }
    if (elementVal && !state.element_states.includes(elementVal)) {
      state.element_states.push(elementVal);
      await ClinicDB.putStoreData('clinic_settings', { key: 'element_states', list: state.element_states });
    }
    if (pulseVal && !state.pulses.includes(pulseVal)) {
      state.pulses.push(pulseVal);
      await ClinicDB.putStoreData('clinic_settings', { key: 'pulses', list: state.pulses });
    }
    if (seasonVal && !state.seasons.includes(seasonVal)) {
      state.seasons.push(seasonVal);
      await ClinicDB.putStoreData('clinic_settings', { key: 'seasons', list: state.seasons });
    }
    if (galaVal && !state.gala_times.includes(galaVal)) {
      state.gala_times.push(galaVal);
      await ClinicDB.putStoreData('clinic_settings', { key: 'gala_times', list: state.gala_times });
    }

    const ttmDiag = {
      diseaseGroup: diseaseVal,
      elementState: elementVal,
      pulse: pulseVal,
      season: seasonVal,
      lines: lines
    };

    queueObj.diagnostics = document.getElementById('c-diag').value;
    queueObj.treatments = selectedServices;
    queueObj.prescriptions = selectedPrescriptions;
    queueObj.ttmDiag = ttmDiag; // save to queue
    queueObj.ttmIntake = {
      behaviors: behaviors,
      timeAggravated: galaVal
    };
    queueObj.status = 'treatment'; // Advance status

    await ClinicDB.updateQueue(queueObj);
    state.queues = await ClinicDB.getQueues();
    
    // Store in medical_records V3 store
    const medRecord = {
      patientId: queueObj.patientId, // link using ID
      date: queueObj.date,
      diagnostics: queueObj.diagnostics,
      symptoms: queueObj.symptoms,
      notes: document.getElementById('c-contraindications').value,
      ttmDiag: ttmDiag,
      ttmIntake: queueObj.ttmIntake || null
    };
    await ClinicDB.addStoreData('medical_records', medRecord);
    state.medical_records = await ClinicDB.getStoreData('medical_records');

    window.activeConsultQueueId = null;
    alert(`บันทึกอาการและตรวจเสร็จเรียบร้อย! คิวคนไข้ ${queueObj.patientName} ถูกส่งไปห้องหัตถการสปาแล้ว`);
    navigate('queue');
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 8. COURSES / PACKAGES PAGE (คอร์ส / แพ็กเกจ)
// -------------------------------------------------------------
export function renderCourses(state) {
  const list = state.patient_courses || [];
  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบบันทึกคอร์สและการใช้แพ็กเกจรักษาของลูกค้า</h2>
        <p>เปิดดูรายการคอร์สที่ลูกค้าสมัครและประวัติตัดการใช้งานคงเหลือสะสม</p>
      </div>
      <button class="btn btn-primary" id="btn-add-course">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 5v14M5 12h14"/></svg>
        สมัครคอร์สใหม่ให้คนไข้
      </button>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>ชื่อลูกค้า (HN)</th>
              <th>ชื่อแพ็กเกจคอร์ส</th>
              <th style="text-align:center;">จำนวนครั้งทั้งหมด</th>
              <th style="text-align:center;">ใช้ไปแล้ว</th>
              <th style="text-align:center;">คงเหลือ</th>
              <th style="text-align:center;">สถานะคอร์ส</th>
              <th style="text-align:center;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--gray-400);">ไม่มีรายการคนไข้ซื้อคอร์สสะสมในระบบ</td></tr>` : 
              list.map(c => `
                <tr>
                  <td><strong>${c.patientName} (HN-${String(c.patientId).padStart(4, '0')})</strong></td>
                  <td>${c.packageName}</td>
                  <td style="text-align:center;">${c.totalSessions} ครั้ง</td>
                  <td style="text-align:center; color:var(--accent); font-weight:600;">${c.usedSessions} ครั้ง</td>
                  <td style="text-align:center; color:var(--primary); font-weight:700;">${c.totalSessions - c.usedSessions} ครั้ง</td>
                  <td style="text-align:center;">
                    <span class="badge ${c.totalSessions - c.usedSessions <= 0 ? 'danger' : 'success'}">
                      ${c.totalSessions - c.usedSessions <= 0 ? 'ใช้คอร์สหมดแล้ว' : 'ใช้งานได้ปกติ'}
                    </span>
                  </td>
                  <td style="text-align:center; white-space:nowrap;">
                    <div style="display:flex; gap:6px; justify-content:center;">
                      ${c.totalSessions - c.usedSessions > 0 ? `
                        <button class="btn btn-primary btn-sm btn-use-session" data-id="${c.id}">
                          ตัดคอร์ส 1 ครั้ง
                        </button>
                      ` : ''}
                      <button class="btn btn-secondary btn-sm btn-course-edit" data-id="${c.id}">แก้ไข</button>
                      <button class="btn btn-danger btn-sm btn-course-delete" data-id="${c.id}">ลบ</button>
                    </div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: Edit Patient Course -->
    <div class="modal-backdrop" id="modal-course-edit" style="display:none;">
      <div class="modal-container" style="max-width:450px;">
        <div class="modal-header">
          <h3>แก้ไขข้อมูลสิทธิ์คอร์สผู้ป่วย</h3>
          <button class="close-btn" id="modal-course-edit-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-course-edit">
            <input type="hidden" id="course-editing-id" value="">
            <div class="form-group">
              <label>ชื่อลูกค้า</label>
              <input type="text" class="form-control" id="course-edit-pat-name" readonly style="background-color:var(--gray-100);">
            </div>
            <div class="form-group">
              <label>คอร์ส/แพ็กเกจ</label>
              <input type="text" class="form-control" id="course-edit-pack-name" readonly style="background-color:var(--gray-100);">
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="course-edit-total">จำนวนครั้งทั้งหมด *</label>
                <input type="number" class="form-control" id="course-edit-total" required min="1">
              </div>
              <div class="form-group">
                <label for="course-edit-used">ใช้ไปแล้ว *</label>
                <input type="number" class="form-control" id="course-edit-used" required min="0">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-course-edit-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-course-edit" type="submit">บันทึกแก้ไข</button>
        </div>
      </div>
    </div>

    <!-- Modal: Register New Patient Course (Checkpoint 7) -->
    <div class="modal-backdrop" id="modal-course-add" style="display:none;">
      <div class="modal-container" style="max-width:450px;">
        <div class="modal-header">
          <h3>สมัครคอร์สแพ็กเกจใหม่ให้คนไข้</h3>
          <button class="close-btn" id="modal-course-add-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-course-add-pat">
            <div class="form-group">
              <label for="course-add-patient">เลือกคนไข้ *</label>
              <select id="course-add-patient" required class="form-control">
                <option value="">-- เลือกคนไข้ --</option>
                ${state.patients.map(p => `<option value="${p.id}">${p.name} (HN-${String(p.id).padStart(4, '0')})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="course-add-package">เลือกคอร์สแพ็กเกจ *</label>
              <select id="course-add-package" required class="form-control">
                <option value="">-- เลือกคอร์สแพ็กเกจ --</option>
                ${state.inventory.filter(i => i.type === 'package').map(pkg => `<option value="${pkg.id}" data-sessions="${pkg.sessions || 10}">${pkg.name} (฿${pkg.price.toLocaleString()})</option>`).join('')}
              </select>
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="course-add-total">จำนวนครั้งทั้งหมด *</label>
                <input type="number" class="form-control" id="course-add-total" value="10" required min="1">
              </div>
              <div class="form-group">
                <label for="course-add-used">ใช้ไปแล้ว *</label>
                <input type="number" class="form-control" id="course-add-used" value="0" required min="0">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-course-add-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-course-add-pat" type="submit">บันทึกสมัครคอร์ส</button>
        </div>
      </div>
    </div>
  `;
}

export function setupCoursesEvents(state, navigate) {
  const modalAdd = document.getElementById('modal-course-add');
  const closeMAdd = () => { if (modalAdd) modalAdd.style.display = 'none'; };

  document.getElementById('btn-add-course')?.addEventListener('click', () => {
    document.getElementById('form-course-add-pat').reset();
    if (modalAdd) modalAdd.style.display = 'flex';
  });

  document.getElementById('modal-course-add-close')?.addEventListener('click', closeMAdd);
  document.getElementById('btn-course-add-cancel')?.addEventListener('click', closeMAdd);

  // Auto sessions set on package select
  document.getElementById('course-add-package')?.addEventListener('change', (e) => {
    const selectedOpt = e.target.options[e.target.selectedIndex];
    const sessions = selectedOpt.dataset.sessions;
    if (sessions) {
      document.getElementById('course-add-total').value = sessions;
    }
  });

  // Submit new course registration
  document.getElementById('form-course-add-pat')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const patId = Number(document.getElementById('course-add-patient').value);
    const pkgId = Number(document.getElementById('course-add-package').value);
    const total = Number(document.getElementById('course-add-total').value);
    const used = Number(document.getElementById('course-add-used').value);

    const patient = state.patients.find(p => p.id === patId);
    const pkg = state.inventory.find(i => i.id === pkgId);

    if (!patient || !pkg) {
      alert("ข้อมูลคนไข้หรือแพ็กเกจคอร์สไม่ถูกต้อง!");
      return;
    }
    if (used > total) {
      alert("จำนวนครั้งที่ใช้งานแล้วห้ามมากกว่าจำนวนครั้งสะสมรวม!");
      return;
    }

    const newCourse = {
      patientId: patId,
      patientName: patient.name,
      packageName: pkg.name,
      totalSessions: total,
      usedSessions: used,
      status: used >= total ? 'completed' : 'active'
    };

    await ClinicDB.addStoreData('patient_courses', newCourse);
    state.patient_courses = await ClinicDB.getStoreData('patient_courses');
    
    alert(`สมัครคอร์ส ${pkg.name} ให้คนไข้ ${patient.name} สำเร็จแล้ว!`);
    closeMAdd();
    navigate('courses');
  });

  document.querySelectorAll('.btn-use-session').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = Number(e.target.dataset.id);
      const course = state.patient_courses.find(c => c.id === id);
      
      // VALIDATION course sessions check
      if (course.usedSessions >= course.totalSessions) {
        alert('คอร์สนี้หมดจำนวนเซสชันการใช้งานแล้ว ไม่สามารถใช้ซ้ำได้!');
        return;
      }

      course.usedSessions += 1;
      if (course.usedSessions === course.totalSessions) {
        course.status = 'completed';
      }
      await ClinicDB.putStoreData('patient_courses', course);

      // Write Log to V3 course_usage_logs
      const useLog = {
        patientId: course.patientId,
        packageName: course.packageName,
        sessionIndex: course.usedSessions,
        date: new Date().toISOString().split('T')[0]
      };
      await ClinicDB.addStoreData('course_usage_logs', useLog);

      state.patient_courses = await ClinicDB.getStoreData('patient_courses');
      state.course_usage_logs = await ClinicDB.getStoreData('course_usage_logs');
      alert(`ตัดสิทธิ์คอร์ส ${course.packageName} ลูกค้า ${course.patientName} เรียบร้อย! คงเหลือ ${course.totalSessions - course.usedSessions} ครั้ง`);
      navigate('courses');
    });
  });

  const modalEdit = document.getElementById('modal-course-edit');
  const closeM = () => { if (modalEdit) modalEdit.style.display = 'none'; };
  document.getElementById('modal-course-edit-close')?.addEventListener('click', closeM);
  document.getElementById('btn-course-edit-cancel')?.addEventListener('click', closeM);

  document.querySelectorAll('.btn-course-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.closest('button').dataset.id);
      const course = state.patient_courses.find(c => c.id === id);
      if (!course) return;

      document.getElementById('course-editing-id').value = id;
      document.getElementById('course-edit-pat-name').value = course.patientName;
      document.getElementById('course-edit-pack-name').value = course.packageName;
      document.getElementById('course-edit-total').value = course.totalSessions;
      document.getElementById('course-edit-used').value = course.usedSessions;

      if (modalEdit) modalEdit.style.display = 'flex';
    });
  });

  document.getElementById('form-course-edit')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = Number(document.getElementById('course-editing-id').value);
    const course = state.patient_courses.find(c => c.id === id);
    if (!course) return;

    const total = Number(document.getElementById('course-edit-total').value);
    const used = Number(document.getElementById('course-edit-used').value);
    if (used > total) {
      alert('จำนวนครั้งที่ใช้ไปแล้วห้ามเกินจำนวนครั้งทั้งหมด!');
      return;
    }

    course.totalSessions = total;
    course.usedSessions = used;
    course.status = used >= total ? 'completed' : 'active';

    await ClinicDB.putStoreData('patient_courses', course);
    state.patient_courses = await ClinicDB.getStoreData('patient_courses');
    
    alert('แก้ไขข้อมูลคอร์สผู้ป่วยเรียบร้อยแล้ว!');
    closeM();
    navigate('courses');
  });

  document.querySelectorAll('.btn-course-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (confirm('คุณต้องการลบสิทธิ์คอร์สสะสมนี้ของผู้ป่วยออกจากระบบถาวรใช่หรือไม่?')) {
        const id = Number(e.target.closest('button').dataset.id);
        await ClinicDB.deleteStoreData('patient_courses', id);
        state.patient_courses = await ClinicDB.getStoreData('patient_courses');
        alert('ลบคอร์สสะสมสำเร็จแล้ว!');
        navigate('courses');
      }
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 9. CLIENT FOLLOW-UP PAGE (ติดตามลูกค้า)
// -------------------------------------------------------------
export function renderFollowUp(state) {
  const list = state.followups || [];
  const pendingList = list.filter(f => f.status === 'pending');
  const contactedList = list.filter(f => f.status === 'contacted');

  // Load patients list for selection in modal
  const patients = state.patients || [];

  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ตารางรายการติดตามผลคนไข้ (Follow-Up Dashboard)</h2>
        <p>เช็กรายชื่อคนไข้ที่ต้องติดต่อเพื่อติดตามอาการหลังบำบัดรักษาหรือนวดสปาครบกำหนด</p>
      </div>
      <button class="btn btn-primary" id="btn-follow-add">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 5v14M5 12h14"/></svg>
        เพิ่มนัดติดตามอาการ
      </button>
    </div>

    <!-- Follow Up Tabs -->
    <div class="tab-container" style="margin-bottom: 20px; display:flex; gap:8px;">
      <button class="btn btn-sm btn-primary" id="tab-follow-pending">รายการรอติดตาม (${pendingList.length})</button>
      <button class="btn btn-sm btn-secondary" id="tab-follow-contacted">ประวัติการติดตามสำเร็จ (${contactedList.length})</button>
    </div>

    <!-- Tab 1: Pending -->
    <div id="follow-pending-section" class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>วันที่นัดติดตาม</th>
              <th>ชื่อลูกค้า (HN)</th>
              <th>หัวข้อนัดติดตาม</th>
              <th>รายละเอียด/หมายเหตุนัด</th>
              <th style="text-align:center;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${pendingList.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:var(--gray-400); padding:24px 10px;">ไม่มีรายการรอการติดต่อติดตามอาการ</td></tr>` : 
              pendingList.map(f => `
                <tr>
                  <td>${new Date(f.date).toLocaleDateString('th-TH')}</td>
                  <td><strong>${f.patientName} (HN-${String(f.patientId).padStart(4, '0')})</strong></td>
                  <td><span class="badge primary">${f.reason || 'ติดตามอาการหลังบริการ'}</span></td>
                  <td>${f.notes || '-'}</td>
                  <td style="text-align:center; white-space:nowrap;">
                    <div style="display:flex; gap:6px; justify-content:center;">
                      <button class="btn btn-success btn-sm btn-follow-outcome" data-id="${f.id}">บันทึกผลติดต่อ</button>
                      <button class="btn btn-secondary btn-sm btn-edit-follow" data-id="${f.id}">แก้ไข</button>
                      <button class="btn btn-danger btn-sm btn-del-follow" data-id="${f.id}">&times;</button>
                    </div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab 2: Contacted (Hidden by default) -->
    <div id="follow-contacted-section" class="card" style="display:none;">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>วันที่ติดต่อสำเร็จ</th>
              <th>ชื่อลูกค้า (HN)</th>
              <th>หัวข้อติดตาม</th>
              <th>ระดับอาการล่าสุด</th>
              <th>รายละเอียดผลการสนทนา</th>
              <th style="text-align:center;">ลบ</th>
            </tr>
          </thead>
          <tbody>
            ${contactedList.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--gray-400); padding:24px 10px;">ยังไม่มีประวัติการติดต่อสำเร็จ</td></tr>` : 
              contactedList.map(f => `
                <tr>
                  <td>${f.contactedDate ? new Date(f.contactedDate).toLocaleDateString('th-TH') : new Date(f.date).toLocaleDateString('th-TH')}</td>
                  <td><strong>${f.patientName} (HN-${String(f.patientId).padStart(4, '0')})</strong></td>
                  <td><strong>${f.reason || 'ติดตามอาการหลังบริการ'}</strong></td>
                  <td>
                    <span class="badge ${
                      f.outcome === 'ดีขึ้นมาก' ? 'success' :
                      f.outcome === 'ดีขึ้นปานกลาง' ? 'info' :
                      f.outcome === 'ทรงตัว' ? 'warning' : 'danger'
                    }">
                      ${f.outcome || 'ไม่ได้ระบุ'}
                    </span>
                  </td>
                  <td>${f.outcomeNotes || '-'}</td>
                  <td style="text-align:center;">
                    <button class="btn btn-danger btn-sm btn-del-follow" data-id="${f.id}">&times;</button>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Follow Add/Edit -->
    <div class="modal-backdrop" id="modal-follow" style="display:none;">
      <div class="modal-container" style="max-width:450px;">
        <div class="modal-header">
          <h3 id="follow-modal-title">เพิ่มตารางติดตามอาการคนไข้</h3>
          <button class="close-btn" id="modal-follow-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-follow">
            <input type="hidden" id="follow-editing-id" value="">
            <div class="form-group">
              <label for="f-patient-id">เลือกคนไข้ *</label>
              <select id="f-patient-id" required>
                <option value="">-- ค้นหารายชื่อคนไข้ --</option>
                ${patients.map(p => `<option value="${p.id}">HN-${String(p.id).padStart(4, '0')} - ${p.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="f-date">วันที่นัดติดตามอาการ *</label>
              <input type="date" class="form-control" id="f-date" required>
            </div>
            <div class="form-group">
              <label for="f-reason">หัวข้อในการติดตาม *</label>
              <select id="f-reason" required>
                <option value="ติดตามอาการปวดบ่าหลังนวดบำบัด">ติดตามอาการปวดบ่าหลังนวดบำบัด</option>
                <option value="ติดตามผลข้างเคียงยาสมุนไพรต้ม">ติดตามผลข้างเคียงยาสมุนไพรต้ม</option>
                <option value="ตรวจระดับลมกำเริบในช่องท้อง">ตรวจระดับลมกำเริบในช่องท้อง</option>
                <option value="อื่นๆ">อื่นๆ (ระบุรายละเอียดเอง)</option>
              </select>
              <input type="text" class="form-control" id="f-reason-other" placeholder="ระบุหัวข้ออื่นด้วยตนเอง" style="display:none; margin-top:8px;">
            </div>
            <div class="form-group">
              <label for="f-notes">คำอธิบาย/หมายเหตุการติดตาม</label>
              <textarea id="f-notes" class="form-control" rows="3" placeholder="ระบุสิ่งที่แพทย์ต้องการตรวจสอบหรือแนะนำเพิ่ม"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-follow-modal-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-follow" type="submit">บันทึกตารางนัด</button>
        </div>
      </div>
    </div>

    <!-- Modal Follow Outcome -->
    <div class="modal-backdrop" id="modal-follow-outcome" style="display:none;">
      <div class="modal-container" style="max-width:450px;">
        <div class="modal-header">
          <h3>บันทึกผลการติดตามอาการคนไข้</h3>
          <button class="close-btn" id="modal-outcome-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-follow-outcome">
            <input type="hidden" id="outcome-follow-id" value="">
            <div class="form-group">
              <label for="fo-outcome">ระดับผลลัพธ์ / ความพึงพอใจการรักษา *</label>
              <select id="fo-outcome" required>
                <option value="ดีขึ้นมาก">ดีขึ้นมาก (หายปวด/ผลรักษาดีเลิศ)</option>
                <option value="ดีขึ้นปานกลาง">ดีขึ้นปานกลาง (บรรเทาลงเล็กน้อย)</option>
                <option value="ทรงตัว">ทรงตัว (อาการคงเดิมไม่เปลี่ยนแปลง)</option>
                <option value="แย่ลง">แย่ลง (ปวดมากขึ้น/ต้องจองแพทย์ตรวจซ้ำ)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="fo-notes">รายละเอียดผลการสนทนาและคำปรึกษาเพิ่มเติม *</label>
              <textarea id="fo-notes" class="form-control" rows="4" required placeholder="พิมพ์ข้อความสรุปอาการหลังคนไข้ให้ความเห็น"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-outcome-modal-cancel">ยกเลิก</button>
          <button class="btn btn-success" form="form-follow-outcome" type="submit">บันทึกผลลัพธ์สำเร็จ</button>
        </div>
      </div>
    </div>
  `;
}

export function setupFollowUpEvents(state, navigate) {
  const pendingTab = document.getElementById('tab-follow-pending');
  const contactedTab = document.getElementById('tab-follow-contacted');
  const pendingSection = document.getElementById('follow-pending-section');
  const contactedSection = document.getElementById('follow-contacted-section');

  const followModal = document.getElementById('modal-follow');
  const outcomeModal = document.getElementById('modal-follow-outcome');

  const reasonSelect = document.getElementById('f-reason');
  const reasonOther = document.getElementById('f-reason-other');

  // Tab toggles
  pendingTab?.addEventListener('click', () => {
    pendingTab.classList.replace('btn-secondary', 'btn-primary');
    contactedTab.classList.replace('btn-primary', 'btn-secondary');
    pendingSection.style.display = 'block';
    contactedSection.style.display = 'none';
  });

  contactedTab?.addEventListener('click', () => {
    contactedTab.classList.replace('btn-secondary', 'btn-primary');
    pendingTab.classList.replace('btn-primary', 'btn-secondary');
    contactedSection.style.display = 'block';
    pendingSection.style.display = 'none';
  });

  // Reason select toggle
  reasonSelect?.addEventListener('change', () => {
    if (reasonSelect.value === 'อื่นๆ') {
      reasonOther.style.display = 'block';
      reasonOther.required = true;
    } else {
      reasonOther.style.display = 'none';
      reasonOther.required = false;
      reasonOther.value = '';
    }
  });

  // Add click
  document.getElementById('btn-follow-add')?.addEventListener('click', () => {
    document.getElementById('form-follow').reset();
    document.getElementById('follow-editing-id').value = '';
    reasonOther.style.display = 'none';
    reasonOther.required = false;
    document.getElementById('f-date').value = new Date(Date.now() + 86400000).toISOString().split('T')[0]; // tomorrow
    document.getElementById('follow-modal-title').textContent = 'เพิ่มตารางติดตามอาการคนไข้';
    followModal.style.display = 'flex';
  });

  const closeFollow = () => {
    if (followModal) followModal.style.display = 'none';
  };
  document.getElementById('modal-follow-close')?.addEventListener('click', closeFollow);
  document.getElementById('btn-follow-modal-cancel')?.addEventListener('click', closeFollow);

  const closeOutcome = () => {
    if (outcomeModal) outcomeModal.style.display = 'none';
  };
  document.getElementById('modal-outcome-close')?.addEventListener('click', closeOutcome);
  document.getElementById('btn-outcome-modal-cancel')?.addEventListener('click', closeOutcome);

  // Edit follow
  document.querySelectorAll('.btn-edit-follow').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id);
      const follow = state.followups.find(f => f.id === id);
      if (!follow) return;

      document.getElementById('follow-editing-id').value = id;
      document.getElementById('f-patient-id').value = follow.patientId;
      document.getElementById('f-date').value = follow.date;
      document.getElementById('f-notes').value = follow.notes || '';

      const stdReasons = ['ติดตามอาการปวดบ่าหลังนวดบำบัด', 'ติดตามผลข้างเคียงยาสมุนไพรต้ม', 'ตรวจระดับลมกำเริบในช่องท้อง'];
      if (stdReasons.includes(follow.reason)) {
        reasonSelect.value = follow.reason;
        reasonOther.style.display = 'none';
        reasonOther.required = false;
        reasonOther.value = '';
      } else {
        reasonSelect.value = 'อื่นๆ';
        reasonOther.style.display = 'block';
        reasonOther.required = true;
        reasonOther.value = follow.reason || '';
      }

      document.getElementById('follow-modal-title').textContent = 'แก้ไขตารางติดตามอาการคนไข้';
      followModal.style.display = 'flex';
    });
  });

  // Submit follow Add/Edit
  document.getElementById('form-follow')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editingId = document.getElementById('follow-editing-id').value;
    const pId = Number(document.getElementById('f-patient-id').value);
    const pat = state.patients.find(p => p.id === pId);

    let finalReason = reasonSelect.value;
    if (finalReason === 'อื่นๆ') {
      finalReason = reasonOther.value.trim() || 'อื่นๆ';
    }

    const follow = {
      patientId: pId,
      patientName: pat ? pat.name : 'คนไข้ทั่วไป',
      date: document.getElementById('f-date').value,
      reason: finalReason,
      notes: document.getElementById('f-notes').value,
      status: 'pending'
    };

    if (editingId) {
      const idNum = Number(editingId);
      const existing = state.followups.find(f => f.id === idNum);
      const updated = { ...existing, ...follow };
      await ClinicDB.putStoreData('followups', updated);
      alert('แก้ไขรายการสำเร็จ!');
    } else {
      await ClinicDB.addStoreData('followups', follow);
      alert('บันทึกตารางนัดติดตามสำเร็จ!');
    }

    state.followups = await ClinicDB.getStoreData('followups');
    closeFollow();
    navigate('follow-up');
  });

  // Open Outcome Modal
  document.querySelectorAll('.btn-follow-outcome').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id);
      document.getElementById('outcome-follow-id').value = id;
      document.getElementById('form-follow-outcome').reset();
      outcomeModal.style.display = 'flex';
    });
  });

  // Submit Outcome
  document.getElementById('form-follow-outcome')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = Number(document.getElementById('outcome-follow-id').value);
    const follow = state.followups.find(f => f.id === id);
    if (!follow) return;

    follow.status = 'contacted';
    follow.outcome = document.getElementById('fo-outcome').value;
    follow.outcomeNotes = document.getElementById('fo-notes').value;
    follow.contactedDate = new Date().toISOString().split('T')[0];

    await ClinicDB.putStoreData('followups', follow);
    state.followups = await ClinicDB.getStoreData('followups');
    alert('บันทึกผลการติดตามสำเร็จ!');
    closeOutcome();
    navigate('follow-up');
  });

  // Delete follow
  document.querySelectorAll('.btn-del-follow').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (confirm('คุณต้องการลบข้อมูลตารางติดตามอาการนี้หรือไม่?')) {
        const id = Number(e.target.dataset.id);
        await ClinicDB.deleteStoreData('followups', id);
        state.followups = await ClinicDB.getStoreData('followups');
        alert('ลบข้อมูลสำเร็จ!');
        navigate('follow-up');
      }
    });
  });
}

// -------------------------------------------------------------
// 10. BILLING / INVOICING PAGE (ชำระเงิน)
// -------------------------------------------------------------
export function renderBilling(state) {
  const activeQId = window.activeBillingQueueId;
  const queueObj = state.queues.find(q => q.id === activeQId);

  if (!queueObj) {
    const billingQueues = state.queues.filter(q => q.status === 'billing');
    const unpaidList = (state.income_transactions || []).filter(t => t.isPaid === false);

    return `
      ${renderSeedDataBanner(state)}
      <div class="page-header">
        <h2>ระบบสรุปและรับชำระบิลค่ารักษา</h2>
      </div>

      <div class="grid-cols-2" style="gap:24px;">
        <!-- Left Column: Select Active Queue -->
        <div class="card" style="padding: 24px;">
          <h3 style="font-weight:700; margin-bottom:12px; color:var(--primary);">เลือกคิวคนไข้เพื่อออกบิลใหม่:</h3>
          <div class="form-group" style="margin-top:16px;">
            <select id="select-billing-queue" class="form-control" style="width:100%; height:42px; font-weight:600;">
              <option value="">-- คิวรอคิดเงินออกบิล (${billingQueues.length} คน) --</option>
              ${billingQueues.map(q => `
                <option value="${q.id}">HN-${String(q.patientId).padStart(4, '0')} - ${q.patientName} (เวลาคิว: ${q.time} น.)</option>
              `).join('')}
            </select>
          </div>
          <div style="margin-top:20px; border-top:1px dashed var(--gray-200); padding-top:16px; text-align:center;">
            <p style="color:var(--gray-500); font-size:13px; margin-bottom:12px;">หรือคุณสามารถส่งคนไข้และดูสถานะคิวทั้งหมดได้ที่บอร์ดคิวตรวจวันนี้</p>
            <button class="btn btn-secondary" id="btn-to-queue-bill-b" style="width:100%;">ไปยังบอร์ดจัดการคิว</button>
          </div>
        </div>

        <!-- Right Column: Settle Unpaid Debt Invoices -->
        <div class="card" style="padding: 24px;">
          <h3 style="font-weight:700; margin-bottom:12px; color:var(--danger);">รายการบิลที่ค้างชำระเงิน (${unpaidList.length} รายการ):</h3>
          <div class="table-container" style="max-height:220px; overflow-y:auto; border:1px solid var(--gray-200); border-radius:8px; margin-top:16px;">
            <table style="width:100%;">
              <thead>
                <tr>
                  <th>วันที่ค้าง</th>
                  <th>คนไข้</th>
                  <th>ยอดเงิน</th>
                  <th style="text-align:center;">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                ${unpaidList.length === 0 ? `<tr><td colspan="4" style="text-align:center; color:var(--gray-400); padding:16px 0;">ไม่มีรายการค้างชำระค้างจ่าย</td></tr>` : 
                  unpaidList.map(item => `
                    <tr>
                      <td>${new Date(item.date).toLocaleDateString('th-TH', {day:'numeric', month:'short'})}</td>
                      <td><strong>${item.patientName}</strong></td>
                      <td style="font-weight:700; color:var(--danger)">฿${item.netAmount.toLocaleString()}</td>
                      <td style="text-align:center;">
                        <button class="btn btn-success btn-sm btn-settle-debt-direct" data-id="${item.id}">รับเงิน</button>
                      </td>
                    </tr>
                  `).join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  const treatments = queueObj.treatments || [];
  const prescriptions = queueObj.prescriptions || [];
  
  const treatmentSum = treatments.reduce((sum, t) => sum + t.price, 0);
  const prescriptionSum = prescriptions.reduce((sum, p) => sum + (p.price * p.qty), 0);
  const subtotal = treatmentSum + prescriptionSum;

  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ทำธุรกรรมออกใบเสร็จรับเงิน</h2>
        <p>คนไข้ชำระ: <strong>${queueObj.patientName} (HN-${String(queueObj.patientId).padStart(4, '0')})</strong></p>
      </div>
      <button class="btn btn-secondary" id="btn-bill-back-q">กลับบอร์ดคิว</button>
    </div>

    <div class="billing-layout">
      <div class="card">
        <h3 style="font-weight:700; margin-bottom:12px;">รายการรักษาและยาสมุนไพร</h3>
        <div class="table-container" style="margin-bottom:20px;">
          <table>
            <thead>
              <tr>
                <th>รายการ</th>
                <th style="text-align:center;">จำนวน</th>
                <th style="text-align:right;">ราคาต่อหน่วย</th>
                <th style="text-align:right;">รวม</th>
              </tr>
            </thead>
            <tbody>
              ${treatments.map(t => `
                <tr>
                  <td><strong>${t.name}</strong></td>
                  <td style="text-align:center;">1</td>
                  <td style="text-align:right;">฿${t.price}</td>
                  <td style="text-align:right;">฿${t.price}</td>
                </tr>
              `).join('')}
              ${prescriptions.map(p => `
                <tr>
                  <td><strong>${p.name}</strong></td>
                  <td style="text-align:center;">${p.qty}</td>
                  <td style="text-align:right;">฿${p.price}</td>
                  <td style="text-align:right;">฿${p.price * p.qty}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <form id="form-final-pay">
          <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
            <div class="form-group">
              <label for="bill-disc">ระบุส่วนลดเงินสด (บาท)</label>
              <input type="number" id="bill-disc" min="0" value="0" class="form-control">
            </div>
            <div class="form-group">
              <label for="bill-reason">ชื่อโปรโมชั่น / แคมเปญส่วนลด</label>
              <input type="text" id="bill-reason" class="form-control" placeholder="ไม่มี / สมาชิกใหม่ลด 5%">
            </div>
          </div>

          <div class="form-group">
            <label for="bill-pay-method">ช่องทางรับเงินชำระบิล *</label>
            <select id="bill-pay-method" required>
              <option value="โอนเงินผ่านธนาคาร/QR Code">โอนเงินผ่านธนาคาร / QR Code</option>
              <option value="เงินสด">เงินสด</option>
              <option value="บัตรเครดิต">บัตรเครดิต</option>
              <option value="ค้างชำระเงินชั่วคราว">ค้างชำระเงิน</option>
            </select>
          </div>
          
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:12px;">
            บันทึกรับเงินชำระและหักยอดสต็อกสมุนไพร
          </button>
        </form>
      </div>

      <!-- Receipt Print -->
      <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <h4 style="font-weight:700; margin-bottom:8px;">จำลองพิมพ์บิลกระดาษความร้อน</h4>
          <div class="receipt-preview" id="receipt-preview-area"></div>
        </div>
        <button class="btn btn-secondary" id="btn-print-receipt-sim" style="width:100%; margin-top:12px;">พิมพ์ใบเสร็จ (80mm)</button>
      </div>
    </div>
  `;
}

export function setupBillingEvents(state, navigate) {
  const activeQId = window.activeBillingQueueId;
  const queueObj = state.queues.find(q => q.id === activeQId);
  if (!queueObj) {
    document.getElementById('select-billing-queue')?.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        window.activeBillingQueueId = Number(val);
        navigate('billing');
      }
    });
    document.getElementById('btn-to-queue-bill-b')?.addEventListener('click', () => navigate('queue'));

    // Bind settle debt direct buttons
    document.querySelectorAll('.btn-settle-debt-direct').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = Number(e.target.dataset.id);
        const tx = state.income_transactions.find(t => t.id === id);
        if (!tx) return;

        const method = prompt(`ระบุช่องทางการรับเงินชำระหนี้คนไข้ ${tx.patientName} (จำนวน ฿${tx.netAmount.toLocaleString()})\nกรุณาพิมพ์: โอนเงิน / เงินสด / บัตรเครดิต`, "โอนเงินผ่านธนาคาร/QR Code");
        if (method !== null) {
          tx.isPaid = true;
          tx.paymentMethod = method;
          await ClinicDB.putStoreData('income_transactions', tx);

          // Also update compatibility sales store if exists
          if (tx.queueId) {
            const sales = await ClinicDB.getStoreData('sales');
            const sale = sales.find(s => s.queueId === tx.queueId);
            if (sale) {
              sale.isPaid = true;
              sale.paymentMethod = method;
              await ClinicDB.putStoreData('sales', sale);
            }
          }

          alert('บันทึกชำระหนี้ค้างเงินสำเร็จ!');
          state.income_transactions = await ClinicDB.getStoreData('income_transactions');
          state.sales = await ClinicDB.getStoreData('sales');
          navigate('billing');
        }
      });
    });
    return;
  }

  document.getElementById('btn-bill-back-q')?.addEventListener('click', () => {
    window.activeBillingQueueId = null;
    navigate('queue');
  });

  const treatments = queueObj.treatments || [];
  const prescriptions = queueObj.prescriptions || [];
  const treatmentSum = treatments.reduce((sum, t) => sum + t.price, 0);
  const prescriptionSum = prescriptions.reduce((sum, p) => sum + (p.price * p.qty), 0);
  const subtotal = treatmentSum + prescriptionSum;

  const discInput = document.getElementById('bill-disc');
  const reasonInput = document.getElementById('bill-reason');
  const methodSelect = document.getElementById('bill-pay-method');

  const updatePreview = () => {
    const disc = Number(discInput.value) || 0;
    const total = Math.max(0, subtotal - disc);
    const method = methodSelect.value || 'เงินสด';
    const reason = reasonInput.value || '-';

    const clinicName = state.settings?.name || 'เรือนสมุนไพรคลินิก';
    const clinicAddress = state.settings?.address || 'ระบบบริหารคลินิกการแพทย์แผนไทย';
    const clinicLogo = state.settings?.logo || '';

    document.getElementById('receipt-preview-area').innerHTML = `
      ${clinicLogo ? `<img src="${clinicLogo}" class="receipt-logo" alt="Logo">` : ''}
      <div class="receipt-header">
        <strong>${clinicName}</strong><br>
        ${clinicAddress}<br>
        -----------------------------
      </div>
      <div>
        คนไข้: ${queueObj.patientName}<br>
        HN: HN-${String(queueObj.patientId).padStart(4, '0')}<br>
        วันที่: ${new Date().toLocaleDateString('th-TH')}<br>
        -----------------------------
      </div>
      <div style="margin: 8px 0;">
        ${treatments.map(t => `<div class="receipt-row"><span>${t.name}</span><span>฿${t.price}</span></div>`).join('')}
        ${prescriptions.map(p => `<div class="receipt-row"><span>${p.name} (x${p.qty})</span><span>฿${p.price * p.qty}</span></div>`).join('')}
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-row"><span>ยอดรวมก่อนหัก:</span><span>฿${subtotal.toLocaleString()}</span></div>
      <div class="receipt-row" style="color:var(--danger)"><span>ส่วนลดพิเศษ (${reason}):</span><span>-฿${disc.toLocaleString()}</span></div>
      <div class="receipt-divider"></div>
      <div class="receipt-row receipt-total"><span>สุทธิค้างจ่าย:</span><span>฿${total.toLocaleString()}</span></div>
      <div class="receipt-row" style="font-size:11px; margin-top:8px;"><span>ช่องทางชำระ:</span><span>${method}</span></div>
    `;
  };

  discInput?.addEventListener('input', updatePreview);
  reasonInput?.addEventListener('input', updatePreview);
  methodSelect?.addEventListener('change', updatePreview);
  updatePreview();

  document.getElementById('btn-print-receipt-sim')?.addEventListener('click', () => {
    alert('ระบบส่งออกพิมพ์กระดาษความร้อน 80mm สำเร็จ!');
  });

  document.getElementById('form-final-pay')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // VALIDATIONS: Double billing block
    if (queueObj.status === 'completed') {
      alert('ข้อผิดพลาด: คิวตรวจรักษานี้ได้ทำการชำระเงินเสร็จสิ้นแล้ว ไม่สามารถรับเงินซ้ำได้!');
      return;
    }

    const disc = Number(discInput.value) || 0;
    if (disc < 0) {
      alert('ส่วนลดต้องไม่ติดลบ!');
      return;
    }

    const total = Math.max(0, subtotal - disc);
    const method = methodSelect.value;
    const reason = reasonInput.value;

    const items = [
      ...treatments.map(t => ({ name: t.name, price: t.price, qty: 1 })),
      ...prescriptions.map(p => ({ name: p.name, price: p.price, qty: p.qty }))
    ];

    const isPaid = method !== 'ค้างชำระเงินชั่วคราว';

    const sale = {
      queueId: queueObj.id,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      patientId: queueObj.patientId, // safe ID
      patientName: queueObj.patientName,
      items: items,
      subtotal: subtotal,
      discount: disc,
      discountReason: reason,
      total: total,
      paymentMethod: method,
      isPaid: isPaid
    };

    // Save to sales (compatibility)
    await ClinicDB.addSale(sale);

    // Save to V3 income_transactions
    const incomeTx = {
      queueId: queueObj.id,
      patientId: queueObj.patientId, // Safe key
      patientName: queueObj.patientName,
      netAmount: total,
      category: treatments.length > 0 ? 'ค่าบริการ' : 'ขายยา',
      paymentMethod: method,
      isPaid: isPaid,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    };
    await ClinicDB.addStoreData('income_transactions', incomeTx);

    // Adjust stocks
    for (const p of prescriptions) {
      const invItem = state.inventory.find(i => i.id === p.itemId);
      if (invItem && invItem.type !== 'service' && invItem.type !== 'package') {
        invItem.stock = Math.max(0, invItem.stock - p.qty);
        await ClinicDB.updateInventoryItem(invItem);
      }
    }

    queueObj.status = 'completed';
    await ClinicDB.updateQueue(queueObj);

    state.queues = await ClinicDB.getQueues();
    state.inventory = await ClinicDB.getInventory();
    state.sales = await ClinicDB.getSales();
    state.income_transactions = await ClinicDB.getStoreData('income_transactions');

    alert(`รับเงินชำระสุทธิ ฿${total.toLocaleString()} บันทึกเสร็จสมบูรณ์`);
    window.activeBillingQueueId = null;
    navigate('dashboard');
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 11. INCOME PAGE (รายรับ)
// -------------------------------------------------------------
export function renderIncome(state) {
  // Prefer V3 income_transactions
  const list = state.income_transactions || [];
  
  const cashTotal = list.filter(i => i.isPaid !== false).reduce((sum, i) => sum + i.netAmount, 0);
  const debtTotal = list.filter(i => i.isPaid === false).reduce((sum, i) => sum + i.netAmount, 0);

  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>สรุปรายการบัญชีรายรับคลินิกทั้งหมด (V3)</h2>
        <p>ประวัติธุรกรรมรายได้ เงินโอน เงินสด จากค่าตรวจ หัตถการ หรือสินค้าของคลินิก</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-secondary btn-sm" id="btn-inc-cats">จัดการหมวดหมู่รายรับ</button>
        <button class="btn btn-primary btn-sm" id="btn-inc-add">บันทึกรายรับทั่วไป</button>
      </div>
    </div>

    <!-- Financial Stats Summary Cards -->
    <div class="grid-cols-2" style="margin-bottom:20px; gap:16px;">
      <div class="card stat-card" style="border-left-color: var(--success); padding: 16px; margin:0;">
        <span style="font-size:12px; color:var(--gray-500); font-weight:600;">รายรับเงินสดจริงสะสม</span>
        <span style="font-size:24px; font-weight:700; color:var(--success); display:block; margin-top:4px;">฿${cashTotal.toLocaleString()}</span>
      </div>
      <div class="card stat-card" style="border-left-color: var(--danger); padding: 16px; margin:0;">
        <span style="font-size:12px; color:var(--gray-500); font-weight:600;">ยอดเงินค้างชำระสะสม (หนี้ค้าง)</span>
        <span style="font-size:24px; font-weight:700; color:var(--danger); display:block; margin-top:4px;">฿${debtTotal.toLocaleString()}</span>
      </div>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>วันที่ธุรกรรม</th>
              <th>เวลา</th>
              <th>คนไข้ผู้ชำระ / รายละเอียด</th>
              <th>ประเภทรายรับ</th>
              <th style="color:var(--primary); font-weight:700; text-align:right;">ยอดเงินชำระสุทธิ (฿)</th>
              <th>สถานะ/ช่องทาง</th>
              <th style="text-align:center; width:180px;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--gray-400); padding:20px;">ยังไม่มีข้อมูลบันทึกรายรับสะสมในระบบ</td></tr>` : 
              list.map(s => `
                <tr>
                  <td>${new Date(s.date).toLocaleDateString('th-TH')}</td>
                  <td>${s.time || '-'}</td>
                  <td>
                    ${s.patientId 
                      ? `<a class="income-pat-link" data-pat-id="${s.patientId}" style="color:var(--primary); text-decoration:underline; font-weight:600; cursor:pointer;">
                           ${s.patientName} (HN-${String(s.patientId).padStart(4, '0')})
                         </a>`
                      : `<strong>ทั่วไป:</strong> ${s.description || '-'}`
                    }
                  </td>
                  <td><span class="badge primary">${s.category || 'ค่าบริการ'}</span></td>
                  <td style="color:var(--primary); font-weight:700; text-align:right;">฿${s.netAmount.toLocaleString()}</td>
                  <td>
                    <span class="badge ${s.isPaid === false ? 'danger' : 'success'}">
                      ${s.isPaid === false ? 'ค้างชำระเงิน' : s.paymentMethod}
                    </span>
                  </td>
                  <td style="text-align:center; white-space:nowrap;">
                    <div style="display:flex; gap:6px; justify-content:center;">
                      ${s.isPaid === false ? `<button class="btn btn-success btn-sm btn-settle-income-debt" data-id="${s.id}">รับเงิน</button>` : ''}
                      <button class="btn btn-secondary btn-sm btn-edit-income" data-id="${s.id}">แก้ไข</button>
                      <button class="btn btn-danger btn-sm btn-del-income" data-id="${s.id}">&times;</button>
                    </div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal General Income -->
    <div class="modal-backdrop" id="modal-inc" style="display:none;">
      <div class="modal-container" style="max-width:450px;">
        <div class="modal-header">
          <h3 id="inc-modal-title">บันทึกรายรับทั่วไป</h3>
          <button class="close-btn" id="modal-inc-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-inc">
            <input type="hidden" id="inc-editing-id" value="">
            <div class="form-group">
              <label for="inc-desc">รายละเอียดรายรับ *</label>
              <input type="text" class="form-control" id="inc-desc" required placeholder="เช่น ค่าขายเครื่องดื่มสมุนไพรหน้าร้าน">
            </div>
            <div class="form-group">
              <label for="inc-category">หมวดหมู่รายรับ *</label>
              <select id="inc-category" required>
                ${state.income_categories.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="inc-amount">จำนวนเงิน (฿) *</label>
                <input type="number" class="form-control" id="inc-amount" required min="1" placeholder="0">
              </div>
              <div class="form-group">
                <label for="inc-method">ช่องทางการเงิน</label>
                <select id="inc-method">
                  <option value="เงินโอน">เงินโอนผ่านธนาคาร</option>
                  <option value="เงินสด">เงินสด</option>
                  <option value="บัตรเครดิต">บัตรเครดิต</option>
                  <option value="ค้างชำระเงินชั่วคราว">ค้างชำระเงิน</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="inc-date">วันที่ทำรายการ *</label>
              <input type="date" class="form-control" id="inc-date" required>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-inc-modal-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-inc" type="submit">บันทึกรายรับ</button>
        </div>
      </div>
    </div>

    <!-- Modal Manage Income Categories -->
    <div class="modal-backdrop" id="modal-inc-cats" style="display:none;">
      <div class="modal-container" style="max-width:450px;">
        <div class="modal-header">
          <h3>จัดการหมวดหมู่รายรับ</h3>
          <button class="close-btn" id="modal-inc-cats-close">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display:flex; gap:8px; margin-bottom:16px;">
            <input type="text" class="form-control" id="new-inc-cat-input" placeholder="พิมพ์ชื่อหมวดหมู่ที่ต้องการเพิ่ม เช่น ค่าเครื่องดื่ม" style="margin:0;">
            <button class="btn btn-primary" id="btn-add-inc-cat">เพิ่ม</button>
          </div>
          <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: 8px;">
            <ul id="inc-cats-list" style="list-style: none; padding: 0; margin: 0;">
              ${state.income_categories.map((c, idx) => `
                <li style="display:flex; justify-content:space-between; align-items:center; padding: 8px; border-bottom: 1px solid var(--gray-100);">
                  <span><strong>${c}</strong></span>
                  <button type="button" class="btn btn-danger btn-sm btn-del-inc-cat-item" data-idx="${idx}" style="padding: 2px 8px; font-weight:700;">&times;</button>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-inc-cats-close-cancel">ปิด</button>
          <button class="btn btn-primary" id="btn-save-inc-cats">บันทึกรายการ</button>
        </div>
      </div>
    </div>
  `;
}
export function setupIncomeEvents(state, navigate) {
  const modal = document.getElementById('modal-inc');

  document.getElementById('btn-inc-add')?.addEventListener('click', () => {
    document.getElementById('form-inc').reset();
    document.getElementById('inc-editing-id').value = '';
    document.getElementById('inc-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('inc-modal-title').textContent = 'บันทึกรายรับทั่วไป';
    modal.style.display = 'flex';
  });

  const closeM = () => modal.style.display = 'none';
  document.getElementById('modal-inc-close')?.addEventListener('click', closeM);
  document.getElementById('btn-inc-modal-cancel')?.addEventListener('click', closeM);

  // Manage categories
  const catsModal = document.getElementById('modal-inc-cats');
  let tempIncomeCats = [...state.income_categories];

  const renderTempIncomeCats = () => {
    const listUl = document.getElementById('inc-cats-list');
    if (listUl) {
      listUl.innerHTML = tempIncomeCats.map((c, idx) => `
        <li style="display:flex; justify-content:space-between; align-items:center; padding: 8px; border-bottom: 1px solid var(--gray-100);">
          <span><strong>${c}</strong></span>
          <button type="button" class="btn btn-danger btn-sm btn-del-inc-cat-item" data-idx="${idx}" style="padding: 2px 8px; font-weight:700;">&times;</button>
        </li>
      `).join('');
    }
  };

  document.getElementById('btn-inc-cats')?.addEventListener('click', () => {
    tempIncomeCats = [...state.income_categories];
    renderTempIncomeCats();
    catsModal.style.display = 'flex';
  });

  const closeCatsModal = () => {
    if (catsModal) catsModal.style.display = 'none';
  };
  document.getElementById('modal-inc-cats-close')?.addEventListener('click', closeCatsModal);
  document.getElementById('btn-inc-cats-close-cancel')?.addEventListener('click', closeCatsModal);

  document.getElementById('btn-add-inc-cat')?.addEventListener('click', () => {
    const input = document.getElementById('new-inc-cat-input');
    const val = input.value.trim();
    if (!val) {
      alert('กรุณากรอกชื่อหมวดหมู่ที่ต้องการเพิ่ม!');
      return;
    }
    if (tempIncomeCats.includes(val)) {
      alert('หมวดหมู่นี้มีอยู่ในรายการแล้ว!');
      return;
    }
    tempIncomeCats.push(val);
    input.value = '';
    renderTempIncomeCats();
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-del-inc-cat-item')) {
      const idx = Number(e.target.dataset.idx);
      tempIncomeCats.splice(idx, 1);
      renderTempIncomeCats();
    }
  });

  document.getElementById('btn-save-inc-cats')?.addEventListener('click', async () => {
    if (tempIncomeCats.length === 0) {
      alert('ควรมีหมวดหมู่รายรับอย่างน้อย 1 หมวดหมู่!');
      return;
    }
    await ClinicDB.putStoreData('clinic_settings', { key: 'income_categories', list: tempIncomeCats });
    state.income_categories = tempIncomeCats;
    alert('บันทึกปรับปรุงหมวดหมู่รายรับสำเร็จ!');
    closeCatsModal();
    navigate('income');
  });

  // Link to EMR
  document.querySelectorAll('.income-pat-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.activePatientHistoryId = Number(e.target.dataset.patId);
      navigate('medical-records');
    });
  });

  // Edit income
  document.querySelectorAll('.btn-edit-income').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id);
      const inc = state.income_transactions.find(i => i.id === id);
      if (!inc) return;

      document.getElementById('inc-editing-id').value = id;
      document.getElementById('inc-desc').value = inc.description || (inc.patientName ? `ค่ารักษาคนไข้ ${inc.patientName}` : '');
      document.getElementById('inc-category').value = inc.category || 'ค่าบริการ';
      document.getElementById('inc-amount').value = inc.netAmount;
      document.getElementById('inc-method').value = inc.paymentMethod;
      document.getElementById('inc-date').value = inc.date;
      
      document.getElementById('inc-modal-title').textContent = 'แก้ไขรายละเอียดรายรับ';
      modal.style.display = 'flex';
    });
  });

  // Delete income
  document.querySelectorAll('.btn-del-income').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (confirm('คุณแน่ใจว่าต้องการลบธุรกรรมรายรับนี้ออกจากระบบ?')) {
        const id = Number(e.target.dataset.id);
        await ClinicDB.deleteStoreData('income_transactions', id);
        state.income_transactions = await ClinicDB.getStoreData('income_transactions');
        alert('ลบรายการสำเร็จ!');
        navigate('income');
      }
    });
  });

  // Form submit
  document.getElementById('form-inc')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editingId = document.getElementById('inc-editing-id').value;
    const amount = Number(document.getElementById('inc-amount').value);
    
    if (amount < 0) {
      alert('จำนวนเงินห้ามติดลบ!');
      return;
    }

    const methodVal = document.getElementById('inc-method').value;
    const inc = {
      description: document.getElementById('inc-desc').value,
      category: document.getElementById('inc-category').value,
      netAmount: amount,
      paymentMethod: methodVal,
      isPaid: methodVal !== 'ค้างชำระเงินชั่วคราว',
      date: document.getElementById('inc-date').value,
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    };

    if (editingId) {
      const idNum = Number(editingId);
      const existing = state.income_transactions.find(i => i.id === idNum);
      const updated = { ...existing, ...inc };
      await ClinicDB.putStoreData('income_transactions', updated);
      alert('แก้ไขรายการสำเร็จ!');
    } else {
      await ClinicDB.addStoreData('income_transactions', inc);
      alert('บันทึกรายรับทั่วไปสำเร็จ!');
    }

    state.income_transactions = await ClinicDB.getStoreData('income_transactions');
    closeM();
    navigate('income');
  });

  // Bind settle debt from income list
  document.querySelectorAll('.btn-settle-income-debt').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = Number(e.target.dataset.id);
      const tx = state.income_transactions.find(t => t.id === id);
      if (!tx) return;

      const method = prompt(`ระบุช่องทางการรับเงินชำระหนี้ (จำนวน ฿${tx.netAmount.toLocaleString()})\nพิมพ์ช่องทาง: โอนเงิน / เงินสด / บัตรเครดิต`, "โอนเงินผ่านธนาคาร/QR Code");
      if (method !== null) {
        tx.isPaid = true;
        tx.paymentMethod = method;
        await ClinicDB.putStoreData('income_transactions', tx);

        // Also update compatibility sales store if exists
        if (tx.queueId) {
          const sales = await ClinicDB.getStoreData('sales');
          const sale = sales.find(s => s.queueId === tx.queueId);
          if (sale) {
            sale.isPaid = true;
            sale.paymentMethod = method;
            await ClinicDB.putStoreData('sales', sale);
          }
        }

        alert('บันทึกรับเงินสำเร็จ!');
        state.income_transactions = await ClinicDB.getStoreData('income_transactions');
        state.sales = await ClinicDB.getStoreData('sales');
        navigate('income');
      }
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 12. EXPENSES PAGE (รายจ่าย)
// -------------------------------------------------------------
export function renderExpenses(state) {
  // Prefer V3 expense_transactions
  const list = state.expense_transactions || [];
  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>บันทึกบัญชีรายจ่ายการบริหารจัดการคลินิก (V3)</h2>
        <p>บันทึกรายจ่ายจิปาถะ ค่าน้ำค่าไฟ เงินเดือน ค่ายาสมุนไพรสต๊อก</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-secondary btn-sm" id="btn-exp-cats">จัดการหมวดหมู่รายจ่าย</button>
        <button class="btn btn-primary btn-sm" id="btn-exp-add">บันทึกรายจ่ายใหม่</button>
      </div>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>วันที่จ่าย</th>
              <th>รายละเอียดรายการ</th>
              <th>หมวดหมู่รายจ่าย</th>
              <th style="text-align:right; font-weight:700; color:var(--danger)">จำนวนเงินจ่าย (฿)</th>
              <th style="text-align:center; width:150px;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:var(--gray-400);">ไม่มีบันทึกข้อมูลรายจ่ายการดำเนินงาน</td></tr>` : 
              list.map(e => `
                <tr>
                  <td>${new Date(e.date).toLocaleDateString('th-TH')}</td>
                  <td><strong>${e.description}</strong></td>
                  <td><span class="badge primary">${e.category}</span></td>
                  <td style="text-align:right; font-weight:700; color:var(--danger)">฿${e.amount.toLocaleString()}</td>
                  <td style="text-align:center; white-space:nowrap;">
                    <button class="btn btn-secondary btn-sm btn-edit-exp" data-id="${e.id}">แก้ไข</button>
                    <button class="btn btn-danger btn-sm btn-del-exp" data-id="${e.id}">ลบ</button>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal expense -->
    <div class="modal-backdrop" id="modal-exp" style="display:none;">
      <div class="modal-container">
        <div class="modal-header">
          <h3 id="exp-modal-title">บันทึกรายจ่ายคลินิกย่อย</h3>
          <button class="close-btn" id="modal-exp-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-exp">
            <input type="hidden" id="exp-editing-id" value="">
            <div class="form-group">
              <label for="e-desc">รายละเอียดรายการจ่าย *</label>
              <input type="text" class="form-control" id="e-desc" required placeholder="เช่น ค่าแรงพนักงานประจำวัน, ค่าน้ำไฟ">
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="e-cat">หมวดหมู่รายจ่าย</label>
                <select id="e-cat" required>
                  ${state.expense_categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label for="e-amount">จำนวนเงินจ่าย (฿) *</label>
                <input type="number" class="form-control" id="e-amount" required min="1" placeholder="0">
              </div>
            </div>
            <div class="form-group">
              <label for="e-date">วันที่บันทึกจ่าย *</label>
              <input type="date" class="form-control" id="e-date" required>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-exp-modal-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-exp" type="submit">บันทึกรายการจ่าย</button>
        </div>
      </div>
    </div>

    <!-- Modal Manage Expense Categories -->
    <div class="modal-backdrop" id="modal-exp-cats" style="display:none;">
      <div class="modal-container" style="max-width:450px;">
        <div class="modal-header">
          <h3>จัดการหมวดหมู่รายจ่าย</h3>
          <button class="close-btn" id="modal-exp-cats-close">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display:flex; gap:8px; margin-bottom:16px;">
            <input type="text" class="form-control" id="new-exp-cat-input" placeholder="พิมพ์ชื่อหมวดหมู่ที่ต้องการเพิ่ม เช่น ค่าเครื่องดื่ม" style="margin:0;">
            <button class="btn btn-primary" id="btn-add-exp-cat">เพิ่ม</button>
          </div>
          <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: 8px;">
            <ul id="exp-cats-list" style="list-style: none; padding: 0; margin: 0;">
              ${state.expense_categories.map((c, idx) => `
                <li style="display:flex; justify-content:space-between; align-items:center; padding: 8px; border-bottom: 1px solid var(--gray-100);">
                  <span><strong>${c}</strong></span>
                  <button type="button" class="btn btn-danger btn-sm btn-del-exp-cat-item" data-idx="${idx}" style="padding: 2px 8px; font-weight:700;">&times;</button>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-exp-cats-close-cancel">ปิด</button>
          <button class="btn btn-primary" id="btn-save-exp-cats">บันทึกรายการ</button>
        </div>
      </div>
    </div>
  `;
}

export function setupExpensesEvents(state, navigate) {
  const modal = document.getElementById('modal-exp');

  document.getElementById('btn-exp-add')?.addEventListener('click', () => {
    document.getElementById('form-exp').reset();
    document.getElementById('exp-editing-id').value = '';
    document.getElementById('e-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('exp-modal-title').textContent = 'บันทึกรายจ่ายคลินิกย่อย';
    modal.style.display = 'flex';
  });

  const closeM = () => modal.style.display = 'none';
  document.getElementById('modal-exp-close')?.addEventListener('click', closeM);
  document.getElementById('btn-exp-modal-cancel')?.addEventListener('click', closeM);

  // Manage categories
  const catsModal = document.getElementById('modal-exp-cats');
  let tempExpenseCats = [...state.expense_categories];

  const renderTempExpenseCats = () => {
    const listUl = document.getElementById('exp-cats-list');
    if (listUl) {
      listUl.innerHTML = tempExpenseCats.map((c, idx) => `
        <li style="display:flex; justify-content:space-between; align-items:center; padding: 8px; border-bottom: 1px solid var(--gray-100);">
          <span><strong>${c}</strong></span>
          <button type="button" class="btn btn-danger btn-sm btn-del-exp-cat-item" data-idx="${idx}" style="padding: 2px 8px; font-weight:700;">&times;</button>
        </li>
      `).join('');
    }
  };

  document.getElementById('btn-exp-cats')?.addEventListener('click', () => {
    tempExpenseCats = [...state.expense_categories];
    renderTempExpenseCats();
    catsModal.style.display = 'flex';
  });

  const closeCatsModal = () => {
    if (catsModal) catsModal.style.display = 'none';
  };
  document.getElementById('modal-exp-cats-close')?.addEventListener('click', closeCatsModal);
  document.getElementById('btn-exp-cats-close-cancel')?.addEventListener('click', closeCatsModal);

  document.getElementById('btn-add-exp-cat')?.addEventListener('click', () => {
    const input = document.getElementById('new-exp-cat-input');
    const val = input.value.trim();
    if (!val) {
      alert('กรุณากรอกชื่อหมวดหมู่ที่ต้องการเพิ่ม!');
      return;
    }
    if (tempExpenseCats.includes(val)) {
      alert('หมวดหมู่นี้มีอยู่ในรายการแล้ว!');
      return;
    }
    tempExpenseCats.push(val);
    input.value = '';
    renderTempExpenseCats();
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-del-exp-cat-item')) {
      const idx = Number(e.target.dataset.idx);
      tempExpenseCats.splice(idx, 1);
      renderTempExpenseCats();
    }
  });

  document.getElementById('btn-save-exp-cats')?.addEventListener('click', async () => {
    if (tempExpenseCats.length === 0) {
      alert('ควรมีหมวดหมู่รายจ่ายอย่างน้อย 1 หมวดหมู่!');
      return;
    }
    await ClinicDB.putStoreData('clinic_settings', { key: 'expense_categories', list: tempExpenseCats });
    state.expense_categories = tempExpenseCats;
    alert('บันทึกปรับปรุงหมวดหมู่รายจ่ายสำเร็จ!');
    closeCatsModal();
    navigate('expenses');
  });

  // Edit Expense
  document.querySelectorAll('.btn-edit-exp').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.closest('button').dataset.id);
      const exp = state.expense_transactions.find(ex => ex.id === id);
      if (!exp) return;

      document.getElementById('exp-editing-id').value = id;
      document.getElementById('e-desc').value = exp.description || '';
      document.getElementById('e-cat').value = exp.category || '';
      document.getElementById('e-amount').value = exp.amount;
      document.getElementById('e-date').value = exp.date;

      document.getElementById('exp-modal-title').textContent = 'แก้ไขรายละเอียดรายการจ่าย';
      modal.style.display = 'flex';
    });
  });

  // Form Submit
  document.getElementById('form-exp')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('e-amount').value);
    const editingId = document.getElementById('exp-editing-id').value;

    // VALIDATION: non-negative check
    if (amount < 0) {
      alert('จำนวนเงินรายจ่ายห้ามติดลบ!');
      return;
    }

    const exp = {
      description: document.getElementById('e-desc').value,
      category: document.getElementById('e-cat').value,
      amount: amount,
      date: document.getElementById('e-date').value
    };

    if (editingId) {
      exp.id = Number(editingId);
      await ClinicDB.putStoreData('expense_transactions', exp);
      alert('แก้ไขรายการจ่ายเงินเสร็จเรียบร้อย!');
    } else {
      await ClinicDB.addStoreData('expense_transactions', exp);
      alert('บันทึกรายการจ่ายเงินดำเนินการใหม่แล้ว!');
    }

    state.expense_transactions = await ClinicDB.getStoreData('expense_transactions');
    closeM();
    navigate('expenses');
  });

  document.querySelectorAll('.btn-del-exp').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (confirm('คุณต้องการลบรายการจ่ายเงินดำเนินการนี้หรือไม่?')) {
        const id = Number(e.target.closest('button').dataset.id);
        await ClinicDB.deleteStoreData('expense_transactions', id);
        state.expense_transactions = await ClinicDB.getStoreData('expense_transactions');
        alert('ลบรายการสำเร็จ!');
        navigate('expenses');
      }
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 13. STARTUP COSTS PAGE (ต้นทุนกิจการ)
// -------------------------------------------------------------
export function renderStartupCosts(state) {
  // Prefer V3 startup_costs
  const list = state.startup_costs || [];
  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบบันทึกต้นทุนการก่อตั้งร้านเริ่มต้น (V3)</h2>
        <p>บันทึกเงินลงทุนจมครั้งแรกสำหรับเปิดกิจการ เพื่อวัดจุดคุ้มทุนแม่นยำ</p>
      </div>
      <button class="btn btn-primary" id="btn-start-add">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 5v14M5 12h14"/></svg>
        เพิ่มต้นทุนก่อตั้งร้าน
      </button>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>วันที่บันทึกบัญชี</th>
              <th>รายการสินค้า/ค่าใช้จ่าย</th>
              <th>หมวดหมู่ทรัพย์สิน</th>
              <th style="text-align:right; font-weight:700; color:var(--accent)">มูลค่าเงินลงทุน (฿)</th>
              <th style="text-align:center; width:150px;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:var(--gray-400);">ไม่มีการบันทึกต้นทุนจุดจัดตั้งร้านเริ่มต้น</td></tr>` : 
              list.map(s => `
                <tr>
                  <td>${new Date(s.date).toLocaleDateString('th-TH')}</td>
                  <td><strong>${s.description}</strong></td>
                  <td><span class="badge warning">${s.category}</span></td>
                  <td style="text-align:right; font-weight:700; color:var(--accent)">฿${s.amount.toLocaleString()}</td>
                  <td style="text-align:center; white-space:nowrap;">
                    <button class="btn btn-secondary btn-sm btn-edit-start" data-id="${s.id}">แก้ไข</button>
                    <button class="btn btn-danger btn-sm btn-del-start" data-id="${s.id}">&times;</button>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal startup -->
    <div class="modal-backdrop" id="modal-start" style="display:none;">
      <div class="modal-container">
        <div class="modal-header">
          <h3 id="start-modal-title">บันทึกต้นทุนจัดตั้งคลินิก</h3>
          <button class="close-btn" id="modal-start-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-start">
            <input type="hidden" id="start-editing-id" value="">
            <div class="form-group">
              <label for="s-desc">รายละเอียดต้นทุนการลงทุนเริ่มต้น *</label>
              <input type="text" class="form-control" id="s-desc" required placeholder="เช่น ค่าเซ้งตึก, เตียงสปานวดหน้า">
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="s-cat">หมวดหมู่ทรัพย์สินหลัก</label>
                <select id="s-cat">
                  <option value="มัดจำร้าน/ค่าเช่าตั้งต้น">มัดจำร้าน / ค่าเช่าแรกเข้า</option>
                  <option value="ค่าตกแต่งสถานที่">ค่าตกแต่งสถานที่ / งานระบบ</option>
                  <option value="ค่าเครื่องมือ/เตียง/อุปกรณ์">ค่าเครื่องมือ / เตียง / ตู้อบ</option>
                  <option value="เฟอร์นิเจอร์สำนักงาน">เฟอร์นิเจอร์ / การตกแต่ง</option>
                  <option value="ป้ายร้าน/โฆษณาแรกเปิด">ป้ายร้าน / สื่อโปรโมตเริ่มต้น</option>
                  <option value="สต๊อกสมุนไพรเริ่มแรก">สต๊อกยาสมุนไพรเริ่มต้น</option>
                  <option value="เอกสาร/ใบอนุญาตกิจการ">เอกสารสิทธิ์ / ใบอนุญาตสปา</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>
              <div class="form-group">
                <label for="s-amount">มูลค่าเงินลงทุน (฿) *</label>
                <input type="number" class="form-control" id="s-amount" required min="1" placeholder="0">
              </div>
            </div>
            <div class="form-group">
              <label for="s-date">วันที่ลงเงินทุน *</label>
              <input type="date" class="form-control" id="s-date" required>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-start-modal-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-start" type="submit">บันทึกต้นทุนสะสม</button>
        </div>
      </div>
    </div>
  `;
}

export function setupStartupCostsEvents(state, navigate) {
  const modal = document.getElementById('modal-start');

  document.getElementById('btn-start-add')?.addEventListener('click', () => {
    document.getElementById('form-start').reset();
    document.getElementById('start-editing-id').value = '';
    document.getElementById('s-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('start-modal-title').textContent = 'บันทึกต้นทุนจัดตั้งคลินิก';
    modal.style.display = 'flex';
  });

  const closeM = () => modal.style.display = 'none';
  document.getElementById('modal-start-close')?.addEventListener('click', closeM);
  document.getElementById('btn-start-modal-cancel')?.addEventListener('click', closeM);

  // Edit Startup Cost
  document.querySelectorAll('.btn-edit-start').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id);
      const st = state.startup_costs.find(s => s.id === id);
      if (!st) return;

      document.getElementById('start-editing-id').value = id;
      document.getElementById('s-desc').value = st.description || '';
      document.getElementById('s-cat').value = st.category || 'อื่นๆ';
      document.getElementById('s-amount').value = st.amount;
      document.getElementById('s-date').value = st.date;
      
      document.getElementById('start-modal-title').textContent = 'แก้ไขต้นทุนจัดตั้งคลินิก';
      modal.style.display = 'flex';
    });
  });

  document.getElementById('form-start')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('s-amount').value);
    const editingId = document.getElementById('start-editing-id').value;

    // VALIDATION: non-negative check
    if (amount < 0) {
      alert('มูลค่าเงินลงทุนห้ามติดลบ!');
      return;
    }

    const st = {
      description: document.getElementById('s-desc').value,
      category: document.getElementById('s-cat').value,
      amount: amount,
      date: document.getElementById('s-date').value
    };

    if (editingId) {
      st.id = Number(editingId);
      await ClinicDB.putStoreData('startup_costs', st);
      alert('แก้ไขรายการสำเร็จ!');
    } else {
      // Save to V3 startup_costs
      await ClinicDB.addStoreData('startup_costs', st);
      alert('บันทึกต้นทุนสำเร็จ!');
    }

    state.startup_costs = await ClinicDB.getStoreData('startup_costs');
    closeM();
    navigate('startup-costs');
  });

  document.querySelectorAll('.btn-del-start').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (confirm('คุณต้องการลบประวัติเงินทุนตั้งต้นรายการนี้หรือไม่?')) {
        const id = Number(e.target.dataset.id);
        await ClinicDB.deleteStoreData('startup_costs', id);
        state.startup_costs = await ClinicDB.getStoreData('startup_costs');
        navigate('startup-costs');
      }
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 14. BREAK EVEN PAGE (จุดคืนทุน)
// -------------------------------------------------------------
export function renderBreakEven(state) {
  // Use V3 stores: startup_costs, income_transactions, expense_transactions
  const startup = state.startup_costs?.reduce((sum, f) => sum + f.amount, 0) || 0;
  const expenses = state.expense_transactions?.reduce((sum, f) => sum + f.amount, 0) || 0;
  const salesVal = state.income_transactions?.reduce((sum, s) => sum + s.netAmount, 0) || 0;

  const netCash = salesVal - expenses;
  const breakEvenVal = Math.max(0, startup - netCash);
  const breakEvenPercent = startup > 0 ? Math.min(100, Math.max(0, (netCash / startup) * 100)) : 0;

  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบวิเคราะห์ประเมินจุดคุ้มทุนสะสม (V3 MVP formulas)</h2>
        <p>สูตรประเมินเทียบทรัพย์สินตั้งต้นเปิดร้าน กับกำไรสะสมหลังหักค่าใช้จ่ายดำเนินการจริง</p>
      </div>
    </div>

    <div class="card">
      <h3 style="font-weight:700; margin-bottom:16px;">สัดส่วนความก้าวหน้าการคืนทุน (Payback progress)</h3>
      <div class="progress-bar-container" style="height:36px; margin-bottom:24px;">
        <div class="progress-bar" style="width: ${breakEvenPercent}%;"></div>
        <span class="progress-label" style="font-size:15px; color:${breakEvenPercent > 50 ? 'white' : 'var(--dark)'}">${breakEvenPercent.toFixed(1)}%</span>
      </div>

      <div class="grid-cols-2">
        <div class="card" style="background-color:var(--gray-50);">
          <h4 style="font-weight:700; margin-bottom:12px;">บัญชีรายได้ vs ทุนตั้งต้น (สูตรทางการเงิน)</h4>
          <div class="finance-stats" style="gap:10px; font-size:14px;">
            <div class="finance-row"><span>1. เงินลงทุนเริ่มต้นรวม (Startup Costs):</span><span style="color:var(--danger); font-weight:700;">฿${startup.toLocaleString()}</span></div>
            <div class="finance-row"><span>2. รายรับสุทธิสะสม (Revenues):</span><span style="color:var(--primary); font-weight:700;">฿${salesVal.toLocaleString()}</span></div>
            <div class="finance-row"><span>3. รายจ่ายดำเนินงานสะสม (Expenses):</span><span style="color:var(--danger)">฿${expenses.toLocaleString()}</span></div>
            <div class="finance-row" style="border-top:2px solid var(--gray-300); font-weight:700; padding-top:8px;">
              <span>เงินสดสุทธิสะสม (2 - 3):</span>
              <span style="color:var(--success)">฿${netCash.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div class="card" style="background-color:var(--primary-light); display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
          ${netCash >= startup ? `
            <div style="font-size:48px; margin-bottom:12px;">🎉</div>
            <h3 style="color:var(--primary); font-weight:700;">คลินิกคืนทุนสมบูรณ์แล้ว!</h3>
            <p style="font-size:14px; margin-top:8px; color:var(--gray-600)">ขณะนี้ธุรกิจของคุณสร้างผลกำไรสุทธิสะสมสะสมอยู่ <strong>฿${(netCash - startup).toLocaleString()}</strong></p>
          ` : `
            <h4 style="color:var(--gray-600); font-weight:600;">ยอดเงินที่เหลือสะสมเพื่อคืนทุน</h4>
            <div style="font-size:32px; font-weight:800; color:var(--accent); margin:12px 0;">฿${breakEvenVal.toLocaleString()}</div>
            <p style="font-size:13px; color:var(--gray-500); line-height:1.6;">
              ระบบประเมินจากผลต่างกำไรสุทธิ ต้องการกำไรอีก ฿${breakEvenVal.toLocaleString()} จึงจะถึงจุดคุ้มทุนเริ่มคืนทุน
            </p>
          `}
        </div>
      </div>
    </div>
  `;
}
export function setupBreakEvenEvents(state, navigate) {
  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 15. FINANCIAL REPORTS PAGE (รายงานการเงิน)
// -------------------------------------------------------------
export function renderFinancialReports(state) {
  const today = new Date();
  let startStr = reportStartDate || '';
  let endStr = reportEndDate || '';

  // Calculate default dates if no custom dates specified
  if (!startStr && !endStr) {
    if (reportPeriod === 'daily') {
      startStr = today.toISOString().split('T')[0];
      endStr = startStr;
    } else if (reportPeriod === 'weekly') {
      const pastWeek = new Date();
      pastWeek.setDate(today.getDate() - 7);
      startStr = pastWeek.toISOString().split('T')[0];
      endStr = today.toISOString().split('T')[0];
    } else if (reportPeriod === 'monthly') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      startStr = new Date(startOfMonth.getTime() - (startOfMonth.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      endStr = today.toISOString().split('T')[0];
    } else if (reportPeriod === 'yearly') {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      startStr = new Date(startOfYear.getTime() - (startOfYear.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      endStr = today.toISOString().split('T')[0];
    }
  }

  // Filter transactions
  const sales = (state.income_transactions || []).filter(s => {
    if (startStr && s.date < startStr) return false;
    if (endStr && s.date > endStr) return false;
    return true;
  });

  const expenses = (state.expense_transactions || []).filter(e => {
    if (startStr && e.date < startStr) return false;
    if (endStr && e.date > endStr) return false;
    return true;
  });

  const cashInflow = sales.filter(s => s.isPaid !== false).reduce((sum, s) => sum + s.netAmount, 0);
  const unpaidRevenue = sales.filter(s => s.isPaid === false).reduce((sum, s) => sum + s.netAmount, 0);
  const expenseSum = expenses.reduce((sum, e) => sum + e.amount, 0);
  const cashProfit = cashInflow - expenseSum;
  const revenueSum = cashInflow + unpaidRevenue;

  // 1. Income Category Breakdown
  const categoryBreakdown = {};
  sales.forEach(s => {
    const cat = s.category || 'ค่าบริการ';
    if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { count: 0, amount: 0 };
    categoryBreakdown[cat].count += 1;
    categoryBreakdown[cat].amount += s.netAmount;
  });

  // 1.2. Consignment Payout Settlement Calculation
  const consignmentSettlements = {};
  const periodSales = (state.sales || []).filter(s => {
    if (startStr && s.date < startStr) return false;
    if (endStr && s.date > endStr) return false;
    return true;
  });

  periodSales.forEach(s => {
    (s.items || []).forEach(item => {
      const invItem = state.inventory.find(i => i.name === item.name);
      if (invItem && invItem.isConsignment && !item.consignmentSettled) {
        const provider = invItem.consignmentProvider || 'ไม่ระบุผู้ฝาก';
        if (!consignmentSettlements[provider]) {
          consignmentSettlements[provider] = {
            items: {},
            totalPayout: 0,
            saleIds: new Set()
          };
        }
        if (!consignmentSettlements[provider].items[item.name]) {
          consignmentSettlements[provider].items[item.name] = {
            count: 0,
            unitCost: invItem.consignmentCost || 0,
            totalDue: 0
          };
        }
        consignmentSettlements[provider].items[item.name].count += item.qty;
        consignmentSettlements[provider].items[item.name].totalDue += item.qty * (invItem.consignmentCost || 0);
        consignmentSettlements[provider].totalPayout += item.qty * (invItem.consignmentCost || 0);
        consignmentSettlements[provider].saleIds.add(s.id);
      }
    });
  });

  // 2. Specific Treatments (หัตถการ/คอร์ส) and Medicine (ยา/สินค้า) Breakdown
  const serviceSales = {};
  const productSales = {};

  sales.forEach(s => {
    const saleObj = state.sales.find(o => o.queueId === s.queueId);
    if (saleObj) {
      (saleObj.items || []).forEach(item => {
        const invItem = state.inventory.find(i => i.name === item.name);
        const type = invItem ? invItem.type : 'service';
        if (type === 'service' || type === 'package') {
          if (!serviceSales[item.name]) serviceSales[item.name] = { count: 0, revenue: 0 };
          serviceSales[item.name].count += item.qty;
          serviceSales[item.name].revenue += item.price * item.qty;
        } else {
          if (!productSales[item.name]) productSales[item.name] = { count: 0, revenue: 0 };
          productSales[item.name].count += item.qty;
          productSales[item.name].revenue += item.price * item.qty;
        }
      });
    } else {
      // General income
      const cat = s.category || 'อื่นๆ';
      if (!serviceSales[cat]) serviceSales[cat] = { count: 0, revenue: 0 };
      serviceSales[cat].count += 1;
      serviceSales[cat].revenue += s.netAmount;
    }
  });

  return `
    ${renderSeedDataBanner(state)}
    <!-- Print-only Header with Logo (Top-Left) and Clinic Information -->
    <div class="print-report-header" style="display:none; align-items:center; gap:16px; margin-bottom:24px; border-bottom:2px solid var(--gray-300); padding-bottom:12px;">
      ${state.settings?.logo ? `<img src="${state.settings.logo}" style="width:60px; height:60px; border-radius:8px; object-fit:cover;">` : ''}
      <div>
        <h1 style="font-size:20px; margin:0; color:var(--primary); font-weight:700;">${state.settings?.name || 'เรือนสมุนไพรคลินิก'}</h1>
        <p style="font-size:12px; margin:4px 0 0 0; color:var(--gray-600);">${state.settings?.address || ''} | โทร: ${state.settings?.phone || ''}</p>
      </div>
    </div>

    <div class="page-header">
      <div class="page-title-desc">
        <h2>รายงานวิเคราะห์ธุรกิจและการเงินเชิงลึก (BI Report)</h2>
        <p>รายงานสถิติรายได้ รายจ่าย กำไรสุทธิ และจัดอันดับบริการที่ได้รับความนิยมสูงที่สุด</p>
      </div>
      <button class="btn btn-primary" id="btn-print-pdf-report">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
        พิมพ์รายงานสรุปผู้บริหาร (PDF)
      </button>
    </div>

    <!-- Date Range & Period Filter -->
    <div class="card" style="margin-bottom:20px; padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="btn btn-sm ${reportPeriod === 'all' && !reportStartDate && !reportEndDate ? 'btn-primary' : 'btn-secondary'}" id="btn-rep-all">ทั้งหมด</button>
          <button class="btn btn-sm ${reportPeriod === 'daily' && !reportStartDate && !reportEndDate ? 'btn-primary' : 'btn-secondary'}" id="btn-rep-daily">รายวัน</button>
          <button class="btn btn-sm ${reportPeriod === 'weekly' && !reportStartDate && !reportEndDate ? 'btn-primary' : 'btn-secondary'}" id="btn-rep-weekly">รายสัปดาห์</button>
          <button class="btn btn-sm ${reportPeriod === 'monthly' && !reportStartDate && !reportEndDate ? 'btn-primary' : 'btn-secondary'}" id="btn-rep-monthly">รายเดือน</button>
          <button class="btn btn-sm ${reportPeriod === 'yearly' && !reportStartDate && !reportEndDate ? 'btn-primary' : 'btn-secondary'}" id="btn-rep-yearly">รายปี</button>
        </div>
        <div style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600;">
          <span>หรือเลือกช่วงวันที่:</span>
          <input type="date" id="rep-start-date" class="form-control" style="width:140px; margin:0;" value="${reportStartDate}">
          <span>ถึง</span>
          <input type="date" id="rep-end-date" class="form-control" style="width:140px; margin:0;" value="${reportEndDate}">
          <button class="btn btn-primary btn-sm" id="btn-rep-apply" style="padding:4px 10px;">กรอง</button>
        </div>
      </div>
    </div>

    <div class="grid-cols-4" style="margin-bottom:20px;">
      <div class="card stat-card" style="border-left-color: var(--success);">
        <div class="stat-info">
          <span class="stat-label">รายรับเงินสดช่วงเวลา</span>
          <span class="stat-value" style="color:var(--success);">฿${cashInflow.toLocaleString()}</span>
        </div>
      </div>
      <div class="card stat-card" style="border-left-color: var(--danger);">
        <div class="stat-info">
          <span class="stat-label">ยอดค้างชำระสะสมช่วงเวลา</span>
          <span class="stat-value" style="color:var(--danger);">฿${unpaidRevenue.toLocaleString()}</span>
        </div>
      </div>
      <div class="card stat-card" style="border-left-color: var(--warning);">
        <div class="stat-info">
          <span class="stat-label">รายจ่ายรวมช่วงเวลา</span>
          <span class="stat-value" style="color:var(--warning-hover);">฿${expenseSum.toLocaleString()}</span>
        </div>
      </div>
      <div class="card stat-card" style="border-left-color: var(--primary);">
        <div class="stat-info">
          <span class="stat-label">กำไรเงินสดสุทธิช่วงเวลา</span>
          <span class="stat-value" style="color:var(--primary-hover);">฿${cashProfit.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <div class="grid-cols-2">
      <!-- Income Category Breakdown -->
      <div class="card">
        <h3 style="font-weight:700; margin-bottom:12px; color:var(--primary);">รายรับจำแนกตามประเภท (Income Group)</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ประเภทรายรับ</th>
                <th style="text-align:center;">จำนวนครั้ง</th>
                <th style="text-align:right;">ยอดรวม (฿)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(categoryBreakdown).length === 0 ? `<tr><td colspan="3" style="text-align:center; color:var(--gray-400);">ไม่มีรายการรายรับในช่วงเวลานี้</td></tr>` :
                Object.keys(categoryBreakdown).map(cat => `
                  <tr>
                    <td><strong>${cat}</strong></td>
                    <td style="text-align:center;">${categoryBreakdown[cat].count} รายการ</td>
                    <td style="text-align:right; font-weight:700; color:var(--primary);">฿${categoryBreakdown[cat].amount.toLocaleString()}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- General Stats info -->
      <div class="card">
        <h3 style="font-weight:700; margin-bottom:12px; color:var(--primary);">งบดำเนินงานโดยสรุป (P&L Overview)</h3>
        <div class="finance-stats" style="gap:12px; font-size:14px; margin-top:16px;">
          <div class="finance-row"><span>วันเริ่มต้นรายงาน:</span><span>${startStr ? new Date(startStr).toLocaleDateString('th-TH') : 'จุดเริ่มต้น'}</span></div>
          <div class="finance-row"><span>วันสิ้นสุดรายงาน:</span><span>${endStr ? new Date(endStr).toLocaleDateString('th-TH') : 'ปัจจุบัน'}</span></div>
          <div class="finance-row"><span>สัดส่วนค่าใช้จ่ายต่อรายได้:</span><span>${revenueSum > 0 ? ((expenseSum / revenueSum) * 100).toFixed(1) : 0}%</span></div>
          <div class="finance-row" style="font-weight:700; border-top:2px solid var(--gray-300); padding-top:8px;">
            <span>กำไรสุทธิรวม:</span>
            <span style="color:var(--success); font-size:16px;">฿${cashProfit.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Treatment (หัตถการ) & Products Breakdown -->
    <div class="grid-cols-2" style="margin-top:20px;">
      <div class="card">
        <h3 style="font-weight:700; margin-bottom:12px; color:var(--primary);">ยอดรายได้แยกตามประเภทหัตถการบำบัด</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ชื่อบริการหัตถการ / คอร์ส</th>
                <th style="text-align:center;">จำนวนที่ทำ</th>
                <th style="text-align:right;">รวมรายได้ (฿)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(serviceSales).length === 0 ? `<tr><td colspan="3" style="text-align:center; color:var(--gray-400);">ไม่มีข้อมูลยอดขายบริการ</td></tr>` :
                Object.keys(serviceSales).map(name => `
                  <tr>
                    <td><strong>${name}</strong></td>
                    <td style="text-align:center;">${serviceSales[name].count} ครั้ง</td>
                    <td style="text-align:right; font-weight:700; color:var(--primary);">฿${serviceSales[name].revenue.toLocaleString()}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3 style="font-weight:700; margin-bottom:12px; color:var(--primary);">ยอดขายแยกตามประเภทสมุนไพร & ผลิตภัณฑ์</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ชื่อยาสมุนไพร / ผลิตภัณฑ์คลัง</th>
                <th style="text-align:center;">จำนวนที่จำหน่าย</th>
                <th style="text-align:right;">รวมยอดจำหน่าย (฿)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(productSales).length === 0 ? `<tr><td colspan="3" style="text-align:center; color:var(--gray-400);">ไม่มีข้อมูลยอดขายสินค้า</td></tr>` :
                Object.keys(productSales).map(name => `
                  <tr>
                    <td><strong>${name}</strong></td>
                    <td style="text-align:center;">${productSales[name].count} ชิ้น</td>
                    <td style="text-align:right; font-weight:700; color:var(--primary);">฿${productSales[name].revenue.toLocaleString()}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Consignment Settlement Section -->
    <div class="card" style="margin-top:20px;">
      <h3 style="font-weight:700; margin-bottom:4px; color:var(--primary);">รายงานสรุปและตัดยอดสินค้าฝากขาย (Consignment Payout Summary)</h3>
      <p style="color:var(--gray-500); font-size:13px; margin-bottom:16px;">สรุปยอดเงินต้นทุนที่คลินิกต้องเคลียร์จ่ายคืนให้ผู้ฝากขายยาสมุนไพรและผลิตภัณฑ์ตามยอดที่ขายได้จริง</p>
      
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>ผู้ฝากขาย (Supplier)</th>
              <th>รายการสินค้าฝากขาย (จำนวนชิ้น x ทุนต่อชิ้น)</th>
              <th style="text-align:center;">จำนวนรวม</th>
              <th style="text-align:right; color:var(--danger);">ยอดเงินที่ต้องจ่ายคืนผู้ฝาก (฿)</th>
              <th style="text-align:center; width:150px;">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(consignmentSettlements).length === 0 ? `<tr><td colspan="5" style="text-align:center; color:var(--gray-400); padding:20px;">ไม่มีรายการขายสินค้าฝากขายค้างชำระจ่ายในช่วงเวลานี้</td></tr>` :
              Object.keys(consignmentSettlements).map(provider => {
                const provData = consignmentSettlements[provider];
                const itemsList = Object.keys(provData.items).map(name => {
                  const it = provData.items[name];
                  return `${name} (${it.count} ชิ้น x ฿${it.unitCost})`;
                }).join(', ');
                
                return `
                  <tr>
                    <td><strong>${provider}</strong></td>
                    <td style="font-size:13px; color:var(--gray-600); max-width:300px; overflow:hidden; text-overflow:ellipsis;">${itemsList}</td>
                    <td style="text-align:center;">
                      ${Object.keys(provData.items).reduce((sum, name) => sum + provData.items[name].count, 0)} ชิ้น
                    </td>
                    <td style="text-align:right; font-weight:700; color:var(--danger);">
                      ฿${provData.totalPayout.toLocaleString()}
                    </td>
                    <td style="text-align:center;">
                      <button class="btn btn-danger btn-sm btn-settle-consignment" data-provider="${provider}" data-payout="${provData.totalPayout}">
                        เคลียร์ยอดจ่ายเงิน
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function setupFinancialReportsEvents(state, navigate) {
  // Period Buttons
  document.getElementById('btn-rep-all')?.addEventListener('click', () => {
    reportPeriod = 'all';
    reportStartDate = '';
    reportEndDate = '';
    navigate('financial-reports');
  });

  document.getElementById('btn-rep-daily')?.addEventListener('click', () => {
    reportPeriod = 'daily';
    reportStartDate = '';
    reportEndDate = '';
    navigate('financial-reports');
  });

  document.getElementById('btn-rep-weekly')?.addEventListener('click', () => {
    reportPeriod = 'weekly';
    reportStartDate = '';
    reportEndDate = '';
    navigate('financial-reports');
  });

  document.getElementById('btn-rep-monthly')?.addEventListener('click', () => {
    reportPeriod = 'monthly';
    reportStartDate = '';
    reportEndDate = '';
    navigate('financial-reports');
  });

  document.getElementById('btn-rep-yearly')?.addEventListener('click', () => {
    reportPeriod = 'yearly';
    reportStartDate = '';
    reportEndDate = '';
    navigate('financial-reports');
  });

  // Apply custom range
  document.getElementById('btn-rep-apply')?.addEventListener('click', () => {
    reportStartDate = document.getElementById('rep-start-date').value;
    reportEndDate = document.getElementById('rep-end-date').value;
    reportPeriod = 'custom';
    navigate('financial-reports');
  });

  // Consignment Payout Settlement Click
  document.querySelectorAll('.btn-settle-consignment').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const provider = e.target.dataset.provider;
      const payout = Number(e.target.dataset.payout);
      
      if (confirm(`คุณต้องการเคลียร์ยอดจ่ายเงินให้แก่ผู้ฝากขาย "${provider}" เป็นจำนวนเงิน ฿${payout.toLocaleString()} และบันทึกเป็นรายจ่ายของคลินิกใช่หรือไม่?`)) {
        // 1. Log an expense transaction
        const expense = {
          description: `จ่ายค่าสินค้าฝากขายเคลียร์ยอดให้ ${provider}`,
          category: 'ซื้อยา/ผลิตภัณฑ์',
          amount: payout,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        };
        await ClinicDB.addStoreData('expense_transactions', expense);
        
        // 2. Loop through period sales, find items belonging to this provider, and mark them consignmentSettled = true
        let startStr = reportStartDate || '';
        let endStr = reportEndDate || '';
        if (!startStr && !endStr) {
          const today = new Date();
          if (reportPeriod === 'daily') {
            startStr = today.toISOString().split('T')[0];
            endStr = startStr;
          } else if (reportPeriod === 'weekly') {
            const pastWeek = new Date();
            pastWeek.setDate(today.getDate() - 7);
            startStr = pastWeek.toISOString().split('T')[0];
            endStr = today.toISOString().split('T')[0];
          } else if (reportPeriod === 'monthly') {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            startStr = new Date(startOfMonth.getTime() - (startOfMonth.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            endStr = today.toISOString().split('T')[0];
          } else if (reportPeriod === 'yearly') {
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            startStr = new Date(startOfYear.getTime() - (startOfYear.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            endStr = today.toISOString().split('T')[0];
          }
        }
        
        const salesToUpdate = (state.sales || []).filter(s => {
          if (startStr && s.date < startStr) return false;
          if (endStr && s.date > endStr) return false;
          return true;
        });
        
        for (const s of salesToUpdate) {
          let updated = false;
          (s.items || []).forEach(item => {
            const invItem = state.inventory.find(i => i.name === item.name);
            if (invItem && invItem.isConsignment && invItem.consignmentProvider === provider && !item.consignmentSettled) {
              item.consignmentSettled = true;
              updated = true;
            }
          });
          if (updated) {
            await ClinicDB.putStoreData('sales', s);
          }
        }
        
        alert(`ตัดยอดเงินและจ่ายค่าสินค้าฝากขายให้แก่ "${provider}" สำเร็จ!`);
        state.sales = await ClinicDB.getSales();
        state.expense_transactions = await ClinicDB.getStoreData('expense_transactions');
        navigate('financial-reports');
      }
    });
  });

  // PDF Print Trigger
  document.getElementById('btn-print-pdf-report')?.addEventListener('click', () => {
    window.print();
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 16. HERBS PAGE (ยาและสมุนไพร)
// -------------------------------------------------------------
export function renderHerbs(state) {
  const list = state.inventory.filter(i => i.type === 'medicine');
  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>คลังข้อมูลทะเบียนยาสมุนไพรและยาเดี่ยว</h2>
        <p>บันทึกรายชื่อยาสมุนไพร ยาต้ม ยาลูกกลอน ยาตำรับ ราคาต้นทุนขาย และวันหมดอายุ</p>
      </div>
      <button class="btn btn-primary" id="btn-herb-add">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 5v14M5 12h14"/></svg>
        เพิ่มยาสมุนไพรเข้าทะเบียน
      </button>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>รหัสยา</th>
              <th>ชื่อยาสมุนไพร / ยาเดี่ยว</th>
              <th style="text-align:right;">ราคาทุน (฿)</th>
              <th style="text-align:right;">ราคาขาย (฿)</th>
              <th style="text-align:center;">จำนวนคงเหลือ</th>
              <th>หน่วยนับ</th>
              <th>วันหมดอายุยา</th>
              <th style="text-align:center;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="8" style="text-align:center; color:var(--gray-400);">ไม่มีข้อมูลยาสมุนไพรในระบบ</td></tr>` : 
              list.map(h => `
                <tr>
                  <td>HERB-${String(h.id).padStart(4, '0')}</td>
                  <td><strong>${h.name}</strong></td>
                  <td style="text-align:right; color:var(--gray-500);">
                    ${h.isConsignment ? `<span class="badge warning" style="font-size:10px; padding:2px 4px;">ฝากขาย</span> ฿0` : `฿${h.cost}`}
                  </td>
                  <td style="text-align:right; font-weight:600; color:var(--primary);">฿${h.price}</td>
                  <td style="text-align:center; font-weight:700; color:${h.stock < 15 ? 'var(--danger)' : 'var(--dark)'}">${h.stock}</td>
                  <td>${h.unit || 'ขวด'}</td>
                  <td><span style="color:${h.expiry && new Date(h.expiry) < new Date() ? 'var(--danger)' : 'var(--dark)'}">${h.expiry ? new Date(h.expiry).toLocaleDateString('th-TH') : '-'}</span></td>
                  <td style="text-align:center; white-space:nowrap;">
                    <div style="display:flex; gap:6px; justify-content:center;">
                      <button class="btn btn-secondary btn-sm btn-edit-herb" data-id="${h.id}">แก้ไข</button>
                      <button class="btn btn-danger btn-sm btn-delete-herb" data-id="${h.id}">ลบ</button>
                    </div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
 
    <!-- Modal Herb -->
    <div class="modal-backdrop" id="modal-herb" style="display:none;">
      <div class="modal-container">
        <div class="modal-header">
          <h3>ลงทะเบียนยาสมุนไพรใหม่</h3>
          <button class="close-btn" id="modal-herb-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-herb">
            <input type="hidden" id="h-id">
            <div class="form-group">
              <label for="h-name">ชื่อยาสมุนไพร / ยาตำรับ *</label>
              <input type="text" class="form-control" id="h-name" required placeholder="เช่น ฟ้าทะลายโจรชนิดแคปซูล">
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="h-cost">ราคาทุนของสินค้า (฿) *</label>
                <input type="number" class="form-control" id="h-cost" required min="0" placeholder="0">
              </div>
              <div class="form-group">
                <label for="h-price">ราคาตั้งขายจริง (฿) *</label>
                <input type="number" class="form-control" id="h-price" required min="0" placeholder="0">
              </div>
            </div>
            <div class="form-group" style="display:flex; align-items:center; gap:8px; margin-top:8px; margin-bottom:12px;">
              <input type="checkbox" id="h-consignment" style="width:16px; height:16px; margin:0;">
              <label for="h-consignment" style="font-weight:600; cursor:pointer; margin:0;">ยาสมุนไพรนี้เป็นสินค้าฝากขาย (Consignment)</label>
            </div>
            <div id="h-consignment-fields" style="display:none; border:1px dashed var(--gray-300); border-radius:8px; padding:12px; margin-bottom:12px; background-color:var(--gray-50);">
              <div class="form-group">
                <label for="h-consignment-provider">ชื่อผู้ฝากขาย (เจ้าของยาสมุนไพร)</label>
                <input type="text" class="form-control" id="h-consignment-provider" placeholder="เช่น บริษัท ชุมชนยาไทย จำกัด">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label for="h-consignment-cost">ต้นทุนจ่ายคืนผู้ฝากเมื่อขายได้ต่อหน่วย (฿)</label>
                <input type="number" class="form-control" id="h-consignment-cost" min="0" value="0">
              </div>
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="h-stock">จำนวนคงคลังนำเข้าเริ่มแรก *</label>
                <input type="number" class="form-control" id="h-stock" required min="0" value="50">
              </div>
              <div class="form-group">
                <label for="h-unit">หน่วยนับ</label>
                <input type="text" class="form-control" id="h-unit" required value="กระปุก">
              </div>
            </div>
            <div class="form-group">
              <label for="h-expiry">วันหมดอายุยา (Expiry Date)</label>
              <input type="date" class="form-control" id="h-expiry">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-herb-modal-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-herb" type="submit">บันทึกข้อมูลยาสมุนไพร</button>
        </div>
      </div>
    </div>
  `;
}

export function setupHerbsEvents(state, navigate) {
  const modal = document.getElementById('modal-herb');
  const consignmentCheck = document.getElementById('h-consignment');
  const consignmentFields = document.getElementById('h-consignment-fields');
  const costInput = document.getElementById('h-cost');

  const updateConsignmentUI = (checked) => {
    if (checked) {
      if (consignmentFields) consignmentFields.style.display = 'block';
      costInput.value = '0';
      costInput.disabled = true;
    } else {
      if (consignmentFields) consignmentFields.style.display = 'none';
      costInput.disabled = false;
    }
  };

  consignmentCheck?.addEventListener('change', (e) => {
    updateConsignmentUI(e.target.checked);
  });

  const populateForm = (item) => {
    document.getElementById('h-id').value = item.id;
    document.getElementById('h-name').value = item.name;
    document.getElementById('h-cost').value = item.cost;
    document.getElementById('h-price').value = item.price;
    document.getElementById('h-stock').value = item.stock;
    document.getElementById('h-unit').value = item.unit;
    document.getElementById('h-expiry').value = item.expiry || '';
    
    if (item.isConsignment) {
      consignmentCheck.checked = true;
      document.getElementById('h-consignment-provider').value = item.consignmentProvider || '';
      document.getElementById('h-consignment-cost').value = item.consignmentCost || 0;
      updateConsignmentUI(true);
    } else {
      consignmentCheck.checked = false;
      document.getElementById('h-consignment-provider').value = '';
      document.getElementById('h-consignment-cost').value = 0;
      updateConsignmentUI(false);
    }
  };

  if (window.autoOpenEditItemId) {
    const editId = window.autoOpenEditItemId;
    const item = state.inventory.find(i => i.id === editId);
    if (item && item.type === 'medicine') {
      window.autoOpenEditItemId = null; // consume
      populateForm(item);
      if (modal) modal.style.display = 'flex';
    }
  }

  document.getElementById('btn-herb-add')?.addEventListener('click', () => {
    document.getElementById('form-herb').reset();
    document.getElementById('h-id').value = '';
    consignmentCheck.checked = false;
    updateConsignmentUI(false);
    modal.style.display = 'flex';
  });

  const closeM = () => modal.style.display = 'none';
  document.getElementById('modal-herb-close')?.addEventListener('click', closeM);
  document.getElementById('btn-herb-modal-cancel')?.addEventListener('click', closeM);

  document.getElementById('form-herb')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idVal = document.getElementById('h-id').value;

    const isCons = consignmentCheck.checked;
    const cost = isCons ? 0 : Number(costInput.value);
    const price = Number(document.getElementById('h-price').value);
    const stock = Number(document.getElementById('h-stock').value);
    if (cost < 0 || price < 0 || stock < 0) {
      alert('จำนวนเงินและสต๊อกห้ามมีค่าติดลบ!');
      return;
    }

    const herb = {
      name: document.getElementById('h-name').value,
      type: 'medicine',
      cost: cost,
      price: price,
      stock: stock,
      unit: document.getElementById('h-unit').value,
      expiry: document.getElementById('h-expiry').value,
      isConsignment: isCons,
      consignmentProvider: isCons ? document.getElementById('h-consignment-provider').value : '',
      consignmentCost: isCons ? Number(document.getElementById('h-consignment-cost').value) : 0
    };

    if (idVal) {
      herb.id = Number(idVal);
      await ClinicDB.updateInventoryItem(herb);
    } else {
      await ClinicDB.addInventoryItem(herb);
    }

    state.inventory = await ClinicDB.getInventory();
    closeM();
    navigate('herbs');
  });

  document.querySelectorAll('.btn-edit-herb').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id);
      const item = state.inventory.find(i => i.id === id);
      populateForm(item);
      modal.style.display = 'flex';
    });
  });

  document.querySelectorAll('.btn-delete-herb').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (confirm('คุณต้องการลบยาสมุนไพรตำรับนี้ออกจากระบบอย่างถาวรใช่หรือไม่? (การลบประวัติอาจส่งผลต่อการเชื่อมโยงระบบบิล)')) {
        const id = Number(e.target.closest('button').dataset.id);
        await ClinicDB.deleteInventoryItem(id);
        state.inventory = await ClinicDB.getInventory();
        alert('ลบข้อมูลยาสมุนไพรสำเร็จ!');
        navigate('herbs');
      }
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 17. PRODUCTS PAGE (ผลิตภัณฑ์)
// -------------------------------------------------------------
export function renderProducts(state) {
  const list = state.inventory.filter(i => i.type === 'product');
  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>คลังระบบผลิตภัณฑ์เพื่อสุขภาพและเวชสำอาง</h2>
        <p>ผลิตภัณฑ์ประทินผิว น้ำมันไพลนวดตัว ครีมพอกหน้าสมุนไพร ชาสุขภาพ ที่คลินิกจำหน่าย</p>
      </div>
      <button class="btn btn-primary" id="btn-prod-add">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 5v14M5 12h14"/></svg>
        เพิ่มผลิตภัณฑ์สุขภาพ
      </button>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>รหัสสินค้า</th>
              <th>ชื่อผลิตภัณฑ์เพื่อสุขภาพ</th>
              <th style="text-align:right;">ราคาทุน (฿)</th>
              <th style="text-align:right;">ราคาขาย (฿)</th>
              <th style="text-align:center;">จำนวนคงเหลือ</th>
              <th>หน่วยนับ</th>
              <th style="text-align:center;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--gray-400);">ไม่มีข้อมูลผลิตภัณฑ์จำหน่ายในระบบ</td></tr>` : 
              list.map(p => `
                <tr>
                  <td>PROD-${String(p.id).padStart(4, '0')}</td>
                  <td><strong>${p.name}</strong></td>
                  <td style="text-align:right; color:var(--gray-500);">
                    ${p.isConsignment ? `<span class="badge warning" style="font-size:10px; padding:2px 4px;">ฝากขาย</span> ฿0` : `฿${p.cost}`}
                  </td>
                  <td style="text-align:right; font-weight:600; color:var(--primary);">฿${p.price}</td>
                  <td style="text-align:center; font-weight:700; color:${p.stock < 15 ? 'var(--danger)' : 'var(--dark)'}">${p.stock}</td>
                  <td>${p.unit || 'ชิ้น'}</td>
                  <td style="text-align:center; white-space:nowrap;">
                    <div style="display:flex; gap:6px; justify-content:center;">
                      <button class="btn btn-secondary btn-sm btn-edit-prod" data-id="${p.id}">แก้ไข</button>
                      <button class="btn btn-danger btn-sm btn-delete-prod" data-id="${p.id}">ลบ</button>
                    </div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Product -->
    <div class="modal-backdrop" id="modal-prod" style="display:none;">
      <div class="modal-container">
        <div class="modal-header">
          <h3>ลงทะเบียนผลิตภัณฑ์ใหม่</h3>
          <button class="close-btn" id="modal-prod-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-prod">
            <input type="hidden" id="p-id-field">
            <div class="form-group">
              <label for="p-name-field">ชื่อผลิตภัณฑ์เพื่อสุขภาพ *</label>
              <input type="text" class="form-control" id="p-name-field" required placeholder="เช่น ครีมมะขามพอกผิวออร์แกนิก">
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="p-cost-field">ราคาทุน (฿) *</label>
                <input type="number" class="form-control" id="p-cost-field" required min="0" placeholder="0">
              </div>
              <div class="form-group">
                <label for="p-price-field">ราคาขายหน้าร้าน (฿) *</label>
                <input type="number" class="form-control" id="p-price-field" required min="0" placeholder="0">
              </div>
            </div>
            <div class="form-group" style="display:flex; align-items:center; gap:8px; margin-top:8px; margin-bottom:12px;">
              <input type="checkbox" id="p-consignment" style="width:16px; height:16px; margin:0;">
              <label for="p-consignment" style="font-weight:600; cursor:pointer; margin:0;">ผลิตภัณฑ์นี้เป็นสินค้าฝากขาย (Consignment)</label>
            </div>
            <div id="p-consignment-fields" style="display:none; border:1px dashed var(--gray-300); border-radius:8px; padding:12px; margin-bottom:12px; background-color:var(--gray-50);">
              <div class="form-group">
                <label for="p-consignment-provider">ชื่อผู้ฝากขาย (เจ้าของผลิตภัณฑ์)</label>
                <input type="text" class="form-control" id="p-consignment-provider" placeholder="เช่น บริษัท สปาไทยอินเตอร์ จำกัด">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label for="p-consignment-cost">ต้นทุนจ่ายคืนผู้ฝากเมื่อขายได้ต่อหน่วย (฿)</label>
                <input type="number" class="form-control" id="p-consignment-cost" min="0" value="0">
              </div>
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="p-stock-field">คงคลังนำเข้าเริ่มแรก *</label>
                <input type="number" class="form-control" id="p-stock-field" required min="0" value="50">
              </div>
              <div class="form-group">
                <label for="p-unit-field">หน่วยนับ</label>
                <input type="text" class="form-control" id="p-unit-field" required value="ชิ้น">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-prod-modal-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-prod" type="submit">บันทึกข้อมูลผลิตภัณฑ์</button>
        </div>
      </div>
    </div>
  `;
}

export function setupProductsEvents(state, navigate) {
  const modal = document.getElementById('modal-prod');
  const consignmentCheck = document.getElementById('p-consignment');
  const consignmentFields = document.getElementById('p-consignment-fields');
  const costInput = document.getElementById('p-cost-field');

  const updateConsignmentUI = (checked) => {
    if (checked) {
      if (consignmentFields) consignmentFields.style.display = 'block';
      costInput.value = '0';
      costInput.disabled = true;
    } else {
      if (consignmentFields) consignmentFields.style.display = 'none';
      costInput.disabled = false;
    }
  };

  consignmentCheck?.addEventListener('change', (e) => {
    updateConsignmentUI(e.target.checked);
  });

  const populateForm = (item) => {
    document.getElementById('p-id-field').value = item.id;
    document.getElementById('p-name-field').value = item.name;
    document.getElementById('p-cost-field').value = item.cost;
    document.getElementById('p-price-field').value = item.price;
    document.getElementById('p-stock-field').value = item.stock;
    document.getElementById('p-unit-field').value = item.unit;
    
    if (item.isConsignment) {
      consignmentCheck.checked = true;
      document.getElementById('p-consignment-provider').value = item.consignmentProvider || '';
      document.getElementById('p-consignment-cost').value = item.consignmentCost || 0;
      updateConsignmentUI(true);
    } else {
      consignmentCheck.checked = false;
      document.getElementById('p-consignment-provider').value = '';
      document.getElementById('p-consignment-cost').value = 0;
      updateConsignmentUI(false);
    }
  };

  if (window.autoOpenEditItemId) {
    const editId = window.autoOpenEditItemId;
    const item = state.inventory.find(i => i.id === editId);
    if (item && item.type === 'product') {
      window.autoOpenEditItemId = null; // consume
      populateForm(item);
      if (modal) modal.style.display = 'flex';
    }
  }

  document.getElementById('btn-prod-add')?.addEventListener('click', () => {
    document.getElementById('form-prod').reset();
    document.getElementById('p-id-field').value = '';
    consignmentCheck.checked = false;
    updateConsignmentUI(false);
    modal.style.display = 'flex';
  });

  const closeM = () => modal.style.display = 'none';
  document.getElementById('modal-prod-close')?.addEventListener('click', closeM);
  document.getElementById('btn-prod-modal-cancel')?.addEventListener('click', closeM);

  document.getElementById('form-prod')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idVal = document.getElementById('p-id-field').value;

    const isCons = consignmentCheck.checked;
    const cost = isCons ? 0 : Number(costInput.value);
    const price = Number(document.getElementById('p-price-field').value);
    const stock = Number(document.getElementById('p-stock-field').value);
    if (cost < 0 || price < 0 || stock < 0) {
      alert('ยอดเงินและคงคลังของผลิตภัณฑ์ห้ามติดลบ!');
      return;
    }

    const prod = {
      name: document.getElementById('p-name-field').value,
      type: 'product',
      cost: cost,
      price: price,
      stock: stock,
      unit: document.getElementById('p-unit-field').value,
      isConsignment: isCons,
      consignmentProvider: isCons ? document.getElementById('p-consignment-provider').value : '',
      consignmentCost: isCons ? Number(document.getElementById('p-consignment-cost').value) : 0
    };

    if (idVal) {
      prod.id = Number(idVal);
      await ClinicDB.updateInventoryItem(prod);
    } else {
      await ClinicDB.addInventoryItem(prod);
    }

    state.inventory = await ClinicDB.getInventory();
    closeM();
    navigate('products');
  });

  document.querySelectorAll('.btn-edit-prod').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id);
      const item = state.inventory.find(i => i.id === id);
      populateForm(item);
      modal.style.display = 'flex';
    });
  });

  document.querySelectorAll('.btn-delete-prod').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (confirm('คุณแน่ใจว่าต้องการลบผลิตภัณฑ์นี้ออกจากระบบอย่างถาวร? (การลบประวัติอาจส่งผลต่อการเชื่อมโยงระบบบิล)')) {
        const id = Number(e.target.closest('button').dataset.id);
        await ClinicDB.deleteInventoryItem(id);
        state.inventory = await ClinicDB.getInventory();
        alert('ลบข้อมูลผลิตภัณฑ์สำเร็จ!');
        navigate('products');
      }
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 18. INVENTORY PAGE (คลังสินค้า)
// -------------------------------------------------------------
export function renderInventory(state) {
  const medicines = state.inventory.filter(i => i.type === 'medicine');
  const products = state.inventory.filter(i => i.type === 'product');
  
  const totalStockVal = [...medicines, ...products].reduce((sum, item) => sum + (item.cost * item.stock), 0);
  const lowStockCount = [...medicines, ...products].filter(i => i.stock < 15).length;
  const expiredCount = medicines.filter(h => h.expiry && new Date(h.expiry) < new Date()).length;

  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>รายงานระบบข้อมูลคลังเวชภัณฑ์และสินค้าโดยย่อ</h2>
        <p>ประเมินสรุปจำนวนยาสมุนไพรและผลิตภัณฑ์สุขภาพคงคลัง มูลค่าทรัพย์สินสต๊อก และแจ้งเตือนสำคัญ</p>
      </div>
    </div>

    <!-- Inventory Dashboard -->
    <div class="grid-cols-4" style="margin-bottom:24px;">
      <div class="card stat-card">
        <div class="stat-icon primary">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">จำนวนสินค้า/ยาในคลังรวม</span>
          <span class="stat-value">${medicines.length + products.length} รายการ</span>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon secondary">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">มูลค่าทุนคลังสินค้ารวม</span>
          <span class="stat-value">฿${totalStockVal.toLocaleString()}</span>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon danger">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">สินค้าใกล้หมดคลัง</span>
          <span class="stat-value" style="color:var(--danger)">${lowStockCount} รายการ</span>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon danger" style="background-color:#fee2e2; color:#ef4444;">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">ยาสมุนไพรหมดอายุ</span>
          <span class="stat-value" style="color:var(--danger)">${expiredCount} รายการ</span>
        </div>
      </div>
    </div>

    <!-- Quick List Table -->
    <div class="card">
      <h3 style="font-weight:700; margin-bottom:12px;">รายการสินค้ายาสมุนไพรและผลิตภัณฑ์ทั้งหมด</h3>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>รหัสคลัง</th>
              <th>ชื่อยา/ผลิตภัณฑ์</th>
              <th>ประเภท</th>
              <th>คงเหลือ</th>
              <th>ราคาทุนเฉลี่ย</th>
              <th>ราคาขายจริง</th>
              <th>สถานะแจ้งเตือน</th>
            </tr>
          </thead>
          <tbody>
            ${[...medicines, ...products].map(item => `
              <tr>
                <td>INV-${String(item.id).padStart(4, '0')}</td>
                <td>
                  <a href="#" class="inv-item-link" data-id="${item.id}" data-type="${item.type}" style="color:var(--primary); text-decoration:underline; font-weight:600;">
                    ${item.name}
                  </a>
                </td>
                <td><span class="badge ${item.type === 'medicine' ? 'success' : 'info'}">${item.type === 'medicine' ? 'ยาสมุนไพร' : 'ผลิตภัณฑ์'}</span></td>
                <td style="font-weight:700;">${item.stock} ${item.unit || 'ชิ้น'}</td>
                <td>฿${item.cost.toLocaleString()}</td>
                <td style="color:var(--primary); font-weight:600;">฿${item.price.toLocaleString()}</td>
                <td>
                  ${item.stock < 15 ? `<span class="badge danger">สต๊อกใกล้หมด</span>` : ''}
                  ${item.expiry && new Date(item.expiry) < new Date() ? `<span class="badge danger">หมดอายุแล้ว</span>` : ''}
                  ${item.stock >= 15 && !(item.expiry && new Date(item.expiry) < new Date()) ? `<span class="badge success">ปกติ</span>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
export function setupInventoryEvents(state, navigate) {
  document.querySelectorAll('.inv-item-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = Number(e.target.dataset.id);
      const type = e.target.dataset.type;
      window.autoOpenEditItemId = id;
      if (type === 'medicine') {
        navigate('herbs');
      } else {
        navigate('products');
      }
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 19. STOCK MOVEMENT PAGE (รับเข้า / จ่ายออก)
// -------------------------------------------------------------
export function renderStockMovement(state) {
  const list = state.stock_movements || [];
  const activeItems = state.inventory.filter(i => i.type !== 'service' && i.type !== 'package');

  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบบันทึกรายการรับเข้า / จ่ายออกสต๊อกสินค้า (Stock Movements)</h2>
        <p>บันทึกประวัติการปรับสต๊อกสินค้าเมื่อมีการซื้อยาเพิ่มเข้าร้าน หรือทำลายสินค้าชำรุดเสียหาย</p>
      </div>
      <button class="btn btn-primary" id="btn-stock-adjust">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 5v14M5 12h14"/></svg>
        ทำรายการปรับสต๊อกด่วน
      </button>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>วันที่ดำเนินการ</th>
              <th>ชื่อยา / ผลิตภัณฑ์</th>
              <th>ประเภทรายการ</th>
              <th style="text-align:center;">จำนวนที่ปรับ (ชิ้น)</th>
              <th>เหตุผล / หมายเหตุบันทึก</th>
              <th style="text-align:center; width:60px;">ลบ</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--gray-400); padding:20px;">ไม่มีบันทึกข้อมูลประวัติการทำสต๊อกเข้าออกย้อนหลัง</td></tr>` : 
              list.map(m => `
                <tr>
                  <td>${new Date(m.date).toLocaleDateString('th-TH')}</td>
                  <td><strong>${m.itemName}</strong></td>
                  <td>
                    <span class="badge ${m.type === 'in' ? 'success' : 'danger'}">
                      ${m.type === 'in' ? 'นำสินค้าเข้า' : 'นำสินค้าออก'}
                    </span>
                  </td>
                  <td style="text-align:center; font-weight:700; color:${m.type === 'in' ? 'var(--success)' : 'var(--danger)'}">
                    ${m.type === 'in' ? '+' : '-'}${m.qty}
                  </td>
                  <td>${m.notes || '-'}</td>
                  <td style="text-align:center;">
                    <button class="btn btn-danger btn-sm btn-del-stock-m" data-id="${m.id}">&times;</button>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Adjust Stock -->
    <div class="modal-backdrop" id="modal-stock-m" style="display:none;">
      <div class="modal-container">
        <div class="modal-header">
          <h3>บันทึกปรับปรุงสต๊อกสินค้า</h3>
          <button class="close-btn" id="modal-stock-m-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-stock-m">
            <div class="form-group">
              <label for="sm-item">เลือกสินค้า / ยาสมุนไพร *</label>
              <select id="sm-item" required>
                <option value="">-- เลือกรายการคลังสินค้า --</option>
                ${activeItems.map(i => `<option value="${i.id}">${i.name} (คงเหลือ: ${i.stock} ${i.unit})</option>`).join('')}
              </select>
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="sm-type">ประเภทปรับปรุงสต๊อก</label>
                <select id="sm-type">
                  <option value="in">รับเข้า (นำสินค้าเข้าสต๊อกเพิ่มเติม)</option>
                  <option value="out">จ่ายออก (นำสินค้าออก / ตัดทำลายชำรุด)</option>
                </select>
              </div>
              <div class="form-group">
                <label for="sm-qty">จำนวนชิ้นที่จะปรับปรุง *</label>
                <input type="number" class="form-control" id="sm-qty" required min="1" value="1">
              </div>
            </div>
            <div class="form-group">
              <label for="sm-notes">เหตุผลประกอบการปรับปรุงสต๊อก *</label>
              <input type="text" class="form-control" id="sm-notes" required placeholder="เช่น ซื้อวัตถุดิบเพิ่ม, ยาเสื่อมสภาพค้างนาน">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-sm-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-stock-m" type="submit">ยืนยันปรับปรุงคลัง</button>
        </div>
      </div>
    </div>
  `;
}

export function setupStockMovementEvents(state, navigate) {
  const modal = document.getElementById('modal-stock-m');

  document.getElementById('btn-stock-adjust')?.addEventListener('click', () => {
    document.getElementById('form-stock-m').reset();
    modal.style.display = 'flex';
  });

  const closeM = () => modal.style.display = 'none';
  document.getElementById('modal-stock-m-close')?.addEventListener('click', closeM);
  document.getElementById('btn-sm-cancel')?.addEventListener('click', closeM);

  document.getElementById('form-stock-m')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const itemId = Number(document.getElementById('sm-item').value);
    const type = document.getElementById('sm-type').value;
    const qty = Number(document.getElementById('sm-qty').value);
    const notes = document.getElementById('sm-notes').value;

    // VALIDATION: Non negative check
    if (qty < 0) {
      alert('จำนวนสต๊อกห้ามปรับติดลบ!');
      return;
    }

    const item = state.inventory.find(i => i.id === itemId);
    if (!item) return;

    if (type === 'in') {
      item.stock += qty;
    } else {
      item.stock = Math.max(0, item.stock - qty);
    }

    await ClinicDB.updateInventoryItem(item);

    const log = {
      itemId: itemId,
      itemName: item.name,
      type: type,
      qty: qty,
      notes: notes,
      date: new Date().toISOString().split('T')[0]
    };
    await ClinicDB.addStoreData('stock_movements', log);

    state.inventory = await ClinicDB.getInventory();
    state.stock_movements = await ClinicDB.getStoreData('stock_movements');
    
    closeM();
    navigate('stock-movement');
  });

  document.querySelectorAll('.btn-del-stock-m').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (confirm('คุณแน่ใจว่าต้องการลบรายการประวัติการปรับสต๊อกนี้ออกจากระบบ? (การลบประวัติสต๊อกจะไม่มีผลกระทบต่อยอดคงเหลือปัจจุบัน)')) {
        const id = Number(e.target.closest('button').dataset.id);
        await ClinicDB.deleteStoreData('stock_movements', id);
        state.stock_movements = await ClinicDB.getStoreData('stock_movements');
        alert('ลบประวัติสำเร็จ!');
        navigate('stock-movement');
      }
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 20. STOCK ALERTS PAGE (แจ้งเตือนสต๊อก)
// -------------------------------------------------------------
export function renderStockAlerts(state) {
  const medicines = state.inventory.filter(i => i.type === 'medicine');
  const products = state.inventory.filter(i => i.type === 'product');

  const lowStock = [...medicines, ...products].filter(i => i.stock < 15);
  const expiringSoon = medicines.filter(m => {
    if (!m.expiry) return false;
    const expDate = new Date(m.expiry);
    const today = new Date();
    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 90;
  });

  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบแจ้งเตือนสต๊อกยาสมุนไพรและผลิตภัณฑ์สุขภาพ</h2>
        <p>รายการที่ระบบแนะนำให้สั่งวัตถุดิบเพิ่ม หรือนำยาออกจากชั้นตรวจเนื่องจากใกล้หมดอายุการใช้</p>
      </div>
    </div>

    <div class="grid-cols-2">
      <div class="card">
        <h3 style="font-weight:700; margin-bottom:12px; color:var(--danger);">⚠️ รายการของใกล้หมดคลัง (${lowStock.length})</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ชื่อเวชภัณฑ์/ยา</th>
                <th style="text-align:center;">คงคลัง</th>
                <th>หน่วยนับ</th>
              </tr>
            </thead>
            <tbody>
              ${lowStock.length === 0 ? `<tr><td colspan="3" style="text-align:center; color:var(--gray-400);">ไม่มีรายการแจ้งเตือนคลังใกล้หมด</td></tr>` : 
                lowStock.map(i => `
                  <tr>
                    <td>
                      <a href="#" class="inv-item-link" data-id="${i.id}" data-type="${i.type}" style="color:var(--primary); text-decoration:underline; font-weight:600;">
                        ${i.name}
                      </a>
                    </td>
                    <td style="text-align:center; font-weight:700; color:var(--danger)">${i.stock}</td>
                    <td>${i.unit || 'ขวด'}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3 style="font-weight:700; margin-bottom:12px; color:var(--warning);">📅 ยาสมุนไพรใกล้หมดอายุภายใน 90 วัน (${expiringSoon.length})</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ชื่อยาสมุนไพร</th>
                <th>วันหมดอายุยา</th>
                <th style="text-align:center;">คงคลัง</th>
              </tr>
            </thead>
            <tbody>
              ${expiringSoon.length === 0 ? `<tr><td colspan="3" style="text-align:center; color:var(--gray-400);">ไม่มียาสมุนไพรใกล้หมดอายุในชั้นวาง</td></tr>` : 
                expiringSoon.map(m => `
                  <tr>
                    <td>
                      <a href="#" class="inv-item-link" data-id="${m.id}" data-type="${m.type}" style="color:var(--primary); text-decoration:underline; font-weight:600;">
                        ${m.name}
                      </a>
                    </td>
                    <td style="color:var(--danger); font-weight:600;">${new Date(m.expiry).toLocaleDateString('th-TH')}</td>
                    <td style="text-align:center;">${m.stock}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
export function setupStockAlertsEvents(state, navigate) {
  document.querySelectorAll('.inv-item-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = Number(e.target.dataset.id);
      const type = e.target.dataset.type;
      window.autoOpenEditItemId = id;
      if (type === 'medicine') {
        navigate('herbs');
      } else {
        navigate('products');
      }
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 21. EMPLOYEES PAGE (พนักงาน)
// -------------------------------------------------------------
export function renderEmployees(state) {
  const list = state.employees || [];
  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบทะเบียนประวัติพนักงานและผู้บำบัดประจำคลินิก</h2>
        <p>บันทึกประวัติพนักงานแพทย์แผนไทยประยุกต์ พนักงานนวดสปา พร้อมกำหนดค่าคอมมิชชั่นตามรายได้</p>
      </div>
      <button class="btn btn-primary" id="btn-emp-add">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 5v14M5 12h14"/></svg>
        เพิ่มรายชื่อพนักงาน
      </button>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>ชื่อพนักงาน</th>
              <th>ชื่อเล่น</th>
              <th>ตำแหน่งงาน</th>
              <th>เบอร์โทรศัพท์</th>
              <th>เลขที่ใบประกอบวิชาชีพ</th>
              <th style="text-align:center;">คอมมิชชั่น (%)</th>
              <th style="text-align:center;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--gray-400);">ไม่มีข้อมูลประวัติพนักงานในระบบ</td></tr>` : 
              list.map(emp => `
                <tr>
                  <td><strong>${emp.name}</strong></td>
                  <td><strong>${emp.nickname || '-'}</strong></td>
                  <td><span class="badge primary">${emp.role}</span></td>
                  <td>${emp.phone}</td>
                  <td><span style="font-family:monospace;">${emp.license || '-'}</span></td>
                  <td style="text-align:center; font-weight:700; color:var(--primary);">${emp.commission}%</td>
                  <td style="text-align:center; white-space:nowrap;">
                    <div style="display:flex; gap:6px; justify-content:center;">
                      <button class="btn btn-secondary btn-sm btn-edit-emp" data-id="${emp.id}">แก้ไข</button>
                      <button class="btn btn-danger btn-sm btn-del-emp" data-id="${emp.id}">&times;</button>
                    </div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Staff -->
    <div class="modal-backdrop" id="modal-emp" style="display:none;">
      <div class="modal-container" style="max-width:500px;">
        <div class="modal-header">
          <h3 id="emp-modal-title">ลงทะเบียนประวัติพนักงานใหม่</h3>
          <button class="close-btn" id="modal-emp-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-emp">
            <input type="hidden" id="emp-editing-id" value="">
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="emp-name">ชื่อ - นามสกุล *</label>
                <input type="text" class="form-control" id="emp-name" required placeholder="ชื่อ-นามสกุล">
              </div>
              <div class="form-group">
                <label for="emp-nickname">ชื่อเล่น</label>
                <input type="text" class="form-control" id="emp-nickname" placeholder="ชื่อเล่น">
              </div>
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="emp-role">ตำแหน่งงานหลัก *</label>
                <select id="emp-role" required>
                  <option value="แพทย์แผนไทย">แพทย์แผนไทย</option>
                  <option value="แพทย์แผนไทยประยุกต์" selected>แพทย์แผนไทยประยุกต์</option>
                  <option value="แพทย์แผนจีน">แพทย์แผนจีน</option>
                  <option value="ผู้ช่วยแพทย์แผนไทย">ผู้ช่วยแพทย์แผนไทย</option>
                  <option value="พนักงานนวด">พนักงานนวด</option>
                  <option value="เทอราปิส">เทอราปิส</option>
                  <option value="อื่นๆ">อื่นๆ (ระบุเอง)</option>
                </select>
                <input type="text" class="form-control" id="emp-role-other" placeholder="โปรดระบุตำแหน่งงานหลัก" style="display:none; margin-top:8px;">
              </div>
              <div class="form-group">
                <label for="emp-comm">อัตราค่ามือ / คอมมิชชั่น (%) *</label>
                <input type="number" class="form-control" id="emp-comm" required min="0" max="100" value="15">
              </div>
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="emp-phone">เบอร์โทรศัพท์ติดต่อ *</label>
                <input type="tel" class="form-control" id="emp-phone" required placeholder="08XXXXXXXX">
              </div>
              <div class="form-group">
                <label for="emp-license">เลขที่ใบประกอบวิชาชีพ / ใบรับรอง</label>
                <input type="text" class="form-control" id="emp-license" placeholder="เลขที่ใบประกอบวิชาชีพ (ถ้ามี)">
              </div>
            </div>
            <div class="form-group">
              <label for="emp-reg-address">ที่อยู่ตามทะเบียนบ้าน *</label>
              <textarea id="emp-reg-address" class="form-control" rows="2" required placeholder="ระบุตามบัตรประชาชน"></textarea>
            </div>
            <div style="margin-bottom: 12px; display:flex; align-items:center; gap:6.5px;">
              <input type="checkbox" id="emp-same-address" style="width:auto; cursor:pointer; margin:0;">
              <label for="emp-same-address" style="margin-bottom:0; cursor:pointer; font-weight:600; font-size:13px; color:var(--primary);">ใช้ที่อยู่เดียวกับทะเบียนบ้าน</label>
            </div>
            <div class="form-group">
              <label for="emp-pres-address">ที่อยู่ปัจจุบัน *</label>
              <textarea id="emp-pres-address" class="form-control" rows="2" required placeholder="ที่อยู่ปัจจุบันที่สะดวกติดต่อ"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-emp-modal-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-emp" type="submit">บันทึกข้อมูลพนักงาน</button>
        </div>
      </div>
    </div>
  `;
}

export function setupEmployeesEvents(state, navigate) {
  const modal = document.getElementById('modal-emp');

  const regAddress = document.getElementById('emp-reg-address');
  const presAddress = document.getElementById('emp-pres-address');
  const sameAddressChk = document.getElementById('emp-same-address');
  const empRoleSelect = document.getElementById('emp-role');
  const empRoleOther = document.getElementById('emp-role-other');

  // Sync address logic
  sameAddressChk?.addEventListener('change', () => {
    if (sameAddressChk.checked) {
      presAddress.value = regAddress.value;
      presAddress.readOnly = true;
      presAddress.style.backgroundColor = '#f1f5f9';
    } else {
      presAddress.readOnly = false;
      presAddress.style.backgroundColor = '';
    }
  });

  regAddress?.addEventListener('input', () => {
    if (sameAddressChk?.checked) {
      presAddress.value = regAddress.value;
    }
  });

  // Role selection dropdown toggle logic
  empRoleSelect?.addEventListener('change', () => {
    if (empRoleSelect.value === 'อื่นๆ') {
      empRoleOther.style.display = 'block';
      empRoleOther.required = true;
    } else {
      empRoleOther.style.display = 'none';
      empRoleOther.required = false;
      empRoleOther.value = '';
    }
  });

  document.getElementById('btn-emp-add')?.addEventListener('click', () => {
    document.getElementById('form-emp').reset();
    document.getElementById('emp-editing-id').value = '';
    
    // reset states
    if (sameAddressChk) sameAddressChk.checked = false;
    if (presAddress) {
      presAddress.readOnly = false;
      presAddress.style.backgroundColor = '';
    }
    if (empRoleOther) {
      empRoleOther.style.display = 'none';
      empRoleOther.required = false;
      empRoleOther.value = '';
    }

    document.getElementById('emp-modal-title').textContent = 'ลงทะเบียนประวัติพนักงานใหม่';
    modal.style.display = 'flex';
  });

  const closeM = () => modal.style.display = 'none';
  document.getElementById('modal-emp-close')?.addEventListener('click', closeM);
  document.getElementById('btn-emp-modal-cancel')?.addEventListener('click', closeM);

  // Edit employee
  document.querySelectorAll('.btn-edit-emp').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.closest('button').dataset.id);
      const emp = state.employees.find(em => em.id === id);
      if (!emp) return;

      document.getElementById('emp-editing-id').value = id;
      document.getElementById('emp-name').value = emp.name || '';
      document.getElementById('emp-nickname').value = emp.nickname || '';
      
      // Determine standard role or custom
      const standardRoles = ['แพทย์แผนไทย', 'แพทย์แผนไทยประยุกต์', 'แพทย์แผนจีน', 'ผู้ช่วยแพทย์แผนไทย', 'พนักงานนวด', 'เทอราปิส'];
      if (standardRoles.includes(emp.role)) {
        empRoleSelect.value = emp.role;
        empRoleOther.style.display = 'none';
        empRoleOther.required = false;
        empRoleOther.value = '';
      } else {
        empRoleSelect.value = 'อื่นๆ';
        empRoleOther.style.display = 'block';
        empRoleOther.required = true;
        empRoleOther.value = emp.role || '';
      }

      document.getElementById('emp-comm').value = emp.commission;
      document.getElementById('emp-phone').value = emp.phone || '';
      document.getElementById('emp-license').value = emp.license || '';
      document.getElementById('emp-reg-address').value = emp.regAddress || '';
      document.getElementById('emp-pres-address').value = emp.presAddress || '';

      // Check if address matches
      if (emp.regAddress && emp.regAddress === emp.presAddress) {
        sameAddressChk.checked = true;
        presAddress.readOnly = true;
        presAddress.style.backgroundColor = '#f1f5f9';
      } else {
        sameAddressChk.checked = false;
        presAddress.readOnly = false;
        presAddress.style.backgroundColor = '';
      }

      document.getElementById('emp-modal-title').textContent = 'แก้ไขประวัติพนักงาน';
      modal.style.display = 'flex';
    });
  });

  document.getElementById('form-emp')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const comm = Number(document.getElementById('emp-comm').value);
    const editingId = document.getElementById('emp-editing-id').value;
    
    // VALIDATIONS: non-negative and bounds check
    if (comm < 0 || comm > 100) {
      alert('ค่าคอมมิชชั่นต้องอยู่ระหว่าง 0 ถึง 100%!');
      return;
    }

    // Determine final role string
    let finalRole = empRoleSelect.value;
    if (finalRole === 'อื่นๆ') {
      finalRole = empRoleOther.value.trim() || 'อื่นๆ';
    }

    const emp = {
      name: document.getElementById('emp-name').value,
      nickname: document.getElementById('emp-nickname').value,
      role: finalRole,
      commission: comm,
      phone: document.getElementById('emp-phone').value,
      license: document.getElementById('emp-license').value,
      regAddress: document.getElementById('emp-reg-address').value,
      presAddress: document.getElementById('emp-pres-address').value
    };

    if (editingId) {
      emp.id = Number(editingId);
      await ClinicDB.putStoreData('employees', emp);
      alert('แก้ไขประวัติพนักงานเสร็จสิ้น!');
    } else {
      await ClinicDB.addStoreData('employees', emp);
      alert('บันทึกพนักงานใหม่เรียบร้อย!');
    }

    state.employees = await ClinicDB.getStoreData('employees');
    closeM();
    navigate('employees');
  });

  document.querySelectorAll('.btn-del-emp').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (confirm('คุณต้องการลบรายชื่อพนักงานนี้ออกจากระบบอย่างถาวรหรือไม่?')) {
        const id = Number(e.target.closest('button').dataset.id);
        await ClinicDB.deleteStoreData('employees', id);
        state.employees = await ClinicDB.getStoreData('employees');
        alert('ลบรายชื่อพนักงานสำเร็จ!');
        navigate('employees');
      }
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 22. CLINIC SERVICES PAGE (บริการของคลินิก)
// -------------------------------------------------------------
export function renderClinicServices(state) {
  const list = state.inventory.filter(i => i.type === 'service');
  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบทะเบียนรายการหัตถการตรวจรักษาและบริการสปาของคลินิก</h2>
        <p>บันทึกอัตราค่าบริการมาตรฐาน ระยะเวลาทำบริการ และต้นทุนประมาณการต่อครั้ง</p>
      </div>
      <button class="btn btn-primary" id="btn-svc-add">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 5v14M5 12h14"/></svg>
        เพิ่มบริการของคลินิก
      </button>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>รหัสบริการ</th>
              <th>ชื่อบริการ / หัตถการ</th>
              <th>ประเภท</th>
              <th style="text-align:right;">ราคาขายมาตรฐาน</th>
              <th style="text-align:right;">ต้นทุนโดยประมาณ</th>
              <th style="text-align:center;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(s => `
              <tr>
                <td>SVC-${String(s.id).padStart(4, '0')}</td>
                <td><strong>${s.name}</strong></td>
                <td><span class="badge primary">บริการรายครั้ง</span></td>
                <td style="text-align:right; font-weight:700; color:var(--primary);">฿${s.price.toLocaleString()}</td>
                <td style="text-align:right; color:var(--gray-500);">฿${s.cost.toLocaleString()}</td>
                <td style="text-align:center; white-space:nowrap;">
                  <button class="btn btn-secondary btn-sm btn-edit-svc-def" data-id="${s.id}">แก้ไข</button>
                  <button class="btn btn-danger btn-sm btn-del-svc-def" data-id="${s.id}">&times;</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Service Def -->
    <div class="modal-backdrop" id="modal-svc-def" style="display:none;">
      <div class="modal-container">
        <div class="modal-header">
          <h3 id="sd-modal-title">ลงทะเบียนสร้างบริการใหม่</h3>
          <button class="close-btn" id="modal-svc-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-svc-def">
            <input type="hidden" id="sd-editing-id" value="">
            <div class="form-group">
              <label for="sd-name">ชื่อบริการ / หัตถการบำบัด *</label>
              <input type="text" class="form-control" id="sd-name" required placeholder="เช่น นวดบำบัดอาการปวดหลัง, นวดอโรม่าตัว">
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="sd-price">ราคามาตรฐานเก็บเงินลูกค้า (฿) *</label>
                <input type="number" class="form-control" id="sd-price" required min="0" placeholder="0">
              </div>
              <div class="form-group">
                <label for="sd-cost">ต้นทุนโดยประมาณ/ค่ามือต่อครั้ง (฿) *</label>
                <input type="number" class="form-control" id="sd-cost" required min="0" placeholder="0">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-svc-modal-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-svc-def" type="submit">บันทึกบริการ</button>
        </div>
      </div>
    </div>
  `;
}

export function setupClinicServicesEvents(state, navigate) {
  const modal = document.getElementById('modal-svc-def');

  document.getElementById('btn-svc-add')?.addEventListener('click', () => {
    document.getElementById('form-svc-def').reset();
    document.getElementById('sd-editing-id').value = '';
    document.getElementById('sd-modal-title').textContent = 'ลงทะเบียนสร้างบริการใหม่';
    modal.style.display = 'flex';
  });

  const closeM = () => modal.style.display = 'none';
  document.getElementById('modal-svc-close')?.addEventListener('click', closeM);
  document.getElementById('btn-svc-modal-cancel')?.addEventListener('click', closeM);

  // Edit Service
  document.querySelectorAll('.btn-edit-svc-def').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id);
      const svc = state.inventory.find(i => i.id === id);
      if (!svc) return;

      document.getElementById('sd-editing-id').value = id;
      document.getElementById('sd-name').value = svc.name || '';
      document.getElementById('sd-price').value = svc.price;
      document.getElementById('sd-cost').value = svc.cost;
      
      document.getElementById('sd-modal-title').textContent = 'แก้ไขบริการ / หัตถการ';
      modal.style.display = 'flex';
    });
  });

  document.getElementById('form-svc-def')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const price = Number(document.getElementById('sd-price').value);
    const cost = Number(document.getElementById('sd-cost').value);
    const editingId = document.getElementById('sd-editing-id').value;

    // VALIDATION: non-negative check
    if (price < 0 || cost < 0) {
      alert('อัตราราคาและต้นทุนบำบัดห้ามมีค่าติดลบ!');
      return;
    }

    const svc = {
      name: document.getElementById('sd-name').value,
      type: 'service',
      price: price,
      cost: cost,
      stock: 9999,
      unit: 'ครั้ง'
    };

    if (editingId) {
      svc.id = Number(editingId);
      await ClinicDB.updateInventoryItem(svc);
      alert('แก้ไขบริการสำเร็จ!');
    } else {
      await ClinicDB.addInventoryItem(svc);
      alert('บันทึกบริการสำเร็จ!');
    }

    state.inventory = await ClinicDB.getInventory();
    closeM();
    navigate('clinic-services');
  });

  document.querySelectorAll('.btn-del-svc-def').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (confirm('คุณต้องการลบรายการบริการนี้หรือไม่?')) {
        const id = Number(e.target.dataset.id);
        await ClinicDB.deleteInventoryItem(id);
        state.inventory = await ClinicDB.getInventory();
        navigate('clinic-services');
      }
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 23. PRICE PACKAGES PAGE (แพ็กเกจราคา)
// -------------------------------------------------------------
export function renderPricePackages(state) {
  const list = state.inventory.filter(i => i.type === 'package');
  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบจัดแพ็กเกจคอร์สบำบัดรักษาและโปรโมชั่นพิเศษ</h2>
        <p>ตั้งค่าคอร์สบำบัดหลายครั้งในราคาพิเศษ เพื่อความสะดวกในการขายรักษาแบบเป็นคอร์ส</p>
      </div>
      <button class="btn btn-primary" id="btn-pkg-add">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 5v14M5 12h14"/></svg>
        สร้างแพ็กเกจคอร์สใหม่
      </button>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>รหัสแพ็กเกจ</th>
              <th>ชื่อคอร์สแพ็กเกจ</th>
              <th style="text-align:center;">จำนวนครั้งในคอร์ส</th>
              <th style="text-align:right;">ราคาขายคอร์สพิเศษ</th>
              <th style="text-align:right;">ต้นทุนโดยประมาณ</th>
              <th style="text-align:center;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(p => `
              <tr>
                <td>PKG-${String(p.id).padStart(4, '0')}</td>
                <td><strong>${p.name}</strong></td>
                <td style="text-align:center;">${p.sessions !== undefined ? p.sessions : (p.name.includes('5 ครั้ง') ? '5' : (p.name.includes('3 ครั้ง') ? '3' : '10'))} ครั้ง</td>
                <td style="text-align:right; font-weight:700; color:var(--primary);">฿${p.price.toLocaleString()}</td>
                <td style="text-align:right; color:var(--gray-500);">฿${p.cost.toLocaleString()}</td>
                <td style="text-align:center; white-space:nowrap;">
                  <button class="btn btn-secondary btn-sm btn-edit-pkg-def" data-id="${p.id}">แก้ไข</button>
                  <button class="btn btn-danger btn-sm btn-del-pkg-def" data-id="${p.id}">&times;</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Package Def -->
    <div class="modal-backdrop" id="modal-pkg-def" style="display:none;">
      <div class="modal-container">
        <div class="modal-header">
          <h3 id="pd-modal-title">ลงทะเบียนสร้างคอร์สใหม่</h3>
          <button class="close-btn" id="modal-pkg-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-pkg-def">
            <input type="hidden" id="pd-editing-id" value="">
            <div class="form-group">
              <label for="pd-name">ชื่อแพ็กเกจคอร์ส *</label>
              <input type="text" class="form-control" id="pd-name" required placeholder="เช่น คอร์สนวดประคบสมุนไพรบำบัด">
            </div>
            <div class="form-group">
              <label for="pd-sessions">จำนวนครั้งของการเข้าทำบริการบำบัดรักษาในคอร์ส *</label>
              <input type="number" class="form-control" id="pd-sessions" required min="1" placeholder="10" value="10">
            </div>
            <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
              <div class="form-group">
                <label for="pd-price">ราคาขายยกคอร์สพิเศษ (฿) *</label>
                <input type="number" class="form-control" id="pd-price" required min="0" placeholder="0">
              </div>
              <div class="form-group">
                <label for="pd-cost">ต้นทุนสะสม/ค่ามือผู้ให้บริการรวม (฿) *</label>
                <input type="number" class="form-control" id="pd-cost" required min="0" placeholder="0">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-pkg-modal-cancel">ยกเลิก</button>
          <button class="btn btn-primary" form="form-pkg-def" type="submit">บันทึกคอร์ส</button>
        </div>
      </div>
    </div>
  `;
}

export function setupPricePackagesEvents(state, navigate) {
  const modal = document.getElementById('modal-pkg-def');

  document.getElementById('btn-pkg-add')?.addEventListener('click', () => {
    document.getElementById('form-pkg-def').reset();
    document.getElementById('pd-editing-id').value = '';
    document.getElementById('pd-sessions').value = '10';
    document.getElementById('pd-modal-title').textContent = 'ลงทะเบียนสร้างคอร์สใหม่';
    modal.style.display = 'flex';
  });

  const closeM = () => modal.style.display = 'none';
  document.getElementById('modal-pkg-close')?.addEventListener('click', closeM);
  document.getElementById('btn-pkg-modal-cancel')?.addEventListener('click', closeM);

  // Edit Package
  document.querySelectorAll('.btn-edit-pkg-def').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id);
      const pkg = state.inventory.find(i => i.id === id);
      if (!pkg) return;

      document.getElementById('pd-editing-id').value = id;
      document.getElementById('pd-name').value = pkg.name || '';
      document.getElementById('pd-price').value = pkg.price;
      document.getElementById('pd-cost').value = pkg.cost;
      document.getElementById('pd-sessions').value = pkg.sessions !== undefined ? pkg.sessions : (pkg.name.includes('5 ครั้ง') ? 5 : (pkg.name.includes('3 ครั้ง') ? 3 : 10));
      
      document.getElementById('pd-modal-title').textContent = 'แก้ไขคอร์สแพ็กเกจ';
      modal.style.display = 'flex';
    });
  });

  document.getElementById('form-pkg-def')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const price = Number(document.getElementById('pd-price').value);
    const cost = Number(document.getElementById('pd-cost').value);
    const sessions = Number(document.getElementById('pd-sessions').value);
    const editingId = document.getElementById('pd-editing-id').value;

    // VALIDATION: non-negative check
    if (price < 0 || cost < 0 || sessions < 1) {
      alert('ราคาตั้งของคอร์ส ต้นทุนสะสม หรือจำนวนครั้งห้ามติดลบและต้องไม่น้อยกว่า 1 ครั้ง!');
      return;
    }

    const pkg = {
      name: document.getElementById('pd-name').value,
      type: 'package',
      price: price,
      cost: cost,
      sessions: sessions,
      stock: 9999,
      unit: 'คอร์ส'
    };

    if (editingId) {
      pkg.id = Number(editingId);
      await ClinicDB.updateInventoryItem(pkg);
      alert('แก้ไขแพ็กเกจสำเร็จ!');
    } else {
      await ClinicDB.addInventoryItem(pkg);
      alert('บันทึกแพ็กเกจสำเร็จ!');
    }

    state.inventory = await ClinicDB.getInventory();
    closeM();
    navigate('price-packages');
  });

  document.querySelectorAll('.btn-del-pkg-def').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (confirm('คุณต้องการลบรายชื่อคอร์สนี้หรือไม่?')) {
        const id = Number(e.target.dataset.id);
        await ClinicDB.deleteInventoryItem(id);
        state.inventory = await ClinicDB.getInventory();
        navigate('price-packages');
      }
    });
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 24. CLINIC SETTINGS PAGE (ตั้งค่าคลินิก)
// -------------------------------------------------------------
export function renderClinicSettings(state) {
  // Safe load settings from state.settings V3
  const info = state.settings || {
    name: 'เรือนสมุนไพรคลินิก',
    owner: 'หมอประยุกต์ แผนไทย',
    phone: '02-123-4567',
    line: '@ruansamunphrai',
    address: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
    logo: ''
  };

  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบตั้งค่าโปรไฟล์ข้อมูลกิจการคลินิก</h2>
        <p>ตั้งชื่อคลินิก ข้อมูลเจ้าของ เบอร์โทรศัพท์ไอดีไลน์ และที่อยู่สำหรับจัดพิมพ์หัวใบเสร็จรับเงิน</p>
      </div>
    </div>

    <div class="card" style="max-width:650px; margin:0 auto;">
      <form id="form-settings">
        <!-- Logo Upload Field -->
        <div class="form-group" style="border-bottom:1px dashed var(--gray-200); padding-bottom:20px; margin-bottom:20px;">
          <label><strong>รูปภาพโลโก้ประจำคลินิก (แสดงบนหัวบิลใบเสร็จ)</strong></label>
          <div style="display:flex; align-items:center; gap:16px; margin-top:8px;">
            <div id="settings-logo-preview" style="width:80px; height:80px; border-radius:50%; border:2px dashed var(--gray-300); display:flex; align-items:center; justify-content:center; overflow:hidden; background-color:var(--gray-50);">
              ${info.logo ? `<img src="${info.logo}" style="width:100%; height:100%; object-fit:cover;">` : '<span style="font-size:12px; color:var(--gray-400);">ไม่มีโลโก้</span>'}
            </div>
            <div>
              <input type="file" id="set-logo-file" accept="image/*" style="display:none;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('set-logo-file').click()">เลือกรูปภาพโลโก้</button>
              <button type="button" class="btn btn-danger btn-sm" id="btn-clear-logo" style="margin-left:8px; display:${info.logo ? 'inline-block' : 'none'};">ลบรูปโลโก้</button>
              <p style="font-size:11px; color:var(--gray-500); margin-top:6px; line-height:1.4;">รองรับไฟล์รูปภาพ PNG, JPG ขนาดไม่เกิน 1MB (บันทึกเป็น Base64)</p>
            </div>
          </div>
          <input type="hidden" id="set-logo-base64" value="${info.logo || ''}">
        </div>

        <div class="form-group">
          <label for="set-name">ชื่อคลินิกแพทย์แผนไทย/สปา *</label>
          <input type="text" class="form-control" id="set-name" required value="${info.name || ''}">
        </div>
        <div class="form-group">
          <label for="set-owner">ชื่อแพทย์หลักผู้ดูแลคลินิก / เจ้าของ *</label>
          <input type="text" class="form-control" id="set-owner" required value="${info.owner || ''}">
        </div>
        <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
          <div class="form-group">
            <label for="set-phone">เบอร์โทรศัพท์คลินิก *</label>
            <input type="tel" class="form-control" id="set-phone" required value="${info.phone || ''}">
          </div>
          <div class="form-group">
            <label for="set-line">LINE ID สังคมออนไลน์</label>
            <input type="text" class="form-control" id="set-line" value="${info.line || ''}">
          </div>
        </div>
        <div class="form-group">
          <label for="set-address">ที่อยู่และพิกัดคลินิกสำหรับหัวกระดาษพิมพ์ใบเสร็จ *</label>
          <textarea id="set-address" rows="3" required>${info.address || ''}</textarea>
        </div>

        <!-- Supabase Cloud Sync Section (Checkpoint 7) -->
        <div style="border-top:2px dashed var(--gray-200); padding-top:20px; margin-top:20px; margin-bottom:20px;">
          <h3 style="font-weight:700; font-size:16px; margin-bottom:4px; color:var(--primary);">
            ตั้งค่าระบบคลาวด์ออนไลน์ (Supabase Sync)
          </h3>
          <p style="color:var(--gray-500); font-size:12px; margin-bottom:12px; line-height:1.4;">
            เปิดใช้งานการซิงค์ข้อมูลเรียลไทม์กับฐานข้อมูลคลาวด์ส่วนกลาง เพื่อเชื่อมโยงข้อมูลระหว่าง PC, iPad และอุปกรณ์เคลื่อนที่อื่นๆ
          </p>
          
          <div class="form-group" style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <input type="checkbox" id="set-supabase-enabled" ${info.supabaseEnabled ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
            <label for="set-supabase-enabled" style="font-weight:600; cursor:pointer; margin-bottom:0;">เปิดใช้งานการเชื่อมต่อซิงค์ออนไลน์</label>
          </div>
          
          <div class="form-group">
            <label for="set-supabase-url">Supabase Project URL</label>
            <input type="text" class="form-control" id="set-supabase-url" placeholder="https://your-project-id.supabase.co" value="${info.supabaseUrl || ''}">
          </div>
          
          <div class="form-group">
            <label for="set-supabase-key">Supabase Anon API Key</label>
            <input type="password" class="form-control" id="set-supabase-key" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." value="${info.supabaseKey || ''}">
          </div>

          <div style="display:flex; gap:10px; margin-top:12px;">
            <button type="button" class="btn btn-secondary" id="btn-test-supabase" style="flex:1;">
              ทดสอบการเชื่อมต่อคลาวด์
            </button>
            <button type="button" class="btn btn-danger" id="btn-push-supabase" style="flex:1;">
              อัปโหลดประวัติเข้าออนไลน์ครั้งแรก
            </button>
          </div>
        </div>

        <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;">
          บันทึกการปรับปรุงประวัติคลินิก
        </button>
      </form>
    </div>
  `;
}

export function setupClinicSettingsEvents(state, navigate) {
  const fileInput = document.getElementById('set-logo-file');
  const base64Input = document.getElementById('set-logo-base64');
  const previewDiv = document.getElementById('settings-logo-preview');
  const clearBtn = document.getElementById('btn-clear-logo');

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert('ขนาดไฟล์รูปภาพโลโก้ต้องไม่เกิน 1MB!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target.result;
      base64Input.value = base64;
      if (previewDiv) {
        previewDiv.innerHTML = `<img src="${base64}" style="width:100%; height:100%; object-fit:cover;">`;
      }
      if (clearBtn) clearBtn.style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
  });

  clearBtn?.addEventListener('click', () => {
    if (base64Input) base64Input.value = '';
    if (previewDiv) previewDiv.innerHTML = '<span style="font-size:12px; color:var(--gray-400);">ไม่มีโลโก้</span>';
    if (clearBtn) clearBtn.style.display = 'none';
    if (fileInput) fileInput.value = '';
  });

  // Test Supabase Connection Click
  document.getElementById('btn-test-supabase')?.addEventListener('click', async () => {
    const url = document.getElementById('set-supabase-url').value.trim();
    const key = document.getElementById('set-supabase-key').value.trim();
    if (!url || !key) {
      alert("กรุณากรอกข้อมูล Supabase URL และ Anon API Key ก่อนกดปุ่มนี้ครับ");
      return;
    }

    const testConfig = {
      url: url.replace(/\/$/, ''),
      key: key
    };

    try {
      await ClinicDB.requestSupabase(testConfig, 'GET', 'clinic_store?select=id&limit=1');
      alert("🟢 เชื่อมต่อกับฐานข้อมูล Supabase สำเร็จแล้ว! ตาราง clinic_store พร้อมใช้งาน");
    } catch (err) {
      console.error(err);
      alert(`🔴 การเชื่อมต่อผิดพลาด! กรุณาตรวจสอบ:\n1. ความถูกต้องของ URL และ Key\n2. คุณได้รัน SQL Script สร้างตาราง clinic_store ในหน้าเว็บ Supabase แล้วหรือยัง\n\nรายละเอียดข้อผิดพลาด: ${err.message}`);
    }
  });

  // Push Local Data to Supabase Click
  document.getElementById('btn-push-supabase')?.addEventListener('click', async () => {
    const info = {
      key: 'general',
      name: document.getElementById('set-name').value,
      owner: document.getElementById('set-owner').value,
      phone: document.getElementById('set-phone').value,
      line: document.getElementById('set-line').value,
      address: document.getElementById('set-address').value,
      logo: document.getElementById('set-logo-base64').value,
      supabaseEnabled: document.getElementById('set-supabase-enabled').checked,
      supabaseUrl: document.getElementById('set-supabase-url').value,
      supabaseKey: document.getElementById('set-supabase-key').value
    };

    await ClinicDB.putStoreData('clinic_settings', info);
    window.appState.settings = info;

    if (!info.supabaseEnabled || !info.supabaseUrl || !info.supabaseKey) {
      alert("กรุณากรอกและติ๊กเปิดใช้งานระบบซิงค์ออนไลน์ (Supabase Sync) ก่อนกดปุ่มนำเข้าประวัติครับ");
      return;
    }

    if (confirm("⚠️ คำเตือน: ระบบจะทำการส่งออกข้อมูลทั้งหมดที่อยู่ใน IndexedDB ในเครื่องคอมพิวเตอร์ของคุณ ขึ้นไปบันทึกทับในฐานข้อมูล Supabase ออนไลน์\n\nคุณต้องการเริ่มต้นอัปโหลดข้อมูลใช่หรือไม่?")) {
      const btn = document.getElementById('btn-push-supabase');
      const originalText = btn.textContent;
      btn.textContent = "กำลังอัปโหลดข้อมูล... ⏳";
      btn.disabled = true;
      try {
        const total = await ClinicDB.pushLocalDataToSupabase();
        alert(`🟢 อัปโหลดประวัติและข้อมูลเข้าระบบออนไลน์สำเร็จทั้งหมดจำนวน ${total} รายการ! อุปกรณ์เครื่องอื่นที่เชื่อมต่อวงเดียวกันจะเห็นประวัตินี้ทันทีหลังรีเฟรช`);
      } catch (err) {
        console.error(err);
        alert(`🔴 อัปโหลดล้มเหลว: ${err.message}`);
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }
  });

  document.getElementById('form-settings')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const info = {
      key: 'general',
      name: document.getElementById('set-name').value,
      owner: document.getElementById('set-owner').value,
      phone: document.getElementById('set-phone').value,
      line: document.getElementById('set-line').value,
      address: document.getElementById('set-address').value,
      logo: document.getElementById('set-logo-base64').value,
      supabaseEnabled: document.getElementById('set-supabase-enabled').checked,
      supabaseUrl: document.getElementById('set-supabase-url').value,
      supabaseKey: document.getElementById('set-supabase-key').value
    };

    // Save to clinic_settings V3
    await ClinicDB.putStoreData('clinic_settings', info);
    
    // Refresh Sidebar title and logo instantly
    const sidebarLogoContainer = document.querySelector('.sidebar-logo');
    if (sidebarLogoContainer) {
      if (info.logo) {
        sidebarLogoContainer.innerHTML = `
          <img src="${info.logo}" style="width:26px; height:26px; border-radius:50%; object-fit:cover; margin-right:8px;" id="sidebar-clinic-logo-img">
          <span id="sidebar-clinic-name">${info.name}</span>
        `;
      } else {
        sidebarLogoContainer.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #2dd4bf;" id="sidebar-clinic-logo-svg"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 2 5.5a7 7 0 0 1-7 7h-3Z"/><path d="M19 2c-3.07 3.42-6 3-10 4"/></svg>
          <span id="sidebar-clinic-name">${info.name}</span>
        `;
      }
    }

    // Refresh state
    const dbSettings = await ClinicDB.getStoreData('clinic_settings');
    const settingsObj = dbSettings.find(s => s.key === 'general') || info;
    window.appState.settings = settingsObj;
    
    alert('บันทึกปรับปรุงข้อมูลคลินิกและข้อมูลหัวใบเสร็จรับเงินเสร็จสมบูรณ์!');
    navigate('clinic-settings');
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 25. BACKUP & RESTORE PAGE (สำรองข้อมูล)
// -------------------------------------------------------------
export function renderBackup(state) {
  const lastBackup = localStorage.getItem('last_backup_date') || 'ไม่เคยสำรองข้อมูล';
  const showBackupWarning = lastBackup === 'ไม่เคยสำรองข้อมูล';

  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบสำรองข้อมูลและกู้คืนฐานข้อมูลท้องถิ่น (Backup & Restore)</h2>
        <p>นำเข้าและส่งออกข้อมูลทั้งหมดแบบ Offline 100% ผ่านไฟล์สากล JSON เพื่อป้องกันระบบสูญหาย</p>
      </div>
    </div>

    <!-- Offline Status Indicator -->
    <div style="background-color:#f0fdf4; border:1px solid #bbf7d0; color:#166534; padding:12px; border-radius:var(--radius-md); margin-bottom:20px; font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px;">
      <span style="display:inline-block; width:10px; height:10px; background-color:#22c55e; border-radius:50%;"></span>
      สถานะระบบ: พร้อมใช้งานแบบออฟไลน์ 100% (Offline Ready) 🟢
    </div>

    <!-- Backup warning -->
    ${showBackupWarning ? `
      <div class="banner warning" style="margin-bottom:20px;">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>
        <span><strong>แจ้งเตือนความปลอดภัย:</strong> คุณยังไม่เคยทำการสำรองข้อมูลเลย กรุณากดสำรองข้อมูลเป็นประจำเพื่อความปลอดภัยของข้อมูลเวชระเบียน</span>
      </div>
    ` : `
      <div class="banner info" style="margin-bottom:20px;">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>การสำรองข้อมูลเสร็จสิ้นล่าสุด: <strong>${lastBackup}</strong></span>
      </div>
    `}

    <div class="grid-cols-2">
      <!-- Backup -->
      <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; min-height:220px;">
        <div>
          <h3 style="font-weight:700; margin-bottom:8px;">1. สำรองข้อมูลส่งออก (Export Data)</h3>
          <p style="font-size:13px; color:var(--gray-500); line-height:1.6;">
            ระบบจะแปลงประวัติทะเบียนคนไข้ นัดหมาย และบัญชีการเงินทั้งหมดเป็นไฟล์ JSON เพื่อดาวน์โหลดเก็บไว้ในเครื่อง iPad/PC ของคุณ
          </p>
        </div>
        <button class="btn btn-primary" id="btn-export-json" style="width:100%; margin-top:16px;">
          คลิกดาวน์โหลดไฟล์สำรองข้อมูล (JSON)
        </button>
      </div>

      <!-- Restore -->
      <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; min-height:220px;">
        <div>
          <h3 style="font-weight:700; margin-bottom:8px; color:var(--danger);">2. นำเข้าข้อมูลสำรองเดิม (Import Data)</h3>
          <p style="font-size:13px; color:var(--gray-500); line-height:1.6;">
            เลือกไฟล์สำรองข้อมูล JSON เดิมของคุณเพื่อกู้คืนฐานข้อมูลการรักษาทั้งหมด *คำเตือน: การนำเข้าจะเขียนทับข้อมูลในเครื่องปัจจุบันทั้งหมด
          </p>
        </div>
        <div style="margin-top:16px;">
          <input type="file" id="file-restore-input" accept=".json" style="margin-bottom:10px;">
          <button class="btn btn-danger" id="btn-import-json" style="width:100%;">
            ยืนยันการอิมพอร์ตข้อมูลย้อนหลัง
          </button>
        </div>
      </div>
    </div>
  `;
}

export function setupBackupEvents(state, navigate) {
  // Export all 20 stores
  document.getElementById('btn-export-json')?.addEventListener('click', async () => {
    const backupData = {
      patients: await ClinicDB.getStoreData('patients'),
      queues: await ClinicDB.getStoreData('queues'),
      inventory: await ClinicDB.getStoreData('inventory'),
      sales: await ClinicDB.getStoreData('sales'),
      finance: await ClinicDB.getStoreData('finance'),
      appointments: await ClinicDB.getStoreData('appointments'),
      patient_courses: await ClinicDB.getStoreData('patient_courses'),
      followups: await ClinicDB.getStoreData('followups'),
      stock_movements: await ClinicDB.getStoreData('stock_movements'),
      employees: await ClinicDB.getStoreData('employees'),
      clinic_services: await ClinicDB.getStoreData('clinic_services'),
      price_packages: await ClinicDB.getStoreData('price_packages'),
      clinic_settings: await ClinicDB.getStoreData('clinic_settings'),
      
      // V3 stores
      service_records: await ClinicDB.getStoreData('service_records'),
      medical_records: await ClinicDB.getStoreData('medical_records'),
      income_transactions: await ClinicDB.getStoreData('income_transactions'),
      expense_transactions: await ClinicDB.getStoreData('expense_transactions'),
      startup_costs: await ClinicDB.getStoreData('startup_costs'),
      payment_methods: await ClinicDB.getStoreData('payment_methods'),
      course_usage_logs: await ClinicDB.getStoreData('course_usage_logs')
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `samunphrai_clinic_mvp_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Save timestamp
    const nowStr = new Date().toLocaleString('th-TH');
    localStorage.setItem('last_backup_date', nowStr);
    
    alert('ส่งออกไฟล์สำรองข้อมูลคลินิกและบันทึกเวลาล่าสุดสำเร็จ!');
    navigate('backup');
  });

  // Import all 20 stores
  document.getElementById('btn-import-json')?.addEventListener('click', () => {
    const fileInput = document.getElementById('file-restore-input');
    if (!fileInput.files || fileInput.files.length === 0) {
      alert('กรุณาเลือกไฟล์สำรองนามสกุล .json ก่อนกดอิมพอร์ตครับ');
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        
        // Loop and put items back to IndexedDB
        const keys = Object.keys(imported);
        for (const storeName of keys) {
          if (Array.isArray(imported[storeName])) {
            // Delete current data first
            const currentItems = await ClinicDB.getStoreData(storeName);
            for (const item of currentItems) {
              const id = item.id || item.key;
              if (id !== undefined) {
                await ClinicDB.deleteStoreData(storeName, id);
              }
            }
            // Put new items
            for (const item of imported[storeName]) {
              await ClinicDB.putStoreData(storeName, item);
            }
          }
        }

        alert('กู้คืนข้อมูลสำรองของคลินิกเสร็จสิ้นแล้ว!');
        window.location.reload();

      } catch (err) {
        console.error(err);
        alert('อิมพอร์ตไฟล์ผิดพลาด: รูปแบบไฟล์ JSON ไม่ถูกต้องหรือเสียหาย');
      }
    };

    reader.readAsText(file);
  });

  // Bind clear seed buttons
  document.getElementById('btn-clear-seed-data')?.addEventListener('click', async () => {
    if (confirm('คุณต้องการลบข้อมูลสาธิตออกทั้งหมดเพื่อเริ่มระบบแบบว่างเปล่าใช่หรือไม่?')) {
      await ClinicDB.clearSeedData();
      alert('ล้างข้อมูลตัวอย่างสำเร็จ!');
      window.location.reload();
    }
  });

  document.getElementById('btn-start-real-use')?.addEventListener('click', async () => {
    await ClinicDB.clearSeedData();
    alert('ระบบเปลี่ยนเป็นโหมดการใช้งานจริงแล้ว! นำทางไปยังการตั้งค่าชื่อคลินิกของคุณ');
    navigate('clinic-settings');
  });
}

// -------------------------------------------------------------
// 26. WALK-IN SALE PAGE (จ่ายยา / ซื้อสินค้าด่วน)
// -------------------------------------------------------------
export function renderWalkInSale(state) {
  const medicines = state.inventory.filter(i => i.type === 'medicine');
  const products = state.inventory.filter(i => i.type === 'product');

  const subtotal = walkInCart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return `
    ${renderSeedDataBanner(state)}
    <div class="page-header">
      <div class="page-title-desc">
        <h2>ระบบจ่ายยาด่วน / ขายสินค้า Walk-In</h2>
        <p>บันทึกการจำหน่ายสมุนไพรเดี่ยว ยาต้ม หรือผลิตภัณฑ์ความงามหน้าร้านโดยไม่ต้องมีนัดหมายคิวตรวจแพทย์</p>
      </div>
    </div>

    <div class="billing-layout">
      <!-- Item Selector Card -->
      <div class="card">
        <h3 style="font-weight:700; margin-bottom:12px; color:var(--primary);">เลือกยาและสินค้าลงตะกร้า</h3>
        <form id="form-walk-in-add" style="margin-bottom:20px;">
          <div class="form-group">
            <label for="ws-item">เลือกสินค้า / สมุนไพรในคลัง *</label>
            <select id="ws-item" required>
              <option value="">-- เลือกรายการคลังสินค้า --</option>
              <optgroup label="ยาสมุนไพร">
                ${medicines.map(m => `<option value="${m.id}" ${m.stock < 1 ? 'disabled style="color:red;"' : ''}>${m.name} [คงคลัง: ${m.stock} ${m.unit}] - ฿${m.price}</option>`).join('')}
              </optgroup>
              <optgroup label="ผลิตภัณฑ์ความงาม/สุขภาพ">
                ${products.map(p => `<option value="${p.id}" ${p.stock < 1 ? 'disabled style="color:red;"' : ''}>${p.name} [คงคลัง: ${p.stock} ${p.unit}] - ฿${p.price}</option>`).join('')}
              </optgroup>
            </select>
          </div>
          <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
            <div class="form-group">
              <label for="ws-qty">จำนวนชิ้นที่ต้องการ *</label>
              <input type="number" id="ws-qty" class="form-control" value="1" min="1" required>
            </div>
            <div class="form-group" style="display:flex; align-items:flex-end;">
              <button type="submit" class="btn btn-primary" style="width:100%; height:38px;">เพิ่มลงตะกร้า</button>
            </div>
          </div>
        </form>

        <!-- Cart Table -->
        <h4 style="font-weight:700; margin-bottom:8px; border-top:1px dashed var(--gray-200); padding-top:15px;">ตะกร้าสินค้าชั่วคราว</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ชื่อสินค้า/เวชภัณฑ์</th>
                <th style="text-align:center;">จำนวน</th>
                <th style="text-align:right;">ราคาต่อหน่วย</th>
                <th style="text-align:right;">ยอดรวม</th>
                <th style="text-align:center; width:50px;">ลบ</th>
              </tr>
            </thead>
            <tbody>
              ${walkInCart.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align:center; color:var(--gray-400); padding:20px;">ไม่มีสินค้าในตะกร้าขณะนี้</td>
                </tr>
              ` : walkInCart.map((item, idx) => `
                <tr>
                  <td><strong>${item.name}</strong></td>
                  <td style="text-align:center;">${item.qty} ${item.unit}</td>
                  <td style="text-align:right;">฿${item.price}</td>
                  <td style="text-align:right;">฿${(item.price * item.qty).toLocaleString()}</td>
                  <td style="text-align:center;">
                    <button type="button" class="btn btn-danger btn-sm btn-del-ws-cart" data-idx="${idx}">&times;</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Checkout Card -->
      <div class="card">
        <h3 style="font-weight:700; margin-bottom:12px; color:var(--primary);">บันทึกข้อมูลและชำระเงิน</h3>
        <form id="form-walk-in-checkout">
          <div class="form-group">
            <label for="ws-patient-id">เชื่อมโยงประวัติลูกค้า (ถ้ามี)</label>
            <select id="ws-patient-id">
              <option value="">-- ลูกค้า Walk-in ทั่วไป (ไม่ผูกประวัติ) --</option>
              ${state.patients.map(p => `<option value="${p.id}">HN-${String(p.id).padStart(4, '0')} - ${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" id="ws-custom-name-group">
            <label for="ws-customer-name">ระบุชื่อลูกค้าทั่วไป</label>
            <input type="text" class="form-control" id="ws-customer-name" value="ลูกค้า Walk-in ทั่วไป" placeholder="ระบุชื่อลูกค้า (ถ้าต้องการ)">
          </div>

          <div class="grid-cols-2" style="margin-bottom:0; gap:16px;">
            <div class="form-group">
              <label for="ws-discount">ระบุส่วนลด (บาท)</label>
              <input type="number" id="ws-discount" class="form-control" value="0" min="0">
            </div>
            <div class="form-group">
              <label for="ws-discount-reason">โปรโมชั่น / เหตุผลลดราคา</label>
              <input type="text" id="ws-discount-reason" class="form-control" placeholder="เช่น แคมเปญหน้าร้อน">
            </div>
          </div>

          <div class="form-group">
            <label for="ws-method">ช่องทางการชำระเงิน *</label>
            <select id="ws-method" required>
              <option value="เงินสด">เงินสด</option>
              <option value="โอนเงินผ่านธนาคาร/QR Code">โอนเงินผ่านธนาคาร / QR Code</option>
              <option value="บัตรเครดิต">บัตรเครดิต</option>
            </select>
          </div>

          <div style="margin: 20px 0; padding:12px; background-color:var(--primary-light); border-radius:var(--radius-md); font-weight:700; display:flex; justify-content:space-between; align-items:center;">
            <span>ยอดสุทธิที่ต้องชำระ:</span>
            <span style="color:var(--primary); font-size:18px;" id="lbl-ws-total">฿0</span>
          </div>

          <button type="submit" class="btn btn-primary" style="width:100%;">
            ยืนยันการขายและหักยอดสต็อกสินค้า
          </button>
        </form>
      </div>
    </div>
  `;
}

export function setupWalkInSaleEvents(state, navigate) {
  // Update net amount preview label helper
  const updateNetTotal = () => {
    const subtotal = walkInCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discount = Number(document.getElementById('ws-discount')?.value) || 0;
    const total = Math.max(0, subtotal - discount);
    const lbl = document.getElementById('lbl-ws-total');
    if (lbl) lbl.textContent = `฿${total.toLocaleString()}`;
  };

  document.getElementById('ws-discount')?.addEventListener('input', updateNetTotal);
  updateNetTotal();

  // Hide/Show custom name input based on patient link selector
  document.getElementById('ws-patient-id')?.addEventListener('change', (e) => {
    const customGroup = document.getElementById('ws-custom-name-group');
    if (e.target.value) {
      if (customGroup) customGroup.style.display = 'none';
    } else {
      if (customGroup) customGroup.style.display = 'block';
    }
  });

  // Add Item to Cart
  document.getElementById('form-walk-in-add')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const itemId = Number(document.getElementById('ws-item').value);
    const qty = Number(document.getElementById('ws-qty').value);

    const item = state.inventory.find(i => i.id === itemId);
    if (!item) return;

    if (qty > item.stock) {
      alert(`ไม่สามารถเพิ่มได้เนื่องจากสต็อกคงคลังไม่พอ! (คงคลัง: ${item.stock} ${item.unit})`);
      return;
    }

    const existing = walkInCart.find(c => c.itemId === item.id);
    if (existing) {
      if (existing.qty + qty > item.stock) {
        alert(`ไม่สามารถเพิ่มชิ้นเพิ่มได้เนื่องจากเกินจำกัดสต็อกคงคลัง!`);
        return;
      }
      existing.qty += qty;
    } else {
      walkInCart.push({
        itemId: item.id,
        name: item.name,
        qty: qty,
        price: item.price,
        unit: item.unit || 'ชิ้น'
      });
    }

    navigate('walk-in-sale');
  });

  // Remove Item from Cart
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-del-ws-cart')) {
      const idx = Number(e.target.dataset.idx);
      walkInCart.splice(idx, 1);
      navigate('walk-in-sale');
    }
  });

  // Checkout submission
  document.getElementById('form-walk-in-checkout')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (walkInCart.length === 0) {
      alert('กรุณาเลือกหยิบสินค้าลงในตะกร้าอย่างน้อย 1 รายการก่อนชำระเงิน!');
      return;
    }

    const patientSelectId = document.getElementById('ws-patient-id').value;
    const discount = Number(document.getElementById('ws-discount').value) || 0;
    const discountReason = document.getElementById('ws-discount-reason').value;
    const method = document.getElementById('ws-method').value;

    const subtotal = walkInCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    if (discount < 0) {
      alert('ยอดส่วนลดห้ามติดลบ!');
      return;
    }
    const total = Math.max(0, subtotal - discount);

    let patientId = null;
    let patientName = document.getElementById('ws-customer-name')?.value || 'ลูกค้า Walk-in ทั่วไป';

    if (patientSelectId) {
      patientId = Number(patientSelectId);
      const patient = state.patients.find(p => p.id === patientId);
      if (patient) {
        patientName = patient.name;
      }
    }

    // Save to sales (compatibility)
    const sale = {
      queueId: null, // Walk-in sale has no queue
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      patientId: patientId,
      patientName: patientName,
      items: walkInCart.map(c => ({ name: c.name, price: c.price, qty: c.qty })),
      subtotal: subtotal,
      discount: discount,
      discountReason: discountReason,
      total: total,
      paymentMethod: method
    };
    await ClinicDB.addSale(sale);

    // Save to income_transactions V3
    const incomeTx = {
      queueId: null,
      patientId: patientId,
      patientName: patientName,
      netAmount: total,
      category: 'ขายยาด่วนหน้าร้าน',
      paymentMethod: method,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    };
    await ClinicDB.addStoreData('income_transactions', incomeTx);

    // Adjust Stocks and save Stock Movements logs
    for (const cartItem of walkInCart) {
      const invItem = state.inventory.find(i => i.id === cartItem.itemId);
      if (invItem) {
        invItem.stock = Math.max(0, invItem.stock - cartItem.qty);
        await ClinicDB.updateInventoryItem(invItem);

        // write stock movement log
        const movementLog = {
          itemId: invItem.id,
          itemName: invItem.name,
          type: 'out',
          qty: cartItem.qty,
          notes: `จำหน่ายด่วน Walk-In ${patientName}`,
          date: new Date().toISOString().split('T')[0]
        };
        await ClinicDB.addStoreData('stock_movements', movementLog);
      }
    }

    // Reset cart and refresh states
    walkInCart = [];
    state.inventory = await ClinicDB.getInventory();
    state.sales = await ClinicDB.getSales();
    state.income_transactions = await ClinicDB.getStoreData('income_transactions');
    state.stock_movements = await ClinicDB.getStoreData('stock_movements');

    alert(`บันทึกจ่ายยาและจำหน่ายสินค้าด่วนสำเร็จ! ชำระเงินสุทธิ ฿${total.toLocaleString()}`);
    navigate('income');
  });
}
