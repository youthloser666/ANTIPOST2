// liquid-menu.js — ANTIPOST Liquid Menu
// Depends on: admin-logic.js (switchTab, openLivePreview)

(function () {
    const trigger = document.getElementById('lmenuTrigger');
    const overlay = document.getElementById('lmenuOverlay');
    const label   = document.getElementById('lmenuLabel');
    const body    = document.body;

    const TAB_LABELS = {
        dashboard: 'Dashboard',
        personal:  'Personal',
        cw:        'Commission',
        settings:  'Settings'
    };

    let isOpen = false;

    function open() {
        if (isOpen) return;
        isOpen = true;
        body.classList.add('lmenu-open');
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        body.classList.remove('lmenu-open');
        body.classList.add('lmenu-closing');
        setTimeout(() => body.classList.remove('lmenu-closing'), 850);
    }

    function goTab(tabName) {
        // Update active state in liquid nav
        document.querySelectorAll('.lmenu-item').forEach(b => b.classList.remove('is-active'));
        const btn = document.getElementById('lbtn-' + tabName);
        if (btn) btn.classList.add('is-active');

        // Update trigger label
        if (label && TAB_LABELS[tabName]) label.textContent = TAB_LABELS[tabName];

        // Close first, then switch tab
        close();
        setTimeout(() => switchTab(tabName), 80);
    }

    // Bind nav items
    document.querySelectorAll('.lmenu-item[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => goTab(btn.dataset.tab));
    });

    // Preview button
    const previewBtn = document.querySelector('.lmenu-item[data-action="preview"]');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            close();
            setTimeout(openLivePreview, 500);
        });
    }

    // Trigger + overlay + ESC
    trigger.addEventListener('click', () => isOpen ? close() : open());
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();
