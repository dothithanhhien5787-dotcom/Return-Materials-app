const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// CONFIG
const EXCEL_FILE = path.join(__dirname, 'Return NVL.xlsx');
const SHEET_NAME = 'data';
const SB_URL = 'https://vrhuzisclglurlmbluzg.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyaHV6aXNjbGdsdXJsbWJsdXpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDM3NTUsImV4cCI6MjA5MTExOTc1NX0.DP3iscBkcDumiwhOs9mlS3nKGV-jIRXFGJ6NRT7wAic';

const supabase = createClient(SB_URL, SB_KEY);

// Các cột ngày tháng
const DATE_COLUMNS = [
  'Load material', 'Laminate Date', 'Sawing cutting date', 
  'Molding Date', 'Cutting Pairs Date', 'Finished date', 'Load liệu'
];

// Các cột số (Ép định dạng số)
const NUMBER_COLUMNS = [
  'Dosage Pu', 'Dosage Fabric', "PO Q'TY", 'Leadtime'
];

// Hàm lấy giá trị số từ Excel (Xử lý trường hợp bị biến thành Date)
function getExcelNumber(val) {
  if (typeof val === 'number') return val;
  if (val instanceof Date) {
    // Chuyển ngược Date về Serial Number của Excel (Xấp xỉ)
    return (val.getTime() - new Date(1899, 11, 30).getTime()) / (24 * 60 * 60 * 1000);
  }
  if (typeof val === 'string') {
    let n = parseFloat(val.replace(/,/g, ''));
    return isNaN(n) ? null : n;
  }
  return null;
}

async function sync() {
  console.log('🚀 Đang bắt đầu đồng bộ (Bản vá cột số và ngày tháng)...');
  
  try {
    const workbook = XLSX.readFile(EXCEL_FILE, { cellDates: true });
    const sheet = workbook.Sheets[SHEET_NAME];
    if (!sheet) throw new Error(`Không tìm thấy sheet "${SHEET_NAME}"`);
    
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`📦 Đã đọc ${data.length} dòng từ Excel.`);

    const processedData = data.map(row => {
      const newRow = {};
      
      // Trim tất cả các tên cột (keys) để tránh lỗi khoảng trắng dư thừa
      Object.keys(row).forEach(key => {
        const trimmedKey = key.trim();
        newRow[trimmedKey] = row[key];
      });

      // 1. Xử lý các cột Số
      NUMBER_COLUMNS.forEach(col => {
        if (newRow[col] !== undefined && newRow[col] !== null) {
          newRow[col] = getExcelNumber(newRow[col]);
        }
      });

      // 2. Xử lý các cột Ngày tháng
      DATE_COLUMNS.forEach(col => {
        if (newRow[col]) {
          let val = newRow[col];
          let d, m, y;
          
          if (val instanceof Date) {
            d = String(val.getDate()).padStart(2, '0');
            m = String(val.getMonth() + 1).padStart(2, '0');
            y = val.getFullYear();
            newRow[col] = `${d}/${m}/${y}`;
          } 
          else if (typeof val === 'number') {
            const dateObj = XLSX.SSF.parse_date_code(val);
            y = dateObj.y || new Date().getFullYear();
            m = String(dateObj.m).padStart(2, '0');
            d = String(dateObj.d).padStart(2, '0');
            newRow[col] = `${d}/${m}/${y}`;
          } 
          else if (typeof val === 'string' && val.includes('H')) { // Xử lý các chuỗi ISO
             const dateObj = new Date(val);
             if (!isNaN(dateObj.getTime())) {
                d = String(dateObj.getDate()).padStart(2, '0');
                m = String(dateObj.getMonth() + 1).padStart(2, '0');
                y = dateObj.getFullYear();
                newRow[col] = `${d}/${m}/${y}`;
             }
          }
        }
      });
      return newRow;
    });

    console.log('🗑️  Làm sạch return_nvl...');
    const { error: delErr } = await supabase.from('return_nvl').delete().neq('id', 0);
    if (delErr) throw delErr;

    const batchSize = 300;
    for (let i = 0; i < processedData.length; i += batchSize) {
      const batch = processedData.slice(i, i + batchSize);
      const { error: insErr } = await supabase.from('return_nvl').insert(batch);
      if (insErr) throw insErr;
      console.log(`✅ Đã đẩy: ${i + batch.length}/${processedData.length}`);
    }

    console.log('✨ Đã sửa lỗi toàn bộ cột Số và Ngày tháng!');
  } catch (err) {
    console.error('💥 Lỗi:', err.message);
  }
}

sync();
