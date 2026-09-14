/**
 * Click Tracker — мониторинг кликов и просмотров сайта.
 * Подключение: <script src="/click_tracker.js"></script>
 */
(function () {
    'use strict';

    // ============================================================
    //   КОНФИГУРАЦИЯ
    // ============================================================
    const API_URL = 'https://clickdk.onrender.com/';

    // ============================================================
    //   ОТПРАВКА
    // ============================================================
    function send(endpoint, payload) {
        try {
            fetch(API_URL + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(function () {});
        } catch (e) {
            // тихо игнорируем
        }
    }

    function sendBeacon(endpoint, payload) {
        try {
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                navigator.sendBeacon(API_URL + endpoint, blob);
            } else {
                send(endpoint, payload);
            }
        } catch (e) {}
    }

    // ============================================================
    //   1. ПРОСМОТР СТРАНИЦЫ
    // ============================================================
    function trackPageview() {
        send('/api/track/pageview', {
            page: window.location.pathname,
            title: document.title,
            referrer: document.referrer,
            screen: window.screen.width + 'x' + window.screen.height,
            language: navigator.language
        });
    }

    // ============================================================
    //   2. КЛИКИ
    // ============================================================
    function describeElement(el) {
        if (!el || !el.tagName) return 'unknown';
        let desc = el.tagName.toLowerCase();
        if (el.id) desc += '#' + el.id;
        if (el.className && typeof el.className === 'string') {
            const first = el.className.trim().split(/\s+/)[0];
            if (first) desc += '.' + first;
        }
        return desc;
    }

    function trackClick(e) {
        const target = e.target;
        if (!target) return;

        send('/api/track/click', {
            page: window.location.pathname,
            element: describeElement(target),
            text: (target.innerText || target.value || '').slice(0, 60),
            x: e.pageX || 0,
            y: e.pageY || 0,
            referrer: document.referrer
        });
    }

    // ============================================================
    //   3. СКРОЛЛ
    // ============================================================
    let scrollTimer = null;
    let maxScrollDepth = 0;

    function trackScroll() {
        const doc = document.documentElement;
        const scrollTop = window.scrollY || doc.scrollTop;
        const scrollHeight = doc.scrollHeight - window.innerHeight;
        const depth = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;

        if (depth > maxScrollDepth) {
            maxScrollDepth = depth;

            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(function () {
                send('/api/track/click', {
                    page: window.location.pathname,
                    element: 'scroll',
                    text: 'depth:' + maxScrollDepth + '%',
                    x: 0,
                    y: scrollTop
                });
            }, 3000);
        }
    }

    // ============================================================
    //   4. УХОД СО СТРАНИЦЫ
    // ============================================================
    function trackExit() {
        const timeOnPage = Math.round((Date.now() - startTime) / 1000);
        sendBeacon('/api/track/click', {
            page: window.location.pathname,
            element: 'exit',
            text: 'time:' + timeOnPage + 's',
            x: 0,
            y: 0
        });
    }

    // ============================================================
    //   5. ВВОД В ПОЛЯ (только факт, без значений)
    // ============================================================
    function trackInput(e) {
        const el = e.target;
        if (!el) return;
        if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return;

        // чтобы не спамить при каждом нажатии
        const now = Date.now();
        if (el._lastTrack && now - el._lastTrack < 2000) return;
        el._lastTrack = now;

        send('/api/track/click', {
            page: window.location.pathname,
            element: 'input:' + (el.id || el.name || el.tagName.toLowerCase()),
            text: 'typing',
            x: 0,
            y: 0
        });
    }

    // ============================================================
    //   6. ЗАПУСК
    // ============================================================
    const startTime = Date.now();

    function init() {
        // Просмотр страницы
        trackPageview();

        // Клики (capture: true — ловим даже те, что остановлены другими обработчиками)
        document.addEventListener('click', trackClick, true);

        // Скролл
        window.addEventListener('scroll', trackScroll, { passive: true });

        // Ввод
        document.addEventListener('input', trackInput, true);

        // Уход
        window.addEventListener('beforeunload', trackExit);
        window.addEventListener('pagehide', trackExit);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
