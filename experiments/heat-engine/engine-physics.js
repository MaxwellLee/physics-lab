export const TAU = Math.PI * 2;
export const CYCLE_ANGLE = Math.PI * 4;

export const INLINE_FOUR_FIRING_ORDER = Object.freeze([1, 3, 4, 2]);
export const INLINE_FOUR_PHASE_OFFSETS = Object.freeze([
  Math.PI * 2,
  Math.PI * 3,
  Math.PI,
  0
]);

export const INLINE_FOUR_GEOMETRY = Object.freeze({
  crankRadius: 0.62,
  rodLength: 3.5,
  crankY: -2.2,
  pistonHeight: 0.58,
  pistonTopOffset: 0.55,
  chamberTop: 2.63,
  cylinderRadius: 0.82,
  cylinderHeight: 3.66,
  cylinderCenterY: 0.8,
  cylinderX: Object.freeze([-2.85, -0.95, 0.95, 2.85])
});

// 教学模型保留真实曲柄滑块几何，同时适度放大两类发动机的结构差异。
// 柴油机使用更长的冲程和汽缸，以直观呈现其通常具有更高压缩程度的特征。
export const ENGINE_GEOMETRY = Object.freeze({
  gasoline: Object.freeze({
    crankRadius: 1.2,
    rodLength: 3.35,
    crankY: -2.55,
    cylinderHeight: 4.45,
    cylinderRadius: 1.45,
    cylinderCenterY: 1.05,
    cylinderTop: 3.275,
    cylinderBottom: -1.175,
    baseY: -3.25,
    baseWidth: 3.82,
    baseHeight: 0.54,
    baseDepth: 3.08,
    railHeight: 4.75,
    railCenterY: 0.72,
    railWidth: 0.25,
    railDepth: 0.3,
    railX: 1.65,
    headWidth: 3.18,
    headHeight: 0.46,
    headDepth: 2.92,
    pistonRadius: 1.04,
    pistonHeight: 0.84,
    pistonTopOffset: 0.82,
    rodTopRadius: 0.14,
    rodBottomRadius: 0.19,
    rodTopEye: 0.3,
    rodBottomEye: 0.4,
    crankWebWidth: 0.3,
    crankPinRadius: 0.24,
    flywheelRadius: 1.3,
    chamberTop: 3.15
  }),
  diesel: Object.freeze({
    crankRadius: 1.35,
    rodLength: 3.6,
    crankY: -2.95,
    cylinderHeight: 5.1,
    cylinderRadius: 1.66,
    cylinderCenterY: 0.75,
    cylinderTop: 3.3,
    cylinderBottom: -1.8,
    baseY: -3.65,
    baseWidth: 4.5,
    baseHeight: 0.82,
    baseDepth: 3.72,
    railHeight: 5.4,
    railCenterY: 0.42,
    railWidth: 0.48,
    railDepth: 0.52,
    railX: 1.94,
    headWidth: 3.82,
    headHeight: 0.76,
    headDepth: 3.46,
    pistonRadius: 1.27,
    pistonHeight: 1.18,
    pistonTopOffset: 0.98,
    rodTopRadius: 0.24,
    rodBottomRadius: 0.32,
    rodTopEye: 0.38,
    rodBottomEye: 0.51,
    crankWebWidth: 0.48,
    crankPinRadius: 0.31,
    flywheelRadius: 1.52,
    chamberTop: 3.15
  })
});

export const STROKES = [
  {
    id: 'intake',
    name: '吸气冲程',
    en: 'INTAKE',
    direction: '活塞向下',
    summary: '进气门打开，活塞下行，汽缸容积增大。',
    energy: '飞轮储存的机械能带动活塞下行，新鲜气体进入汽缸。',
    doesExternalWork: false
  },
  {
    id: 'compression',
    name: '压缩冲程',
    en: 'COMPRESSION',
    direction: '活塞向上',
    summary: '两气门关闭，活塞上行，汽缸内气体被压缩。',
    energy: '飞轮的机械能转化为气体内能，气体温度升高。',
    doesExternalWork: false
  },
  {
    id: 'power',
    name: '做功冲程',
    en: 'POWER',
    direction: '活塞向下',
    summary: '燃气膨胀推动活塞下行，并通过连杆带动曲轴。',
    energy: '燃料的化学能先转化为燃气内能，再转化为活塞和曲轴的机械能。',
    doesExternalWork: true
  },
  {
    id: 'exhaust',
    name: '排气冲程',
    en: 'EXHAUST',
    direction: '活塞向上',
    summary: '排气门打开，活塞上行，将燃烧后的气体排出。',
    energy: '飞轮储存的机械能带动活塞上行，把废气推出汽缸。',
    doesExternalWork: false
  }
];

export const ENGINE_COPY = {
  gasoline: {
    name: '汽油机',
    en: 'SPARK IGNITION',
    intake: '吸入空气与汽油形成的混合气',
    ignition: '压缩冲程末端由火花塞点燃混合气',
    marker: '火花塞'
  },
  diesel: {
    name: '柴油机',
    en: 'COMPRESSION IGNITION',
    intake: '吸气冲程只吸入空气',
    ignition: '压缩冲程末端喷油，燃油在高温空气中自燃',
    marker: '喷油嘴'
  }
};

export function normalizeCycleAngle(angle) {
  return ((angle % CYCLE_ANGLE) + CYCLE_ANGLE) % CYCLE_ANGLE;
}

export function sliderCrankPosition(angle, radius = 1.2, rodLength = 3.35, crankY = -2.55) {
  const crankAngle = normalizeCycleAngle(angle) % TAU;
  const crankX = radius * Math.sin(crankAngle);
  const crankPinY = crankY + radius * Math.cos(crankAngle);
  const rodRise = Math.sqrt(Math.max(0, rodLength ** 2 - crankX ** 2));
  return {
    crankX,
    crankPinY,
    pistonPinY: crankPinY + rodRise,
    crankAngle
  };
}

export function getTeachingCompressionRatio(engineType = 'gasoline') {
  const profile = ENGINE_GEOMETRY[engineType];
  const top = sliderCrankPosition(0, profile.crankRadius, profile.rodLength, profile.crankY);
  const clearance = profile.chamberTop - (top.pistonPinY + profile.pistonTopOffset);
  return (2 * profile.crankRadius + clearance) / clearance;
}

export function getInlineFourStates(angle) {
  return INLINE_FOUR_PHASE_OFFSETS.map((offset, index) => ({
    ...getCycleState(angle + offset, 'gasoline'),
    cylinder: index + 1,
    phaseOffset: offset
  }));
}

export function getCycleState(angle, engineType = 'gasoline') {
  const normalized = normalizeCycleAngle(angle);
  const strokeIndex = Math.min(3, Math.floor(normalized / Math.PI));
  const stroke = STROKES[strokeIndex];
  const progress = (normalized - strokeIndex * Math.PI) / Math.PI;
  const valveCurve = Math.pow(Math.sin(progress * Math.PI), 0.72);
  const sparkWindow = (strokeIndex === 1 && progress > 0.9) || (strokeIndex === 2 && progress < 0.1);
  const injectionWindow = strokeIndex === 1 && progress > 0.82;
  const pressure = strokeIndex === 0 ? '较低' : strokeIndex === 1 ? '持续升高' : strokeIndex === 2 ? '先达到最高后下降' : '接近排气压力';
  const temperature = strokeIndex === 0 ? '较低' : strokeIndex === 1 ? '持续升高' : strokeIndex === 2 ? '燃烧后最高，随后下降' : '仍高于进气温度';
  const gasKind = strokeIndex === 3 ? 'exhaust' : strokeIndex === 2 ? 'combustion' : engineType === 'diesel' ? 'air' : 'mixture';
  return {
    angle: normalized,
    degrees: normalized * 180 / Math.PI,
    strokeIndex,
    stroke,
    progress,
    pistonDirection: strokeIndex % 2 === 0 ? 'down' : 'up',
    intakeLift: strokeIndex === 0 ? valveCurve : 0,
    exhaustLift: strokeIndex === 3 ? valveCurve : 0,
    spark: engineType === 'gasoline' && sparkWindow,
    injection: engineType === 'diesel' && injectionWindow,
    combustion: strokeIndex === 2,
    gasKind,
    pressure,
    temperature,
    engine: ENGINE_COPY[engineType]
  };
}
