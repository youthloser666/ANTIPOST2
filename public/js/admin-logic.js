// --- CONFIG & UTILS ---

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
}

// Fungsi Upload Generic (bisa dipakai Personal & Comission)
function uploadFile(file, progressBarElement, progressContainer) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('image', file);

        const xhr = new XMLHttpRequest();
        
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBarElement) progressBarElement.style.width = '0%';

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && progressBarElement) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressBarElement.style.width = percentComplete + '%';
            }
        });

        xhr.addEventListener('load', () => {
            if (progressContainer) progressContainer.style.display = 'none';
            if (xhr.status === 200) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    resolve(result);
                } catch (e) {
                    reject(new Error('Gagal parsing response: ' + e.message));
                }
            } else {
                reject(new Error(xhr.responseText || 'Upload failed'));
            }
        });

        xhr.addEventListener('error', () => {
            if (progressContainer) progressContainer.style.display = 'none';
            reject(new Error('Network error'));
        });

        xhr.open('POST', '/upload');
        xhr.send(formData);
    });
}

function escapeHtml(s) { 
    return String(s || '').replace(/[&<>\"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]); 
}

function getImgSrc(path, folder) {
    if (!path) return 'https://via.placeholder.com/200?text=No+Image';
    if (path.startsWith('http')) return path;
    return `/images/${folder}/${path}`;
}

// --- DASHBOARD LOGIC ---
async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        
        document.getElementById('stat-personal-count').textContent = data.counts.personals;
        document.getElementById('stat-cw-count').textContent = data.counts.comission_works;

        const renderList = (items, elementId, folder) => {
            const list = document.getElementById(elementId);
            if (!items || !items.length) { list.innerHTML = '<li>No recent items</li>'; return; }
            list.innerHTML = items.map(item => `
                <li class="recent-item">
                    <img src="${getImgSrc(item.image_path, folder)}" class="recent-thumb" onerror="this.src='https://via.placeholder.com/50'">
                    <div class="recent-info">
                        <span class="recent-title">${escapeHtml(item.name || item.title)}</span>
                        <span class="recent-meta">ID: ${item.id}</span>
                    </div>
                </li>
            `).join('');
        };

        renderList(data.recent.personals, 'recent-personal-list', 'personals');
        renderList(data.recent.comission_works, 'recent-cw-list', 'comission_works');
    } catch (e) {
        console.error("Failed to load stats:", e);
    }
}

// --- PERSONAL WORKS LOGIC ---

async function handlePersonalSubmit() {
    const name = document.getElementById('personalNameInput').value.trim();
    const fileInput = document.getElementById('personalFileInput');
    const id = document.getElementById('personalId').value || null;
    const existingUrl = document.getElementById('personalImageUrl').value;
    const existingPublicId = document.getElementById('personalPublicId').value;
    const status = document.getElementById('personalStatus');
    const progress = document.getElementById('personalProgress');
    const progressBar = document.getElementById('personalProgressBar');

    if (!name) {
        status.innerHTML = '<span class="error-message">⚠️ Judul wajib diisi!</span>';
        return;
    }

    // Edit tanpa ganti gambar
    if (id && !fileInput.files.length) {
        await savePersonalToDB(id, name, existingUrl, existingPublicId);
        return;
    }

    // Harus ada file jika buat baru
    if (!id && !fileInput.files.length) {
        status.innerHTML = '<span class="error-message">⚠️ Pilih gambar dulu!</span>';
        return;
    }

    // Upload gambar baru
    try {
        status.innerHTML = '<span>🔄 Uploading...</span>';
        const uploadRes = await uploadFile(fileInput.files[0], progressBar, progress);
        await savePersonalToDB(id, name, uploadRes.imageUrl, uploadRes.public_id);
    } catch (err) {
        console.error(err);
        status.innerHTML = `<span class="error-message">❌ Error: ${err.message}</span>`;
    }
}

async function savePersonalToDB(id, name, imageUrl, publicId) {
    const status = document.getElementById('personalStatus');
    try {
        const url = id ? `/api/personals/${id}` : '/api/personals';
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                image_path: imageUrl,
                public_id: publicId,
                description: 'Uploading.....'
            })
        });

        if (!res.ok) throw new Error('Gagal menyimpan ke database');
        
        status.innerHTML = '<span class="success-message">✅ Berhasil disimpan!</span>';
        cancelPersonal(); // Reset form
        loadPersonals();
    } catch (err) {
        console.error(err);
        status.innerHTML = `<span class="error-message">❌ DB Error: ${err.message}</span>`;
    }
}

async function loadPersonals() {
    try {
        const res = await fetch('/api/personals');
        const data = await res.json();
        const gallery = document.getElementById('personalGallery');
        
        if (!data.length) { gallery.innerHTML = '<p>Belum ada data.</p>'; return; }

        gallery.innerHTML = data.map(item => `
            <div class="gallery-item">
                <input type="checkbox" class="bulk-check bulk-personal" value="${item.id}">
                <div class="gallery-img-container">
                    <img src="${getImgSrc(item.image_path, 'personals')}" class="gallery-img" onerror="this.src='https://via.placeholder.com/200'">
                </div>
                <h3 class="gallery-title">${escapeHtml(item.name)}</h3>
                <div class="action-buttons">
                    <button onclick="editPersonal(${item.id})">Edit</button>
                    <button class="delete" onclick="deletePersonal(${item.id})">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

async function editPersonal(id) {
    try {
        const res = await fetch(`/api/personals/${id}`);
        const data = await res.json();
        
        document.getElementById('personalId').value = data.id;
        document.getElementById('personalNameInput').value = data.name;
        document.getElementById('personalImageUrl').value = data.image_path;
        document.getElementById('personalPublicId').value = data.public_id || '';
        
        const preview = document.getElementById('personalPreview');
        preview.src = getImgSrc(data.image_path, 'personals');
        preview.style.display = 'block';

        document.getElementById('personalUploadBtn').textContent = 'Update';
        document.getElementById('personalCancelBtn').style.display = 'inline-block';
        document.getElementById('personalStatus').innerHTML = '<span>🔄 Mode Edit</span>';
        document.querySelector('.main-content').scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { alert('Gagal memuat data'); }
}

function cancelPersonal() {
    document.getElementById('personalId').value = '';
    document.getElementById('personalNameInput').value = '';
    document.getElementById('personalImageUrl').value = '';
    document.getElementById('personalPublicId').value = '';
    document.getElementById('personalFileInput').value = '';
    document.getElementById('personalPreview').style.display = 'none';
    document.getElementById('personalUploadBtn').textContent = 'Upload';
    document.getElementById('personalCancelBtn').style.display = 'none';
    document.getElementById('personalStatus').innerHTML = '';
}

async function deletePersonal(id) {
    if (!confirm('Hapus item ini?')) return;
    try {
        await fetch(`/api/personals/${id}`, { method: 'DELETE' });
        loadPersonals();
    } catch (err) { alert('Gagal menghapus'); }
}

// --- COMISSION WORKS LOGIC ---

async function handleComissionSubmit() {
    const title = document.getElementById('cwTitleInput').value.trim();
    const fileInput = document.getElementById('cwFileInput');
    const id = document.getElementById('cwId').value || null;
    const existingUrl = document.getElementById('cwImageUrl').value;
    const existingPublicId = document.getElementById('cwPublicId').value;
    const status = document.getElementById('cwStatus');
    const progress = document.getElementById('cwProgress');
    const progressBar = document.getElementById('cwProgressBar');

    if (!title) {
        status.innerHTML = '<span class="error-message">⚠️ Judul wajib diisi!</span>';
        return;
    }

    if (id && !fileInput.files.length) {
        await saveComissionToDB(id, title, existingUrl, existingPublicId);
        return;
    }

    if (!id && !fileInput.files.length) {
        status.innerHTML = '<span class="error-message">⚠️ Pilih gambar dulu!</span>';
        return;
    }

    try {
        status.innerHTML = '<span>🔄 Uploading...</span>';
        const uploadRes = await uploadFile(fileInput.files[0], progressBar, progress);
        await saveComissionToDB(id, title, uploadRes.imageUrl, uploadRes.public_id);
    } catch (err) {
        console.error(err);
        status.innerHTML = `<span class="error-message">❌ Error: ${err.message}</span>`;
    }
}

async function saveComissionToDB(id, title, imageUrl, publicId) {
    const status = document.getElementById('cwStatus');
    try {
        const url = id ? `/api/comission_works/${id}` : '/api/comission_works';
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                image_path: imageUrl,
                public_id: publicId,
                description: null
            })
        });

        if (!res.ok) throw new Error('Gagal menyimpan ke database');
        
        status.innerHTML = '<span class="success-message">✅ Berhasil disimpan!</span>';
        cancelComission();
        loadComissions();
    } catch (err) {
        console.error(err);
        status.innerHTML = `<span class="error-message">❌ DB Error: ${err.message}</span>`;
    }
}

async function loadComissions() {
    try {
        const res = await fetch('/api/comission_works');
        const data = await res.json();
        const gallery = document.getElementById('cwGallery');
        
        if (!data.length) { gallery.innerHTML = '<p>Belum ada data.</p>'; return; }

        gallery.innerHTML = data.map(item => `
            <div class="gallery-item">
                <input type="checkbox" class="bulk-check bulk-commission" value="${item.id}">
                <div class="gallery-img-container">
                    <img src="${getImgSrc(item.image_path, 'comission_works')}" class="gallery-img" onerror="this.src='https://via.placeholder.com/200'">
                </div>
                <h3 class="gallery-title">${escapeHtml(item.title)}</h3>
                <div class="action-buttons">
                    <button onclick="editComission(${item.id})">Edit</button>
                    <button class="delete" onclick="deleteComission(${item.id})">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

async function editComission(id) {
    try {
        const res = await fetch(`/api/comission_works/${id}`);
        const data = await res.json();
        
        document.getElementById('cwId').value = data.id;
        document.getElementById('cwTitleInput').value = data.title;
        document.getElementById('cwImageUrl').value = data.image_path;
        document.getElementById('cwPublicId').value = data.public_id || '';
        
        const preview = document.getElementById('cwPreview');
        preview.src = getImgSrc(data.image_path, 'comission_works');
        preview.style.display = 'block';

        document.getElementById('cwUploadBtn').textContent = 'Update';
        document.getElementById('cwCancelBtn').style.display = 'inline-block';
        document.getElementById('cwStatus').innerHTML = '<span>🔄 Mode Edit</span>';
        
        // Scroll ke form comission
        document.querySelector('.main-content').scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { alert('Gagal memuat data'); }
}

function cancelComission() {
    document.getElementById('cwId').value = '';
    document.getElementById('cwTitleInput').value = '';
    document.getElementById('cwImageUrl').value = '';
    document.getElementById('cwPublicId').value = '';
    document.getElementById('cwFileInput').value = '';
    document.getElementById('cwPreview').style.display = 'none';
    document.getElementById('cwUploadBtn').textContent = 'Upload';
    document.getElementById('cwCancelBtn').style.display = 'none';
    document.getElementById('cwStatus').innerHTML = '';
}

async function deleteComission(id) {
    if (!confirm('Hapus item ini?')) return;
    try {
        await fetch(`/api/comission_works/${id}`, { method: 'DELETE' });
        loadComissions();
    } catch (err) { alert('Gagal menghapus'); }
}

// --- BULK DELETE LOGIC ---
async function handleBulkDelete(category) {
    // Tentukan class checkbox berdasarkan kategori
    const className = category === 'personal' ? '.bulk-personal' : '.bulk-commission';
    const checkboxes = document.querySelectorAll(`${className}:checked`);
    
    if (checkboxes.length === 0) {
        alert('Pilih minimal satu item untuk dihapus.');
        return;
    }

    if (!confirm(`Yakin ingin menghapus ${checkboxes.length} item yang dipilih?`)) return;

    const ids = Array.from(checkboxes).map(cb => cb.value);

    try {
        const res = await fetch('/api/admin/bulk-delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, category })
        });
        const result = await res.json();
        if (result.success) {
            // Reload data sesuai kategori
            category === 'personal' ? loadPersonals() : loadComissions();
            loadStats(); // Update dashboard stats juga
        } else {
            alert('Gagal menghapus: ' + (result.error || 'Unknown error'));
        }
    } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan saat menghubungi server.');
    }
}

// --- INIT ---
window.addEventListener('load', () => {
    loadStats();
    loadWmConfig(); // Load watermark setting saat halaman dibuka
    loadPersonals();
    loadComissions();

    // Validasi Ukuran File (Max 10MB)
    ['personalFileInput', 'cwFileInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', function() {
                if (this.files[0] && this.files[0].size > 50 * 1024 * 1024) {
                    alert('Ukuran file maksimal 50MB untuk akun gratis');
                    this.value = '';
                }
            });
        }
    });
});

async function loadWmConfig() {
    try {
        const res = await fetch('/api/wm-config');
        const data = await res.json();
        if(data.wm_text) document.getElementById('wmTextInput').value = data.wm_text;
    } catch(e) { console.error(e); }
}

// --- SETTINGS LOGIC ---
async function handleChangePassword() {
    const oldPass = document.getElementById('oldPassInput').value;
    const newPass = document.getElementById('newPassInput').value;
    const status = document.getElementById('settingsStatus');

    if (!oldPass || !newPass) {
        status.innerHTML = '<span class="error-message">⚠️ Mohon isi kedua kolom password.</span>';
        return;
    }

    status.innerHTML = '<span>🔄 Memproses...</span>';

    try {
        const res = await fetch('/api/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
        });
        const data = await res.json();

        if (data.success) {
            status.innerHTML = '<span class="success-message">✅ Password berhasil diubah!</span>';
            document.getElementById('oldPassInput').value = '';
            document.getElementById('newPassInput').value = '';
        } else {
            status.innerHTML = `<span class="error-message">❌ ${data.message}</span>`;
        }
    } catch (err) {
        status.innerHTML = '<span class="error-message">❌ Gagal menghubungi server.</span>';
    }
}

async function handleChangePin() {
    const oldPin = document.getElementById('oldPinInput').value;
    const newPin = document.getElementById('newPinInput').value;
    const status = document.getElementById('pinStatus');

    if (!oldPin || !newPin) {
        status.innerHTML = '<span class="error-message">⚠️ Mohon isi kedua kolom PIN.</span>';
        return;
    }

    status.innerHTML = '<span>🔄 Memproses...</span>';

    try {
        const res = await fetch('/api/change-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPin: oldPin, newPin: newPin })
        });
        const data = await res.json();

        if (data.success) {
            status.innerHTML = '<span class="success-message">✅ PIN berhasil diubah!</span>';
            document.getElementById('oldPinInput').value = '';
            document.getElementById('newPinInput').value = '';
        } else {
            status.innerHTML = `<span class="error-message">❌ ${data.message}</span>`;
        }
    } catch (err) {
        status.innerHTML = '<span class="error-message">❌ Gagal menghubungi server.</span>';
    }
}

async function handleUpdateWm() {
    const text = document.getElementById('wmTextInput').value;
    const status = document.getElementById('wmStatus');
    
    status.innerHTML = '<span>🔄 Saving...</span>';
    try {
        const res = await fetch('/api/admin/update-wm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wm_text: text })
        });
        const data = await res.json();
        if (data.success) {
            status.innerHTML = '<span class="success-message">✅ Watermark updated!</span>';
        } else {
            status.innerHTML = `<span class="error-message">❌ ${data.message}</span>`;
        }
    } catch (e) {
        console.error(e);
        status.innerHTML = '<span class="error-message">❌ Error saving watermark.</span>';
    }
}

// --- LIVE PREVIEW LOGIC ---
function openLivePreview() {
    const modal = document.getElementById('live-preview-modal');
    const iframe = document.getElementById('live-preview-frame');
    iframe.src = '/'; // Refresh content
    modal.style.display = 'flex';
}

function closeLivePreview() {
    document.getElementById('live-preview-modal').style.display = 'none';
    document.getElementById('live-preview-frame').src = ''; // Stop loading
}