// login.js — ANTIPOST Login

const errorMsg = document.getElementById('error-msg');
const step1    = document.getElementById('step-1');
const step2    = document.getElementById('step-2');

// Show session timeout error from URL param
const params = new URLSearchParams(window.location.search);
if (params.get('error') === 'timeout') {
    showError('Sesi Anda telah habis. Silakan login kembali.');
}

async function validatePassword() {
    const pwd = document.getElementById('passwordInput').value;
    if (!pwd) return;

    try {
        const res  = await fetch('/api/validate-password', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ password: pwd })
        });
        const data = await res.json();

        if (data.success) {
            step1.style.display = 'none';
            step2.style.display = 'flex';
            document.getElementById('hiddenPassword').value = pwd;
            errorMsg.style.display = 'none';
            setTimeout(() => document.getElementById('pinInput').focus(), 100);
        } else {
            showError('Password salah!');
            document.getElementById('passwordInput').value = '';
            document.getElementById('passwordInput').focus();
        }
    } catch {
        showError('Terjadi kesalahan koneksi.');
    }
}

function showError(msg) {
    errorMsg.textContent    = msg;
    errorMsg.style.display  = 'block';
}

document.getElementById('passwordInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') validatePassword();
});
