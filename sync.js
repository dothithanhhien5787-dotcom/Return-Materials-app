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

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) return reject(new Error(`Tải lỗi: ${response.statusCode}`));
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    }).on('error', (err) => reject(err));
  });
}

function formatExcelDate(val) {
  if (val instanceof Date) {
    let d = String(val.getDate()).padStart(2, '0');
    let m = String(val.getMonth() + 1).padStart(2, '0');
    let y = val.getFullYear();
    return `${d}/${m}/${y}`;
  } else if (typeof val === 'number') {
    try {
      const dateObj = XLSX.SSF.parse_date_code(val);
      let d = String(dateObj.d).padStart(2, '0');
      let m = String(dateObj.m).padStart(2, '0');
      let y = dateObj.y || 2026;
      return `${d}/${m}/${y}`;
    } catch(e) { return val; }
  }
  return val;
}

async function sync() {
  console.log('🚀 Đang đồng bộ lại dữ liệu...');
  let targetFile = LOCAL_FILE;
  
  try {
    if (EXCEL_URL) {
       console.log('📡 Đang tải bản Cloud...');
       try { await downloadFile(EXCEL_URL, DOWNLOADED_FILE); targetFile = DOWNLOADED_FILE; } catch (e) {}
    }

    const workbook = XLSX.readFile(targetFile, { cellDates: true });
    const sheet = workbook.Sheets[SHEET_NAME];
    
    // Đảm bảo dải ô bao gồm cột AH (index 33)
    const ref = sheet['!ref'] || "A1:Z5000";
    const range = XLSX.utils.decode_range(ref);
    if (range.e.c < 33) range.e.c = 33;
    sheet['!ref'] = XLSX.utils.encode_range(range);

    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const headers = rawData[0];
    const AH_INDEX = 33;
    const FINISHED_DATE_INDEX = 15; // Su dung cot Finished date co san de luu AH

    const processedData = rawData.slice(1).map(row => {
      let newRow = {};
      headers.forEach((h, i) => {
        let hName = h ? String(h).trim() : "";
        if (!hName) return;

        let val = row[i];
        
        // Neu den cot Finished date, lay gia tri cua AH (neu AH co du lieu)
        if (i === FINISHED_DATE_INDEX) {
           const ahVal = row[AH_INDEX];
           if (ahVal && ahVal !== "") val = ahVal;
        }

        // Dinh dang ngay thang
        if ([10, 11, 12, 13, 14, 15, 26].includes(i)) {
          val = formatExcelDate(val);
        }
        newRow[hName] = val;
      });
      return newRow;
    });

    console.log(`📊 Đang đẩy ${processedData.length} dòng lên Supabase...`);
    await supabase.from('return_nvl').delete().neq('id', 0);

    const batchSize = 300;
    for (let i = 0; i < processedData.length; i += batchSize) {
      const batch = processedData.slice(i, i + batchSize);
      const { error } = await supabase.from('return_nvl').insert(batch);
      if (error) throw error;
      console.log(`✅ Đã đẩy: ${i + batch.length}/${processedData.length}`);
    }

    console.log('✨ XONG! Dữ liệu đã được cập nhật.');
  } catch (err) {
    console.error('💥 Lỗi:', err.message);
  }
}

sync();
