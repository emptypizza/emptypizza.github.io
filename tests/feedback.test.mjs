import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/js/feedback.js', import.meta.url), 'utf8');

function fixture({ enabled = true, response = { ok: true, status: 201 }, fetchImpl } = {}) {
    const nodes = new Map();
    const timers = new Map();
    let timerId = 0;
    const requests = [];
    function element() {
        return {
            value: '', textContent: '', dataset: {}, disabled: false, listeners: {}, children: [],
            addEventListener(event, callback) { this.listeners[event] = callback; },
            setAttribute(name, value) { this[name] = value; },
            focus() { this.focused = true; },
            scrollIntoView() { this.scrolled = true; },
            appendChild(child) { this.children.push(child); },
            querySelector(selector) { return this.children.find(child => '.' + child.className === selector); },
        };
    }
    for (const id of ['fb-form', 'fb-status', 'fb-submit', 'fb-card', 'fb-fields', 'fb-summary', 'fb-detail', 'fb-contact', 'overlay']) {
        nodes.set(id, element());
    }
    const form = nodes.get('fb-form');
    form.elements = { website: { value: '' } };
    form.resetCount = 0;
    form.reset = () => {
        form.resetCount++;
        for (const id of ['fb-summary', 'fb-detail', 'fb-contact']) nodes.get(id).value = '';
    };
    const window = {
        GGHF_CONTENT: { feedback: { enabled, endpoint: 'https://example.test/feedback' } },
        GGHF_GAME: { getState: () => ({ stage: 2 }), pause() {} },
        innerWidth: 390, innerHeight: 844, matchMedia: () => ({ matches: false }),
    };
    vm.runInNewContext(source, {
        window,
        document: { getElementById: id => nodes.get(id), createElement: element },
        AbortController,
        setTimeout(callback, ms) { const id = ++timerId; timers.set(id, { callback, ms }); return id; },
        clearTimeout(id) { timers.delete(id); },
        fetch: async (url, options) => {
            requests.push({ url, options });
            return fetchImpl ? fetchImpl(url, options) : response;
        },
    });
    function fill() {
        nodes.get('fb-summary').value = '두 번째 스테이지 제보';
        nodes.get('fb-detail').value = '열쇠를 먹었는데 숫자가 바뀌지 않았습니다.';
        nodes.get('fb-contact').value = 'tester@example.test';
    }
    return {
        nodes, window, timers, requests, form, fill, api: window.GGHF_FEEDBACK,
        submit: () => form.listeners.submit({ preventDefault() {} }),
    };
}

test('disabled configuration blocks both form and drone requests without losing input', async () => {
    const f = fixture({ enabled: false });
    f.fill();
    assert.equal(f.nodes.get('fb-fields').disabled, true);
    assert.equal(f.nodes.get('fb-submit').disabled, true);
    assert.match(f.nodes.get('fb-status').textContent, /온라인 제보 접수 준비 중/);
    const result = await f.api.send({ summary: '제보 드론에서 보내는 내용' });
    assert.equal(result.reason, 'not_configured');
    await f.submit();
    assert.equal(f.requests.length, 0);
    assert.equal(f.form.resetCount, 0);
    assert.equal(f.nodes.get('fb-summary').value, '두 번째 스테이지 제보');
    assert.equal(f.api.remaining(), 3);
});

for (const [status, reason, expectedMessage] of [
    [503, 'not_configured', /접수 준비 중/],
    [429, 'rate_limited', /제보 횟수가 많습니다/],
    [500, 'server', /접수하지 못했습니다/],
]) {
    test(`HTTP ${status} preserves the report and restores form controls`, async () => {
        const f = fixture({ response: { ok: false, status } });
        f.fill();
        await f.submit();
        assert.equal(f.form.resetCount, 0);
        assert.equal(f.nodes.get('fb-summary').value, '두 번째 스테이지 제보');
        assert.equal(f.nodes.get('fb-contact').value, 'tester@example.test');
        assert.match(f.nodes.get('fb-status').textContent, expectedMessage);
        assert.equal(f.nodes.get('fb-status').dataset.tone, 'err');
        assert.equal(f.nodes.get('fb-fields').disabled, false);
        assert.equal(f.api.remaining(), 3);
        assert.equal(f.timers.size, 0);
        const result = await f.api.send({ summary: '다시 보내는 제보 내용' });
        assert.equal(result.reason, reason);
    });
}

test('only a successful response clears input and counts a report, using the public game stage', async () => {
    const f = fixture();
    f.fill();
    await f.submit();
    assert.equal(f.form.resetCount, 1);
    assert.equal(f.nodes.get('fb-summary').value, '');
    assert.equal(f.nodes.get('fb-contact').value, '');
    assert.equal(f.api.remaining(), 2);
    assert.equal(f.nodes.get('fb-status').dataset.tone, 'ok');
    assert.equal(f.requests.length, 1);
    const request = f.requests[0];
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers['Content-Type'], 'application/json');
    const payload = JSON.parse(request.options.body);
    assert.equal(payload.stage, 'stage2');
    assert.equal(payload.summary, '두 번째 스테이지 제보');
    assert.equal(payload.viewport, '390x844');
    assert.equal(f.timers.size, 0);
});

test('network failures keep the input and do not imply delivery', async () => {
    const f = fixture({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
    f.fill();
    await f.submit();
    assert.equal(f.form.resetCount, 0);
    assert.match(f.nodes.get('fb-status').textContent, /접수 여부를 확인하지 못했습니다/);
    assert.equal(f.nodes.get('fb-summary').value, '두 번째 스테이지 제보');
    assert.equal(f.nodes.get('fb-submit').disabled, false);
    assert.equal(f.api.remaining(), 3);
});

test('form double submit and simultaneous drone sends create only one request', async () => {
    let resolveRequest;
    const f = fixture({ fetchImpl: () => new Promise(resolve => { resolveRequest = resolve; }) });
    f.fill();
    const first = f.submit();
    await f.submit();
    const drone = await f.api.send({ summary: '동시에 보내는 드론 제보' });
    assert.equal(drone.reason, 'busy');
    assert.equal(f.requests.length, 1);
    assert.equal(f.nodes.get('fb-fields').disabled, true);
    assert.equal(f.form['aria-busy'], 'true');
    resolveRequest({ ok: true, status: 201 });
    await first;
    assert.equal(f.form.resetCount, 1);
    assert.equal(f.form['aria-busy'], 'false');
    assert.equal(f.nodes.get('fb-fields').disabled, false);
});

test('timeout aborts the request and preserves input without claiming it was not received', async () => {
    const f = fixture({ fetchImpl: (_, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }) });
    f.fill();
    const sending = f.submit();
    const timer = [...f.timers.values()][0];
    assert.equal(timer.ms, 15000);
    timer.callback();
    await sending;
    assert.equal(f.requests[0].options.signal.aborted, true);
    assert.equal(f.form.resetCount, 0);
    assert.match(f.nodes.get('fb-status').textContent, /응답 시간이 길어 접수 여부를 확인하지 못했습니다/);
    assert.equal(f.nodes.get('fb-detail').value, '열쇠를 먹었는데 숫자가 바뀌지 않았습니다.');
    assert.equal(f.nodes.get('fb-submit').disabled, false);
    assert.equal(f.timers.size, 0);
});

test('short reports and exhausted session quota do not issue additional requests', async () => {
    const f = fixture();
    const short = await f.api.send({ summary: '짧음' });
    assert.equal(short.reason, 'too_short');
    assert.equal(f.requests.length, 0);
    for (let i = 0; i < 3; i++) assert.equal((await f.api.send({ summary: '정상 제보 내용입니다' })).ok, true);
    const limited = await f.api.send({ summary: '네 번째 제보 내용입니다' });
    assert.equal(limited.reason, 'rate_limited');
    assert.equal(f.requests.length, 3);
    assert.equal(f.api.remaining(), 0);
});

test('feedback open preserves the game result overlay and focuses the available notice', () => {
    const f = fixture({ enabled: false });
    f.api.onGameOver();
    f.api.onGameOver();
    assert.equal(f.nodes.get('overlay').children.length, 1);
    f.api.open();
    assert.equal(f.nodes.get('fb-card').scrolled, true);
    assert.equal(f.nodes.get('fb-status').focused, true);
    assert.equal(f.nodes.get('fb-summary').focused, undefined);
});
