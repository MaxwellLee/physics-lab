# 物理实验室 / Interactive Physics Lab

一个面向课堂演示的静态网页实验库，可直接发布到 GitHub Pages。

当前发布流程采用“仓库先保存、网页后公开”：`main` 保存已确认的稳定版本，较大修改先在独立分支预览，验收后再合并并更新 GitHub Pages。正式网址保持不变，必要时可以回退到之前的提交。

## 目录约定

```text
physics-lab/
├─ index.html                    # 实验库首页
├─ assets/                       # 全站共用主题、图标与资源
└─ experiments/
   └─ <short-english-slug>/      # 每个实验一个独立目录
      ├─ index.html
      ├─ style.css
      └─ app.js
```

后续实验继续放在 `experiments/实验英文短名/` 中，并在首页新增实验卡片。首页与天体实验沿用深空视觉；需要高对比结构观察的课堂工作台可以使用电学实验台和热机实验的明亮教学背景，但仍保持青蓝强调、细边框和统一控制语言。

## 本地预览

发布版本已将 Three.js 打包到本地脚本中，可以直接双击 `index.html`，再进入日月食实验；不需要等待 CDN，也不会受到本地 ES Modules 跨域限制。

开发时修改 `experiments/eclipse/app.js` 后，需要重新生成浏览器使用的 `app.bundle.js`：

```powershell
cd physics-lab
npm install
npm run build
```

不要直接编辑 `app.bundle.js`，它是自动生成的发布文件。

需要通过 HTTP 检查完整实验库时，在仓库根目录运行：

```powershell
npm run preview
```

然后打开 `http://localhost:8766/`。这个预览服务禁用缓存，适合检查刚修改的 CSS 和浏览器脚本。

## 手机端约定

- 实验库首页支持手机竖屏：实验卡片使用紧凑列表，整张卡片均可点击。
- 需要精细拖动、接线或三维操作的实验优先采用横屏工作区；若内容可以清楚重排，则提供竖屏布局。例如热机对比在横屏时左右排列、竖屏时上下排列。
- 高频操作固定在拇指容易触及的位置，次要操作收进“更多”；按钮和接线柱应提供至少约 44–48 px 的触控命中区。
- 面板在手机横屏中作为互斥抽屉使用，避免资料与元件箱同时遮住实验台。
- 新实验应同时检查 `390×844` 竖屏入口、`844×390` 横屏操作和桌面端回归；不能只靠桌面浏览器缩窄窗口判断手机体验。

## 发布到 GitHub Pages

1. 将 `physics-lab` 文件夹内容放在仓库根目录。
2. 推送到 GitHub。
3. 在仓库 `Settings → Pages` 中选择 `Deploy from a branch`。
4. 选择发布分支与根目录 `/ (root)`，保存后等待生成网址。

## 模型原则

- 天体运行方向、月球约 5.1° 轨道倾角和日月食遮挡关系按物理关系表达。
- 所有影锥都沿太阳光传播方向、背向太阳延伸；不会为了画面对齐而弯向目标天体。
- 日全食表现为月球本影到达地球；日偏食表现为本影偏离地球、半影扫过地球；日环食表现为本影尖端未到地球、伪本影继续到达地球。
- 月食时地球位于日月之间；月全食进入地球本影后，月面用穿过地球大气层的红橙光表现。
- 为了让三颗天体同时清晰出现在屏幕上，空间模式的天体大小和距离采用教学可视化比例，不是统一真实比例。
- 地面模式重点表达太阳与月球视圆面的相对运动、食甚与复圆的连续过程。
- Three.js 已打包进发布脚本，不依赖第三方 CDN；直接打开和 GitHub Pages 使用同一份三维代码。
- 地球、云层和月球使用 NASA 真实影像；桌面端自动选择 4K，较弱设备自动降至 2K，也可以在实验面板手动切换。

## 银河系实验

`experiments/galaxy/` 提供银河系、银河中心人马座 A*、重点恒星系统、太阳系八大行星和地月系的分层探索。银河系远景采用科学重建而非外部照片；太阳系使用近似 J2000 轨道参数和开普勒求解器推进到当前日期。行星贴图、观测数据与程序化可视化的区别记录在 [`experiments/galaxy/SOURCES.md`](experiments/galaxy/SOURCES.md)。

银河系实验的纹理作为独立文件按页面需要加载，不会内嵌进 `app.bundle.js`。修改 `experiments/galaxy/app.js` 或 `data.js` 后运行：

```powershell
npm run build:galaxy
```

物理关系参考：[NASA 日月食几何](https://science.nasa.gov/eclipses/geometry/)、[NASA 日月食与月球](https://science.nasa.gov/moon/eclipses/)、[NASA 月球轨道参数](https://eclipse.gsfc.nasa.gov/SEhelp/moonorbit.html)。

纹理来源、处理方法和署名见 [`assets/textures/SOURCES.md`](assets/textures/SOURCES.md)。

## 电学实验台

`experiments/circuit-bench/` 是面向初中电学的自由搭建实验台（EXP.003）：学生从窄图标栏快速选择元件，在台面点按放置，并通过拖线或依次点击两个接线柱完成接线。再次点选元件才显示参数与红色删除按钮；导线也支持点选删除。实物图可一键转换为按连接拓扑重新排版的教材式电路图，导线横平竖直、元件间距统一。

界面坚持“先探索、后提示”：不提供预设演示电路和复杂资料卡片；短路路径用红色高亮、未接的必要接线柱用黄色高亮，电表超量程或用电器过功率用橙色提示。手机端采用窄元件栏与横屏工作台，并保持约 48 px 的接线柱/导线触控区。

物理模型为初中理想模型（电表无内阻、电源无内阻、参数全可调），直流稳态用改进节点分析（MNA）求解，非线性灯泡采用经验 R(U) 模型。理想化清单、元件数据与教学依据见 [`experiments/circuit-bench/SOURCES.md`](experiments/circuit-bench/SOURCES.md)。

修改 `experiments/circuit-bench/app.js`、`data.js` 或 `src/` 后运行：

```powershell
npm run build:circuit-bench
```

物理引擎可脱离浏览器独立测试（欧姆定律、串并联、短路、熔断、二极管、非线性灯泡、预设实例化等 18 个用例）：

```powershell
npm run test:circuit-bench
```

启动本地预览后，还可以运行桌面与手机浏览器冒烟测试：

```powershell
npm run test:circuit-bench:browser
npm run test:circuit-bench:mobile
```

## 四冲程内燃机实验

`experiments/heat-engine/` 是面向初三热学课堂的四冲程三维实验（EXP.004）。默认进入汽油机正交正视剖面，可切换柴油机、同步对比和直列四缸汽油机应用；支持播放、暂停、速度调节、720° 手动时间轴、观察方式切换、按需零件标注与能量变化讲解。四缸模式为避免画面拥挤，只保留剖视、完整和正视，不提供拆解。

模型把活塞、连杆、偏心曲柄销、主轴颈、曲柄臂、飞轮和气门运动统一绑定到同一曲轴角度。汽油机在吸气冲程用黄色雾滴示意燃油随气流进入，并展示火花塞点火；柴油机使用更长的汽缸和冲程，以及更厚重的缸体、缸盖、活塞、连杆与曲轴结构，只在压缩末端展示喷油和压燃。对比页同时提供同步模型与差异表格。四缸应用按常见的 1—3—4—2 顺序错峰做功，并用四张紧凑状态卡同步显示各缸冲程。音效由 Web Audio 程序生成，参考授权启动与怠速录音的节奏特征，并随模拟转速改变音调和燃烧脉冲，不直接使用外部录音素材。

修改 `experiments/heat-engine/app.js` 或 `engine-physics.js` 后运行：

```powershell
npm run build:heat-engine
npm run test:heat-engine
```

启动本地预览后运行桌面、慢网和手机横竖屏浏览器回归：

```powershell
npm run test:heat-engine:browser
```

权威资料、教学比例和真实发动机与理想模型的边界见 [`experiments/heat-engine/SOURCES.md`](experiments/heat-engine/SOURCES.md)。
