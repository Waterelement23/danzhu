# 用户选定 A 发射 + C 蓄力的加工试听

用户明确选择 slingshot-comparison 的 A 用作发射、C 用作蓄力，并授权加工。原始候选均保留；这批加工结果尚待用户听感验收，尚未接入游戏。

## 三条试听

- gesture-audition.wav（10 秒）：0.35 秒开始快速蓄力，约 1.39 秒发射；3.00 秒开始慢蓄力，5.388 秒发射；7.70 秒开始半途取消的蓄力，8.35 秒淡出结束，不跟发射。
- charge-audition.wav（7 秒）：快速蓄力、完整慢蓄力、中途取消三段。
- release-audition.wav（3 秒）：0.30/1.20/2.10 秒轻、中、重三档音量。同一发射片段乘以 0.6/0.8/1.0，不冒充三种力度的实录。

## 独立片段

- charge-main.wav：C 的 0.80–3.20 秒，保留 2.4 秒的主要拉伸。
- charge-alternate.wav：C 的 5.50–7.22 秒，长 1.72 秒。
- charge-quick.wav：备用片段作 1.65 倍保音高变速，约 1.052 秒，仅演示快速手势，不是无限循环。
- release.wav：A 的 0.407–0.637 秒，长 0.23 秒，裁去出手前的静音。

C 使用 110Hz 高通、6.5kHz 低通和快速峰值压缩（阈值 .025、4:1、0.3ms attack、35ms release），减少尖峰对拉伸底声的遮盖；两个选段分别用恒定增益整平，峰值不超过 -12dBFS。A 使用 90Hz 高通和 8.5kHz 低通，保留原始瞬态，不作时间拉伸，峰值 -8dBFS。片段边缘淡入淡出，演示中蓄力末端与发射重叠 12ms。

后续运行时应随真实拖动播放蓄力，停止/取消即淡出，实际出手才播放发射；不允许把整个试听或原始 7.7 秒拉伸录音直接循环。需要在实际手势中进一步验证可变时长和力度，不能把离线时序当作已实现的交互。

## 来源

A: Slingshot by renne100 — https://freesound.org/people/renne100/sounds/353033/
C: rubber.wav by Anthousai — https://freesound.org/people/Anthousai/sounds/399008/
两者 CC0 1.0：https://creativecommons.org/publicdomain/zero/1.0/

使用 ../slingshot-comparison/source/ 中的公开 HQ MP3 预览版本，不是原始 WAV。本次仅剪辑、滤波、压缩、增益、边缘淡化及快速试听的保音高变速，没有替换为合成噪声或混入弓箭素材。来源哈希保存在 validation.json。

## 验证与复现

运行 python scripts/process-selected-gesture-audio.py，依赖 NumPy 和 ffmpeg。7 个 WAV 均经重新解码验证：48kHz、单声道、PCM16、时长与样本数量一致、首尾为零、无削波；组合试听取消结束后全为静音。数值验证不代表主观听感已获认可。
