# 物理实验室 / Interactive Physics Lab

一个面向课堂演示的静态网页实验库，可直接发布到 GitHub Pages。

当前发布流程采用“仓库先保存、网页后公开”：`main` 保存已确认的稳定版本，较大修改先在独立分支预览，验收后再合并并更新 GitHub Pages。正式网址保持不变，必要时可以回退到之前的提交。

## 目录约定

```text
physics-lab/
├─ index.html                    # 实验库首页
├─ assets/                       # 全站共用主题、图标与资源
└─ experiments/
   └─ eclipse/                   # 每个实验一个独立目录
      ├─ index.html
      ├─ style.css
      └─ app.js
```

后续实验继续放在 `experiments/实验英文短名/` 中，并在首页新增实验卡片。视觉变量沿用 `assets/lab-theme.css`：深空背景、低饱和青蓝色、细边框、克制的发光效果。

## 本地预览

ES Modules 需要通过本地服务器打开，不能直接双击 HTML 文件。

```powershell
cd physics-lab
python -m http.server 8000
```

浏览器访问 `http://localhost:8000/`。

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
- Three.js 从 jsDelivr CDN 加载，因此在线展示无需构建；课堂断网环境需要另行改为本地依赖。

物理关系参考：[NASA 日月食几何](https://science.nasa.gov/eclipses/geometry/)、[NASA 日月食与月球](https://science.nasa.gov/moon/eclipses/)、[NASA 月球轨道参数](https://eclipse.gsfc.nasa.gov/SEhelp/moonorbit.html)。
