/* ============================================
   GSAP ANIMATIONS + FULL INIT
   ============================================ */
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

function initGalleryReveal() {
    ['#image-gallery', '#commission-gallery'].forEach(sel => {
        const imgs = document.querySelectorAll(sel + ' img');
        if (!imgs.length) return;
        gsap.to(imgs, {
            opacity: 1, clipPath: 'inset(0% 0 0 0)',
            duration: 0.9, ease: 'power3.out',
            stagger: { amount: 1.0, from: 'start' },
            scrollTrigger: { trigger: sel, start: 'top 88%', toggleActions: 'play none none reset' }
        });
    });
}

function initInfoReveal() {
    gsap.to('.info-header', {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.18,
        scrollTrigger: { trigger: '.info-container', start: 'top 85%', toggleActions: 'play none none reset' }
    });
    gsap.to('.info-list', {
        opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.14,
        scrollTrigger: { trigger: '.info-container', start: 'top 78%', toggleActions: 'play none none reset' }
    });
}

function initContactReveal() {
    const ct = { trigger: '.footer-contact', toggleActions: 'play none none reset' };
    gsap.to('.footer-contact-label', { opacity: 1, y: 0, duration: .7, ease: 'power2.out', scrollTrigger: { ...ct, start: 'top 85%' } });
    gsap.to('.footer-contact-heading', { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: .15, scrollTrigger: { ...ct, start: 'top 85%' } });
    gsap.to('.footer-form input, .footer-form textarea', { opacity: 1, y: 0, duration: .7, ease: 'power2.out', stagger: .12, delay: .3, scrollTrigger: { ...ct, start: 'top 80%' } });
    gsap.to('.footer-form button', { opacity: 1, y: 0, duration: .6, ease: 'power2.out', delay: .55, scrollTrigger: { ...ct, start: 'top 80%' } });
    gsap.to('.footer-contact-note', { opacity: 1, duration: .6, ease: 'power2.out', delay: .7, scrollTrigger: { ...ct, start: 'top 80%' } });
}

window.addEventListener('load', () => {
    const _origOpenView = window.openView;
    const _origCloseModal = window.closeModal;

    window.openView = function (src, title) {
        _origOpenView(src, title);
        const modal = document.getElementById('image-modal'), modalImg = document.getElementById('modal-img'),
            caption = document.getElementById('modal-caption'), closeBtn = document.getElementById('close-modal');
        gsap.set(modal, { opacity: 0 }); gsap.set(modalImg, { opacity: 0, scale: .94, y: 12 });
        gsap.set(caption, { opacity: 0 }); gsap.set(closeBtn, { opacity: 0 });
        gsap.to(modal, { opacity: 1, duration: .28, ease: 'power2.out' });
        gsap.to(modalImg, { opacity: 1, scale: 1, y: 0, duration: .5, ease: 'power3.out', delay: .06 });
        gsap.to(caption, { opacity: 1, duration: .4, ease: 'power2.out', delay: .2 });
        gsap.to(closeBtn, { opacity: 1, duration: .3, delay: .22 });
    };

    window.closeModal = function () {
        const modal = document.getElementById('image-modal'), modalImg = document.getElementById('modal-img'),
            caption = document.getElementById('modal-caption'), closeBtn = document.getElementById('close-modal');
        gsap.to(modal, {
            opacity: 0, duration: .22, ease: 'power2.in', onComplete() {
                _origCloseModal();
                gsap.set(modal, { opacity: 1 }); gsap.set(modalImg, { opacity: 0, scale: .94, y: 12 });
                gsap.set(caption, { opacity: 0 }); gsap.set(closeBtn, { opacity: 0 });
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
    if (isZoomed && modalCont) modalCont.style.cursor = 'move';
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
    modal.onclick = (e) => { if (e.target === modal || e.target === modalCont) closeModal(); };
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


// ── SINGLE DOMContentLoaded ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // SPLASH
    const splash = document.getElementById('splash');
    const hideSplash = () => { if (splash) splash.classList.add('hidden'); };
    setTimeout(hideSplash, 1200);
    setTimeout(hideSplash, 4000); // fallback

    // HEADER + HERO GSAP
    gsap.to('header', { translateY: 0, duration: .9, ease: 'power3.out', delay: .1 });
    gsap.fromTo('.biglogo-wrapper',
        { opacity: 0, clipPath: 'inset(6% 0 0 0)' },
        { opacity: 1, clipPath: 'inset(0% 0 0 0)', duration: 1.3, ease: 'power3.out', delay: .45 }
    );
    gsap.fromTo('.nav-link',
        { opacity: 0, y: -8 },
        { opacity: 1, y: 0, stagger: .08, duration: .5, ease: 'power2.out', delay: .7 }
    );

    // LOAD DATA
    fetchWmConfig();
    Promise.all([
        loadData('/api/personals', 'image-gallery', 'personals'),
        loadData('/api/comission_works', 'commission-gallery', 'comission_works')
    ]).then(() => {
        initGalleryReveal();
        initInfoReveal();
        initContactReveal();
    });

    // CONTACT FORM
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', e => {
            e.preventDefault();
            const subject = contactForm.querySelector('[name="subject"]').value.trim();
            const message = contactForm.querySelector('[name="message"]').value.trim();
            if (!subject || !message) return;
            window.open(`mailto:galleryantipost@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`, '_blank');
            contactForm.reset();
        });
    }
});

// ── ACTIVE NAV + STICKY INVERT ──────────────────────────────────────
const headerBlock = document.querySelector('.section-divider-block');
const _sections = [
    { id: 'artwork-section', href: '#artwork-section' },
    { id: 'commission-gallery-section', href: '#commission-gallery-section' },
    { id: 'info-section', href: '#info-section' },
];

let _navScrolling = false;
let _navScrollTimer = null;

function updateActiveNav() {
    if (_navScrolling) return;
    const offset = window.innerWidth <= 768 ? 85 : 110;
    const scrollY = window.scrollY + offset + 40;
    if (headerBlock) {
        headerBlock.classList.toggle('is-pinned', headerBlock.getBoundingClientRect().top <= offset);
    }
    let current = null;
    _sections.forEach(s => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top + window.scrollY <= scrollY) current = s.href;
    });
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    if (current) {
        const a = document.querySelector('a[href="' + current + '"]');
        if (a) a.classList.add('active');
    }
}

window.addEventListener('scroll', updateActiveNav, { passive: true });
updateActiveNav();

// ── SMOOTH SCROLL NAV ───────────────────────────────────────────────
document.querySelectorAll('.nav-link').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        _navScrolling = true;
        clearTimeout(_navScrollTimer);
        _navScrollTimer = setTimeout(() => { _navScrolling = false; }, 1000);

        // Click animation on the text inside nav-link
        const navText = this.querySelector('.nav-item');
        if (navText) {
            gsap.fromTo(navText,
                { scale: 0.95, y: 2 },
                { scale: 1, y: 0, duration: 0.4, ease: "back.out(2)" }
            );
        }

        const targetEl = document.querySelector(this.getAttribute('href'));
        if (!targetEl) return;

        const ho = window.innerWidth <= 768 ? 85 : 110;

        // Gunakan GSAP ScrollToPlugin untuk garansi scroll jalan dari posisi mana saja
        gsap.to(window, {
            duration: 1.2,
            scrollTo: { y: targetEl, offsetY: ho },
            ease: "power3.inOut"
        });
    });
});

document.getElementById('back-to-top')?.addEventListener('click', e => {
    e.preventDefault();
    gsap.to(window, { duration: 1, scrollTo: 0, ease: "power3.inOut" });
});
