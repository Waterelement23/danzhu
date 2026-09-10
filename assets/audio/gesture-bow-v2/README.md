# 弓箭风格蓄力与发射试听 v2

用户反馈上一版指腹摩擦合成蓄力“不对劲”，要求直接参考拉弓蓄力和放箭声音。本轮使用配套弓箭音效素材加工，保留原 v1 供对比；尚未接入游戏，音色等待试听。

## 来源与署名

SonoFxAudio — Bow_draw_slow01.wav
https://freesound.org/people/SonoFxAudio/sounds/649336/

SonoFxAudio — Arrow_loose01.wav
https://freesound.org/people/SonoFxAudio/sounds/649335/

两页均标注 CC BY 4.0：https://creativecommons.org/licenses/by/4.0/
本轮取得的是网站公开的 HQ MP3 试听版，不是原始 WAV。原始下载件保存在 source/，哈希与加工参数见 validation.json。作者将它们描述为强化真实感的弓箭拟音，不能声称未经加工的真实弓箭实录。

Modified: 65Hz highpass, 9.5kHz lowpass, mono conversion, 48kHz resampling, silence trimming, gain adjustment, short edge fades and audition arrangement. No pitch shift or synthesized layer was added.

## 试听

- bow-charge-audition.wav：6 秒，同一拉弓片段按 0.55/0.8/1.0 三档增益播放。
- bow-release-audition.wav：4 秒，同一放箭片段按上述增益播放。
- bow-gesture-audition.wav：10 秒，三组完整拉弓—放箭，放箭在 1.518/4.518/7.518 秒。三档只是混音强弱演示，不代表三个不同真实力度的录音。
- bow-charge.wav 与 bow-release.wav：独立剪辑段，分别 1.18 秒与 0.35 秒。

复现：`python scripts/build-bow-gesture-audio.py`，需 NumPy、ffmpeg。共 5 个输出 WAV，通过解码、48kHz 单声道 PCM16、无削波和首尾采样检查。所有试听使用相同片段与相对混音，不对拼接后文件再次分别归一化。未宣称用户已经认可音色。

后续运行时蓄力随操作推进或分段播放，停拖淡出；禁止整段蓄力/试听反复循环制造持续拉弓声。发射仅在实际出手时触发。保留仅操作方听到蓄力、双方听到发射的设计。
