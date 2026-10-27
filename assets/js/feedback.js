/* The form and island drone share one request path. No credentials belong here. */
window.GGHF_FEEDBACK = (function () {
    const form = document.getElementById('fb-form');
    const status = document.getElementById('fb-status');
    const submit = document.getElementById('fb-submit');
    const card = document.getElementById('fb-card');
    const fieldset = document.getElementById('fb-fields');
    const sessionStart = Date.now();
    const MAX_PER_SESSION = 3;
    const REQUEST_TIMEOUT_MS = 15000;
    const PREPARING = '온라인 제보 접수 준비 중입니다. 이메일로 제보를 보내주세요.';
    let sent = 0;
    let inFlight = false;
    let formSubmitting = false;

    function configuration() {
        return window.GGHF_CONTENT?.feedback || {};
    }

    function isEnabled() {
        const config = configuration();
        return config.enabled === true && typeof config.endpoint === 'string' && config.endpoint.startsWith('https://');
    }

    function setStatus(message, tone) {
        if (!status) return;
        status.textContent = message;
        if (tone) status.dataset.tone = tone;
        else delete status.dataset.tone;
    }

    function syncControls() {
        const disabled = !isEnabled() || inFlight;
        if (fieldset) fieldset.disabled = disabled;
        if (submit) submit.disabled = disabled;
        if (form) form.setAttribute('aria-busy', String(inFlight));
    }

    function currentStage() {
        try {
            const stage = window.GGHF_GAME?.getState()?.stage;
            if (Number.isInteger(stage) && stage > 0) return 'stage' + stage;
        } catch (_) {
            // Reporting remains available when the optional game is unavailable.
        }
        return 'hub';
    }

    /** Failed reports never consume the local session limit. */
    async function send(fields = {}) {
        if (!isEnabled()) {
            syncControls();
            setStatus(PREPARING, 'busy');
            return { ok: false, reason: 'not_configured' };
        }
        if (inFlight) return { ok: false, reason: 'busy' };
        if (sent >= MAX_PER_SESSION) return { ok: false, reason: 'rate_limited' };

        const payload = {
            website: String(fields.website || ''),
            summary: String(fields.summary || '').slice(0, 300),
            detail: String(fields.detail || '').slice(0, 1500),
            contact: String(fields.contact || '').slice(0, 120),
            stage: fields.stage || currentStage(),
            playtime: Math.round((Date.now() - sessionStart) / 1000) + 's',
            viewport: window.innerWidth + 'x' + window.innerHeight,
        };
        if ((payload.summary + payload.detail).trim().length < 5) {
            return { ok: false, reason: 'too_short' };
        }

        const controller = new AbortController();
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, REQUEST_TIMEOUT_MS);
        inFlight = true;
        syncControls();
        try {
            const response = await fetch(configuration().endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            if (response.ok) {
                sent += 1;
                return { ok: true };
            }
            if (response.status === 503) return { ok: false, reason: 'not_configured' };
            if (response.status === 429) return { ok: false, reason: 'rate_limited' };
            return { ok: false, reason: 'server' };
        } catch (_) {
            return { ok: false, reason: timedOut ? 'timeout' : 'network' };
        } finally {
            clearTimeout(timeout);
            inFlight = false;
            syncControls();
        }
    }

    const FORM_MSG = {
        rate_limited: ['제보 횟수가 많습니다. 잠시 후 다시 시도하거나 이메일로 보내주세요.', 'err'],
        too_short: ['제보 내용을 다섯 글자 이상 적어주세요.', 'err'],
        not_configured: [PREPARING, 'err'],
        busy: ['다른 제보를 보내는 중입니다. 잠시 기다려주세요.', 'busy'],
        timeout: ['응답 시간이 길어 접수 여부를 확인하지 못했습니다. 입력한 내용은 유지됩니다.', 'err'],
        network: ['연결이 끊겨 접수 여부를 확인하지 못했습니다. 입력한 내용은 유지됩니다.', 'err'],
        server: ['제보를 접수하지 못했습니다. 입력한 내용을 확인하고 다시 시도하거나 이메일로 보내주세요.', 'err'],
    };

    form?.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (formSubmitting) return;
        formSubmitting = true;
        setStatus('보내는 중…', 'busy');
        try {
            const result = await send({
                website: form.elements['website']?.value || '',
                summary: document.getElementById('fb-summary')?.value || '',
                detail: document.getElementById('fb-detail')?.value || '',
                contact: document.getElementById('fb-contact')?.value || '',
            });
            if (result.ok) {
                form.reset();
                setStatus('전달됐습니다. 고맙습니다!', 'ok');
            } else {
                setStatus(...(FORM_MSG[result.reason] || FORM_MSG.server));
            }
        } finally {
            formSubmitting = false;
            syncControls();
        }
    });

    function openFromOverlay() {
        if (!card) return;
        window.GGHF_GAME?.pause('feedback');
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        card.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' });
        if (isEnabled() && !inFlight) {
            document.getElementById('fb-summary')?.focus({ preventScroll: true });
        } else if (status) {
            status.tabIndex = -1;
            status.focus({ preventScroll: true });
        }
    }

    function mountOverlayLink() {
        const overlay = document.getElementById('overlay');
        if (!overlay || overlay.querySelector('.fb-overlay-link')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'fb-overlay-link';
        button.textContent = '게임 의견 보내기 →';
        button.addEventListener('click', openFromOverlay);
        overlay.appendChild(button);
    }

    syncControls();
    if (!isEnabled()) setStatus(PREPARING, 'busy');

    return {
        onGameOver: mountOverlayLink,
        open: openFromOverlay,
        send,
        remaining: () => Math.max(0, MAX_PER_SESSION - sent),
    };
})();
