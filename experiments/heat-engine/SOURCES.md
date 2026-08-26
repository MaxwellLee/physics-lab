# 热机实验资料来源

核对日期：2026-08-26

## 四冲程、点火方式与基本能量过程

- U.S. Department of Energy, **Internal Combustion Engine Basics**<br>
  https://www.energy.gov/cmei/vehicles/articles/internal-combustion-engine-basics<br>
  用于核对四冲程顺序、汽油机火花点火、柴油机只吸入空气后喷油压燃，以及燃气推动活塞和曲轴做功的表述。

- NASA Glenn Research Center, **Internal Combustion Engine Stages**<br>
  https://www.grc.nasa.gov/WWW/K-12/airplane/engstage.html<br>
  用于核对进气门与排气门状态、压缩时温度和压强升高、做功冲程及向环境散热等热力学过程。

## 柴油机压缩与效率差异

- U.S. Department of Energy, **Retrospective Benefit-Cost Evaluation of U.S. DOE Vehicle Combustion Engine R&D Investments**, Section 2.4, pp. 2-7–2-8<br>
  https://www.energy.gov/node/1056876<br>
  用于核对柴油机在压缩冲程末端喷油、高压缩程度促使燃料自燃，以及柴油机通常具有较高效率的定性说明。

- NASA Technical Reports Server, **Automotive Stirling Engine Development Program—Fuel Economy Analysis**, compression-ignition engine discussion<br>
  https://ntrs.nasa.gov/api/citations/19750064998/downloads/19750064998.pdf<br>
  用于核对柴油机较高压缩程度会带来更高机械负荷，机体因此通常需要更坚固、厚重的定性关系。

- Princeton University course material, **Fuels and Internal Combustion Engines**, compression-ratio table (data attributed to Heywood)<br>
  https://commons.princeton.edu/60-3-tiger-cub/wp-content/uploads/sites/440/2025/05/FRS-106-Ferris-on-Fuels.pdf<br>
  用于交叉核对汽油机与柴油机常见压缩比量级。具体数值会随发动机设计而变化，界面只用于初中课堂的代表性比较。

## 启动与怠速声音参考

- Wikimedia Commons, **Starting a car and driving.ogg**（Public Domain）<br>
  https://commons.wikimedia.org/wiki/File:Starting_a_car_and_driving.ogg<br>
  用于参考汽油车启动后进入连续运转时的节奏变化；网页未直接嵌入该录音。

- Wikimedia Commons, **WWS Rustondieselengine.ogg**（CC BY 4.0，单缸四冲程柴油机，页面标注 1500 r/min）<br>
  https://commons.wikimedia.org/wiki/File:WWS_Rustondieselengine.ogg<br>
  用于参考柴油机更明显的低频燃烧脉冲与机械敲击感；网页未直接嵌入该录音。

音效仍由 Web Audio 实时合成，不复制录音声纹。四冲程单缸发动机每两转完成一次循环，因此单缸教学音效将燃烧脉冲频率按 `转速 ÷ 120` 联动；四缸模式按四个汽缸错峰做功，将脉冲频率设为单缸的 4 倍。

## 曲轴关系与直列四缸顺序

- Sandia National Laboratories, **Crankshaft Design and Analysis**，术语图列出 Main Bearing Journal、Crankpin Journal 与 Crankpin Offset<br>
  https://pubdocserve.sandia.gov/sand_doc/CSP/external/CSP-0988.pdf<br>
  用于核对曲轴绕主轴颈中心线旋转、曲柄销相对主轴线存在偏心距的几何关系。

- Continental Motors, **Overhaul and Repair Manual for Four Cylinder Engines**，Firing Order 1-3-4-2<br>
  https://www.cs.toronto.edu/~relu/tractor/CONTINENTAL-LHEAD-MANUAL.pdf<br>
  用于核对本教学应用模型采用的常见直列四缸 1—3—4—2 做功顺序。

- NASA Glenn Research Center, **Bore and Stroke**<br>
  https://www.grc.nasa.gov/WWW/K-12/BGP/stroke.html<br>
  用于交叉核对活塞、连杆、曲轴曲柄与上止点/下止点的基本几何关系。

## 教学模型边界

- 模型采用初中课程常用的理想化气门正时：每个进、排气门仅在相应冲程开启。
- 真实发动机存在提前点火、延迟关闭、气门重叠、不同燃油供给方式和多种燃烧策略；这些工程细节不纳入本实验的运动状态计算。
- 零件分离距离、气门行程、气体粒子大小、燃烧亮度与动画时间尺度均为教学放大，不代表真实比例。
- 四缸模型用于展示真实应用中的错峰四冲程关系，并非某一具体发动机的制造图；缸距、连杆长度、气道和凸轮机构均采用教学比例。
- 转速联动音效是程序生成的课堂提示音，不是特定车型的实录声纹，也不用于推断实际声压级；界面中的转速是教学模拟值。
