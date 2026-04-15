const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const https = require('https');
const fs = require('fs');

// CONFIG
const EXCEL_URL = 'https://ortholitevietnam.sharepoint.com/:x:/s/production9/IQAL2XyY96biSKz7OewO0UGoARRvcAJKgJxn2ReYwSzPDX0?download=1';
const LOCAL_FILE = path.join(__dirname, 'Return NVL.xlsx');
const DOWNLOADED_FILE = path.join(__dirname, 'temp_sync.xlsx');
const SHEET_NAME = 'data';
const SB_URL = 'https://vrhuzisclglurlmbluzg.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyaHV6aXNjbGdsdXJsbWJsdXpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDM3NTUsImV4cCI6MjA5MTExOTc1NX0.DP3iscBkcDumiwhOs9mlS3nKGV-jIRXFGJ6NRT7wAic';

const supabase = createClient(SB_URL, SB_KEY);

const DATE_COLUMNS_INDICES = [10, 11, 12, 13, 14, 15, 26, 33]; // Cac cot ngay thang (Load material, ..., AH)

// Ham tai file tu URL (Ho tro Redirect)
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Tải tệp thất bại: ${response.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(dest));
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

function formatExcelDate(val) {
  if (val instanceof Date) {
    let d = String(val.getDate()).padStart(2, '0');
    let m = String(val.getMonth() + 1).padStart(2, '0');
    let y = val.getFullYear();
    return `${d}/${m}/${y}`;
  } else if (typeof val === 'number') {
    const dateObj = XLSX.SSF.parse_date_code(val);
    let d = String(dateObj.d).padStart(2, '0');
    let m = String(dateObj.m).padStart(2, '0');
    let y = dateObj.y || new Date().getFullYear();
    return `${d}/${m}/${y}`;
  }
  return val;
}

async function sync() {
  console.log('🚀 Bắt đầu đồng bộ...');
  let targetFile = LOCAL_FILE;
  
  try {
    if (EXCEL_URL) {
       console.log('📡 Đang tải bản mới từ SharePoint...');
       try {
         await downloadFile(EXCEL_URL, DOWNLOADED_FILE);
         targetFile = DOWNLOADED_FILE;
       } catch (e) {
         console.log('⚠️ Không tải được bản Cloud, dùng bản Local thay thế.');
       }
    }

    const workbook = XLSX.readFile(targetFile, { cellDates: true });
    const sheet = workbook.Sheets[SHEET_NAME];
    if (!sheet) throw new Error(`Không thấy sheet "${SHEET_NAME}"`);

    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const headers = rawData[0];
    const AH_INDEX = 33;

    const processedData = rawData.slice(1).filter(row => {
      // LOC THEO YEU CAU: Chi lay don hang co ngay o cot AH (index 33)
      const ahValue = row[AH_INDEX];
      return ahValue !== "" && ahValue !== undefined && ahValue !== null;
    }).map(row => {
      let newRow = {};
      headers.forEach((h, i) => {
        if (!h) return;
        let val = row[i];
        if (DATE_COLUMNS_INDICES.includes(i)) {
          val = formatExcelDate(val);
        }
        newRow[h.trim()] = val;
      });
      return newRow;
    });

    console.log(`🎯 Số đơn hàng thỏa mãn (có ngày AH): ${processedData.length}`);

    console.log('🗑️  Xóa data cũ...');
    await supabase.from('return_nvl').delete().neq('id', 0);

    if (processedData.length > 0) {
      const batchSize = 300;
      for (let i = 0; i < processedData.length; i += batchSize) {
        const batch = processedData.slice(i, i + batchSize);
        await supabase.from('return_nvl').insert(batch);
        console.log(`✅ Đã đẩy: ${i + batch.length}/${processedData.length}`);
      }
    }

    console.log('✨ HOÀN TẤT ĐỒNG BỘ!');
  } catch (err) {
    console.error('💥 Lỗi:', err.message);
  }
}

sync();
