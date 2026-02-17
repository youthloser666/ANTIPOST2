const errorMsg = document.getElementById('error-msg');
        
    // Tampilkan pesan error
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('error')) {
        const errType = urlParams.get('error');
        if (errType === 'timeout') {
            errorMsg.textContent = 'Sesi Anda telah habis. Silakan login kembali.';
        }
        errorMsg.style.display = 'block';
    }

    async function validatePassword() {
        const pwd = document.getElementById('passwordInput').value;
        if (!pwd) return;

        try {
            const res = await fetch('/api/validate-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd })
            });
            const data = await res.json();

            if (data.success) {
                // Switch to Step 2
                document.getElementById('step-1').style.display = 'none';
                document.getElementById('step-2').style.display = 'block';
                document.getElementById('hiddenPassword').value = pwd;
                errorMsg.style.display = 'none';
                    
                // Focus PIN input
                setTimeout(() => document.getElementById('pinInput').focus(), 100);
            } else {
                errorMsg.textContent = 'Password salah!';
                errorMsg.style.display = 'block';
                document.getElementById('passwordInput').value = '';
                document.getElementById('passwordInput').focus();
            }
        } catch (e) {
            console.error(e);
            errorMsg.textContent = 'Terjadi kesalahan koneksi.';
            errorMsg.style.display = 'block';
        }
    }

    // Allow Enter key for password step
    document.getElementById('passwordInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            validatePassword();
        }
    });