// 数据与资料层：元件分类与文案、电阻丝规格、概念讲解、预设演示电路。
// 电气行为定义在 src/physics/components.js；外观几何在 src/render/bench.js。
// 预设电路中 wires 用元件序号引用 components 数组。

import { DEFS, defaultParams } from './src/physics/components.js';

export const CATEGORIES = [
  { id: 'source', label: '电源' },
  { id: 'switch', label: '开关' },
  { id: 'resistor', label: '电阻' },
  { id: 'meter', label: '电表' },
  { id: 'semi', label: '半导体' },
  { id: 'load', label: '用电器' },
  { id: 'safety', label: '安全' }
];

// type -> { category, brief, detail }
export const CATALOG = {
  'student-supply': {
    category: 'source',
    brief: '实验室常用的可调直流电源。转动旋钮可以改变输出电压，为电路提供持续的电势差。',
    detail: '学生电源把其他形式的能量转化为电能，在电源内部把正电荷从负极“泵”到正极，从而在两极之间维持稳定的电压。实际实验中应先把输出调到较小值，闭合开关后再逐渐升高电压。本实验中电源按理想电压源处理，忽略内阻。'
  },
  'battery-pack': {
    category: 'source',
    brief: '每节干电池电压 1.5 V，多节串联时总电压等于各节电压之和。',
    detail: '干电池通过内部的化学反应提供电能。串联电池组的总电压 = 1.5 V × 节数。使用时不允许用导线直接连接电池正负两极，否则会因电流过大而损坏电池。'
  },
  accumulator: {
    category: 'source',
    brief: '每节蓄电池电压 2 V，可以反复充放电。',
    detail: '蓄电池（铅酸电池）每节标称电压 2 V，放电时化学能转化为电能，充电时反向进行。汽车、电动车中广泛使用。本实验中按理想电压源处理。'
  },
  switch: {
    category: 'switch',
    brief: '控制电路的通断。连接电路时开关应当断开，检查无误后再闭合。',
    detail: '开关闭合时相当于一段导线，断开时电路成为断路，电流立刻处处为零。养成“先断开开关再改电路”的习惯，是电学实验最基本的安全规范。'
  },
  'spdt-switch': {
    category: 'switch',
    brief: '一个刀闸可以在两个触点之间切换，常用于需要“两处控制同一盏灯”的场合。',
    detail: '单刀双掷开关有一个公共端（刀）和两个掷点。两只单刀双掷开关配合，可以实现楼梯口和床头都能独立开关同一盏灯——只要改变其中任意一只开关的状态，灯的状态就会翻转。'
  },
  resistor: {
    category: 'resistor',
    brief: '对电流有确定阻碍作用的元件，阻值不随电压、电流改变。',
    detail: '电阻表示导体对电流的阻碍作用，单位是欧姆（Ω）。定值电阻遵守欧姆定律：通过它的电流与两端电压成正比，I = U / R。本实验中普通定值电阻是严格的欧姆元件。'
  },
  rheostat: {
    category: 'resistor',
    brief: '通过滑片改变接入电路的电阻丝长度，从而连续改变电阻和电流。',
    detail: '滑动变阻器正确的接法是“一上一下”：接入一个电阻丝端点（下）和滑片端（上），移动滑片就改变了接入部分的电阻。只接下面两个端点时相当于定值电阻，只接上面两个端点时电阻几乎为零。闭合开关前，应把滑片移到接入电阻最大的位置，保护电路。'
  },
  'resistance-box': {
    category: 'resistor',
    brief: '可以直接读出阻值的可变电阻，常用于需要精确知道电阻大小的实验。',
    detail: '电阻箱通过旋盘组合不同阻值，读数即接入电路的电阻。与滑动变阻器相比，它不能连续调节，但能给出准确数值。'
  },
  'wire-board': {
    category: 'resistor',
    brief: '人教版经典实验“探究影响电阻大小的因素”的实验板，可更换不同材料、长度、横截面积的电阻丝。',
    detail: '导体的电阻与材料、长度、横截面积有关：R = ρL / S。实验时用控制变量法：保持两项不变，只改变一项，比较电流表示数。镍铬合金电阻率大，常用来演示电阻规律；铜的电阻率很小，所以用来做导线。'
  },
  ammeter: {
    category: 'meter',
    brief: '测量电流，必须串联在被测电路中，让电流从“0.6”或“3”接线柱流入、“−”接线柱流出。',
    detail: '电流表有三个接线柱：“−”为公共负接线柱，“0.6”与“3”分别对应 0–0.6 A 和 0–3 A 两个量程——量程由实际接线的接线柱决定。电流表内阻极小，理想情况下相当于一段导线，因此绝不能直接并在电源或用电器两端——那相当于短路，会烧坏电流表。读数时先确认接入的量程再读数。本实验中电流表按理想处理：不计内阻，但保留了极性与量程的教学规则。'
  },
  voltmeter: {
    category: 'meter',
    brief: '测量电压，必须并联在被测电路两端，由“3”或“15”接线柱选择量程。电压是两点之间的电势差。',
    detail: '电压表有三个接线柱：“−”为公共负接线柱，“3”与“15”分别对应 0–3 V 和 0–15 V 两个量程。电压表内阻极大，理想情况下相当于断路，因此可以直接并在电源两端测电源电压。若把电压表错误地串入电路，电路几乎不通，电压表读数接近电源电压。本实验中电压表按理想处理：内阻视为无穷大。'
  },
  galvanometer: {
    category: 'meter',
    brief: '检测微小电流的灵敏仪表，指针在刻度盘中央，由“G0”或“G1”接线柱选择灵敏度，可以显示电流方向。',
    detail: '灵敏电流计的零刻度在中央，电流从“G0”或“G1”接线柱流入时指针向右偏，反向时向左偏。它常用于判断有无电流以及电流方向，也是改装电流表、电压表的核心部件。'
  },
  diode: {
    category: 'semi',
    brief: '只允许电流单向通过的半导体元件：正向导通，反向截止。',
    detail: '二极管由 PN 结构成，电流只能从阳极（三角形一端）流向阴极（横线一端）。利用单向导电性可以整流、检波。本实验按理想二极管处理：正向视为导线，反向视为断开。'
  },
  led: {
    category: 'semi',
    brief: '正向导通时会发光的二极管。长脚为正极，使用时一般要串联限流电阻。',
    detail: '发光二极管（LED）把电能直接转化为光能，效率高、寿命长。它和二极管一样具有单向导电性，但正常工作电流较小，电流过大会烧毁，因此实际电路中通常串联一个限流电阻。'
  },
  bulb: {
    category: 'load',
    brief: '把电能转化为内能和光能的用电器。本元件把它简化为定值电阻（教学简化，界面已披露）。',
    detail: '普通灯泡元件按定值电阻处理，便于专心练习欧姆定律和串并联规律。它的“亮度”由实际功率 P = UI 决定：功率越大灯越亮。真实的灯丝电阻会随温度明显变化，想观察这种非线性请使用“小灯泡（非线性）”元件。'
  },
  'bulb-nl': {
    category: 'load',
    brief: '更接近真实白炽灯的灯泡：温度越高电阻越大，I-U 图像是一条弯曲的线。',
    detail: '真实白炽灯发光时灯丝温度可达两千多摄氏度，热态电阻约为冷态的十倍量级。因此它的电流不与电压成正比，伏安特性曲线向电压轴弯曲。本实验用经验模型 R(U) 复现这一形态（参数与假设见模型说明），用来纠正“灯泡是定值电阻”的直觉。'
  },
  fuse: {
    category: 'safety',
    brief: '电流超过熔断电流时自动熔断，切断电路，保护电源和用电器。',
    detail: '保险丝由电阻率较大、熔点较低的合金制成。电流过大时产生的热量使保险丝先熔断，电路变成断路，从而避免火灾或设备损坏。更换保险丝前必须先排除短路故障，绝不能用铜丝代替保险丝。'
  },
  bell: {
    category: 'load',
    brief: '电磁铁的应用：通电时铃锤敲击铃碗发声。本实验中简化为一个会“工作”的用电器。',
    detail: '真实电铃利用电磁铁反复吸合衔铁带动铃锤。本实验不模拟内部磁学过程，只把它当作一个用电器：电流达到工作电流时铃锤动作。电磁铁与继电器会在后续的“电与磁”实验中出现。'
  },
  motor: {
    category: 'load',
    brief: '把电能转化为机械能的装置。本实验中简化为一个会转动的用电器。',
    detail: '真实电动机利用磁场对电流的作用转动。本实验不模拟换向器与磁场，只保留“通电达到工作电流即转动”的表现。'
  }
};

// 电阻丝实验板可选规格：R = ρL/S
// 电阻率取值见 SOURCES.md（镍铬 ≈1.10e-6、康铜 ≈0.49e-6、锰铜 ≈0.47e-6、铜 ≈1.68e-8 Ω·m）
export const WIRE_SPECIMENS = [
  { id: 'nicr-0.5-0.2', label: '镍铬 0.5 m · 0.20 mm²', material: '镍铬', L: 0.5, S: 0.2e-6, rho: 1.10e-6, R: 2.75 },
  { id: 'nicr-1.0-0.2', label: '镍铬 1.0 m · 0.20 mm²', material: '镍铬', L: 1.0, S: 0.2e-6, rho: 1.10e-6, R: 5.5 },
  { id: 'nicr-1.0-0.4', label: '镍铬 1.0 m · 0.40 mm²', material: '镍铬', L: 1.0, S: 0.4e-6, rho: 1.10e-6, R: 2.75 },
  { id: 'const-1.0-0.2', label: '康铜 1.0 m · 0.20 mm²', material: '康铜', L: 1.0, S: 0.2e-6, rho: 0.49e-6, R: 2.45 },
  { id: 'mang-1.0-0.2', label: '锰铜 1.0 m · 0.20 mm²', material: '锰铜', L: 1.0, S: 0.2e-6, rho: 0.47e-6, R: 2.35 },
  { id: 'cu-1.0-0.2', label: '铜 1.0 m · 0.20 mm²', material: '铜', L: 1.0, S: 0.2e-6, rho: 1.68e-8, R: 0.084 }
];

// 概念讲解（右侧资料面板，简版/详细版）
export const CONCEPTS = {
  current: {
    title: '电流与电子流', en: 'CURRENT & ELECTRON FLOW',
    brief: '电荷的定向移动形成电流。物理学规定：正电荷定向移动的方向为电流方向。金属导体中实际移动的是带负电的自由电子，方向与电流方向相反。',
    detail: '在电源外部，电流从正极流向负极；在电源内部，电流从负极回到正极，形成闭合回路。要注意两个常见误解：① 开关闭合后电流“瞬间”形成——因为电场几乎同时在整个电路中建立，导线里本来就存在的自由电子一起开始定向移动，而不是从电源“跑”过来；② 自由电子定向移动的速率其实极慢（约 0.1 mm/s 量级），本实验中的流动动画是经过夸张的示意。电流的大小用安培（A）表示：1 A 表示每秒通过横截面的电荷为 1 C。'
  },
  voltage: {
    title: '电压与电势', en: 'VOLTAGE & POTENTIAL',
    brief: '电压是两点之间的电势差，是使电荷定向移动的原因。不能说“某一点有电压”，就像不能说“某一点有高度差”——高度差永远属于两个点。',
    detail: '电路中每个点都有一个“电势”，可以理解为“电的高度”。选定参考点（通常取电源负极）为 0 V 后，其他点的电势就有了确定数值；两点电势之差就是这两点间的电压。电源的作用类似水泵：在内部把正电荷从低电势“搬”到高电势，维持两极之间的电势差。用电器两端的电压越大，通过它的电流一般越大。电压的单位是伏特（V）。闭合开关后用“流向”按钮观察电流方向与电子定向移动方向，可以帮助理解电压是驱动电荷定向移动的原因。'
  },
  short: {
    title: '短路', en: 'SHORT CIRCUIT',
    brief: '电流不经过用电器，直接用导线连通电源两极，叫电源短路。此时电流很大，会损坏电源、导线，甚至引起火灾。',
    detail: '短路时回路中只剩导线的微小电阻，由 I = U / R，电流可以达到正常工作时的成百上千倍。本实验用 1 mΩ 的“理想导线残余电阻”让短路电流成为一个有限但巨大的数值，并在界面给出警告；接入保险丝时可以观察到熔断保护过程。用电器两端被导线直接连接叫“用电器被短接”，该用电器中几乎没有电流通过。'
  },
  open: {
    title: '断路', en: 'OPEN CIRCUIT',
    brief: '电路在某处断开（开关断开、导线松脱、灯丝烧断、保险丝熔断），电流就处处为零。',
    detail: '断路时电路中没有闭合路径，自由电子无法定向移动，所有用电器都停止工作。但断开点两侧之间可以存在电压——例如断开的开关两端，电压等于电源电压，这正是用电压表排查断路位置的原理。'
  },
};

// 预设演示电路
// components: [type, x, y, params?]；wires: [元件序号, 端子, 元件序号, 端子]
export const PRESETS = [
  {
    id: 'good-simple', group: 'good', title: '简单电路', en: 'SIMPLE CIRCUIT',
    brief: '电源、开关、小灯泡组成的完整回路。闭合开关，电流从正极出发经过灯泡回到负极。',
    detail: '一个完整电路需要电源、用电器、导线和开关。观察电流表读数（可自己串联一个电流表），改变电源电压，看看灯泡亮度和电流怎么变化。',
    components: [['student-supply', 120, 430, { voltage: 3 }], ['switch', 520, 280, {}], ['bulb', 940, 280, {}]],
    wires: [[0, 'pos', 1, 'a'], [1, 'b', 2, 'a'], [2, 'b', 0, 'neg']]
  },
  {
    id: 'good-series', group: 'good', title: '串联电路', en: 'SERIES CIRCUIT',
    brief: '两盏灯泡首尾相连。串联电路中电流处处相等，总电压等于各部分电压之和。',
    detail: '闭合开关后两灯同时亮。拧下（删除）其中一盏灯，另一盏也会熄灭——串联只有一条通路。可以自己加电压表分别测两盏灯的电压，验证 U = U₁ + U₂。',
    components: [['student-supply', 100, 470, { voltage: 4.5 }], ['switch', 420, 260, {}], ['bulb', 740, 260, {}], ['bulb', 1080, 260, {}]],
    wires: [[0, 'pos', 1, 'a'], [1, 'b', 2, 'a'], [2, 'b', 3, 'a'], [3, 'b', 0, 'neg']]
  },
  {
    id: 'good-parallel', group: 'good', title: '并联电路', en: 'PARALLEL CIRCUIT',
    brief: '两盏灯泡并列连接。并联电路中各支路电压相等，干路电流等于各支路电流之和。',
    detail: '断开一条支路，另一条支路的灯仍然亮——并联电路各支路互不影响。可以自己加电流表分别测干路和支路电流，验证 I = I₁ + I₂。',
    components: [['student-supply', 100, 470, { voltage: 3 }], ['switch', 400, 240, {}], ['bulb', 800, 170, {}], ['bulb', 800, 500, {}]],
    wires: [[0, 'pos', 1, 'a'], [1, 'b', 2, 'a'], [1, 'b', 3, 'a'], [2, 'b', 0, 'neg'], [3, 'b', 0, 'neg']]
  },
  {
    id: 'good-stair', group: 'good', title: '双控楼梯灯', en: 'TWO-WAY SWITCHING',
    brief: '两只单刀双掷开关控制同一盏灯：任意改变一只开关的状态，灯就翻转。',
    detail: '这是单刀双掷开关的经典应用。楼下开灯、上楼后关灯，两只开关都能独立控制。电路规律：两只开关掷向相同触点灯亮，不同则灭。点击开关可以切换掷向。',
    components: [['student-supply', 100, 470, { voltage: 3 }], ['spdt-switch', 430, 230, {}], ['spdt-switch', 850, 480, {}], ['bulb', 1200, 300, {}]],
    wires: [[0, 'pos', 1, 'com'], [1, 'x', 2, 'x'], [1, 'y', 2, 'y'], [2, 'com', 3, 'a'], [3, 'b', 0, 'neg']]
  },
  {
    id: 'good-volt-amp', group: 'good', title: '伏安法测电阻', en: 'MEASURE RESISTANCE',
    brief: '用电压表测电阻两端电压、电流表测通过电流，由 R = U / I 求电阻。',
    detail: '伏安法是测电阻的基本方法：电压表与电阻并联，电流表与电阻串联。移动滑动变阻器可以改变电阻两端电压，多测几组数据求平均值减小误差。打开“数据”面板可以记录多组 (U, I) 并描点。',
    components: [['student-supply', 240, 620, { voltage: 4.5 }], ['switch', 520, 200, {}], ['rheostat', 760, 200, { max: 50, x: 1 }], ['resistor', 1120, 200, { resistance: 10 }], ['ammeter', 620, 560, {}], ['voltmeter', 1120, 430, {}]],
    wires: [[0, 'pos', 1, 'a'], [1, 'b', 2, 'a'], [2, 'c', 3, 'b'], [3, 'a', 4, 'low'], [4, 'minus', 0, 'neg'], [5, 'minus', 3, 'a'], [5, 'low', 3, 'b']]
  },
  {
    id: 'good-ohm-law', group: 'good', title: '探究电流与电压的关系', en: 'OHM’S LAW INQUIRY',
    brief: '保持电阻不变，改变它两端的电压，看电流怎么变化：I 与 U 成正比。',
    detail: '这是欧姆定律的探究实验：控制电阻不变，用滑动变阻器改变定值电阻两端电压，记录多组电压与电流，在“数据”面板描出 I-U 图像——过原点的直线说明电流与电压成正比。换成非线性灯泡再试，图像会变弯。',
    components: [['student-supply', 240, 620, { voltage: 6 }], ['switch', 520, 200, {}], ['rheostat', 760, 200, { max: 100, x: 1 }], ['resistor', 1120, 200, { resistance: 5 }], ['ammeter', 620, 560, {}], ['voltmeter', 1120, 430, {}]],
    wires: [[0, 'pos', 1, 'a'], [1, 'b', 2, 'a'], [2, 'c', 3, 'b'], [3, 'a', 4, 'low'], [4, 'minus', 0, 'neg'], [5, 'minus', 3, 'a'], [5, 'low', 3, 'b']]
  },
  {
    id: 'good-wire-board', group: 'good', title: '探究影响电阻大小的因素', en: 'RESISTIVITY INQUIRY',
    brief: '更换不同材料、长度、横截面积的电阻丝，用电流表示数比较电阻大小。',
    detail: '控制变量法的经典实验：① 材料、横截面积相同，长度不同 → 长度越长电阻越大；② 材料、长度相同，横截面积不同 → 越粗电阻越小；③ 长度、横截面积相同，材料不同 → 电阻率不同。在右侧面板更换电阻丝规格，观察电流变化。',
    components: [['student-supply', 100, 500, { voltage: 3 }], ['switch', 420, 250, {}], ['wire-board', 700, 250, { specimen: 'nicr-1.0-0.2' }], ['ammeter', 1180, 250, {}]],
    wires: [[0, 'pos', 1, 'a'], [1, 'b', 2, 'a'], [2, 'b', 3, 'low'], [3, 'minus', 0, 'neg']]
  },
  {
    id: 'good-diode', group: 'good', title: '二极管与 LED 方向性', en: 'DIODE DIRECTION',
    brief: '二极管和发光二极管只允许电流单向通过。反接任意一个，整串电路断开。',
    detail: '闭合开关，LED 点亮；把二极管或 LED 反接（交换两端的导线），电路立刻断开。半导体元件的方向性在充电器和指示灯电路中无处不在。注意串联的定值电阻起限流保护作用。',
    components: [['student-supply', 100, 500, { voltage: 3 }], ['switch', 400, 250, {}], ['diode', 660, 250, {}], ['led', 920, 250, {}], ['resistor', 1200, 250, { resistance: 100 }]],
    wires: [[0, 'pos', 1, 'a'], [1, 'b', 2, 'an'], [2, 'ka', 3, 'an'], [3, 'ka', 4, 'a'], [4, 'b', 0, 'neg']]
  },
  {
    id: 'bad-short', group: 'bad', title: '电源短路', en: 'SHORT CIRCUIT',
    brief: '导线直接连接电源两极：电流极大，电源和导线会迅速发热，非常危险。',
    detail: '短路时回路几乎没有电阻，电流可以达到正常工作时的成百上千倍。本实验用 1 mΩ 的理想导线残余电阻把电流限制为有限值用于演示，现实中这样操作可能损坏电源、引发火灾。接入保险丝再试，可以看到熔断保护。',
    components: [['student-supply', 200, 420, { voltage: 3 }]],
    wires: [[0, 'pos', 0, 'neg']]
  },
  {
    id: 'bad-short-fuse', group: 'bad', title: '短路与保险丝熔断', en: 'FUSE BLOWS',
    brief: '在短路回路中串入保险丝：电流超过熔断电流的瞬间，保险丝熔断，电路被切断。',
    detail: '保险丝是电路的“安全卫士”。观察熔断前后电流的变化。排除故障（删掉短路导线）后，选中保险丝可以在右侧面板更换新保险丝。绝不能用铜丝代替保险丝。',
    components: [['student-supply', 200, 420, { voltage: 3 }], ['fuse', 750, 280, { rating: 2 }]],
    wires: [[0, 'pos', 1, 'a'], [1, 'b', 0, 'neg']]
  },
  {
    id: 'bad-open', group: 'bad', title: '断路', en: 'OPEN CIRCUIT',
    brief: '开关断开（或导线松脱）时电路成为断路，电流处处为零，用电器停止工作。',
    detail: '断路时电路中虽然没有电流，但断开点两侧之间存在电压。自己加一个电压表跨在断开的开关两端试试：读数约等于电源电压。这是用电压表排查断路故障的原理。',
    components: [['student-supply', 120, 430, { voltage: 3 }], ['switch', 520, 280, { closed: false }], ['bulb', 940, 280, {}]],
    wires: [[0, 'pos', 1, 'a'], [1, 'b', 2, 'a'], [2, 'b', 0, 'neg']]
  },
  {
    id: 'bad-ammeter-parallel', group: 'bad', title: '电流表并在灯泡两端', en: 'AMMETER IN PARALLEL',
    brief: '电流表内阻极小，并在灯泡两端相当于把灯泡短路——灯不亮，电流表可能烧坏。',
    detail: '这是使用电流表最常见的错误。电流表必须串联在被测电路中。观察电流表读数和灯泡状态，理解为什么“电流表相当于一段导线”。',
    components: [['student-supply', 100, 470, { voltage: 3 }], ['switch', 400, 240, {}], ['bulb', 780, 240, {}], ['ammeter', 780, 520, {}]],
    wires: [[0, 'pos', 1, 'a'], [1, 'b', 2, 'a'], [2, 'b', 0, 'neg'], [3, 'minus', 2, 'a'], [3, 'low', 2, 'b']]
  },
  {
    id: 'bad-voltmeter-series', group: 'bad', title: '电压表串入电路', en: 'VOLTMETER IN SERIES',
    brief: '电压表内阻极大，串入电路后电路几乎不通：灯泡不亮，电压表读数接近电源电压。',
    detail: '电压表必须并联在被测电路两端。这个错误接法恰好说明：理想电压表相当于断路。观察电压表读数为什么接近电源电压（几乎全部电压都“落”在电压表两端）。',
    components: [['student-supply', 100, 470, { voltage: 3 }], ['voltmeter', 470, 260, {}], ['bulb', 880, 260, {}]],
    wires: [[0, 'pos', 1, 'low'], [1, 'minus', 2, 'a'], [2, 'b', 0, 'neg']]
  },
  {
    id: 'bad-ammeter-reversed', group: 'bad', title: '电流表正负接反', en: 'REVERSED POLARITY',
    brief: '电流从“−”接线柱流入电流表，指针反向偏转（本实验用负读数表示）。',
    detail: '电表接线必须让电流“正进负出”。指针反打可能损坏指针式电表。改正方法：交换电流表两根导线的位置。灵敏电流计指针居中，可以利用偏转方向判断电流方向。',
    components: [['student-supply', 100, 470, { voltage: 3 }], ['ammeter', 480, 260, {}], ['bulb', 900, 260, {}]],
    wires: [[0, 'pos', 1, 'minus'], [1, 'low', 2, 'a'], [2, 'b', 0, 'neg']]
  },
  {
    id: 'bad-messy', group: 'bad', title: '用电器被短接', en: 'LOAD SHORTED',
    brief: '一根导线直接把灯泡两端连了起来：电流“抄近路”走导线，灯泡几乎不亮。',
    detail: '用电器被短接与电源短路不同：电源没有被直接短接，电流仍然受其他元件限制，但被短接的用电器中没有电流。排查“灯为什么不亮”时，先检查有没有多余导线造成短接。',
    components: [['student-supply', 100, 470, { voltage: 3 }], ['switch', 400, 240, {}], ['bulb', 780, 240, {}]],
    wires: [[0, 'pos', 1, 'a'], [1, 'b', 2, 'a'], [2, 'b', 0, 'neg'], [2, 'a', 2, 'b']]
  }
];

export function findPreset(id) {
  return PRESETS.find(p => p.id === id) ?? null;
}

export function catalogEntry(type) {
  return CATALOG[type] ?? null;
}

export function componentLabel(type) {
  return DEFS[type]?.label ?? type;
}

// 把预设规格换算为台面元件实例（含 wire-board 的电阻换算）
export function instantiatePreset(preset, makeId) {
  const components = preset.components.map((entry, i) => {
    const [type, x, y, params] = entry;
    // 预设只给出要覆盖的参数，其余落在元件默认值上（否则空 params 会丢掉默认状态，如开关默认闭合）
    const comp = { id: makeId('p', i), type, x, y, params: { ...defaultParams(type), ...structuredClone(params ?? {}) } };
    if (type === 'wire-board') {
      const spec = WIRE_SPECIMENS.find(s => s.id === comp.params.specimen) ?? WIRE_SPECIMENS[1];
      comp.resistance = spec.R;
    }
    return comp;
  });
  const wires = preset.wires.map(([ai, at, bi, bt], i) => ({
    id: makeId('w', i),
    a: { comp: components[ai].id, term: at },
    b: { comp: components[bi].id, term: bt }
  }));
  return { components, wires };
}
