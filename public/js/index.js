/* ============================================
   GSAP ANIMATIONS — tambahan di atas kode original
   ============================================ */
gsap.registerPlugin(ScrollTrigger);

window.addEventListener('DOMContentLoaded', () => {
    gsap.to('header', {
        translateY: 0, duration: 0.9, ease: 'power3.out', delay: 0.1
    });
    gsap.fromTo('.biglogo-wrapper',
        { opacity: 0, clipPath: 'inset(6% 0 0 0)' },
        { opacity: 1, clipPath: 'inset(0% 0 0 0)', duration: 1.3, ease: 'power3.out', delay: 0.45 }
    );
    gsap.fromTo('.nav-link',
        { opacity: 0, y: -8 },
        { opacity: 1, y: 0, stagger: 0.08, duration: 0.5, ease: 'power2.out', delay: 0.7 }
    );
});

function initGalleryReveal() {
    ['#image-gallery', '#commission-gallery'].forEach(sel => {
        const imgs = document.querySelectorAll(sel + ' img');
        if (!imgs.length) return;
        gsap.to(imgs, {
            opacity: 1,
            clipPath: 'inset(0% 0 0 0)',
            duration: 0.9,
            ease: 'power3.out',
            stagger: { amount: 1.0, from: 'start' },
            scrollTrigger: {
                trigger: sel,
                start: 'top 88%',
                toggleActions: 'play none none reset'
            }
        });
    });
}

function initInfoReveal() {
    gsap.to('.info-header', {
        opacity: 1, y: 0,
        duration: 0.9, ease: 'power3.out', stagger: 0.18,
        scrollTrigger: {
            trigger: '.info-container',
            start: 'top 85%',
            toggleActions: 'play none none reset'
        }
    });
    gsap.to('.info-list', {
        opacity: 1, y: 0,
        duration: 0.7, ease: 'power2.out', stagger: 0.14,
        scrollTrigger: {
            trigger: '.info-container',
            start: 'top 78%',
            toggleActions: 'play none none reset'
        }
    });
}

window.addEventListener('load', () => {
    const _origOpenView   = window.openView;
    const _origCloseModal = window.closeModal;

    window.openView = function(src, title) {
        _origOpenView(src, title);
        const modal    = document.getElementById('image-modal');
        const modalImg = document.getElementById('modal-img');
        const caption  = document.getElementById('modal-caption');
        const closeBtn = document.getElementById('close-modal');
        gsap.set(modal,    { opacity: 0 });
        gsap.set(modalImg, { opacity: 0, scale: 0.94, y: 12 });
        gsap.set(caption,  { opacity: 0 });
        gsap.set(closeBtn, { opacity: 0 });
        gsap.to(modal,    { opacity: 1, duration: 0.28, ease: 'power2.out' });
        gsap.to(modalImg, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: 0.06 });
        gsap.to(caption,  { opacity: 1, duration: 0.4, ease: 'power2.out', delay: 0.2 });
        gsap.to(closeBtn, { opacity: 1, duration: 0.3, delay: 0.22 });
    };

    window.closeModal = function() {
        const modal    = document.getElementById('image-modal');
        const modalImg = document.getElementById('modal-img');
        const caption  = document.getElementById('modal-caption');
        const closeBtn = document.getElementById('close-modal');
        gsap.to(modal, {
            opacity: 0, duration: 0.22, ease: 'power2.in',
            onComplete() {
                _origCloseModal();
                gsap.set(modal,    { opacity: 1 });
                gsap.set(modalImg, { opacity: 0, scale: 0.94, y: 12 });
                gsap.set(caption,  { opacity: 0 });
                gsap.set(closeBtn, { opacity: 0 });
            }
        });
    };
});

/* ============================================
   KODE ORIGINAL — TIDAK DIUBAH
   ============================================ */

// PARALLAX LOGIC
function updateParallax() {
    const scrollY = window.pageYOffset;
    const bigLogo = document.getElementById('parallax-logo');
    const bigLogoTop = document.getElementById('parallax-logo-top');
    const insertLogo = document.getElementById('parallax-insert');
    const movement = scrollY * 0.4;
    const rotation = scrollY * 0.8;

    if (bigLogo) bigLogo.style.transform = `translateY(${movement}px)`;
    if (bigLogoTop) bigLogoTop.style.transform = `translateY(${movement}px)`;
    if (insertLogo) {
        insertLogo.style.transform = `translate(-50%, calc(-50% + ${movement}px)) rotate(${rotation}deg)`;
    }
    requestAnimationFrame(updateParallax);
}
requestAnimationFrame(updateParallax);

// --- CONFIG & UTILS ---
let globalWmText = '';

async function fetchWmConfig() {
    try {
        const res = await fetch('/api/wm-config');
        const data = await res.json();
        globalWmText = data.wm_text;
    } catch (e) { console.error("WM Config Error", e); }
}

function getCloudinaryUrl(url, mode) {
    if (!url || !url.includes('cloudinary.com')) return url;
    
    let params = 'f_auto,q_auto';
    
    if (mode === 'thumb') {
        params = 'f_auto,q_auto,w_600,h_750,c_fill';
    } else if (mode === 'full') {
        if (globalWmText) {
            params = `f_auto,q_auto,l_text:Arial_20_bold:${encodeURIComponent(globalWmText)},co_white,o_30,g_south_east,x_10,y_10`;
        }
    }
    
    return url.replace('/upload/', `/upload/${params}/`);
}

// --- MODAL FEATURES LOGIC (UPDATED FOR FREE PANNING) ---
const modal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const modalCont = document.getElementById('modal-container');

let isZoomed = false;
let isDragging = false;
let startX = 0, startY = 0;
let translateX = 0, translateY = 0;
const ZOOM_SCALE = 2.5;

// Fungsi ini dipanggil dari inline onclick di HTML yang digenerate loadData
// Karena file ini di-load di global scope, fungsi ini tetap bisa diakses.
function openView(src, title) {
    if (!modal || !modalImg) return;
    modal.style.display = "flex";
    modalImg.src = getCloudinaryUrl(src, 'full');
    const caption = document.getElementById('modal-caption');
    if (caption) caption.innerHTML = title;
    document.body.style.overflow = "hidden";
    resetZoom();
}

function resetZoom() {
    if (!modalImg || !modalCont) return;
    isZoomed = false;
    isDragging = false;
    translateX = 0; 
    translateY = 0;
    modalImg.classList.remove('zoomed');
    modalImg.style.transform = `translate(0px, 0px) scale(1)`;
    modalCont.style.cursor = 'zoom-in';
}

// Logic Zoom
if (modalImg) {
    modalImg.onclick = (e) => {
        e.stopPropagation();
        if (!isZoomed) {
            isZoomed = true;
            modalImg.classList.add('zoomed');
            modalImg.style.transform = `scale(${ZOOM_SCALE})`;
            modalCont.style.cursor = 'move';
        } else {
            resetZoom();
        }
    };
}

// --- MULTI-DEVICE DRAG/PAN LOGIC ---
const startDrag = (e) => {
    if (!isZoomed) return;
    isDragging = true;
    if (modalCont) modalCont.style.cursor = 'grabbing';
    // Deteksi koordinat Mouse atau Touch (HP)
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clientX - translateX;
    startY = clientY - translateY;
};

const moveDrag = (e) => {
    if (!isDragging || !isZoomed) return;
    if (e.cancelable) e.preventDefault(); // Cegah scroll layar di HP

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    translateX = clientX - startX;
    translateY = clientY - startY;
    
    // Apply transformasi (translate dibagi scale agar movement terasa natural)
    if (modalImg) {
        modalImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${ZOOM_SCALE})`;
    }
};

const stopDrag = () => { 
    isDragging = false; 
    if(isZoomed && modalCont) modalCont.style.cursor = 'move';
};

// Listener untuk Mouse (PC) & Touch (Mobile)
if (modalCont) {
    modalCont.addEventListener('mousedown', startDrag);
    modalCont.addEventListener('touchstart', startDrag, { passive: false });
    modalCont.addEventListener('touchmove', moveDrag, { passive: false });
    modalCont.addEventListener('touchend', stopDrag);
}

window.addEventListener('mousemove', moveDrag);
window.addEventListener('mouseup', stopDrag);

// Close functions
function closeModal() { 
    if (modal) modal.style.display = "none"; 
    document.body.style.overflow = "auto"; 
    resetZoom();
}

const closeModalBtn = document.getElementById('close-modal');
if (closeModalBtn) {
    closeModalBtn.onclick = closeModal;
}

if (modal) {
    modal.onclick = (e) => { if(e.target === modal || e.target === modalCont) closeModal(); };
}

// DATA LOADING
async function loadData(api, gridId, folder) {
    try {
        const res = await fetch(api);
        const items = await res.json();
        const grid = document.getElementById(gridId);
        if (items && items.length > 0 && grid) {
            grid.innerHTML = items.map(item => {
                const rawPath = item.image_path.startsWith('http') ? item.image_path : `/images/${folder}/${item.image_path}`;
                // openView dipanggil di sini
                return `<img src="${getCloudinaryUrl(rawPath, 'thumb')}" alt="${item.name || item.title || 'Untitled'}" onclick="openView('${rawPath}', this.alt)">`;
            }).join('');
        }
    } catch (err) { console.error(err); }
}

window.addEventListener('DOMContentLoaded', () => {
    fetchWmConfig(); // Ambil config watermark
    Promise.all([
        loadData('/api/personals', 'image-gallery', 'personals'),
        loadData('/api/comission_works', 'commission-gallery', 'comission_works')
    ]).then(() => {
        initGalleryReveal();
        initInfoReveal();
    });
});

const headerBlock = document.querySelector('.section-divider-block');

// Kita pantau posisi elemen terhadap top header (85px di mobile, 110px di desktop)
window.addEventListener('scroll', () => {
    if (!headerBlock) return;
    const stickyPos = headerBlock.getBoundingClientRect().top;
    const offset = window.innerWidth <= 768 ? 85 : 110;

    // Jika posisi elemen <= batas sticky, tambahkan class is-pinned
    if (stickyPos <= offset) {
        headerBlock.classList.add('is-pinned');
    } else {
        headerBlock.classList.remove('is-pinned');
    }
});

document.querySelectorAll('.nav-link').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault(); // Mencegah lompatan instan

        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            // Tentukan offset berdasarkan tinggi header (110px desktop, 85px mobile)
            const headerOffset = window.innerWidth <= 768 ? 85 : 110;
            const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY; 
            const offsetPosition = elementPosition - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

const logoToTop = document.getElementById('back-to-top');
if (logoToTop) {
    logoToTop.addEventListener('click', function(e) {
        e.preventDefault(); // Mencegah munculnya '#' di URL
        
        window.scrollTo({
            top: 0,
            behavior: 'smooth' // Scroll meluncur halus ke atas
        });
    });
}
