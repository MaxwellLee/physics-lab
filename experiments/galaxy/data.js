export const OBJECTS = {
  galaxy: {
    id: 'galaxy', name: '银河系', en: 'MILKY WAY', code: 'MW', type: '棒旋星系 · BARRED SPIRAL GALAXY', mode: 'galaxy',
    summary: '太阳系所在的棒旋星系。明亮恒星盘之外还有更大的暗物质晕；我们从内部观测它，因此画面是依据观测资料完成的三维科学重建。',
    metrics: [['直径', '约 10 万光年'], ['恒星数量', '约 1000–4000 亿颗'], ['太阳位置', '猎户臂支脉'], ['银河年', '约 2.3 亿年']],
    facts: ['中央由棒状恒星结构和密集核球组成。', '太阳系距离银河中心约 2.6 万光年。', '银河盘中的恒星、气体和尘埃绕银河中心运动。'],
    note: '银河系远景不是从外部拍摄的照片。恒星数量、亮度和盘厚均经过抽样与视觉压缩。',
    source: 'https://science.nasa.gov/universe/galaxies/', sourceLabel: 'NASA · Galaxies'
  },
  'sagittarius-a': {
    id: 'sagittarius-a', name: '人马座 A*', en: 'SAGITTARIUS A*', code: 'Sgr A*', type: '超大质量黑洞 · SUPERMASSIVE BLACK HOLE', mode: 'blackhole',
    summary: '位于银河系动力学中心的超大质量黑洞。它本身不发光，天文学家通过周围恒星的高速轨道和多波段辐射确认其质量与位置。',
    metrics: [['质量', '约 400 万个太阳'], ['距地球', '约 2.6 万光年'], ['位置', '银河系中心'], ['状态', '相对平静']],
    facts: ['事件视界以内的光无法逃逸。', '周围恒星轨道是测定其质量的重要证据。', '它不是虫洞，也不会像吸尘器一样吞噬整座银河系。'],
    note: '近景为基于广义相对论特征的教学可视化，并非直接光学照片；发光盘表示被加热的周围物质。',
    source: 'https://science.nasa.gov/universe/black-holes/types/', sourceLabel: 'NASA · Black Hole Types'
  },
  'solar-system': {
    id: 'solar-system', name: '太阳系', en: 'SOLAR SYSTEM', code: 'SOL', type: '行星系统 · PLANETARY SYSTEM', mode: 'solar',
    summary: '以太阳为中心的行星系统，包括八大行星、矮行星、卫星、小行星和彗星等。太阳系位于银河系猎户臂支脉。',
    metrics: [['年龄', '约 46 亿年'], ['行星', '8 颗'], ['银河位置', '猎户臂支脉'], ['银河公转', '约 2.3 亿年/周']],
    facts: ['八大行星由近到远依次为水星、金星、地球、火星、木星、土星、天王星、海王星。', '太阳包含太阳系超过 99% 的质量。', '行星当前位置由 J2000 近似轨道参数推进。'],
    note: '行星半径和轨道间距使用不同的教学压缩比例；资料卡数值为真实物理量。',
    source: 'https://science.nasa.gov/solar-system/solar-system-facts/', sourceLabel: 'NASA · Solar System Facts'
  },
  sun: {
    id: 'sun', name: '太阳', en: 'SUN', code: '☉', type: 'G2V 型恒星 · YELLOW DWARF', mode: 'solar',
    summary: '太阳系的中心恒星，主要由氢和氦组成。核心核聚变把氢转化为氦，并释放维持地球生命所需的光和热。',
    metrics: [['直径', '约 139 万 km'], ['质量', '1.989 × 10³⁰ kg'], ['年龄', '约 46 亿年'], ['表面温度', '约 5500 ℃']],
    facts: ['太阳是一颗处于主序阶段的 G2V 型恒星。', '光从太阳到达地球平均需要约 8 分 20 秒。', '太阳活动会影响行星际空间和地球空间天气。'],
    note: '太阳表面动画是光球层对流颗粒的程序化表现，不是静态摄影贴图。',
    source: 'https://science.nasa.gov/sun/facts/', sourceLabel: 'NASA · Sun Facts'
  },
  moon: {
    id: 'moon', name: '月球', en: 'MOON', code: '☾', type: '地球天然卫星 · NATURAL SATELLITE', mode: 'earth',
    summary: '地球唯一的天然卫星。月球自转周期与绕地公转周期接近，因此长期以近似同一面朝向地球。',
    metrics: [['平均半径', '1737.4 km'], ['平均距离', '384,400 km'], ['恒星月', '27.3 天'], ['表面重力', '1.62 m/s²']],
    facts: ['月球轨道相对黄道面倾斜约 5.1°。', '月球引力是地球潮汐的主要来源之一。', '当前主流理论认为月球源于早期巨大撞击后的物质聚合。'],
    note: '月面纹理来自 NASA LRO/LROC 全球影像；地月距离与大小使用不同教学比例。',
    source: 'https://science.nasa.gov/moon/facts/', sourceLabel: 'NASA · Moon Facts'
  },
  'alpha-centauri': {
    id: 'alpha-centauri', name: '南门二系统', en: 'ALPHA CENTAURI', code: 'α Cen', type: '三星系统 · TRIPLE STAR SYSTEM', mode: 'system', color: 0xffe5b0,
    summary: '距离太阳最近的恒星系统，由南门二 A、南门二 B 和更远的比邻星组成；比邻星是距离太阳最近的单颗恒星。',
    metrics: [['距离', '约 4.37 光年'], ['成员', '三颗恒星'], ['最近成员', '比邻星'], ['已知行星', '比邻星周围']],
    facts: ['南门二 A、B 是一对绕共同质心运行的类太阳恒星。', '比邻星是一颗活动强烈的红矮星。', '系外行星表面目前没有直接影像。'],
    note: '恒星间距和行星外观为教学比例；系统结构依据观测资料简化。',
    source: 'https://science.nasa.gov/sun/facts/', sourceLabel: 'NASA · Sun Facts'
  },
  sirius: {
    id: 'sirius', name: '天狼星系统', en: 'SIRIUS', code: 'α CMa', type: '双星系统 · BINARY STAR SYSTEM', mode: 'system', color: 0xcde8ff,
    summary: '夜空中视星等最亮的恒星系统，由白色主序星天狼星 A 和白矮星天狼星 B 组成。',
    metrics: [['距离', '约 8.6 光年'], ['成员', '双星'], ['主星类型', 'A 型主序星'], ['伴星', '白矮星']],
    facts: ['看起来明亮既因为本身光度较高，也因为距离太阳较近。', '天狼星 B 是致密的恒星遗骸。'],
    note: '双星尺度与轨道周期为示意表现。',
    source: 'https://science.nasa.gov/universe/stars/types/', sourceLabel: 'NASA · Star Types'
  },
  'trappist-1': {
    id: 'trappist-1', name: 'TRAPPIST-1', en: 'TRAPPIST-1', code: '2MASS J2306', type: '红矮星行星系统 · EXOPLANET SYSTEM', mode: 'system', color: 0xff7755,
    summary: '一颗超冷红矮星及其七颗已知、大小接近地球的行星组成的紧凑系统，是研究岩质系外行星的重要目标。',
    metrics: [['距离', '约 40 光年'], ['恒星类型', '超冷红矮星'], ['已知行星', '7 颗'], ['行星尺度', '接近地球']],
    facts: ['七颗行星的轨道都比水星轨道紧凑得多。', '位于宜居带不等于已确认宜居。', '目前无法直接看清这些行星的表面。'],
    note: '行星颜色仅用于区分，不能视为真实地表纹理。',
    source: 'https://science.nasa.gov/universe/exoplanets/trappist-1/', sourceLabel: 'NASA · TRAPPIST-1'
  },
  betelgeuse: {
    id: 'betelgeuse', name: '参宿四', en: 'BETELGEUSE', code: 'α Ori', type: '红超巨星 · RED SUPERGIANT', mode: 'system', color: 0xff7d45,
    summary: '猎户座中醒目的红超巨星，半径远大于太阳，已经进入恒星演化晚期。它未来会发生超新星爆发，但无法准确预测时间。',
    metrics: [['距离', '约数百光年'], ['类型', '红超巨星'], ['变光', '半规则变星'], ['演化阶段', '晚期']],
    facts: ['参宿四的外层大气和尘埃活动会影响其亮度。', '“即将爆炸”在天文学语境下可能仍是很长时间。'],
    note: '恒星半径存在观测不确定性，画面不用于尺寸测量。',
    source: 'https://science.nasa.gov/universe/stars/', sourceLabel: 'NASA · Stars'
  },
  vega: {
    id: 'vega', name: '织女星', en: 'VEGA', code: 'α Lyr', type: 'A 型主序星 · MAIN-SEQUENCE STAR', mode: 'system', color: 0xd8e8ff,
    summary: '距离太阳约 25 光年的明亮 A 型主序星，是夏季大三角成员之一，也是测光史上的重要基准星。',
    metrics: [['距离', '约 25 光年'], ['类型', 'A0V'], ['颜色', '蓝白色'], ['星座', '天琴座']],
    facts: ['织女星自转很快，形状并非完美球形。', '其周围观测到尘埃盘。'],
    note: '恒星形状和尘埃盘为简化表现。',
    source: 'https://science.nasa.gov/universe/stars/', sourceLabel: 'NASA · Stars'
  },
  polaris: {
    id: 'polaris', name: '北极星', en: 'POLARIS', code: 'α UMi', type: '多星系统 · CEPHEID SYSTEM', mode: 'system', color: 0xffefcf,
    summary: '接近北天极的多星系统，主星是一颗造父变星。地轴指向会随岁差缓慢变化，因此北极星并非永远位于北天极附近。',
    metrics: [['距离', '约 430 光年'], ['主星', '造父变星'], ['系统', '多星'], ['星座', '小熊座']],
    facts: ['北极星高度可近似反映北半球观测者的地理纬度。', '它并不是夜空中最亮的恒星。'],
    note: '伴星距离采用教学比例。',
    source: 'https://science.nasa.gov/universe/stars/', sourceLabel: 'NASA · Stars'
  }
};

export const PLANETS = [
  {id:'mercury',name:'水星',en:'MERCURY',code:'☿',type:'岩质行星 · TERRESTRIAL PLANET',texture:'./textures/mercury.jpg',color:0xa9a298,radius:2439.7,visual:0.78,a:0.387,e:0.2056,i:7.005,period:87.969,m0:174.796,rotation:1407.6,tilt:0.034,
   summary:'距离太阳最近、也是八大行星中最小的行星。表面布满撞击坑，昼夜温差极大。',metrics:[['平均半径','2439.7 km'],['距太阳','0.387 AU'],['公转周期','88.0 天'],['自转周期','58.6 天']],facts:['拥有巨大的铁质核心。','几乎没有能保温的浓厚大气。','贴图来自 MESSENGER 全球彩色拼接数据。'],source:'https://science.nasa.gov/mercury/',sourceLabel:'NASA · Mercury'},
  {id:'venus',name:'金星',en:'VENUS',code:'♀',type:'岩质行星 · TERRESTRIAL PLANET',texture:'./textures/venus.jpg',color:0xd7a66b,radius:6051.8,visual:1.08,a:0.723,e:0.0068,i:3.395,period:224.701,m0:50.115,rotation:-5832.5,tilt:177.36,
   summary:'大小与地球相近，但被浓厚二氧化碳大气和硫酸云覆盖，是太阳系表面温度最高的行星。',metrics:[['平均半径','6051.8 km'],['距太阳','0.723 AU'],['公转周期','224.7 天'],['表面温度','约 465 ℃']],facts:['金星自转方向与大多数行星相反。','表面贴图来自 Magellan 雷达数据，肉眼无法穿透云层看到该表面。'],source:'https://science.nasa.gov/venus/',sourceLabel:'NASA · Venus'},
  {id:'earth',name:'地球',en:'EARTH',code:'⊕',type:'岩质行星 · TERRESTRIAL PLANET',texture:'../../assets/textures/earth_2048.jpg',color:0x4c96c9,radius:6371,visual:1.14,a:1,e:0.0167,i:0,period:365.256,m0:357.517,rotation:23.934,tilt:23.44,
   summary:'太阳系第三颗行星，目前唯一已知存在生命的天体。液态海洋覆盖大部分表面，并拥有活跃的板块构造和大气循环。',metrics:[['平均半径','6371 km'],['距太阳','1 AU'],['公转周期','365.256 天'],['天然卫星','月球']],facts:['地轴倾角约 23.44°，是季节变化的重要原因。','磁场与大气共同帮助地表维持适宜环境。','点击地球进入地月系统。'],source:'https://science.nasa.gov/earth/facts/',sourceLabel:'NASA · Earth'},
  {id:'mars',name:'火星',en:'MARS',code:'♂',type:'岩质行星 · TERRESTRIAL PLANET',texture:'./textures/mars.jpg',color:0xb85c35,radius:3389.5,visual:0.9,a:1.524,e:0.0934,i:1.85,period:686.98,m0:19.373,rotation:24.623,tilt:25.19,
   summary:'寒冷、干燥的岩质行星，表面含丰富氧化铁而呈红色。拥有太阳系最大的火山奥林帕斯山。',metrics:[['平均半径','3389.5 km'],['距太阳','1.524 AU'],['公转周期','687 天'],['卫星','火卫一、火卫二']],facts:['存在古代河流、湖泊和更湿润气候的证据。','极冠主要由水冰和二氧化碳冰组成。'],source:'https://science.nasa.gov/mars/',sourceLabel:'NASA · Mars'},
  {id:'jupiter',name:'木星',en:'JUPITER',code:'♃',type:'气态巨行星 · GAS GIANT',texture:'./textures/jupiter.jpg',color:0xd7aa80,radius:69911,visual:3.05,a:5.203,e:0.0489,i:1.303,period:4332.59,m0:20.02,rotation:9.925,tilt:3.13,
   summary:'太阳系最大的行星，主要由氢和氦组成。大红斑是持续已久的巨大风暴系统。',metrics:[['平均半径','69,911 km'],['距太阳','5.203 AU'],['公转周期','11.86 年'],['自转周期','约 9.9 小时']],facts:['强大的磁场形成庞大磁层。','伽利略卫星包括木卫一、木卫二、木卫三和木卫四。','贴图由 Voyager 影像制成。'],source:'https://science.nasa.gov/jupiter/',sourceLabel:'NASA · Jupiter'},
  {id:'saturn',name:'土星',en:'SATURN',code:'♄',type:'气态巨行星 · GAS GIANT',texture:'./textures/saturn.jpg',color:0xd9c28c,radius:58232,visual:2.7,a:9.537,e:0.0565,i:2.485,period:10759.22,m0:317.02,rotation:10.656,tilt:26.73,
   summary:'拥有太阳系最醒目的行星环。环主要由无数水冰颗粒和少量岩石物质组成。',metrics:[['平均半径','58,232 km'],['距太阳','9.537 AU'],['公转周期','29.45 年'],['自转周期','约 10.7 小时']],facts:['平均密度低于液态水。','土卫六拥有浓厚大气，土卫二存在向太空喷射的冰羽流。'],source:'https://science.nasa.gov/saturn/',sourceLabel:'NASA · Saturn'},
  {id:'uranus',name:'天王星',en:'URANUS',code:'♅',type:'冰巨行星 · ICE GIANT',texture:null,color:0x92d7df,radius:25362,visual:1.86,a:19.191,e:0.0472,i:0.773,period:30688.5,m0:142.2386,rotation:-17.24,tilt:97.77,
   summary:'一颗蓝绿色冰巨行星，自转轴几乎躺在轨道平面内，像侧卧着绕太阳运行。',metrics:[['平均半径','25,362 km'],['距太阳','19.19 AU'],['公转周期','84 年'],['轴倾角','97.77°']],facts:['蓝绿色主要来自大气中的甲烷吸收红光。','拥有暗淡的环系统。','可见光下整体较平滑，画面不添加虚构地表细节。'],source:'https://science.nasa.gov/uranus/',sourceLabel:'NASA · Uranus'},
  {id:'neptune',name:'海王星',en:'NEPTUNE',code:'♆',type:'冰巨行星 · ICE GIANT',texture:'./textures/neptune.jpg',color:0x386bc4,radius:24622,visual:1.82,a:30.069,e:0.0086,i:1.77,period:60182,m0:256.228,rotation:16.11,tilt:28.32,
   summary:'距离太阳最远的八大行星。大气中存在太阳系内极高速的风，并会形成和消散大型暗斑。',metrics:[['平均半径','24,622 km'],['距太阳','30.07 AU'],['公转周期','164.8 年'],['自转周期','约 16.1 小时']],facts:['海王星首先通过数学预测被发现，随后才被望远镜确认。','蓝色来自甲烷吸收与大气散射；云层图为基于观测的全球视觉重建。'],source:'https://science.nasa.gov/neptune/',sourceLabel:'NASA · Neptune'}
];

for (const planet of PLANETS) {
  OBJECTS[planet.id] = {...planet, mode: planet.id === 'earth' ? 'earth' : 'solar', note: '行星大小和轨道间距采用教学比例；资料数值为真实物理量。'};
}

export const FEATURED_IDS = ['solar-system','sagittarius-a','earth','jupiter','saturn'];
export const SYSTEM_IDS = ['alpha-centauri','sirius','trappist-1','betelgeuse','vega','polaris'];
export const SEARCH_IDS = ['galaxy','sagittarius-a','solar-system','sun',...PLANETS.map(p=>p.id),'moon',...SYSTEM_IDS];
