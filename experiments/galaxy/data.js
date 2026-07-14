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
    facts: ['画面中央是黑洞阴影，不是事件视界本身；引力透镜使阴影看起来更大。', '吸积盘远侧的光被弯曲到阴影上方和下方；靠近阴影的细环是多重光子环影像。', '朝向观察者运动的一侧因相对论性多普勒束射而更亮、更偏白。'],
    note: '近景采用定性正确的简化光学模型，不是完整广义相对论光线追踪，也不是人马座 A* 的直接光学照片。其吸积盘亮度被刻意增强；真实的人马座 A* 目前相对平静。',
    source: 'https://science.nasa.gov/universe/black-holes/anatomy/', sourceLabel: 'NASA · Anatomy of a Black Hole'
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
    details: [
      {title:'轨道与同步自转',body:'月球约 27.3 天绕地球一周，也以近似相同周期自转，因此从地球长期只能看到接近同一半球。朔望月约为 29.5 天，因为地球同时还在绕太阳公转。'},
      {title:'表面与内部',body:'月面保存了撞击坑、玄武岩月海、高地和极区永久阴影坑中的水冰记录。它具有地壳、地幔和较小的核心，但没有像地球那样稠密的大气。'},
      {title:'形成与探索',body:'主流巨大撞击模型认为，早期地球与大型天体碰撞后的碎屑聚合形成月球。自无人探测器和阿波罗任务以来，月球岩样与轨道遥感持续帮助研究太阳系早期历史。'}
    ],
    note: '月面纹理来自 NASA LRO/LROC 全球影像；地月距离与大小使用不同教学比例。',
    source: 'https://science.nasa.gov/moon/facts/', sourceLabel: 'NASA · Moon Facts'
  },
  'alpha-centauri': {
    id: 'alpha-centauri', name: '南门二系统', en: 'ALPHA CENTAURI', code: 'α Cen', type: '三星与行星系统 · TRIPLE STAR SYSTEM', mode: 'system', color: 0xffe5b0, guideLabel: '轨道',
    summary: '距离太阳最近的恒星系统，由南门二 A、南门二 B 和更远的比邻星组成；比邻星是距离太阳最近的单颗恒星。',
    metrics: [['距离', '约 4.37 光年'], ['成员', '三颗恒星'], ['最近成员', '比邻星'], ['确认行星', '比邻星 b、d']],
    facts: ['南门二 A、B 是一对绕共同质心运行的类太阳恒星。', '模型展示比邻星 b 与 d；更远的比邻星 c 仍按候选体处理，没有画成确认行星。', '系外行星表面目前没有直接影像，颜色仅表达类别。'],
    details: [{title:'三星架构',body:'南门二 A 与 B 构成较紧密的双星，比邻星则远离这对主星。模型大幅压缩了三颗恒星之间的真实距离，重点展示系统的层级结构。'},{title:'已确认与候选行星',body:'NASA 系外行星档案将比邻星 b、d 列为确认行星；比邻星 c 和南门二 A 周围的信号仍按候选体处理，因此模型只绘制 b、d。'}],
    note: '恒星间距和行星外观为教学比例；系统结构依据观测资料简化。',
    source: 'https://exoplanetarchive.ipac.caltech.edu/overview/Proxima', sourceLabel: 'NASA Exoplanet Archive · Proxima'
  },
  sirius: {
    id: 'sirius', name: '天狼星系统', en: 'SIRIUS', code: 'α CMa', type: '双星系统 · BINARY STAR SYSTEM', mode: 'system', color: 0xcde8ff, guideLabel: '双星轨道',
    summary: '夜空中视星等最亮的恒星系统，由白色主序星天狼星 A 和白矮星天狼星 B 组成。',
    metrics: [['距离', '约 8.6 光年'], ['成员', '双星'], ['主星类型', 'A 型主序星'], ['伴星', '白矮星']],
    facts: ['看起来明亮既因为本身光度较高，也因为距离太阳较近。', '天狼星 B 是致密的恒星遗骸。'],
    details: [{title:'双星结构',body:'天狼星 A 与天狼星 B 绕共同质心运行。A 是明亮的主序星，B 则是一颗半径很小、密度极高的白矮星，是恒星演化后留下的遗骸。'},{title:'为何没有画行星',body:'当前模型没有为天狼星添加未经确认的行星；画面重点转为双星轨道、两颗恒星的尺寸类别和演化差异。'}],
    note: '双星尺度与轨道周期为示意表现。',
    source: 'https://science.nasa.gov/universe/stars/types/', sourceLabel: 'NASA · Star Types'
  },
  'trappist-1': {
    id: 'trappist-1', name: 'TRAPPIST-1', en: 'TRAPPIST-1', code: '2MASS J2306', type: '红矮星行星系统 · EXOPLANET SYSTEM', mode: 'system', color: 0xff7755, guideLabel: '轨道',
    summary: '一颗超冷红矮星及其七颗已知、大小接近地球的行星组成的紧凑系统，是研究岩质系外行星的重要目标。',
    metrics: [['距离', '约 40 光年'], ['恒星类型', '超冷红矮星'], ['已知行星', '7 颗'], ['行星尺度', '接近地球']],
    facts: ['七颗行星的轨道都比水星轨道紧凑得多。', '位于宜居带不等于已确认宜居。', '目前无法直接看清这些行星的表面。'],
    details: [{title:'紧凑共振链',body:'七颗行星从 b 到 h 依次排列，公转周期约从 1.5 天延伸到 20 天，轨道全部位于水星轨道以内。相邻行星之间形成接近整数比的共振链。'},{title:'宜居带不等于有生命',body:'e、f、g 位于传统宜居带，但是否保有大气、液态水和适宜气候仍需观测。行星颜色是艺术化区分，不是直接拍到的表面。'}],
    note: '行星颜色仅用于区分，不能视为真实地表纹理。',
    source: 'https://science.nasa.gov/universe/exoplanets/trappist-1/', sourceLabel: 'NASA · TRAPPIST-1'
  },
  betelgeuse: {
    id: 'betelgeuse', name: '参宿四', en: 'BETELGEUSE', code: 'α Ori', type: '红超巨星 · RED SUPERGIANT', mode: 'system', color: 0xff7d45, guideLabel: '外层壳',
    summary: '猎户座中醒目的红超巨星，半径远大于太阳，已经进入恒星演化晚期。它未来会发生超新星爆发，但无法准确预测时间。',
    metrics: [['距离', '约数百光年'], ['类型', '红超巨星'], ['变光', '半规则变星'], ['演化阶段', '晚期']],
    facts: ['参宿四的外层大气和尘埃活动会影响其亮度。', '“即将爆炸”在天文学语境下可能仍是很长时间。'],
    details: [{title:'膨胀与质量流失',body:'参宿四已经离开主序阶段，外层大气极度膨胀并不断向外抛射物质。模型中的多层结构表示扩展大气和尘埃壳，并非行星轨道。'},{title:'未来演化',body:'它最终会发生核心坍缩超新星，但现有观测无法给出人类日历尺度上的准确爆发日期。'}],
    note: '恒星半径存在观测不确定性，画面不用于尺寸测量。',
    source: 'https://science.nasa.gov/universe/stars/', sourceLabel: 'NASA · Stars'
  },
  vega: {
    id: 'vega', name: '织女星', en: 'VEGA', code: 'α Lyr', type: 'A 型主序星 · MAIN-SEQUENCE STAR', mode: 'system', color: 0xd8e8ff, guideLabel: '尘埃盘',
    summary: '距离太阳约 25 光年的明亮 A 型主序星，是夏季大三角成员之一，也是测光史上的重要基准星。',
    metrics: [['距离', '约 25 光年'], ['类型', 'A0V'], ['颜色', '蓝白色'], ['星座', '天琴座']],
    facts: ['织女星自转很快，形状并非完美球形。', '其周围观测到尘埃盘。'],
    details: [{title:'快速自转',body:'织女星自转很快，赤道方向鼓起，并产生重力昏暗效应：不同纬度的表面温度和亮度并不相同。'},{title:'尘埃盘与行星线索',body:'Hubble 与 Webb 看到范围很大的平滑尘埃盘，但没有发现清晰的行星扰动结构。模型因此绘制尘埃盘，而不虚构已确认行星。'}],
    note: '恒星形状和尘埃盘为简化表现。',
    source: 'https://science.nasa.gov/missions/hubble/nasas-hubble-webb-probe-surprisingly-smooth-disk-around-vega/', sourceLabel: 'NASA · Vega Debris Disk'
  },
  polaris: {
    id: 'polaris', name: '北极星', en: 'POLARIS', code: 'α UMi', type: '多星系统 · CEPHEID SYSTEM', mode: 'system', color: 0xffefcf, guideLabel: '伴星轨道',
    summary: '接近北天极的多星系统，主星是一颗造父变星。地轴指向会随岁差缓慢变化，因此北极星并非永远位于北天极附近。',
    metrics: [['距离', '约 430 光年'], ['主星', '造父变星'], ['系统', '多星'], ['星座', '小熊座']],
    facts: ['北极星高度可近似反映北半球观测者的地理纬度。', '它并不是夜空中最亮的恒星。'],
    details: [{title:'多星系统',body:'北极星不是单独一颗恒星。主星北极星 Aa 是造父变星，附近有近伴星 Ab，系统中还有更远的北极星 B；模型分别显示并标注这三颗恒星。'},{title:'导航与造父变星',body:'北极星目前靠近北天极，因此在北半球可辅助判断方向。主星亮度随脉动变化，造父变星的周期—光度关系也是测量宇宙距离的重要工具。'}],
    note: '伴星距离采用教学比例。',
    source: 'https://science.nasa.gov/universe/stars/', sourceLabel: 'NASA · Stars'
  }
};

export const PLANETS = [
  {id:'mercury',name:'水星',en:'MERCURY',code:'☿',type:'岩质行星 · TERRESTRIAL PLANET',texture:'./textures/mercury.jpg',color:0xa9a298,radius:2439.7,visual:0.78,a:0.387,e:0.2056,i:7.005,period:87.969,m0:174.796,rotation:1407.6,tilt:0.034,
   summary:'距离太阳最近、也是八大行星中最小的行星。表面布满撞击坑，昼夜温差极大。',metrics:[['平均半径','2439.7 km'],['距太阳','0.387 AU'],['公转周期','88.0 天'],['自转周期','58.6 天']],facts:['拥有巨大的铁质核心。','几乎没有能保温的浓厚大气。','贴图来自 MESSENGER 全球彩色拼接数据。'],details:[{title:'内部与地貌',body:'水星密度仅次于地球，金属核心约占行星半径的 85%。表面类似月球，遍布撞击坑、古老平原和因内部冷却收缩形成的长距离断崖。'},{title:'温度与外逸层',body:'日面温度最高约 430 ℃，夜面可降至约 −180 ℃。它没有稠密大气，只有由太阳风和微流星撞击补充的极稀薄外逸层；永久阴影的极区坑内仍可保存水冰。'},{title:'轨道与自转',body:'水星以约 88 天绕太阳一周，自转一周约 59 天，处于 3∶2 自旋—轨道共振；一个完整昼夜循环约等于 176 个地球日。'}],source:'https://science.nasa.gov/mercury/facts/',sourceLabel:'NASA · Mercury Facts'},
  {id:'venus',name:'金星',en:'VENUS',code:'♀',type:'岩质行星 · TERRESTRIAL PLANET',texture:'./textures/venus.jpg',color:0xd7a66b,radius:6051.8,visual:1.08,a:0.723,e:0.0068,i:3.395,period:224.701,m0:50.115,rotation:-5832.5,tilt:177.36,
   summary:'大小与地球相近，但被浓厚二氧化碳大气和硫酸云覆盖，是太阳系表面温度最高的行星。',metrics:[['平均半径','6051.8 km'],['距太阳','0.723 AU'],['公转周期','224.7 天'],['表面温度','约 465 ℃']],facts:['金星自转方向与大多数行星相反。','表面贴图来自 Magellan 雷达数据，肉眼无法穿透云层看到该表面。'],details:[{title:'大气与温室效应',body:'金星大气主要由二氧化碳组成，云层含硫酸液滴，地表气压约为地球的 90 多倍。强烈的失控温室效应使平均地表温度约 465 ℃，比更靠近太阳的水星还热。'},{title:'地表与火山活动',body:'稠密云层遮住可见光下的地表，麦哲伦号使用雷达绘制了广阔火山平原、山地和大量火山结构。现有观测仍在研究金星今天是否保持活跃火山活动。'},{title:'缓慢逆向自转',body:'金星约 225 天绕太阳一周，却约 243 天才自转一周，而且方向与多数行星相反。它没有天然卫星和行星环。'}],source:'https://science.nasa.gov/venus/venus-facts/',sourceLabel:'NASA · Venus Facts'},
  {id:'earth',name:'地球',en:'EARTH',code:'⊕',type:'岩质行星 · TERRESTRIAL PLANET',texture:'../../assets/textures/earth_2048.jpg',color:0x4c96c9,radius:6371,visual:1.14,a:1,e:0.0167,i:0,period:365.256,m0:357.517,rotation:23.934,tilt:23.44,
   summary:'太阳系第三颗行星，目前唯一已知存在生命的天体。液态海洋覆盖大部分表面，并拥有活跃的板块构造和大气循环。',metrics:[['平均半径','6371 km'],['距太阳','1 AU'],['公转周期','365.256 天'],['天然卫星','月球']],facts:['地轴倾角约 23.44°，是季节变化的重要原因。','磁场与大气共同帮助地表维持适宜环境。','点击地球进入地月系统。'],details:[{title:'海洋与活动地表',body:'海洋覆盖地球约 71% 的表面。地壳分成不断运动的板块，板块构造持续塑造山脉、海沟、火山和大陆，也参与长期碳循环。'},{title:'大气与磁场',body:'近地面干燥空气以氮和氧为主，水汽驱动天气和水循环。由液态外核运动产生的全球磁场与大气一起削弱太阳风和高能粒子对地表环境的影响。'},{title:'生命与地月系统',body:'地球是目前唯一确认存在生命的天体。月球不仅造成显著潮汐，也在长期尺度上帮助稳定地轴姿态；地月系统共同绕二者质心运动。'}],source:'https://science.nasa.gov/earth/facts/',sourceLabel:'NASA · Earth Facts'},
  {id:'mars',name:'火星',en:'MARS',code:'♂',type:'岩质行星 · TERRESTRIAL PLANET',texture:'./textures/mars.jpg',color:0xb85c35,radius:3389.5,visual:0.9,a:1.524,e:0.0934,i:1.85,period:686.98,m0:19.373,rotation:24.623,tilt:25.19,
   summary:'寒冷、干燥的岩质行星，表面含丰富氧化铁而呈红色。拥有太阳系最大的火山奥林帕斯山。',metrics:[['平均半径','3389.5 km'],['距太阳','1.524 AU'],['公转周期','687 天'],['卫星','火卫一、火卫二']],facts:['存在古代河流、湖泊和更湿润气候的证据。','极冠主要由水冰和二氧化碳冰组成。'],details:[{title:'地貌与古代水环境',body:'火星拥有奥林帕斯山、巨大的水手谷和密布陨石坑的高地。干涸河谷、三角洲和沉积岩表明，远古火星曾有河流、湖泊以及比今天更温暖湿润的阶段。'},{title:'稀薄大气与冰',body:'现代火星大气以二氧化碳为主但非常稀薄，难以长期维持地表液态水。水冰存在于极冠和地下，季节性二氧化碳霜与全球性沙尘活动会明显改变外观。'},{title:'卫星与探测',body:'火星有火卫一和火卫二两颗小卫星。轨道器、着陆器和巡视器持续研究其地质、气候演化及古代环境是否曾适合微生物生命。'}],source:'https://science.nasa.gov/mars/facts/',sourceLabel:'NASA · Mars Facts'},
  {id:'jupiter',name:'木星',en:'JUPITER',code:'♃',type:'气态巨行星 · GAS GIANT',texture:'./textures/jupiter.jpg',color:0xd7aa80,radius:69911,visual:3.05,a:5.203,e:0.0489,i:1.303,period:4332.59,m0:20.02,rotation:9.925,tilt:3.13,
   summary:'太阳系最大的行星，主要由氢和氦组成。大红斑是持续已久的巨大风暴系统。',metrics:[['平均半径','69,911 km'],['距太阳','5.203 AU'],['公转周期','11.86 年'],['自转周期','约 9.9 小时']],facts:['强大的磁场形成庞大磁层。','伽利略卫星包括木卫一、木卫二、木卫三和木卫四。','贴图由 Voyager 影像制成。'],details:[{title:'气态巨行星内部',body:'木星没有可供站立的固体表面。向内压力不断升高，氢从分子态过渡到具有导电性的金属氢；深处可能存在由重元素构成、边界并不清晰的核心区。'},{title:'条带、风暴与磁层',body:'快速自转把大气组织成明暗相间的云带和高速急流。大红斑是持续多年的巨大反气旋；强磁场形成太阳系行星中最庞大的磁层环境。'},{title:'卫星小系统',body:'木卫一火山活跃，木卫二冰壳下可能存在全球海洋，木卫三是太阳系最大卫星且具有自身磁场，木卫四则保存大量古老撞击记录。'}],source:'https://science.nasa.gov/jupiter/jupiter-facts/',sourceLabel:'NASA · Jupiter Facts'},
  {id:'saturn',name:'土星',en:'SATURN',code:'♄',type:'气态巨行星 · GAS GIANT',texture:'./textures/saturn.jpg',color:0xd9c28c,radius:58232,visual:2.7,a:9.537,e:0.0565,i:2.485,period:10759.22,m0:317.02,rotation:10.656,tilt:26.73,
   summary:'拥有太阳系最醒目的行星环。环主要由无数水冰颗粒和少量岩石物质组成。',metrics:[['平均半径','58,232 km'],['距太阳','9.537 AU'],['公转周期','29.45 年'],['自转周期','约 10.7 小时']],facts:['平均密度低于液态水。','土卫六拥有浓厚大气，土卫二存在向太空喷射的冰羽流。'],details:[{title:'气态结构',body:'土星主要由氢和氦组成，没有明确固体表面，平均密度低于液态水。快速自转使其赤道鼓起，大气中有高速风带，北极附近存在著名的六边形急流结构。'},{title:'行星环',body:'主环虽然横向延伸数十万千米，垂直厚度在许多区域却只有几十米量级。环由大小跨度很大的冰颗粒、岩屑和尘埃构成，并被卫星共振刻出缝隙和波纹。'},{title:'土卫六与土卫二',body:'土卫六拥有以氮为主的浓厚大气和甲烷湖泊；土卫二从南极裂缝喷出含水冰的羽流，指向冰壳下存在液态海洋。'}],source:'https://science.nasa.gov/saturn/facts/',sourceLabel:'NASA · Saturn Facts'},
  {id:'uranus',name:'天王星',en:'URANUS',code:'♅',type:'冰巨行星 · ICE GIANT',texture:null,color:0x92d7df,radius:25362,visual:1.86,a:19.191,e:0.0472,i:0.773,period:30688.5,m0:142.2386,rotation:-17.24,tilt:97.77,
   summary:'一颗蓝绿色冰巨行星，自转轴几乎躺在轨道平面内，像侧卧着绕太阳运行。',metrics:[['平均半径','25,362 km'],['距太阳','19.19 AU'],['公转周期','84 年'],['轴倾角','97.77°']],facts:['蓝绿色主要来自大气中的甲烷吸收红光。','拥有暗淡的环系统。','可见光下整体较平滑，画面不添加虚构地表细节。'],details:[{title:'冰巨行星结构',body:'天王星外层大气以氢和氦为主，并含吸收红光的甲烷。更深处富含水、氨和甲烷等挥发性物质的高温高压流体，因此与木星、土星分属不同的“冰巨行星”类别。'},{title:'侧卧自转与季节',body:'约 97.8° 的轴倾角使天王星几乎侧卧自转，并表现为逆向旋转。它绕太阳一周约 84 年，极端姿态使每个季节持续约 21 个地球年。'},{title:'环、卫星与探测',body:'天王星拥有暗淡窄环和多颗卫星。旅行者 2 号在 1986 年完成至今唯一一次近距离飞掠，因此其内部、磁场和大气仍有许多待解问题。'}],source:'https://science.nasa.gov/uranus/facts/',sourceLabel:'NASA · Uranus Facts'},
  {id:'neptune',name:'海王星',en:'NEPTUNE',code:'♆',type:'冰巨行星 · ICE GIANT',texture:'./textures/neptune.jpg',color:0x386bc4,radius:24622,visual:1.82,a:30.069,e:0.0086,i:1.77,period:60182,m0:256.228,rotation:16.11,tilt:28.32,
   summary:'距离太阳最远的八大行星。大气中存在太阳系内极高速的风，并会形成和消散大型暗斑。',metrics:[['平均半径','24,622 km'],['距太阳','30.07 AU'],['公转周期','164.8 年'],['自转周期','约 16.1 小时']],facts:['海王星首先通过数学预测被发现，随后才被望远镜确认。','蓝色来自甲烷吸收与大气散射；云层图为基于观测的全球视觉重建。'],details:[{title:'大气与内部',body:'海王星是冰巨行星，大气以氢、氦和甲烷为主，深部则富含水、氨和甲烷等物质。其蓝色不能只用甲烷解释，云和气溶胶散射也会影响观测颜色。'},{title:'强风与暗斑',body:'尽管接收的太阳能很少，海王星仍有极活跃天气，测得风速可超过每小时 2,000 千米。大型暗斑是会形成、漂移并消散的风暴系统。'},{title:'发现、长年与海卫一',body:'海王星的位置先由天王星轨道扰动推算，再于 1846 年被望远镜确认。它约 164.8 年绕太阳一周；最大的卫星海卫一沿逆行轨道运行，可能是被捕获的柯伊伯带天体。'}],source:'https://science.nasa.gov/neptune/neptune-facts/',sourceLabel:'NASA · Neptune Facts'}
];

for (const planet of PLANETS) {
  OBJECTS[planet.id] = {...planet, mode: planet.id === 'earth' ? 'earth' : 'solar', note: '行星大小和轨道间距采用教学比例；资料数值为真实物理量。'};
}

export const FEATURED_IDS = ['solar-system','sagittarius-a','earth','moon','jupiter','saturn'];
export const SYSTEM_IDS = ['alpha-centauri','sirius','trappist-1','betelgeuse','vega','polaris'];
export const SEARCH_IDS = ['galaxy','sagittarius-a','solar-system','sun',...PLANETS.map(p=>p.id),'moon',...SYSTEM_IDS];
