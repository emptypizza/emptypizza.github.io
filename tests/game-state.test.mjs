import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createGame, STAGES } = require('../assets/js/game.js');

function stationaryEnemies(stage = 0) {
    let roll = 0.99999;
    const game = createGame({ random: () => roll });
    game.prepare(stage);
    // Enemies spawn at the bottom edge, then choose a downward move that is blocked.
    roll = 0;
    return game;
}
function paintRows(game, rows) {
    const size = game.getState().gridSize;
    for (let row = 0; row < rows; row++) {
        for (let column = 1; column < size; column++) game.move(row % 2 ? -1 : 1, 0);
        if (row < rows - 1) game.move(0, 1);
    }
}

test('page load and prepare never start timers or accept movement', () => {
    const game = stationaryEnemies();
    const before = game.getState();
    game.advance(120000);
    assert.equal(game.move(1, 0), false);
    assert.deepEqual(game.getState(), before);
    assert.equal(before.mode, 'ready');
    assert.equal(before.timeLeft, 45);
    assert.equal(before.enemies.length, 1);
});

test('explicit start runs time; pause freezes time, enemies and key lifetimes', () => {
    const game = stationaryEnemies(1);
    game.start();
    game.advance(1400);
    const playing = game.getState();
    assert.equal(playing.timeLeft, 69);
    assert.equal(playing.key.remainingMs, 2600);
    game.pause('hidden');
    const paused = game.getState();
    game.advance(120000);
    assert.deepEqual(game.getState(), paused);
    game.resume();
    game.advance(600);
    assert.equal(game.getState().timeLeft, 68);
    assert.equal(game.getState().key.remainingMs, 2000);
});

test('restart resets only the current stage and explicitly starts it', () => {
    const game = stationaryEnemies(1);
    game.start();
    game.move(1, 0);
    game.advance(1000);
    game.pause();
    game.restart();
    const state = game.getState();
    assert.equal(state.stage, 2);
    assert.equal(state.mode, 'running');
    assert.equal(state.timeLeft, 70);
    assert.deepEqual(state.player, { x: 0, y: 0 });
    assert.equal(state.keys, 0);
    assert.equal(state.paintPercent, 1);
});

test('board boundaries and non-cardinal movement are rejected', () => {
    const game = stationaryEnemies();
    game.start();
    for (const vector of [[-1, 0], [0, -1], [1, 1], [2, 0], [0, 0], [NaN, 0]]) {
        assert.equal(game.move(...vector), false);
    }
    assert.deepEqual(game.getState().player, { x: 0, y: 0 });
    assert.equal(game.move(1, 0), true);
    assert.deepEqual(game.getState().player, { x: 1, y: 0 });
});

test('70 percent of stage one wins and next stage waits for explicit input', () => {
    const game = stationaryEnemies();
    game.start();
    paintRows(game, 6);
    const won = game.getState();
    assert.equal(won.mode, 'won');
    assert.equal(won.stage, 1);
    assert.equal(won.paintPercent, 70);
    game.advance(30000);
    assert.deepEqual(game.getState(), won);
    game.start();
    const next = game.getState();
    assert.equal(next.stage, 2);
    assert.equal(next.mode, 'running');
    assert.equal(next.timeLeft, 70);
    assert.equal(next.enemies.length, 3);
});

test('later stages need all three keys as well as paint', () => {
    const game = stationaryEnemies(1);
    game.start();
    paintRows(game, 7);
    assert.equal(game.getState().paintPercent, 70);
    assert.equal(game.getState().mode, 'running');
    assert.equal(game.getState().keys, 0);
});

test('key collection, 70 percent paint and transition to final stage work together', () => {
    const game = stationaryEnemies(1);
    game.start();
    for (let i = 0; i < 3; i++) {
        game.advance(1000);
        assert.deepEqual({ x: game.getState().key.x, y: game.getState().key.y }, { x: 0, y: 0 });
        game.move(1, 0);
        game.move(-1, 0);
    }
    assert.equal(game.getState().keys, 3);
    assert.equal(game.getState().key, null);
    paintRows(game, 7);
    assert.equal(game.getState().mode, 'won');
    game.start();
    const final = game.getState();
    assert.equal(final.stage, 3);
    assert.equal(final.enemies.length, 8);
    assert.equal(final.timeLeft, 90);
    assert.equal(final.finalStage, true);
});

test('expired keys disappear after three running seconds, not paused time', () => {
    let roll = .99999;
    const game = createGame({ random: () => roll });
    game.prepare(1);
    roll = 0;
    game.start();
    game.advance(1000);
    assert.equal(game.getState().key.remainingMs, 3000);
    // Suppress the next random spawn while keeping the player far from enemies.
    roll = .5;
    game.advance(2999);
    assert.equal(game.getState().key.remainingMs, 1);
    game.advance(1);
    assert.equal(game.getState().key, null);
});

test('time runs out exactly at the stage limit and stays stopped after loss', () => {
    const game = stationaryEnemies();
    game.start();
    game.advance(44999);
    assert.equal(game.getState().mode, 'running');
    assert.equal(game.getState().timeLeft, 1);
    game.advance(1);
    const lost = game.getState();
    assert.equal(lost.mode, 'lost');
    assert.equal(lost.reason, 'timeout');
    assert.equal(lost.timeLeft, 0);
    game.advance(5000);
    assert.deepEqual(game.getState(), lost);
    game.start();
    assert.equal(game.getState().stage, 1);
    assert.equal(game.getState().timeLeft, 45);
});

test('contact with an enemy is a loss and cannot become a win afterward', () => {
    const game = stationaryEnemies();
    game.start();
    for (let i = 0; i < 7; i++) game.move(1, 0);
    for (let i = 0; i < 7; i++) game.move(0, 1);
    const lost = game.getState();
    assert.equal(lost.mode, 'lost');
    assert.equal(lost.reason, 'collision');
    assert.equal(game.move(-1, 0), false);
    assert.deepEqual(game.getState(), lost);
});

test('getState returns snapshots; callers cannot mutate active game state', () => {
    const game = stationaryEnemies();
    const snapshot = game.getState();
    snapshot.player.x = 99;
    snapshot.enemies[0].x = 99;
    snapshot.painted.push('100,100');
    assert.equal(game.getState().player.x, 0);
    assert.notEqual(game.getState().enemies[0].x, 99);
    assert.equal(game.getState().painted.length, 1);
    assert.deepEqual(STAGES.map(({ level, gridSize, goalPercent, goalKeys, enemies, time }) => ({ level, gridSize, goalPercent, goalKeys, enemies, time })), [
        { level: 1, gridSize: 8, goalPercent: 70, goalKeys: 0, enemies: 1, time: 45 },
        { level: 2, gridSize: 10, goalPercent: 70, goalKeys: 3, enemies: 3, time: 70 },
        { level: 3, gridSize: 10, goalPercent: 70, goalKeys: 3, enemies: 8, time: 90 }
    ]);
});
