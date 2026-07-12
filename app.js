// app.js - Main Application Shell & Router for Thai Traditional Clinic Suite (V2.0)
import { ClinicDB } from './db.js';
import * as pages from './pages.js';

// Global state container
window.appState = {
  activePage: 'dashboard',
  patients: [],
  queues: [],
  inventory: [],
  sales: [],
  finance: [],
  appointments: [],
  patient_courses: [],
  followups: [],
  stock_movements: [],
  employees: [],
  settings: {}
};

// Map of all 25 pages to their render and event hook functions
const pageModules = {
  // 1. ภาพรวม
  'dashboard': { render: pages.renderDashboard, setup: pages.setupDashboardEvents },
  
  // 2. งานบริการ
  'customers': { render: pages.renderCustomers, setup: pages.setupCustomersEvents },
  'appointments': { render: pages.renderAppointments, setup: pages.setupAppointmentsEvents },
  'queue': { render: pages.renderQueue, setup: pages.setupQueueEvents },
  'medical-records': { render: pages.renderMedicalRecords, setup: pages.setupMedicalRecordsEvents },
  'service-records': { render: pages.renderServiceRecords, setup: pages.setupServiceRecordsEvents },
  'consultation': { render: pages.renderConsultation, setup: pages.setupConsultationEvents },
  'courses': { render: pages.renderCourses, setup: pages.setupCoursesEvents },
  'follow-up': { render: pages.renderFollowUp, setup: pages.setupFollowUpEvents },
  'walk-in-sale': { render: pages.renderWalkInSale, setup: pages.setupWalkInSaleEvents },
  
  // 3. การเงิน
  'billing': { render: pages.renderBilling, setup: pages.setupBillingEvents },
  'income': { render: pages.renderIncome, setup: pages.setupIncomeEvents },
  'expenses': { render: pages.renderExpenses, setup: pages.setupExpensesEvents },
  'startup-costs': { render: pages.renderStartupCosts, setup: pages.setupStartupCostsEvents },
  'break-even': { render: pages.renderBreakEven, setup: pages.setupBreakEvenEvents },
  'financial-reports': { render: pages.renderFinancialReports, setup: pages.setupFinancialReportsEvents },
  
  // 4. สินค้าและสต๊อก
  'herbs': { render: pages.renderHerbs, setup: pages.setupHerbsEvents },
  'products': { render: pages.renderProducts, setup: pages.setupProductsEvents },
  'inventory': { render: pages.renderInventory, setup: pages.setupInventoryEvents },
  'stock-movement': { render: pages.renderStockMovement, setup: pages.setupStockMovementEvents },
  'stock-alerts': { render: pages.renderStockAlerts, setup: pages.setupStockAlertsEvents },
  
  // 5. ตั้งค่า
  'employees': { render: pages.renderEmployees, setup: pages.setupEmployeesEvents },
  'clinic-services': { render: pages.renderClinicServices, setup: pages.setupClinicServicesEvents },
  'price-packages': { render: pages.renderPricePackages, setup: pages.setupPricePackagesEvents },
  'clinic-settings': { render: pages.renderClinicSettings, setup: pages.setupClinicSettingsEvents },
  'backup': { render: pages.renderBackup, setup: pages.setupBackupEvents }
};

// Title dictionary for header display (Thai Language)
const pageTitles = {
  'dashboard': 'สรุปข้อมูลหลักและสรุปผลวันนี้',
  'customers': 'รายชื่อลูกค้าและจุดรับบริการ',
  'appointments': 'บันทึกและระบบจองนัดหมายคิวสุขภาพ',
  'queue': 'บอร์ดความคืบหน้าคิวบริการประจำวัน',
  'medical-records': 'ทะเบียนเวชระเบียนประวัติผู้ป่วยเดี่ยว',
  'service-records': 'ใบบันทึกผลการบำบัดนวดสปาเฉพาะครั้ง',
  'consultation': 'ห้องตรวจแพทย์แผนไทยและการวิเคราะห์ธาตุ',
  'courses': 'แฟ้มติดตามความก้าวหน้าคอร์สแพ็กเกจลูกค้า',
  'follow-up': 'รายการติดตามอาการผู้ป่วยหลังบริการ',
  'walk-in-sale': 'ระบบสั่งซื้อยาและสมุนไพรตรง (Walk-In Pharmacy)',
  'billing': 'ระบบคำนวณชำระบิลเงินสดและค่าบริการ',
  'income': 'บัญชีสรุปรายรับคลินิกทั้งหมด',
  'expenses': 'บัญชีรายจ่ายดำเนินการประจำวัน / เดือน',
  'startup-costs': 'ต้นทุนก่อตั้งร้านและการลงทุนเริ่มต้น',
  'break-even': 'ประเมินจุดคุ้มทุนสะสม (Break-Even)',
  'financial-reports': 'รายงานวิเคราะห์การเงินและงบการบัญชี',
  'herbs': 'คลังทะเบียนยาสมุนไพรและยาตำรับ',
  'products': 'คลังทะเบียนผลิตภัณฑ์สุขภาพบำรุงผิว',
  'inventory': 'สรุปจำนวนเวชภัณฑ์สินค้าและคลังคงเหลือ',
  'stock-movement': 'บันทึกประวัติสต๊อกรับเข้าและจ่ายออก',
  'stock-alerts': 'แจ้งเตือนสินค้าใกล้หมดคลังและยาหมดอายุ',
  'employees': 'ทำทะเบียนประวัติพนักงานและตั้งค่าคอมมิชชั่น',
  'clinic-services': 'ตั้งค่าเมนูและราคาหัตถการบริการมาตรฐาน',
  'price-packages': 'ตั้งค่ารายละเอียดและราคาคอร์สแพ็กเกจ',
  'clinic-settings': 'ตั้งค่าโปรไฟล์ข้อมูลส่วนตัวของคลินิก',
  'backup': 'ระบบสำรองข้อมูลภายนอกและกู้คืนฐานข้อมูล'
};

// Navigation controller
export async function navigate(pageName) {
  if (!pageModules[pageName]) return;
  
  window.appState.activePage = pageName;

  // 1. Highlight sidebar link
  document.querySelectorAll('.menu-item').forEach(item => {
    if (item.dataset.page === pageName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // 2. Update page header title
  const headerTitle = document.getElementById('current-header-title');
  if (headerTitle) {
    headerTitle.textContent = pageTitles[pageName];
  }

  // 3. Refresh and reload data from IndexedDB
  await refreshState();
  updateSidebarBrand();

  // 4. Render HTML into body content
  const contentBody = document.querySelector('.content-body');
  if (contentBody) {
    contentBody.innerHTML = pageModules[pageName].render(window.appState);
  }

  // 5. Setup interaction event handlers
  pageModules[pageName].setup(window.appState, navigate);
}

// Update Sidebar brand details
export function updateSidebarBrand() {
  const sidebarLogoContainer = document.querySelector('.sidebar-logo');
  if (sidebarLogoContainer) {
    if (window.appState.settings.logo) {
      sidebarLogoContainer.innerHTML = `
        <img src="${window.appState.settings.logo}" style="width:26px; height:26px; border-radius:50%; object-fit:cover; margin-right:8px;" id="sidebar-clinic-logo-img">
        <span id="sidebar-clinic-name">${window.appState.settings.name}</span>
      `;
    } else {
      sidebarLogoContainer.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #2dd4bf;" id="sidebar-clinic-logo-svg"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 2 5.5a7 7 0 0 1-7 7h-3Z"/><path d="M19 2c-3.07 3.42-6 3-10 4"/></svg>
        <span id="sidebar-clinic-name">${window.appState.settings.name}</span>
      `;
    }
  }
}

// Read database and update global state variables
async function refreshState() {
  window.appState.patients = await ClinicDB.getPatients();
  window.appState.queues = await ClinicDB.getQueues();
  window.appState.inventory = await ClinicDB.getInventory();
  window.appState.sales = await ClinicDB.getSales();
  window.appState.finance = await ClinicDB.getFinance();
  window.appState.appointments = await ClinicDB.getStoreData('appointments');
  window.appState.patient_courses = await ClinicDB.getStoreData('patient_courses');
  window.appState.followups = await ClinicDB.getStoreData('followups');
  window.appState.stock_movements = await ClinicDB.getStoreData('stock_movements');
  window.appState.employees = await ClinicDB.getStoreData('employees');
  
  // V3 Store integration
  window.appState.service_records = await ClinicDB.getStoreData('service_records');
  window.appState.medical_records = await ClinicDB.getStoreData('medical_records');
  window.appState.income_transactions = await ClinicDB.getStoreData('income_transactions');
  window.appState.expense_transactions = await ClinicDB.getStoreData('expense_transactions');
  window.appState.startup_costs = await ClinicDB.getStoreData('startup_costs');
  window.appState.payment_methods = await ClinicDB.getStoreData('payment_methods');
  window.appState.course_usage_logs = await ClinicDB.getStoreData('course_usage_logs');
  
  const settingsData = await ClinicDB.getStoreData('clinic_settings');
  window.appState.settings = settingsData.find(s => s.key === 'general') || {
    name: 'เรือนสมุนไพรคลินิก',
    owner: 'หมอประยุกต์ แผนไทย',
    phone: '02-123-4567',
    line: '@ruansamunphrai',
    address: '123 ถนนสุขุมวิท กรุงเทพฯ 10110'
  };

  window.appState.income_categories = settingsData.find(s => s.key === 'income_categories')?.list || ['ค่าบริการ', 'ขายยา', 'ขายผลิตภัณฑ์', 'ค่าคอร์ส', 'อื่นๆ'];
  window.appState.expense_categories = settingsData.find(s => s.key === 'expense_categories')?.list || ['ค่าน้ำค่าไฟ', 'เงินเดือนพนักงาน/แพทย์', 'ค่าวัตถุดิบ/ซื้อยาเติมคลัง', 'ค่าเช่าสถานที่', 'ค่าโฆษณา/การตลาด', 'อื่นๆ'];

  window.appState.disease_groups = settingsData.find(s => s.key === 'disease_groups')?.list || [
    'ลมปลายปัตคาดบ่าไหล่',
    'ลมปลายปัตคาดหลัง',
    'ลมอัมพฤกษ์/อัมพาต',
    'ลมจับโปงเข่า',
    'ลมปะกังศีรษะ',
    'ลมจุกเสียดท้อง',
    'ไข้ตักศิลา/ไข้พิษ',
    'สตรีระดูขัด',
    'โรคทั่วไป/สปาบำบัด'
  ];
  window.appState.element_states = settingsData.find(s => s.key === 'element_states')?.list || [
    'วาโยธาตุ (ลม) พิการ/กำเริบ',
    'ปถวีธาตุ (ดิน) พิการ/กำเริบ',
    'อาโปธาตุ (น้ำ) พิการ/กำเริบ',
    'เตโชธาตุ (ไฟ) พิการ/กำเริบ',
    'ไม่พบความผิดปกติของธาตุ'
  ];
  window.appState.pulses = settingsData.find(s => s.key === 'pulses')?.list || [
    'เต้นปกติ',
    'เร็วตึง (กำเริบ)',
    'ช้าเบา (หย่อน)',
    'เต้นสะดุด/เต้นข้ามจังหวะ (พิการ)'
  ];
  window.appState.seasons = settingsData.find(s => s.key === 'seasons')?.list || [
    'คิมหันตฤดู (ฤดูร้อน - พิกัดเตโช)',
    'วสันตฤดู (ฤดูฝน - พิกัดวาโย)',
    'เหมันตฤดู (ฤดูหนาว - พิกัดเสมหะ)'
  ];
  window.appState.gala_times = settingsData.find(s => s.key === 'gala_times')?.list || [
    'ไม่ระบุ',
    'ช่วงเช้า (06.00 - 10.00 น.) [พิกัดเสมหะ]',
    'ช่วงกลางวัน (10.00 - 14.00 น.) [พิกัดดี/โลหิต]',
    'ช่วงเย็น (14.00 - 18.00 น.) [พิกัดวาตะ]',
    'ช่วงค่ำ/กลางคืน (18.00 - 06.00 น.)'
  ];
}

// Initial application bootstrap
async function init() {
  try {
    // 1. Load initial seeds if database is blank
    await ClinicDB.seed();

    // 2. Fetch all values
    await refreshState();

    // 3. Set display date in Header via JavaScript dynamically
    const headerDate = document.getElementById('current-header-date');
    if (headerDate) {
      headerDate.textContent = new Date().toLocaleDateString('th-TH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    // 4. Set Sidebar Clinic Name and Logo dynamically
    updateSidebarBrand();

    // 5. Bind Sidebar click actions
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const targetPage = e.currentTarget.dataset.page;
        navigate(targetPage);
      });
    });

    // 6. Route to Dashboard initially
    await navigate('dashboard');

  } catch (error) {
    console.error('Failed to initialize local clinic application:', error);
  }
}

// Wait for browser loading completed
window.addEventListener('DOMContentLoaded', init);
