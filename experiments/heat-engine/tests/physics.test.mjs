import assert from 'node:assert/strict';
import { CYCLE_ANGLE, ENGINE_GEOMETRY, INLINE_FOUR_FIRING_ORDER, INLINE_FOUR_GEOMETRY, STROKES, getCycleState, getInlineFourStates, getTeachingCompressionRatio, sliderCrankPosition } from '../engine-physics.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('90° 为吸气冲程，进气门开启且活塞下行', () => {
  const state = getCycleState(Math.PI / 2, 'gasoline');
  assert.equal(state.stroke.id, 'intake');
  assert.ok(state.intakeLift > 0.9);
  assert.equal(state.exhaustLift, 0);
  assert.equal(state.pistonDirection, 'down');
});

test('270° 为压缩冲程，两气门关闭且活塞上行', () => {
  const state = getCycleState(Math.PI * 1.5, 'gasoline');
  assert.equal(state.stroke.id, 'compression');
  assert.equal(state.intakeLift, 0);
  assert.equal(state.exhaustLift, 0);
  assert.equal(state.pistonDirection, 'up');
});

test('450° 为做功冲程，两气门关闭且活塞下行', () => {
  const state = getCycleState(Math.PI * 2.5, 'diesel');
  assert.equal(state.stroke.id, 'power');
  assert.equal(state.intakeLift, 0);
  assert.equal(state.exhaustLift, 0);
  assert.equal(state.pistonDirection, 'down');
  assert.equal(state.combustion, true);
});

test('630° 为排气冲程，排气门开启且活塞上行', () => {
  const state = getCycleState(Math.PI * 3.5, 'diesel');
  assert.equal(state.stroke.id, 'exhaust');
  assert.ok(state.exhaustLift > 0.9);
  assert.equal(state.intakeLift, 0);
  assert.equal(state.pistonDirection, 'up');
});

test('汽油机在压缩末端由火花塞点火', () => {
  const state = getCycleState(Math.PI * 1.96, 'gasoline');
  assert.equal(state.spark, true);
  assert.equal(state.injection, false);
});

test('柴油机在压缩末端喷油并压燃', () => {
  const state = getCycleState(Math.PI * 1.96, 'diesel');
  assert.equal(state.injection, true);
  assert.equal(state.spark, false);
  assert.equal(getCycleState(320 * Math.PI / 180, 'diesel').injection, false);
  assert.equal(getCycleState(330 * Math.PI / 180, 'diesel').injection, true);
  assert.equal(getCycleState(Math.PI * 2.04, 'diesel').injection, false);
});

test('吸气冲程中汽油机显示混合气，柴油机只显示空气', () => {
  assert.equal(getCycleState(Math.PI / 2, 'gasoline').gasKind, 'mixture');
  assert.equal(getCycleState(Math.PI / 2, 'diesel').gasKind, 'air');
});

test('只有做功冲程对外做功，能量说明包含化学能、内能和机械能', () => {
  assert.deepEqual(STROKES.map(stroke => stroke.doesExternalWork), [false, false, true, false]);
  assert.match(STROKES[2].energy, /化学能/);
  assert.match(STROKES[2].energy, /内能/);
  assert.match(STROKES[2].energy, /机械能/);
});

test('一个完整循环是 720°，状态随后回到吸气冲程', () => {
  const start = getCycleState(0, 'gasoline');
  const wrapped = getCycleState(CYCLE_ANGLE, 'gasoline');
  assert.equal(wrapped.stroke.id, start.stroke.id);
  assert.equal(wrapped.degrees, 0);
});

test('曲柄滑块机构在 0° 上止点、180° 下止点', () => {
  const top = sliderCrankPosition(0);
  const bottom = sliderCrankPosition(Math.PI);
  assert.ok(top.pistonPinY > bottom.pistonPinY);
  assert.ok(Math.abs((top.pistonPinY - bottom.pistonPinY) - 2.4) < 1e-9);
});

test('曲柄转动时连杆长度保持不变，不为命中目标而弯曲', () => {
  for (let degrees = 0; degrees < 720; degrees += 15) {
    const state = sliderCrankPosition(degrees * Math.PI / 180);
    const distance = Math.hypot(state.crankX, state.pistonPinY - state.crankPinY);
    assert.ok(Math.abs(distance - 3.35) < 1e-9, `${degrees}° 连杆长度异常`);
  }
});

test('柴油机教学模型具有更长冲程和更厚重的承压结构', () => {
  const gasoline = ENGINE_GEOMETRY.gasoline;
  const diesel = ENGINE_GEOMETRY.diesel;
  assert.ok(diesel.cylinderHeight > gasoline.cylinderHeight);
  assert.ok(diesel.crankRadius > gasoline.crankRadius);
  assert.ok(diesel.rodLength > gasoline.rodLength);
  assert.ok(diesel.pistonHeight > gasoline.pistonHeight);
  assert.ok(diesel.pistonTopOffset > gasoline.pistonTopOffset);
  assert.ok(diesel.cylinderRadius > gasoline.cylinderRadius);
  assert.ok(diesel.headWidth > gasoline.headWidth);
  assert.ok(diesel.headHeight > gasoline.headHeight);
  assert.ok(diesel.pistonRadius > gasoline.pistonRadius);
  assert.ok(diesel.rodTopRadius > gasoline.rodTopRadius);
  assert.ok(diesel.rodBottomRadius > gasoline.rodBottomRadius);
  assert.ok(diesel.crankWebWidth > gasoline.crankWebWidth);
});

test('教学几何保持汽油机低压缩比、柴油机高压缩比的量级差异', () => {
  const gasolineRatio = getTeachingCompressionRatio('gasoline');
  const dieselRatio = getTeachingCompressionRatio('diesel');
  assert.ok(gasolineRatio >= 8 && gasolineRatio <= 12, gasolineRatio);
  assert.ok(dieselRatio >= 16 && dieselRatio <= 22, dieselRatio);
  assert.ok(dieselRatio > gasolineRatio * 1.8);
});

test('汽油机和柴油机曲柄滑块均保持各自连杆长度', () => {
  for (const profile of Object.values(ENGINE_GEOMETRY)) {
    for (let degrees = 0; degrees < 720; degrees += 15) {
      const state = sliderCrankPosition(degrees * Math.PI / 180, profile.crankRadius, profile.rodLength, profile.crankY);
      const distance = Math.hypot(state.crankX, state.pistonPinY - state.crankPinY);
      assert.ok(Math.abs(distance - profile.rodLength) < 1e-9, `${degrees}° 连杆长度异常`);
    }
  }
});

test('直列四缸示例按 1—3—4—2 每隔 180° 进入做功冲程', () => {
  const powerOrder = [0, 180, 360, 540].map(degrees => {
    const states = getInlineFourStates(degrees * Math.PI / 180);
    const power = states.filter(state => state.strokeIndex === 2 && state.progress < 1e-9);
    assert.equal(power.length, 1, `${degrees}° 应只有一个汽缸进入做功冲程`);
    return power[0].cylinder;
  });
  assert.deepEqual(powerOrder, INLINE_FOUR_FIRING_ORDER);
});

test('直列四缸在循环起点同时呈现四种冲程', () => {
  const states = getInlineFourStates(0);
  assert.deepEqual(states.map(state => state.stroke.id), ['power', 'exhaust', 'compression', 'intake']);
});

test('直列四缸中 1、4 缸同相，2、3 缸同相且两组反相', () => {
  for (let degrees = 0; degrees < 720; degrees += 30) {
    const states = getInlineFourStates(degrees * Math.PI / 180);
    const positions = states.map(state => sliderCrankPosition(state.angle, INLINE_FOUR_GEOMETRY.crankRadius, INLINE_FOUR_GEOMETRY.rodLength, INLINE_FOUR_GEOMETRY.crankY));
    assert.ok(Math.abs(positions[0].pistonPinY - positions[3].pistonPinY) < 1e-9);
    assert.ok(Math.abs(positions[1].pistonPinY - positions[2].pistonPinY) < 1e-9);
    assert.ok(Math.abs((positions[0].crankPinY - INLINE_FOUR_GEOMETRY.crankY) + (positions[1].crankPinY - INLINE_FOUR_GEOMETRY.crankY)) < 1e-9);
  }
});

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

console.log(`\n${tests.length}/${tests.length} 通过`);
