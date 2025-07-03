// js/config.js
window.supabaseUrl = 'https://wytqlpwlelznkoxhygfc.supabase.co';
window.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5dHFscHdsZWx6bmtveGh5Z2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1Mzk4NDAsImV4cCI6MjA2NzExNTg0MH0.bMPiovIGFAqdC-BQwozDBN9FhbCPwszwG9gUJ-oc7Ok';

// 初始化客户端
document.addEventListener('DOMContentLoaded', function() {
    if (supabase && supabase.createClient) {
        window.supabase = supabase.createClient(window.supabaseUrl, window.supabaseKey);
    }
});
