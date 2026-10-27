import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../assets/js/game.js', import.meta.url), 'utf8');

function mountGame() {
    let document, now = 0, audioCreated = 0;
    class Element {
        constructor(tagName = 'DIV') {
            this.tagName = tagName;
            this.style = {};
            this.dataset = {};
            this.children = [];
            this.listeners = new Map();
            this.attributes = {};
            const names = new Set();
            this.classList = {
                contains: name => names.has(name),
                add: name => names.add(name),
                remove: name => names.delete(name),
                toggle: (name, force) => force ? names.add(name) : names.delete(name)
            };
        }
        setAttribute(name, value) { this.attributes[name] = value; }
        replaceChildren(...children) { this.children = children; }
        appendChild(child) { this.children.push(child); }
        addEventListener(type, listener) { this.listeners.set(type, listener); }
        click() { now += 200; this.listeners.get('click')?.({ target: this }); }
        focus() { document.activeElement = this; }
        scrollIntoView() { this.scrolledIntoView = true; }
        getBoundingClientRect() { return { width: 320, height: 320, top: 100, bottom: 420 }; }
        closest() { return ['INPUT', 'TEXTAREA', 'SELECT'].includes(this.tagName) || this.editable ? this : null; }
    }
    const ids = ['game-board', 'play', 'overlay', 'stage-num', 'time-display', 'score-display', 'key-container', 'key-display', 'mission-text', 'result-title', 'result-desc', 'overlay-btn', 'game-start', 'game-pause', 'game-restart'];
    const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
    const directions = Object.fromEntries(['up', 'down', 'left', 'right'].map(direction => {
        const button = new Element('BUTTON');
        button.dataset.move = direction;
        return [direction, button];
    }));
    const events = new Map(), windowEvents = new Map(), frames = new Map();
    let frameID = 0, intersection, mutation;
    document = {
        hidden: false,
        body: new Element('BODY'),
        getElementById: id => elements[id],
        querySelectorAll: () => Object.values(directions),
        createElement: tag => new Element(tag.toUpperCase()),
        addEventListener: (type, listener) => events.set(type, listener)
    };
    const window = {
        document, innerHeight: 844, performance: { now: () => now },
        requestAnimationFrame: callback => { frames.set(++frameID, callback); return frameID; },
        cancelAnimationFrame: id => frames.delete(id),
        addEventListener: (type, listener) => windowEvents.set(type, listener),
        IntersectionObserver: class { constructor(callback) { intersection = callback; } observe() {} },
        MutationObserver: class { constructor(callback) { mutation = callback; } observe() {} },
        AudioContext: class { constructor() { audioCreated++; this.state = 'suspended'; } resume() { return Promise.resolve(); } }
    };
    vm.runInNewContext(source, { window });
    return {
        game: window.GGHF_GAME, elements, directions, document, window, Element,
        get audioCreated() { return audioCreated; },
        key(code, target = elements['game-board']) {
            now += 200;
            let prevented = false;
            events.get('keydown')({ code, target, preventDefault: () => { prevented = true; } });
            return prevented;
        },
        visibility(hidden) { document.hidden = hidden; events.get('visibilitychange')(); },
        blur() { windowEvents.get('blur')(); },
        intersection(visible) { intersection([{ isIntersecting: visible }]); },
        island() { document.body.classList.add('in-village'); mutation(); }
    };
}

function position(game) { const { x, y } = game.getState().player; return { x, y }; }

test('DOM mount is idle and silent until the explicit start control is activated', () => {
    const app = mountGame();
    assert.equal(app.audioCreated, 0);
    app.window.advanceTime(60000);
    assert.equal(app.game.getState().mode, 'ready');
    assert.equal(app.game.getState().timeLeft, 45);
    assert.equal(app.elements['overlay-btn'].textContent, '게임 시작');
    app.elements['game-start'].click();
    assert.equal(app.game.getState().mode, 'running');
    assert.equal(app.audioCreated, 1);
    assert.equal(app.elements.overlay.hidden, true);
    assert.equal(app.document.activeElement, app.elements['game-board']);
});

test('keyboard and native direction-button click both move the player', () => {
    const app = mountGame();
    app.elements['overlay-btn'].click();
    assert.equal(app.key('ArrowRight'), true);
    assert.deepEqual(position(app.game), { x: 1, y: 0 });
    app.key('KeyS');
    assert.deepEqual(position(app.game), { x: 1, y: 1 });
    app.directions.right.click();
    assert.deepEqual(position(app.game), { x: 2, y: 1 });
    app.directions.up.click();
    assert.deepEqual(position(app.game), { x: 2, y: 0 });
});

test('start, resume and restart reveal an offscreen board before running', () => {
    const app = mountGame();
    const board = app.elements['game-board'];
    for (const action of ['start', 'resume', 'restart']) {
        app.intersection(false);
        board.scrolledIntoView = false;
        app.game[action]();
        assert.equal(board.scrolledIntoView, true);
        assert.equal(app.game.getState().mode, 'running');
    }
    app.intersection(false);
    board.getBoundingClientRect = () => ({ width: 0, height: 0, top: 0, bottom: 0 });
    app.game.resume();
    assert.equal(app.game.getState().mode, 'paused');
});

test('form and editable text input cannot control the game', () => {
    const app = mountGame();
    app.elements['game-start'].click();
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
        assert.equal(app.key('ArrowRight', new app.Element(tag)), false);
    }
    const editable = new app.Element();
    editable.editable = true;
    assert.equal(app.key('KeyD', editable), false);
    assert.deepEqual(position(app.game), { x: 0, y: 0 });
});

test('P and Escape pause, and an explicit control resumes without resetting', () => {
    const app = mountGame();
    app.game.start();
    app.key('ArrowRight');
    app.key('KeyP');
    assert.equal(app.game.getState().mode, 'paused');
    app.window.advanceTime(5000);
    assert.equal(app.game.getState().timeLeft, 45);
    app.key('ArrowRight');
    assert.deepEqual(position(app.game), { x: 1, y: 0 });
    app.elements['game-pause'].click();
    assert.equal(app.game.getState().mode, 'running');
    assert.deepEqual(position(app.game), { x: 1, y: 0 });
    app.key('Escape');
    assert.equal(app.game.getState().mode, 'paused');
});

test('tab visibility, window blur, leaving the viewport and island entry each pause', () => {
    const app = mountGame();
    app.game.start();
    app.visibility(true);
    assert.equal(app.game.getState().reason, 'hidden');
    app.visibility(false);
    assert.equal(app.game.getState().mode, 'paused');
    app.game.resume();
    app.blur();
    assert.equal(app.game.getState().reason, 'blur');
    app.game.resume();
    app.intersection(false);
    assert.equal(app.game.getState().reason, 'offscreen');
    app.intersection(true);
    assert.equal(app.game.getState().mode, 'paused');
    app.game.resume();
    app.island();
    assert.equal(app.game.getState().reason, 'island');
    app.game.resume();
    assert.equal(app.game.getState().mode, 'paused');
});
