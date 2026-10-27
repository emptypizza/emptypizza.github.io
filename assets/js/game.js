/* kmm adventure: the original three-stage rules with an explicit game lifecycle. */
(function (root) {
    'use strict';

    const STAGES = Object.freeze([
        Object.freeze({ level: 1, gridSize: 8, goalPercent: 70, goalKeys: 0, enemies: 1, time: 45, missionText: '1단계 · 적을 피해 보드의 70%를 칠하세요.' }),
        Object.freeze({ level: 2, gridSize: 10, goalPercent: 70, goalKeys: 3, enemies: 3, time: 70, missionText: '2단계 · 열쇠 3개를 모으고 보드의 70%를 칠하세요.' }),
        Object.freeze({ level: 3, gridSize: 10, goalPercent: 70, goalKeys: 3, enemies: 8, time: 90, missionText: '마지막 단계 · 적 8명을 피해 열쇠 3개와 점령률 70%를 달성하세요.' })
    ]);
    const DIRECTIONS = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });

    function createGame({ random = Math.random, onChange = () => {}, onSound = () => {} } = {}) {
        let stageIndex = 0, config = STAGES[0], mode = 'ready', reason = '';
        let player, enemies, painted, keys, activeKey, timeLeft;
        let mainIn, enemyIn, spawnIn;
        const randomIndex = size => Math.min(size - 1, Math.max(0, Math.floor(random() * size)));
        const notify = () => onChange(getState());
        const percent = () => Math.floor(painted.size / (config.gridSize * config.gridSize) * 100);
        const enemyDelay = () => config.enemies > 5 ? 700 : 600;

        function prepare(index = 0) {
            if (!Number.isInteger(index) || !STAGES[index]) throw new RangeError('Unknown stage');
            stageIndex = index;
            config = STAGES[index];
            mode = 'ready';
            reason = '';
            player = { x: 0, y: 0 };
            painted = new Set(['0,0']);
            enemies = [];
            const candidates = [];
            for (let y = 0; y < config.gridSize; y++) {
                for (let x = 0; x < config.gridSize; x++) {
                    if (x + y > 4) candidates.push({ x, y });
                }
            }
            while (enemies.length < config.enemies) {
                enemies.push(candidates.splice(randomIndex(candidates.length), 1)[0]);
            }
            keys = 0;
            activeKey = null;
            timeLeft = config.time;
            mainIn = 1000;
            enemyIn = enemyDelay();
            spawnIn = 1000;
            notify();
        }

        function start() {
            if (mode === 'running') return;
            if (mode === 'paused') return resume();
            if (mode === 'lost') prepare(stageIndex);
            else if (mode === 'won') prepare(stageIndex < STAGES.length - 1 ? stageIndex + 1 : 0);
            mode = 'running';
            reason = '';
            notify();
        }
        function pause(why = 'manual') {
            if (mode !== 'running') return;
            mode = 'paused';
            reason = why;
            notify();
        }
        function resume() {
            if (mode !== 'paused') return;
            mode = 'running';
            reason = '';
            notify();
        }
        function restart() { prepare(stageIndex); start(); }
        function finish(won, why) {
            if (mode !== 'running') return;
            mode = won ? 'won' : 'lost';
            reason = why;
            onSound(won ? 'win' : 'lose');
        }
        function collision() {
            if (enemies.some(enemy => enemy.x === player.x && enemy.y === player.y)) {
                finish(false, 'collision');
                return true;
            }
            return false;
        }
        function move(dx, dy) {
            if (mode !== 'running' || !Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) + Math.abs(dy) !== 1) return false;
            const x = player.x + dx, y = player.y + dy;
            if (x < 0 || y < 0 || x >= config.gridSize || y >= config.gridSize) return false;
            player = { x, y };
            if (!painted.has(`${x},${y}`)) onSound('move');
            painted.add(`${x},${y}`);
            if (activeKey && x === activeKey.x && y === activeKey.y) {
                keys++;
                activeKey = null;
                onSound('coin');
            }
            // A collision stays a loss even if the same step crosses the paint target.
            if (!collision() && percent() >= config.goalPercent && keys >= config.goalKeys) finish(true, 'target');
            notify();
            return true;
        }
        function moveEnemies() {
            for (const enemy of enemies) {
                let dx = 0, dy = 0;
                if (random() > 0.5) {
                    if (player.x > enemy.x) dx = 1;
                    else if (player.x < enemy.x) dx = -1;
                    else if (player.y > enemy.y) dy = 1;
                    else if (player.y < enemy.y) dy = -1;
                } else {
                    [dx, dy] = [[0, 1], [0, -1], [1, 0], [-1, 0]][randomIndex(4)];
                }
                const x = enemy.x + dx, y = enemy.y + dy;
                if (x >= 0 && y >= 0 && x < config.gridSize && y < config.gridSize) Object.assign(enemy, { x, y });
            }
            collision();
        }
        function trySpawnKey() {
            if (activeKey || keys >= config.goalKeys) return;
            const chance = 0.1 + painted.size / (config.gridSize * config.gridSize) * 0.4;
            if (random() < chance) {
                activeKey = { x: randomIndex(config.gridSize), y: randomIndex(config.gridSize), remainingMs: 3000 };
                onSound('spawn');
            }
        }
        function advance(milliseconds) {
            if (!Number.isFinite(milliseconds) || milliseconds <= 0 || mode !== 'running') return;
            let remaining = milliseconds;
            while (remaining > 0 && mode === 'running') {
                const step = Math.min(remaining, mainIn, enemyIn, config.goalKeys ? spawnIn : Infinity, activeKey ? activeKey.remainingMs : Infinity);
                remaining -= step;
                mainIn -= step;
                enemyIn -= step;
                if (config.goalKeys) spawnIn -= step;
                if (activeKey) {
                    activeKey.remainingMs -= step;
                    if (activeKey.remainingMs <= 0) activeKey = null;
                }
                if (mainIn <= 0) {
                    mainIn += 1000;
                    timeLeft--;
                    if (timeLeft <= 0) finish(false, 'timeout');
                }
                if (mode !== 'running') break;
                if (enemyIn <= 0) { enemyIn += enemyDelay(); moveEnemies(); }
                if (mode !== 'running') break;
                if (config.goalKeys && spawnIn <= 0) { spawnIn += 1000; trySpawnKey(); }
            }
            notify();
        }
        function getState() {
            return {
                mode, reason, stage: config.level, stageIndex, gridSize: config.gridSize,
                coordinateSystem: 'origin top-left; x increases right; y increases down',
                player: { ...player }, enemies: enemies?.map(enemy => ({ ...enemy })) || [],
                painted: painted ? [...painted] : [], paintPercent: painted ? percent() : 0,
                keys, key: activeKey ? { ...activeKey } : null, timeLeft,
                goalPercent: config.goalPercent, goalKeys: config.goalKeys,
                missionText: config.missionText, finalStage: stageIndex === STAGES.length - 1
            };
        }
        prepare();
        return { prepare, start, pause, resume, restart, move, advance, getState };
    }

    if (typeof module === 'object' && module.exports) module.exports = { createGame, STAGES };
    if (!root.document) return;
    const document = root.document;
    const board = document.getElementById('game-board');
    if (!board) return;
    const region = document.getElementById('play') || board.parentElement;
    const overlay = document.getElementById('overlay');
    const ui = Object.fromEntries([
        'stage-num', 'time-display', 'score-display', 'key-container', 'key-display',
        'mission-text', 'result-title', 'result-desc', 'overlay-btn', 'game-start', 'game-pause', 'game-restart'
    ].map(id => [id, document.getElementById(id)]));
    let audioContext = null, game = null, frameId = null, previousTime = null;
    let lastMode = '', lastStage = -1, lastPaint = '', lastInput = -Infinity, manualClock = false;
    let boardVisible = true;
    const cells = [];

    function unlockAudio() {
        try {
            const AudioClass = root.AudioContext || root.webkitAudioContext;
            if (!AudioClass) return;
            if (!audioContext) audioContext = new AudioClass();
            if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
        } catch (_) { /* Audio is optional; gameplay remains available. */ }
    }
    function sound(type) {
        if (!audioContext || audioContext.state !== 'running') return;
        try {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            const now = audioContext.currentTime;
            const tone = { move: [200, 50, .05, 'triangle'], spawn: [800, 1200, .3, 'sine'], coin: [1200, 1600, .4, 'sine'], win: [523.25, 1046.5, .8, 'square'], lose: [400, 100, .5, 'sawtooth'] }[type];
            if (!tone) return;
            oscillator.type = tone[3];
            oscillator.frequency.setValueAtTime(tone[0], now);
            oscillator.frequency.exponentialRampToValueAtTime(tone[1], now + tone[2]);
            gain.gain.setValueAtTime(.07, now);
            gain.gain.exponentialRampToValueAtTime(.001, now + tone[2]);
            oscillator.start(now);
            oscillator.stop(now + tone[2]);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        } catch (_) { /* A blocked audio context must not stop the game. */ }
    }
    function text(id, value) { if (ui[id]) ui[id].textContent = String(value); }
    function setOverlay(state) {
        const shown = state.mode !== 'running';
        if (overlay) { overlay.hidden = !shown; overlay.style.display = shown ? 'flex' : 'none'; }
        const content = {
            ready: ['플레이 준비', '방향키 · WASD 또는 화면 버튼으로 이동하세요. 시작하기 전에는 시간이 흐르지 않습니다.', '게임 시작'],
            paused: ['잠시 쉬는 중', '이동과 남은 시간이 멈췄습니다. 준비되면 이어서 플레이하세요.', '이어서 플레이'],
            lost: ['다시 도전해 보세요', state.reason === 'timeout' ? '제한시간이 끝났습니다.' : '적에게 잡혔습니다. 다른 경로를 찾아보세요.', '이 스테이지 다시 하기'],
            won: [state.finalStage ? '모든 스테이지 완료!' : '스테이지 클리어!', state.finalStage ? '열쇠와 영역을 모두 확보했습니다. 멋진 플레이였습니다.' : '다음 보드가 기다립니다. 준비되면 시작하세요.', state.finalStage ? '처음부터 플레이' : '다음 스테이지']
        }[state.mode];
        if (content) {
            text('result-title', content[0]); text('result-desc', content[1]); text('overlay-btn', content[2]);
            text('game-start', content[2]);
        } else text('game-start', '플레이 중');
        if (ui['game-start']) ui['game-start'].disabled = state.mode === 'running';
        if (ui['game-pause']) {
            ui['game-pause'].disabled = !['running', 'paused'].includes(state.mode);
            text('game-pause', state.mode === 'paused' ? '이어서 하기' : '일시정지');
        }
        if (ui['game-restart']) ui['game-restart'].disabled = state.mode === 'ready';
        region?.setAttribute('data-game-mode', state.mode);
    }
    function drawBoard(state) {
        const fingerprint = JSON.stringify([state.player, state.enemies, state.painted, state.key && [state.key.x, state.key.y]]);
        if (fingerprint === lastPaint && state.stage === lastStage) return;
        if (state.stage !== lastStage) {
            board.replaceChildren();
            cells.length = 0;
            board.style.gridTemplateColumns = `repeat(${state.gridSize}, 1fr)`;
            board.style.gridTemplateRows = `repeat(${state.gridSize}, 1fr)`;
            for (let i = 0; i < state.gridSize ** 2; i++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.setAttribute('aria-hidden', 'true');
                board.appendChild(cell);
                cells.push(cell);
            }
        }
        for (const cell of cells) { cell.className = 'cell'; cell.replaceChildren(); }
        for (const position of state.painted) {
            const [x, y] = position.split(',').map(Number);
            cells[y * state.gridSize + x].classList.add('painted');
        }
        const actor = (position, className) => {
            if (!position) return;
            const element = document.createElement('div');
            element.className = className;
            cells[position.y * state.gridSize + position.x].appendChild(element);
        };
        actor(state.key, 'gold-key');
        actor(state.player, 'player');
        state.enemies.forEach(enemy => actor(enemy, 'enemy'));
        board.setAttribute('aria-label', `게임 보드. ${state.gridSize} 곱하기 ${state.gridSize}칸. 내 위치 ${state.player.x + 1}열 ${state.player.y + 1}행. 점령률 ${state.paintPercent}퍼센트.`);
        lastPaint = fingerprint;
        lastStage = state.stage;
    }
    function render(state) {
        drawBoard(state);
        text('stage-num', state.stage); text('time-display', state.timeLeft); text('score-display', `${state.paintPercent}%`);
        text('key-display', `${state.keys}/${state.goalKeys}`); text('mission-text', state.missionText);
        if (ui['key-container']) {
            ui['key-container'].hidden = state.goalKeys === 0;
            ui['key-container'].style.display = state.goalKeys ? 'block' : 'none';
        }
        if (ui['time-display']) ui['time-display'].classList.toggle('time-low', state.timeLeft <= 10);
        if (state.mode !== lastMode) setOverlay(state);
        lastMode = state.mode;
        if (state.mode !== 'running') stopLoop();
    }
    function stopLoop() {
        if (frameId !== null) root.cancelAnimationFrame(frameId);
        frameId = null;
        previousTime = null;
    }
    function tick(timestamp) {
        frameId = null;
        if (game.getState().mode !== 'running' || manualClock) return;
        if (previousTime !== null) game.advance(timestamp - previousTime);
        previousTime = timestamp;
        if (game.getState().mode === 'running') frameId = root.requestAnimationFrame(tick);
    }
    function startLoop() {
        stopLoop();
        manualClock = false;
        if (game.getState().mode === 'running') frameId = root.requestAnimationFrame(tick);
    }
    function gameUnavailable() { return document.hidden || document.body.classList.contains('in-village'); }
    function showBoard() {
        board.scrollIntoView({ block: 'center', behavior: 'instant' });
        const bounds = board.getBoundingClientRect();
        boardVisible = bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < root.innerHeight;
        if (boardVisible) board.focus({ preventScroll: true });
        return boardVisible;
    }
    function start() {
        if (gameUnavailable() || !showBoard()) return;
        unlockAudio();
        game.start();
        lastInput = -Infinity;
        startLoop();
    }
    function resume() { if (!gameUnavailable() && showBoard()) { unlockAudio(); game.resume(); startLoop(); } }
    function restart() { if (!gameUnavailable() && showBoard()) { unlockAudio(); game.restart(); lastInput = -Infinity; startLoop(); } }
    function pause(reason) { game.pause(reason); }
    function move(dx, dy) {
        if (gameUnavailable() || !boardVisible || game.getState().mode !== 'running') return;
        const now = root.performance.now();
        if (now - lastInput < 150) return;
        lastInput = now;
        unlockAudio();
        game.move(dx, dy);
    }

    game = createGame({ onChange: render, onSound: sound });
    board.tabIndex = 0;
    board.setAttribute('role', 'group');
    ui['overlay-btn']?.addEventListener('click', start);
    ui['game-start']?.addEventListener('click', start);
    ui['game-pause']?.addEventListener('click', () => game.getState().mode === 'paused' ? resume() : pause('manual'));
    ui['game-restart']?.addEventListener('click', restart);
    for (const button of document.querySelectorAll('[data-move]')) {
        button.addEventListener('click', () => { const direction = DIRECTIONS[button.dataset.move]; if (direction) move(...direction); });
    }
    const keys = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    document.addEventListener('keydown', event => {
        const target = event.target;
        if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || gameUnavailable() || target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
        const active = game.getState().mode;
        if (event.code === 'Escape' && active === 'running') { event.preventDefault(); pause('manual'); return; }
        if (event.code === 'KeyP' && ['running', 'paused'].includes(active) && boardVisible) {
            event.preventDefault();
            if (active === 'running') pause('manual'); else resume();
            return;
        }
        const direction = DIRECTIONS[keys[event.code]];
        if (direction && active === 'running' && boardVisible) { event.preventDefault(); move(...direction); }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause('hidden'); });
    root.addEventListener('blur', () => pause('blur'));
    if ('IntersectionObserver' in root) {
        new root.IntersectionObserver(entries => {
            boardVisible = entries[0].isIntersecting;
            if (!boardVisible) pause('offscreen');
        }, { threshold: 0 }).observe(board);
    }
    if ('MutationObserver' in root) {
        new root.MutationObserver(() => {
            if (document.body.classList.contains('in-village')) pause('island');
        }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    root.GGHF_GAME = Object.freeze({
        prepare: index => { game.prepare(index); lastInput = -Infinity; },
        start, pause, resume, restart, getState: game.getState,
        advanceTime: milliseconds => { manualClock = true; stopLoop(); game.advance(milliseconds); return game.getState(); }
    });
    root.render_game_to_text = () => JSON.stringify(game.getState());
    root.advanceTime = root.GGHF_GAME.advanceTime;
})(typeof window !== 'undefined' ? window : globalThis);
