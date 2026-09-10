# 干土 / 细沙音效候选（2026-09-09）

搜索目标是玻璃弹珠在压实干土、薄层细沙上落地弹跳及滚动。当前未检索到明确标注同时匹配物体、地面和动作的现成录音。用户已试听并选择前两项，确认同意以 ZapSplat 土路石子音作为落地/弹跳基础，以 Freesound 砂砾音作为颗粒扰动细节。后两项暂不采用；用户已将前两项原文件下载到项目主目录，已完成离线初剪；尚未接入游戏。不能将小石子、砂砾录音标作弹珠实录。

| 来源与素材 | 已核实描述 | 可评估用途 / 局限 | 获取与许可 |
| --- | --- | --- | --- |
| [ZapSplat：Small stone throw, land on dirt road and small stones 4](https://www.zapsplat.com/music/small-stone-throw-land-on-dirt-road-and-small-stones-4/) | 小石子投掷后落在土路和小石子上；页面提供播放器 | 土地撞击候选；物体是石子，不是玻璃弹珠，也不是持续滚动声 | 页面列 Standard License；免费 Basic MP3 需署名，Premium 提供 WAV；[官方许可](https://www.zapsplat.com/license-type/standard-license/page/2/)允许在游戏内使用，限制单独素材再分发 |
| [Freesound / Sheyvan：Gravel Stone Dirt Debris Falling Small 1 5](https://beta.freesound.org/people/Sheyvan/sounds/569738/) | 2.57 秒，48 kHz / 24-bit / 单声道；标签小砂砾、土、碎屑落下 | 颗粒撞击细节候选；不是单颗玻璃球的录音 | 页面标 CC0，可编辑及商用；原文件下载需要登录，页面可试听 |
| [Pro Sound Effects：Stone Debris Small Rock Falls Dirt](https://www.prosoundeffects.com/sound-effects/PSE_GEN/8ORkP/Stone-Debris-Small-Rock-Falls-Dirt) | 小石块落下、土面撞击、滚动、小颗粒散开；14 秒，48 kHz / 24-bit 双声道 | 同时含撞击和滚动，物体材质与尺度需试听比较 | 页面列单条 $5，未购买；实际使用前核对适用授权 |
| [Vadi Sound Library：Sand And Pebble](https://vadisound.com/shop/sand-and-pebble/) | 671 条，含落下、撞击、摩擦、滑动、滚动；地面含 ground / dirt 等；96 kHz / 24-bit | 细沙/颗粒声音素材池；不是确认含有“玻璃珠在土上”的音效包 | 付费，页面有预览与 sound list；[官方条款](https://vadisound.com/terms-and-conditions/)5.5 描述可同步到游戏等媒体，不能理解为允许把原始素材直接公开分发 |

早期曾建议试听前两项判断土地颗粒尺度；最新试听已否定砂砾录音作为滚动声，后续改为寻找真正的玻璃珠滚土实录。听感确认之前不通过大幅变调或简单叠噪声来冒充弹珠实录。

已排除的典型误匹配：Footsteps sand and marble（marble 指大理石地面）、玻璃珠在木桌/玻璃碗上滚动、保龄球和海浪推动砂石。这些都不能直接满足当前目标。

原用户素材已归档到 marble-tile/，依据用户听感保留为未来瓷砖地面候选。

## 已确认的加工范围

1. ZapSplat 40324：分离独立落地撞击，淡化切口，保留自然尾音与力度差异；未来按实际物理接触触发。
2. Freesound 569738：提取较轻的砂粒扰动，只作为颗粒细节，响度低于主要撞击。
3. 用户进一步确认砂砾原音频具有滚动感，要求保留连贯声音。本轮保留完整原录音及轻度交叉渐变的循环候选，不再仅提取峰值。
4. 先交付离线试听，再讨论游戏接入。

获取状态：用户已提供两份原文件。已生成 `marble-earth/` 下 3 个落地冲击片段、4 个砂粒片段与两份试听合集；来源、剪辑参数和哈希详见该目录 manifest.json。用户指出短峰值剪辑丢失原声滚动感后，已补充完整原声版和连续循环版，见 `marble-earth/earth-roll-natural.wav` 和 `earth-roll-loop-audition.wav`。土地落地剪辑已获用户认可并保持不变。

最新反馈（2026-09-09）：用户调大音量试听后指出，变化拼接版本仍混有沙子落地撞击，与玻璃珠在土地滚动不同。所有基于 Sheyvan 569738 的滚动试样停止作为滚动候选，仅保留加工历史；已认可的土地落地声保持不变。下一步寻找单颗玻璃弹珠在压实干土上的连续滚动和两颗玻璃珠相撞实录。

## 新一轮实录搜索（2026-09-09）

以下依据作者页面描述筛选。用户已选定第一份 Freesound 755084 作为弹珠之间的碰撞声；原文件已由用户提供，已提取 8 段独立碰撞及试听合集，尚未接入游戏。其他条目未采用、未购买。

| 素材 | 核实结果 | 状态 |
| --- | --- | --- |
| [Two marbles colliding — D43thsilence / Freesound](https://freesound.org/people/D43thsilence/sounds/755084/) | 17 秒，多次一颗弹珠与另一颗相撞；小房间内 Sony UX570 录音；44.1 kHz / 16-bit / 双声道；CC BY 4.0，需署名，登录下载 | 用户已选定；原文件已获取并提取 8 段，剪辑后听感待确认 |
| [Two Marbles Hitting Together — applehillstudios / AudioJungle](https://audiojungle.net/item/two-marbles-hitting-together/38527402) | 描述明确为两颗玻璃弹珠碰撞；3 个版本，各 1 秒；页面提供预览，标价 $1 | 碰撞付费备选，未购买；采用前核对对应产品授权 |
| [Marbles — The Sound Pack Tree](https://thesoundpacktree.com/sound-packs/Marbles) | 列表包含 Marble Rolling Around、Small Marble Rolling Past、Marble Roll And Hit Marbles 等；所见描述未确认是干土地面 | 仅为待核对线索，不能标作土面滚动候选或据此购买 |

本轮中英文搜索及上述素材目录仍未找到能同时确认“玻璃弹珠 + 干土地面 + 连续滚动”的可用实录。明确排除 [JuandreSound 的 Marble Roll](https://freesound.org/people/JuandreSound/sounds/490913/)（作者标注瓷砖），以及木桌、轨道、撒砂、碎石落地声。若现成素材持续缺失，可另行考虑实地录制单颗玻璃珠在压实干土上的多次快/中/慢滚动，落地与滚动分录；目前未安排或实施录制。

## 碰撞声选用确认

用户已明确选择 D43thsilence 的 Two marbles colliding（Freesound 755084）。2026-09-09 尝试从已登录的作者页面下载原始 WAV，Chrome 在 CDN 下载地址返回 ERR_BLOCKED_BY_CLIENT，未绕过拦截；本地工作目录尚未发现该文件。后续取得原文件后提取独立碰撞片段，保留自然起音和尾音，记录切点及源文件哈希。当前只是来源选定，不代表游戏音效已经接入。

署名：Two marbles colliding by D43thsilence — https://freesound.org/people/D43thsilence/sounds/755084/ — CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)。实际加工后补充修改说明。

最新进展：用户已提供 `755084__d43thsilence__two-marbles-colliding.wav`，17 秒 / 44.1kHz / PCM16 / 双声道。已生成 `marble-collision/` 下 8 段碰撞与 7.41 秒试听合集；处理、署名和数值验证见该目录 README.md 和 manifest.json。原文件不变，游戏音效尚未接入。

## 瓷砖滚动声变闷试验

用户进一步要求尝试对已有瓷砖滚动声降高频并试听。已生成 `marble-earth-from-tile/` 下对照、轻度变闷、更沉闷三段和对比合集；连续滚动段保留，不混入此前被否定的落砂声，不做短循环。作为模拟候选待试听，不能标作真实土面录音。此前已认可的落地和弹珠互撞片段均保持不变。

用户反馈第一轮变闷版本仍像瓷砖或木板摩擦，已标记为未采用。第二轮 `marble-earth-from-tile-v2/` 改为削弱低频与 1.18kHz 中频突出部分，并另做柔化起音版本；待试听，未接入游戏。

用户认为第二轮仍过于尖锐，主动建议滤除更多高频、降低摩擦声并重新叠加落砂。已生成 `marble-earth-layered/` 的低通轻声底层及两种落砂比例试听；这是新的混合试验，不改变早前否定落砂单独充当滚动声的判断，未接入游戏。

用户认可低通滚动与落砂叠加的方向，但落砂撞击太明显。已生成 `marble-earth-layered-v2/`，保留上一轮滚动底声，按包络削弱砂层强事件，不补偿放大；新听感待确认，未接入游戏。

用户确认 `marble-earth-layered-v2` 音色可接受，但原录音及派生音频存在由远而近再远的过程。当前只作为音色参考，禁止整段循环；需先准备稳定距离的滚动纹理，再由游戏位置/速度/接触状态驱动声音。详见技术设计文档的音效接入约束。

用户授权制作多个土地滚动循环与由玻璃珠互撞派生的碰石声。新增 `game-audio-candidates/`：A/B/C 三种基于已认可层的平均频谱重建的稳定循环（每段 8 秒，试听重复三次共 24 秒），不循环原录音的远近过程；8 段碰石近似音效。均待用户选择，未接入游戏。完整来源、方法与局限见该目录 README.md。

2026-09-10 听感验收：用户确认 `game-audio-candidates/` 滚动声没有明显机械重复和忽远忽近、比较自然，碰石声比较像石头。保留 A/B/C 三版，未指定首选；离线音色验收通过，尚未接入游戏或进行运行时验证。
