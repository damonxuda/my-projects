// js/config.js
window.supabaseUrl = 'https://exnfrclagndigmdybicq.supabase.co';
window.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4bmZyY2xhZ25kaWdtZHliaWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4NzA5MDAsImV4cCI6MjA1MTQ0NjkwMH0.aW0snMCgrrEV4LOF64JGM0qD324o_WvvYxNFoPXPHgY';

// 初始化客户端
document.addEventListener('DOMContentLoaded', function() {
    if (supabase && supabase.createClient) {
        window.supabase = supabase.createClient(window.supabaseUrl, window.supabaseKey);
    }
});
