# 声音波形实验室：物理与声音来源

核实日期：2026-09-19。

## 物理依据

- National Research Council, *Hearing Loss: Determining Eligibility for Social Security Benefits* (2004), Chapter 2: https://www.ncbi.nlm.nih.gov/books/NBK207834/ 。据此区分时间域波形、频率、振幅、音色与主观听感。波形纵轴为数字信号相对幅度，不标成校准声压或声级。
- 变速实现使用 Web Audio 的 AudioBufferSourceNode.playbackRate：实际采样播放加速，f′ = r f，T′ = T / r；绘制读取原数据的 t × r 位置。不是保音调变速，也不是改变空气中的声速。
- 合成声音采用 24 kHz 单声道数据。正弦波/方波/锯齿波最多 35 个谐波，最高谐波低于 5.9 kHz，适配最高 2× 播放。有限谐波导致边沿圆滑或振铃；保持峰值振幅不能保证相同主观响度。
- 整段视图使用每像素的极值包络；细节视图线性插值。十轨均为相对幅度 ±1，不按轨道归一化录音。

## 环境实录（本地随附）

NPS 素材授权声明：https://www.nps.gov/subjects/sound/gallery.htm 。NPS 声音库明确说明这些音频属于公共领域，可以下载，并要求适当署名。本项目署名 NPS；不使用页面图片。

| 文件 | 录音 / 署名 | 来源页 | 原始下载 |
|---|---|---|---|
| audio/bird.mp3 | American Robin，美洲知更鸟，Yellowstone National Park / NPS | https://www.nps.gov/subjects/sound/sounds-american-robin.htm | https://www.nps.gov/nps-audiovideo/legacy/mp3/nri/avElement/nri-AmericanRobinYELL.mp3 |
| audio/frog.mp3（保留的旧素材，界面已改用花狭口蛙） | Green Tree Frog，绿树蛙，Everglades National Park / NPS | https://www.nps.gov/subjects/sound/sounds-green-treefrog.htm | https://www.nps.gov/nps-audiovideo/legacy/mp3/nri/avElement/nri-GreenTreeFrogEvergladesNP.mp3 |
| audio/thunder.mp3 | Thunder，雷声 / NPS Natural Sounds and Night Skies Division | https://www.nps.gov/subjects/sound/sounds-thunder.htm | https://www.nps.gov/nps-audiovideo/legacy/mp3/nri/avElement/nri-Thunder.mp3 |

新增素材：

- `audio/marsh-frog.ogg`：**Marsh frog (Pelophylax ridibundus) call / 湖蛙鸣叫**，作者 **Llivermore**，采用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 授权。[原始页面](https://commons.wikimedia.org/wiki/File:Marsh_frog_(Pelophylax_ridibundus)_call.ogg)，[原始 OGG](https://upload.wikimedia.org/wikipedia/commons/5/59/Marsh_frog_%28Pelophylax_ridibundus%29_call.ogg)。保留原文件；运行时截取前 15 秒，转 24 kHz 单声道，导出节选继续按相同授权并保存署名、来源、改动说明。

- `audio/frog-croak.ogg`：**Banded Bull Frog Call / 花狭口蛙群鸣**，作者 **Inspector**，采用 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 授权。原始录音：[Wikimedia Commons 文件页](https://commons.wikimedia.org/wiki/File:Banded_Bull_Frog_Call.ogg)，[原始 OGG](https://upload.wikimedia.org/wikipedia/commons/c/c5/Banded_Bull_Frog_Call.ogg)。随附原文件未修改；运行时取前 15 秒、转 24 kHz 单声道；导出的音频节选同样按 CC BY-SA 3.0 授权。作者、来源、授权链接及节选说明随课堂文件的 `credits` 字段保存。此录音只代表花狭口蛙，蛙种不同叫声不同。
- `audio/chainsaw.mp3`：**Chain Saw / 链锯**，NPS，公共领域。[来源页](https://www.nps.gov/subjects/sound/sounds-chainsaw.htm)，[原始音频](https://www.nps.gov/nps-audiovideo/legacy/mp3/nri/avElement/nri-ChainsawSEKI.mp3)。用于机械环境噪声听辨。
- `audio/rain.mp3`：**Rain / 雨声**，NPS，公共领域。[来源页](https://www.nps.gov/subjects/sound/sounds-rain.htm)，[原始音频](https://www.nps.gov/nps-audiovideo/legacy/mp3/nri/avElement/nri-RainDEPO.mp3)。
- 白噪声由本实验随机生成；不作为真实环境录音。环境意义上的噪声不能仅依据波形是否规则判断，还取决于是否妨碍生活学习。

文件保留原始下载，加载时只取前 15 秒并转换为单声道。原录音条件不同，不能用它们的数字峰值反推声源实际响度。

## 使用与保存

通过 localhost 或 HTTPS 使用麦克风；推荐新版 Chrome / Edge。通过 file:// 打开可用合成声音和课堂导入，但自然素材 fetch 与录音受浏览器限制，完整体验请用本地预览服务。

课堂文件 `.soundlab` 是版本 1 的 JSON，包含 24 kHz、16-bit PCM 的 Base64 数据、名称、缩小后的 JPEG 头像、播放速度/音量、视图和选段。录音最长 15 秒，10 条轨道；头像上传限制 5 MB，音频导入限制 20 MB，课堂导入限制 12 MB。解析先验证再替换当前课堂。录音/头像不上传，不写入网站，不自动恢复；下载完成后请保管课堂文件。

构建：`npm run build:sound-lab`。模型检查：`npm run test:sound-lab`。启动预览后执行 `npm run test:sound-lab:browser`。浏览器自动测试使用虚拟麦克风；真实设备权限与实际输入质量还需教师实测。


## 十轨与演示视图

三要素按钮切换独立演示，不消耗十条个人声轨配额；返回时恢复原声轨、视图、选段、速度和滚动位置。在演示中保存课堂，保存的是已保留的个人声轨及设置。旧版六轨课堂文件仍可打开。

按住声轨的 ⠿ 拖拽可调整顺序，靠近列表上下边缘会自动滚动；聚焦该按钮后，也可按上下方向键排序。顺序随课堂文件保存。桌面（宽度大于 700 px、高度至少 600 px）使用固定页面，独立音轨滚动条与固定工具栏；窄屏/低高度设备采用自然页面布局及有高度限制的音轨滚动区。


## 紧凑布局与录音交互

播放、变速、选段、缩放、时间轴平移集中在左侧，右侧优先用于音轨；素材库默认折叠。三要素演示直接显示保持不变/改变的条件，并标出相对振幅 A 或周期 T；同基频的音色演示标出同长周期。

点击学生录音先显示姓名/录音提示弹窗，点击开始后才创建对应轨道。AudioWorklet 将麦克风的 PCM 采样用于弹窗及音轨的实时预览，0—15 秒统一时间轴；最终音频仍由 MediaRecorder 生成并解码。输入不回放到扬声器。录音完成后保留弹窗供确认，取消新录音不留下空轨，取消重录保留旧音频。实时输入依赖同目录 `live-input.js`，发布时需要随附。


## 2026-09-25：播放与素材更新

- 每条声轨新增暂停/继续，共用同一播放状态；暂停保留游标和轮流播放队列。
- 波形区底部固定时间定位条；滑块步长 0.0001 秒，数字输入可直接定位，左右微调每次移动当前时间窗的十分之一。整段视图无需平移时滑块禁用；“振动细节”或缩放后可平移。它改变共同显示窗口，不改变播放选段。
- 删除投屏模式入口；默认布局已经适合教师投屏，音轨单独滚动。
- `audio/rain-clear.wav`：原 NPS 雨声转 24 kHz 单声道、提高音量，以 0.75 次幂压缩幅度后将峰值设为 0.85。原版保留。
- `audio/thunder-clear.wav`：原 NPS 雷声选取 11.77996—23.77996 秒（包含强雷声），同上增强，峰值 0.85。原版保留。
- 上述响度增强会改变波形，已在界面标注，仅用于声音体验，不作为控制变量的响度/音色实验素材；学生录音不做自动归一化。
- `audio/ak47.wav`：[AK-47，qubodup / Freesound](https://freesound.org/people/qubodup/sounds/184750/)，[CC0](https://creativecommons.org/publicdomain/zero/1.0/)。源自作者汇编的美国政府训练录像音频。取公开预览前 8 秒、转 24 kHz 单声道、峰值设为 0.85。[原始预览](https://cdn.freesound.org/previews/184/184750_71257-hq.mp3)。
- `audio/nuclear-effect.wav`：原创教学合成爆炸声，8 秒。随机噪声爆发、低频振荡和衰减尾音叠加；不是真实原子弹/核试验录音，不模拟核爆传播过程或真实声级。
- `audio/laser.wav`：原创合成科幻激光音效，3 秒，快速下降的频率和衰减包络。
- `audio/sonar.wav`：原创合成声呐提示音，4 秒，800 Hz 脉冲；不是水下声呐实录。
- `audio/trump-slogan.wav`：特朗普 2017 年 1 月 20 日就职演讲原声节选。美国总统行政办公室作品，Commons 标注为公共领域。[来源与授权](https://commons.wikimedia.org/wiki/File:President_Donald_Trump%27s_First_Inaugural_Address_-_January_20,_2017.wav)。不使用 AI 仿声，不拼接改写；保留原话 “We will make America great again”。

雨声增强、雷声增强和 AK47 节选的首尾各加 10 ms 淡入/淡出，避免剪辑边界爆音。

口号截取原文件 974.35—980.60 秒（6.25 秒），包含 “And yes, together, we will make America great again”；用离线语音识别核对片段位置，24 kHz 单声道，峰值调至 0.85。


## 三要素现场调参

响度与音调演示的两条声轨各有独立滑块和复原按钮。响度只改变相对振幅 A（0.001—1.000，步长 0.001；默认对比 0.020 与 0.800），频率固定为原速 220 Hz；音调只改变原速频率（80—1000 Hz，步长 10 Hz），振幅保持 0.50。若改变播放倍速，实际频率仍按倍速换算，摘要与周期标记同步更新。

这两项正弦波演示在播放时用浏览器原生振荡器与独立增益节点发声，参数以 15 ms 时间常数平滑改变，避免每次拖动重启声音；绘图用同参数重算的 24 kHz 数据。暂停调参不会自动发声，继续时采用新参数。每段源声音为三秒，三要素演示默认循环，可取消循环单次播放；实时调整不写入已保留的学生课堂。音色的三种预设波形与录音播放继续使用原有缓冲区。

响度演示扩大至 0.001—1.000，显示三位小数，音频增益与绘图振幅保持一致；端点的信号幅度比为 1000，不代表主观响度比。浏览器回归测试直接采样送往输出端的信号，核对调节前后的实际 RMS 比值。

三要素演示默认勾选循环；单轨重复选段，轮流播放则循环整个演示列表。暂停/继续保留轮流顺序，重置视图恢复演示默认循环，返回课堂恢复原来的循环设置。


## 场景声级与听力范围

核对日期：2026-09-26。右上详情按钮打开独立详情视图，与波形实验互斥显示、互斥试听；返回保留课堂与参数；不采集麦克风、不测声压级，不更改学生课堂数据。

### 场景参考值

- 0 dB：正常听力的听阈参考；40 dB：典型安静图书馆；60 dB：正常交谈；110 dB：链锯；120 dB：救护车警笛。参考 [CDC 学校噪声教学表](https://archive.cdc.gov/www_cdc_gov/healthyschools/noise/signs.htm)。这些都是粗略场景参考，不能推定任何地点的实时测量结果；现场声级随距离、设备、环境和测量方法变化。
- 30 dB 耳语、90 dB 卡车交通、140 dB 起飞喷气发动机：参考 [CDC/NIOSH 声级示例](https://stacks.cdc.gov/view/cdc/121568/cdc_121568_DS1.pdf) 及 [NIOSH 工作噪声估计](https://stacks.cdc.gov/view/cdc/209822)。飞机场的示例明确指发动机附近的高声级情境，不是候机厅，不指定未核实的测量距离。
- 圆盘单位为场景参考 dB，**不是麦克风测量，也不是电脑实际输出的声压级**。在未校准设备、距离、系统音量时，网页无法保证真实 dB SPL。试听统一使用 440 Hz 纯音，保持音色一致来比较强弱，非场景实录。
- 为在普通设备上演示强弱，0—140 场景刻度压缩映射为 48 dB 的数字增益跨度：`gain = 0.5 × 10^((sceneDb−140)×48/140/20)`，再乘左侧主音量；上限 0.5，界面明确披露压缩。不能据试听反推环境声级、强度比或实际主观响度比。

### 听力范围

- 人：20—20,000 Hz，采用中学常用的年轻健康人耳近似范围。低于 20 Hz 为次声，高于 20,000 Hz 为超声。依据 [NOAA 声学教学材料](https://graysreef.noaa.gov/education/activities/pdfs/gr_sound_of_the_beluga.pdf)。边界不是对所有个体都绝对成立。
- 狗：约 67—45,000 Hz；猫：约 45—64,000 Hz。来自 [LSU 兽医学院听力范围资料](https://www.lsu.edu/vetmed/deafness/hearingrange.php)，资料同时强调阈值取决于实验方法和刺激强度，不能过度比较物种。本实验显示的是近似范围，不表示范围内的任意弱声都能听到，也不进行听力诊断。LSU 表中人类范围基于其研究口径为 64—23,000 Hz；人耳教学分区使用上述常见 20—20,000 Hz 口径，两者来源明确区分。
- 横轴 1—200,000 Hz，采用对数刻度（等间距对应相同频率倍数）；频率位置 `log10(f)/log10(200000)`。次声/超声分类始终以人耳为参照，切换动物不改变名称。
- 独立频率试听只开放 80—8,000 Hz，使用原生振荡器，不经过 24 kHz 声轨采样，也不受左侧声轨倍速影响。其他频率只做可视化，拖出试听范围立即停止；这不代表所选动物听不到。电脑扬声器、音量、年龄和个体会影响听感。


### 独立详情页与新增动物（2026-09-26）

详情在同一文档内切换独立视图，避免页面跳转丢失未保存录音；返回按钮或 Escape 关闭详情，停止试听，保留声轨与实验参数。无需服务器或新依赖。

- 亚洲象示意范围 16—12,000 Hz：Heffner & Heffner (1982), *Hearing in the elephant (Elephas maximus): Absolute sensitivity, frequency discrimination, and sound localization*, 96(6), 926–944，doi:10.1037/0735-7036.96.6.926。[作者机构记录](https://scholars.utoledo.edu/display/n19274)；[作者提供的论文全文](https://www.researchgate.net/profile/Henry-Heffner/publication/16046468_Hearing_in_the_elephant_Elephas_maximus_Absolute_sensitivity_frequency_discrimination_and_sound_localization/links/54a411230cf267bdb9066c35/Hearing-in-the-elephant-Elephas-maximus-Absolute-sensitivity-frequency-discrimination-and-sound-localization.pdf)。这是单个体在不同阈值下的实验示例，不是恒定声级判据下所有大象的通用范围；全文图2在两端阈值明显高于最佳听觉区域。
- 虎鲸示意范围 600—114,000 Hz：Branstetter et al. (2017), *Killer whale (Orcinus orca) behavioral audiograms*, JASA 141, 2387–2398。[原始论文摘要](https://pubmed.ncbi.nlm.nih.gov/28464669/)。采用论文综合听力图的截止频率，判据为阈值超过 100 dB re 1 μPa。水下声压级参考不同，不能与空气中 dB 数值直接作灵敏度比较；虎鲸代表齿鲸中的一个物种，不能概括所有鲸类。未将发声频率误用为听力范围，也未用群体模型冒充物种实测。

### 声波应用来源

- [CTBTO 次声监测](https://www.ctbto.org/our-work/monitoring-technologies/infrasound-monitoring)：微气压计与阵列、大气爆炸监测，需结合其他证据。
- [CTBTO 民用与科学应用](https://www.ctbto.org/our-work/civil-and-scientific-applications)、[流星事件记录](https://www.ctbto.org/resources/for-the-media/press-releases/nothing-escapes-global-ear-nuclear-tests-volcanoes)：喷发及流星观测，不宣称精准灾害预测。
- [FDA 超声成像](https://www.fda.gov/radiation-emitting-products/medical-imaging/ultrasound-imaging)：回波成像、耦合凝胶、血流观测以及能量效应的适用说明。
- [NIST 焊缝裂纹超声衍射研究](https://www.nist.gov/publications/defect-characterization-and-dimensioning-cracks-welds-ultrasonic-diffraction-method)：无损探伤。
- [CDC 清洗指南](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/cleaning.html)：空化清洗；明确清洗不等于灭菌。
- [NOAA 声呐原理](https://oceanservice.noaa.gov/facts/sonar.html)、[回声测深](https://oceanservice.noaa.gov/education/tutorial_nautical_charts/nautical_charts06_tools_6b.html)：主动与被动声呐、往返时间测距；不把所有声呐都称为超声。


## 应用配图（2026-09-26）

六张公开授权图片保存于 `images/`，原文件未裁剪、未重绘、未放大；网页按比例缩放显示，点击可在新标签页查看原分辨率大图。图片延迟加载，不阻塞录音与波形功能。下列许可仅适用于对应图片。
- `images/infrasound-array.jpg`：阿森松岛 IS50 次声监测站阵列实景。 分辨率 1600 × 1200；作者/署名：The Official CTBTO Photostream / CTBTO Preparatory Commission；[CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)。[来源页](https://commons.wikimedia.org/wiki/File:Array_at_Infrasound_Station_IS50_-_Flickr_-_The_Official_CTBTO_Photostream.jpg)；[原文件](https://upload.wikimedia.org/wikipedia/commons/a/ab/Array_at_Infrasound_Station_IS50_-_Flickr_-_The_Official_CTBTO_Photostream.jpg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original)。保留原始文件，网页仅等比显示。
- `images/volcano-eruption.jpg`：1980 年圣海伦火山喷发实景；照片展示声源事件，次声波本身不可见。 分辨率 2994 × 4500；作者/署名：Austin Post / USGS；[公共领域（美国）](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits)。[来源页](https://commons.wikimedia.org/wiki/File:MSH80_eruption_mount_st_helens_05-18-80.jpg)；[原文件](https://upload.wikimedia.org/wikipedia/commons/a/a5/MSH80_eruption_mount_st_helens_05-18-80.jpg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original)。保留原始文件，网页仅等比显示。
- `images/fetal-ultrasound.jpg`：胎儿二维 B 超影像实拍：灰度图像来自声波回波，并非可见光拍到胎儿。 分辨率 1300 × 810；作者/署名：Goleisureintl；[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。[来源页](https://commons.wikimedia.org/wiki/File:Obstetric_ultrasound_scan_monitor_showing_20-week_human_fetus_profile_in_Navi_Mumbai_2015.jpg)；[原文件](https://upload.wikimedia.org/wikipedia/commons/c/cb/Obstetric_ultrasound_scan_monitor_showing_20-week_human_fetus_profile_in_Navi_Mumbai_2015.jpg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original)。保留原始文件，网页仅等比显示。
- `images/ultrasonic-testing.jpg`：手动双探头超声衍射时差法（TOFD）检测现场。 分辨率 1850 × 1388；作者/署名：CEphoto, Uwe Aranas；[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)。[来源页](https://commons.wikimedia.org/wiki/File:TOFD-ManuallyGuidedSensors.jpg)；[原文件](https://upload.wikimedia.org/wikipedia/commons/f/f3/TOFD-ManuallyGuidedSensors.jpg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original)。保留原始文件，网页仅等比显示。
- `images/ultrasonic-cleaner.jpg`：超声清洗设备实物：左侧为清洗槽，右侧为控制装置。 分辨率 3702 × 2718；作者/署名：Hannes Grobe；[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)。[来源页](https://commons.wikimedia.org/wiki/File:Bandelin-sonorex_hg.jpg)；[原文件](https://upload.wikimedia.org/wikipedia/commons/f/fa/Bandelin-sonorex_hg.jpg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original)。保留原始文件，网页仅等比显示。
- `images/sonar-seafloor.jpg`：多波束回声测深重建的红海海底峡谷；颜色为数据可视化，并非海底实景照片。 分辨率 2494 × 1962；作者/署名：Photo: Royal Navy/MOD；[OGL v1.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/1/)。[来源页](https://commons.wikimedia.org/wiki/File:Echo_Sounding_of_Newly_Discovered_Canyon_in_the_Red_Sea_MOD_45155032.jpg)；[原文件](https://upload.wikimedia.org/wikipedia/commons/b/bf/Echo_Sounding_of_Newly_Discovered_Canyon_in_the_Red_Sea_MOD_45155032.jpg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original)。保留原始文件，网页仅等比显示。
