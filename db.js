// db.js - IndexedDB Manager for Thai Traditional Medicine Clinic (Version 3 MVP)
const DB_NAME = 'TraditionalClinicDB';
const DB_VERSION = 3; // Upgraded to V3 for MVP stores

export class ClinicDB {
  static open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        // V1 Stores
        if (!db.objectStoreNames.contains('patients')) {
          const patientStore = db.createObjectStore('patients', { keyPath: 'id', autoIncrement: true });
          patientStore.createIndex('name', 'name', { unique: false });
          patientStore.createIndex('phone', 'phone', { unique: false });
        }
        if (!db.objectStoreNames.contains('queues')) {
          const queueStore = db.createObjectStore('queues', { keyPath: 'id', autoIncrement: true });
          queueStore.createIndex('status', 'status', { unique: false });
          queueStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('inventory')) {
          const inventoryStore = db.createObjectStore('inventory', { keyPath: 'id', autoIncrement: true });
          inventoryStore.createIndex('name', 'name', { unique: false });
          inventoryStore.createIndex('type', 'type', { unique: false });
        }
        if (!db.objectStoreNames.contains('sales')) {
          const salesStore = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
          salesStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('finance')) {
          const financeStore = db.createObjectStore('finance', { keyPath: 'id', autoIncrement: true });
          financeStore.createIndex('type', 'type', { unique: false });
          financeStore.createIndex('date', 'date', { unique: false });
        }

        // V2 Stores
        if (!db.objectStoreNames.contains('appointments')) {
          const apptStore = db.createObjectStore('appointments', { keyPath: 'id', autoIncrement: true });
          apptStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('patient_courses')) {
          const courseStore = db.createObjectStore('patient_courses', { keyPath: 'id', autoIncrement: true });
          courseStore.createIndex('patientId', 'patientId', { unique: false });
        }
        if (!db.objectStoreNames.contains('followups')) {
          const followStore = db.createObjectStore('followups', { keyPath: 'id', autoIncrement: true });
          followStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('stock_movements')) {
          const movementStore = db.createObjectStore('stock_movements', { keyPath: 'id', autoIncrement: true });
          movementStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('employees')) {
          db.createObjectStore('employees', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('clinic_services')) {
          db.createObjectStore('clinic_services', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('price_packages')) {
          db.createObjectStore('price_packages', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('clinic_settings')) {
          db.createObjectStore('clinic_settings', { keyPath: 'key' });
        }

        // --- NEW V3 MVP STORES ---
        if (!db.objectStoreNames.contains('service_records')) {
          const store = db.createObjectStore('service_records', { keyPath: 'id', autoIncrement: true });
          store.createIndex('patientId', 'patientId', { unique: false });
        }
        if (!db.objectStoreNames.contains('medical_records')) {
          const store = db.createObjectStore('medical_records', { keyPath: 'id', autoIncrement: true });
          store.createIndex('patientId', 'patientId', { unique: false });
        }
        if (!db.objectStoreNames.contains('income_transactions')) {
          const store = db.createObjectStore('income_transactions', { keyPath: 'id', autoIncrement: true });
          store.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('expense_transactions')) {
          const store = db.createObjectStore('expense_transactions', { keyPath: 'id', autoIncrement: true });
          store.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('startup_costs')) {
          const store = db.createObjectStore('startup_costs', { keyPath: 'id', autoIncrement: true });
          store.createIndex('category', 'category', { unique: false });
        }
        if (!db.objectStoreNames.contains('payment_methods')) {
          db.createObjectStore('payment_methods', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('course_usage_logs')) {
          const store = db.createObjectStore('course_usage_logs', { keyPath: 'id', autoIncrement: true });
          store.createIndex('patientId', 'patientId', { unique: false });
        }
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  static async runTx(storeName, mode, callback) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = callback(store);

      tx.oncomplete = () => resolve(request ? request.result : null);
      tx.onerror = (event) => reject(event.target.error);
    });
  }

  // --- SUPABASE CLOUD SYNC HELPER METHODS ---
  static async getSupabaseConfig() {
    try {
      // Note: We bypass recursive config check by loading directly from IndexedDB bypassing generic wrapper
      const settings = await this.runTx('clinic_settings', 'readonly', (store) => store.getAll());
      const general = settings.find(s => s.key === 'general') || {};
      if (general.supabaseEnabled && general.supabaseUrl && general.supabaseKey) {
        return {
          url: general.supabaseUrl.trim().replace(/\/$/, ''),
          key: general.supabaseKey.trim()
        };
      }
    } catch (e) {
      console.warn("Failed to read Supabase config:", e);
    }
    return null;
  }

  static async requestSupabase(config, method, endpoint, body = null) {
    const headers = {
      'apikey': config.key,
      'Authorization': `Bearer ${config.key}`,
      'Content-Type': 'application/json'
    };
    if (method === 'POST') {
      headers['Prefer'] = 'resolution=merge-duplicates';
    }
    const options = {
      method: method,
      headers: headers
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`${config.url}/rest/v1/${endpoint}`, options);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Supabase Request Failed: ${response.statusText} (${errText})`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  static async pushLocalDataToSupabase() {
    const config = await this.getSupabaseConfig();
    if (!config) {
      throw new Error("กรุณากรอกข้อมูลและเปิดใช้งานระบบซิงค์ออนไลน์ (Supabase Sync) ในหน้าตั้งค่าก่อนกดปุ่มนี้");
    }

    const stores = [
      'patients', 'queues', 'inventory', 'sales', 'finance', 
      'appointments', 'patient_courses', 'followups', 'stock_movements', 
      'employees', 'clinic_services', 'price_packages', 'clinic_settings',
      'service_records', 'medical_records', 'income_transactions', 
      'expense_transactions', 'startup_costs', 'payment_methods', 'course_usage_logs'
    ];

    let totalUploaded = 0;
    for (const storeName of stores) {
      const items = await this.runTx(storeName, 'readonly', (store) => store.getAll());
      for (const item of items) {
        const recordId = String(item.id !== undefined ? item.id : item.key);
        if (recordId !== undefined && recordId !== 'null' && recordId !== 'undefined') {
          await this.requestSupabase(config, 'POST', 'clinic_store?on_conflict=store_name,record_id', {
            store_name: storeName,
            record_id: recordId,
            data: item
          });
          totalUploaded++;
        }
      }
    }
    return totalUploaded;
  }

  // --- GENERIC DB CRUD APIs (WITH ONLINE SUPABASE SYNC) ---
  static async getStoreData(storeName) {
    const config = await this.getSupabaseConfig();
    if (config) {
      try {
        const rows = await this.requestSupabase(config, 'GET', `clinic_store?store_name=eq.${storeName}&select=data`);
        const items = rows.map(r => r.data);
        
        // Synchronize local IndexedDB
        await this.runTx(storeName, 'readwrite', (store) => {
          store.clear();
          items.forEach(item => store.put(item));
        });
        
        return items;
      } catch (err) {
        console.error(`Failed to fetch ${storeName} from Supabase, falling back to local:`, err);
      }
    }
    return this.runTx(storeName, 'readonly', (store) => store.getAll());
  }

  static async addStoreData(storeName, item) {
    const localId = await this.runTx(storeName, 'readwrite', (store) => store.add({
      ...item,
      createdAt: new Date().toISOString()
    }));
    
    const resolvedItem = { ...item };
    if (typeof localId === 'number' || typeof localId === 'string') {
      if (item.id === undefined) {
        resolvedItem.id = localId;
      }
    }
    
    const config = await this.getSupabaseConfig();
    if (config) {
      try {
        const recordId = String(resolvedItem.id !== undefined ? resolvedItem.id : resolvedItem.key);
        await this.requestSupabase(config, 'POST', 'clinic_store?on_conflict=store_name,record_id', {
          store_name: storeName,
          record_id: recordId,
          data: resolvedItem
        });
      } catch (err) {
        console.error(`Failed to sync added item in ${storeName} to Supabase:`, err);
      }
    }
    return localId;
  }

  static async putStoreData(storeName, item) {
    const localResult = await this.runTx(storeName, 'readwrite', (store) => store.put(item));
    
    const config = await this.getSupabaseConfig();
    if (config) {
      try {
        const recordId = String(item.id !== undefined ? item.id : item.key);
        await this.requestSupabase(config, 'POST', 'clinic_store?on_conflict=store_name,record_id', {
          store_name: storeName,
          record_id: recordId,
          data: item
        });
      } catch (err) {
        console.error(`Failed to sync updated item in ${storeName} to Supabase:`, err);
      }
    }
    return localResult;
  }

  static async deleteStoreData(storeName, id) {
    const localResult = await this.runTx(storeName, 'readwrite', (store) => store.delete(id));
    
    const config = await this.getSupabaseConfig();
    if (config) {
      try {
        await this.requestSupabase(config, 'DELETE', `clinic_store?store_name=eq.${storeName}&record_id=eq.${id}`);
      } catch (err) {
        console.error(`Failed to sync deleted item in ${storeName} to Supabase:`, err);
      }
    }
    return localResult;
  }

  // --- Patients API ---
  static addPatient(patient) {
    return this.addStoreData('patients', patient);
  }

  static getPatients() {
    return this.getStoreData('patients');
  }

  static getPatient(id) {
    return this.runTx('patients', 'readonly', (store) => store.get(Number(id)));
  }

  static updatePatient(patient) {
    return this.putStoreData('patients', patient);
  }

  // --- Queues API ---
  static addQueue(queue) {
    return this.addStoreData('queues', queue);
  }

  static getQueues() {
    return this.getStoreData('queues');
  }

  static updateQueue(queue) {
    return this.putStoreData('queues', queue);
  }

  static deleteQueue(id) {
    return this.deleteStoreData('queues', Number(id));
  }

  // --- Inventory API ---
  static getInventory() {
    return this.getStoreData('inventory');
  }

  static addInventoryItem(item) {
    return this.addStoreData('inventory', item);
  }

  static updateInventoryItem(item) {
    return this.putStoreData('inventory', item);
  }

  static deleteInventoryItem(id) {
    return this.deleteStoreData('inventory', Number(id));
  }

  // --- Sales API ---
  static addSale(sale) {
    return this.addStoreData('sales', sale);
  }

  static getSales() {
    return this.getStoreData('sales');
  }

  // --- Finance API ---
  static getFinance() {
    return this.getStoreData('finance');
  }

  static addFinance(item) {
    return this.addStoreData('finance', item);
  }

  static deleteFinance(id) {
    return this.deleteStoreData('finance', Number(id));
  }

  // --- Clear all Seed Data (isSeedData === true) ---
  static async clearSeedData() {
    const stores = [
      'patients', 'queues', 'inventory', 'sales', 'finance', 
      'appointments', 'patient_courses', 'followups', 'stock_movements', 
      'employees', 'service_records', 'medical_records', 
      'income_transactions', 'expense_transactions', 'startup_costs', 
      'course_usage_logs'
    ];

    for (const storeName of stores) {
      const items = await this.getStoreData(storeName);
      for (const item of items) {
        if (item.isSeedData === true) {
          const id = item.id || item.key;
          if (id !== undefined) {
            await this.deleteStoreData(storeName, id);
          }
        }
      }
    }
    
    // Write marker in settings to prevent reseeding
    await this.putStoreData('clinic_settings', { key: 'has_seeded', value: true });
  }

  // --- Seed Initial Data with isSeedData flag ---
  static async seed() {
    const settings = await this.getStoreData('clinic_settings');
    const hasSeeded = settings.find(s => s.key === 'has_seeded');
    if (hasSeeded) return; // Prevent reseeding if cleared or set

    // Seed general clinic info
    const generalSettings = settings.find(s => s.key === 'general');
    if (!generalSettings) {
      await this.putStoreData('clinic_settings', {
        key: 'general',
        name: 'เรือนสมุนไพรคลินิก',
        owner: 'หมอประยุกต์ แผนไทย',
        phone: '02-123-4567',
        line: '@ruansamunphrai',
        address: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
        isSeedData: true
      });
    }

    // 1. Inventory Seed (Medicines, Products, Services, Packages)
    const items = await this.getInventory();
    if (items.length === 0) {
      const defaultItems = [
        { name: 'ยาหม่องสมุนไพรสูตรเสลดพังพอน', type: 'medicine', price: 80, cost: 35, stock: 120, unit: 'ขวด', expiry: '2027-12-31', subCategory: 'ยาใช้ภายนอก', isSeedData: true },
        { name: 'ยาแคปซูลฟ้าทะลายโจร', type: 'medicine', price: 150, cost: 70, stock: 8, unit: 'กระปุก', expiry: '2026-10-15', subCategory: 'ยาสมุนไพรรักษาโรค', isSeedData: true }, 
        { name: 'ขมิ้นชันชนิดแคปซูล', type: 'medicine', price: 120, cost: 50, stock: 100, unit: 'กระปุก', expiry: '2027-04-20', subCategory: 'ยาสมุนไพรรักษาโรค', isSeedData: true },
        { name: 'น้ำมันไพลนวดบำบัด', type: 'product', price: 250, cost: 110, stock: 45, unit: 'ขวด', subCategory: 'ผลิตภัณฑ์ในคลินิก', isSeedData: true },
        { name: 'ชาสมุนไพรเกสรทั้งห้า', type: 'product', price: 180, cost: 90, stock: 6, unit: 'กล่อง', subCategory: 'ผลิตภัณฑ์ในคลินิก', isSeedData: true }, 
        { name: 'หัตถการนวดประคบสมุนไพร', type: 'service', price: 600, cost: 150, stock: 9999, unit: 'ครั้ง', isSeedData: true },
        { name: 'บริการสปานวดหน้าสมุนไพรสด', type: 'service', price: 890, cost: 200, stock: 9999, unit: 'ครั้ง', isSeedData: true },
        { name: 'คอร์สนวดรักษาออฟฟิศซินโดรม (5 ครั้ง)', type: 'package', price: 2500, cost: 750, stock: 9999, unit: 'คอร์ส', isSeedData: true },
        { name: 'คอร์สสปาตัว+นวดหน้าพรีเมียม (3 ครั้ง)', type: 'package', price: 3900, cost: 1000, stock: 9999, unit: 'คอร์ส', isSeedData: true }
      ];
      for (const item of defaultItems) {
        await this.addInventoryItem(item);
      }
    }

    const pts = await this.getPatients();
    if (pts.length === 0) {
      const defaultPatients = [
        { name: 'สมชาย นามดี', phone: '0812345678', birthdate: '1985-02-14', gender: 'ชาย', element: 'ดิน (ปถวีธาตุ)', congenitalDiseases: 'ความดันโลหิตสูง', allergies: 'เกสรดอกไม้', isSeedData: true },
        { name: 'สมศรี รักษ์ไทย', phone: '0898765432', birthdate: '1990-05-20', gender: 'หญิง', element: 'น้ำ (อาโปธาตุ)', congenitalDiseases: 'ไม่มี', allergies: 'ไม่มี', isSeedData: true },
        { name: 'กิตติศักดิ์ พูลเพิ่ม', phone: '0867891234', birthdate: '1978-08-08', gender: 'ชาย', element: 'ลม (วาโยธาตุ)', congenitalDiseases: 'โรคหัวใจ', allergies: 'พาราเซตามอล', isSeedData: true }
      ];
      for (const p of defaultPatients) {
        await this.addPatient(p);
      }
    }

    // 3. Appointments Seed
    const appts = await this.getStoreData('appointments');
    if (appts.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const defaultAppts = [
        { patientId: 1, patientName: 'สมชาย นามดี', date: today, time: '10:00', status: 'confirmed', notes: 'นวดประคบรักษาอาการบ่าไหล่ตึง', isSeedData: true },
        { patientId: 2, patientName: 'สมศรี รักษ์ไทย', date: today, time: '13:00', status: 'waiting', notes: 'ทำสปานวดหน้าสมุนไพรสด', isSeedData: true },
        { patientId: 3, patientName: 'กิตติศักดิ์ พูลเพิ่ม', date: today, time: '15:30', status: 'scheduled', notes: 'ปรึกษาธาตุเจ้าเรือนกำเริบ', isSeedData: true }
      ];
      for (const a of defaultAppts) {
        await this.addStoreData('appointments', a);
      }
    }

    // 4. Patient Courses Purchased Seed
    const courses = await this.getStoreData('patient_courses');
    if (courses.length === 0) {
      const defaultCourses = [
        { patientId: 1, patientName: 'สมชาย นามดี', packageName: 'คอร์สนวดรักษาออฟฟิศซินโดรม (5 ครั้ง)', totalSessions: 5, usedSessions: 2, status: 'active', isSeedData: true },
        { patientId: 2, patientName: 'สมศรี รักษ์ไทย', packageName: 'คอร์สสปาตัว+นวดหน้าพรีเมียม (3 ครั้ง)', totalSessions: 3, usedSessions: 3, status: 'completed', isSeedData: true }
      ];
      for (const c of defaultCourses) {
        await this.addStoreData('patient_courses', c);
      }
    }

    // 5. Follow-ups Seed
    const followups = await this.getStoreData('followups');
    if (followups.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const defaultFollowups = [
        { patientId: 1, patientName: 'สมชาย นามดี', date: today, notes: 'ติดตามอาการหลังทำหัตถการประคบสมุนไพรบ่าไหล่ตึง', status: 'pending', isSeedData: true },
        { patientId: 3, patientName: 'กิตติศักดิ์ พูลเพิ่ม', date: today, notes: 'สอบถามผลการรับประทานยาแคปซูลขมิ้นชัน', status: 'contacted', isSeedData: true }
      ];
      for (const f of defaultFollowups) {
        await this.addStoreData('followups', f);
      }
    }

    // 6. Employees Seed
    const emps = await this.getStoreData('employees');
    if (emps.length === 0) {
      const defaultEmps = [
        { name: 'พท.ป. เมธา ศรีสุข', role: 'แพทย์แผนไทยประยุกต์', phone: '0822223333', commission: 20, isSeedData: true },
        { name: 'นส. วันดี นวดดี', role: 'พนักงานนวดหัตถการ/สปา', phone: '0855556666', commission: 15, isSeedData: true }
      ];
      for (const e of defaultEmps) {
        await this.addStoreData('employees', e);
      }
    }

    // 7. Startup Costs Seed (New V3 store)
    const startupCosts = await this.getStoreData('startup_costs');
    if (startupCosts.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const defaultStartups = [
        { description: 'ค่าตกแต่งร้านและงานระบบ', category: 'ค่าตกแต่งสถานที่', amount: 80000, date: today, isSeedData: true },
        { description: 'เตียงนวดและอุปกรณ์ตู้อบไอน้ำสด', category: 'ค่าเครื่องมือ/เตียง/อุปกรณ์', amount: 35000, date: today, isSeedData: true },
        { description: 'ค่าเอกสารและใบอนุมัติสิทธิ์สปา', category: 'เอกสาร/ใบอนุญาตกิจการ', amount: 15000, date: today, isSeedData: true }
      ];
      for (const sc of defaultStartups) {
        await this.addStoreData('startup_costs', sc);
      }
    }

    // 8. Expense Transactions Seed (New V3 store)
    const expenseTx = await this.getStoreData('expense_transactions');
    if (expenseTx.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const defaultExpenses = [
        { description: 'จ่ายค่าเช่าอาคารตึกประจำเดือน', category: 'ค่าเช่าสถานที่', amount: 12000, date: today, isSeedData: true },
        { description: 'จ่ายค่าน้ำประปาและค่าไฟฟ้าคลินิก', category: 'ค่าน้ำค่าไฟ', amount: 3500, date: today, isSeedData: true }
      ];
      for (const ex of defaultExpenses) {
        await this.addStoreData('expense_transactions', ex);
      }
    }

    // 9. Income Transactions Seed (New V3 store)
    const incomeTx = await this.getStoreData('income_transactions');
    if (incomeTx.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const defaultIncomes = [
        { patientId: 1, patientName: 'สมชาย นามดี', netAmount: 1200, category: 'ค่าบริการ', paymentMethod: 'เงินสด', date: today, isSeedData: true },
        { patientId: 2, patientName: 'สมศรี รักษ์ไทย', netAmount: 3900, category: 'ค่าคอร์ส', paymentMethod: 'โอนเงินผ่านธนาคาร/QR Code', date: today, isSeedData: true }
      ];
      for (const inc of defaultIncomes) {
        await this.addStoreData('income_transactions', inc);
      }
    }

    // Set seeded flag
    await this.putStoreData('clinic_settings', { key: 'has_seeded', value: true });
  }
}
