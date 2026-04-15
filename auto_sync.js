const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

// Cấu hình tệp cần theo dõi
const EXCEL_FILE = path.join(__dirname, 'Return NVL.xlsx');
const SYNC_SCRIPT = path.join(__dirname, 'sync.js');

let lastMtime = 0;
let isSyncing = false;

console.log('----------------------------------------------------');
console.log('🚀 HE THONG TU DONG DONG BO DATA (SYNC WATCHER)');
console.log('📂 Dang theo doi file: ' + EXCEL_FILE);
console.log('⏰ Kiem tra thay doi moi 10 giay...');
console.log('----------------------------------------------------');

function runSync() {
    if (isSyncing) return;
    isSyncing = true;
    
    console.log(`\n[${new Date().toLocaleTimeString()}] 🟢 Phat hien thay doi! Dang bat dau dong bo...`);
    
    exec(`node "${SYNC_SCRIPT}"`, (error, stdout, stderr) => {
        isSyncing = false;
        if (error) {
            console.error(`❌ LOI DONG BO: ${error.message}`);
            return;
        }
        if (stderr) {
            console.warn(`⚠️ Warning: ${stderr}`);
        }
        console.log(stdout);
        console.log(`✅ [${new Date().toLocaleTimeString()}] DONG BO HOAN TAT!`);
        console.log('----------------------------------------------------');
    });
}

// Ham kiem tra dinh ky mtime (Last Modified Time)
// Dung method nay se on dinh hon fs.watch tren OneDrive/Sharepoint
setInterval(() => {
    try {
        if (!fs.existsSync(EXCEL_FILE)) return;
        
        const stats = fs.statSync(EXCEL_FILE);
        const currentMtime = stats.mtimeMs;

        if (lastMtime === 0) {
            lastMtime = currentMtime;
            return;
        }

        if (currentMtime > lastMtime) {
            lastMtime = currentMtime;
            runSync();
        }
    } catch (err) {
        // Co the file dang bi khoa do OneDrive dang dong bo, bo qua lan nay
    }
}, 10000); // Kiem tra moi 10 giay
