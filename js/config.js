// js/config.js
window.supabaseUrl = 'https://exnfrclagndigmdybicg.supabase.co';
window.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4bmZyY2xhZ25kaWdtZHliaWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1MTEyODIsImV4cCI6MjA2NzA4NzI4Mn0.aW0snMCgrrEV4LOF64JGM0qD324o_WvvYxNFoPXPHgY';

// 初始化客户端
document.addEventListener('DOMContentLoaded', function() {
  if (window.supabase && window.supabase.createClient) {
    window.supabase = supabase;    
  }
});
