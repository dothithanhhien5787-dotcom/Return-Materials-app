const { createClient } = require('@supabase/supabase-js');

const SB_URL = 'https://vrhuzisclglurlmbluzg.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyaHV6aXNjbGdsdXJsbWJsdXpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDM3NTUsImV4cCI6MjA5MTExOTc1NX0.DP3iscBkcDumiwhOs9mlS3nKGV-jIRXFGJ6NRT7wAic';
const supabase = createClient(SB_URL, SB_KEY);

async function check() {
    const { count, error } = await supabase
        .from('return_nvl')
        .select('*', { count: 'exact', head: true });
    
    if (error) {
        console.log('❌ Lỗi kết nối:', error.message);
    } else {
        console.log('✅ Số dòng hiện có trên Supabase:', count);
    }
}

check();
