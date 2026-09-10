# 玻璃弹珠互撞音效

用户已选定 D43thsilence 的 Two marbles colliding。原始 WAV 已由用户下载到项目主目录；已提取 8 次独立碰撞和 7.41 秒试听合集，尚未接入游戏，剪辑版本待用户试听。

- `marble-collision-01.wav` 至 `marble-collision-08.wav`：按原录音时间顺序，各 295ms，含起音前余量和自然衰减。
- `marble-collision-audition.wav`：8 段各播放一次，每次之间留 600ms 静音；不是游戏内连续播放的碰撞序列。
- 输出为单声道 48 kHz / PCM16。原始左右声道在碰撞段略呈负相关，为避免直接合并导致相位抵消，统一选取右声道。使用同一增益 -3.5144dB，保留各次相对强弱，最高峰 -3dBFS；不逐段归一化，不变调、不压缩、不降噪。
- 仅首 1ms 和末 25ms 做淡入淡出以避免切口杂音；首段淡入位于主起音之前。起音和尾音的保留基于波形与能量分析，不能替代听感确认。
- 原文件保持不变；来源哈希、切点、输出哈希与处理参数在 `manifest.json`。

## 来源与署名

[Two marbles colliding — D43thsilence](https://freesound.org/people/D43thsilence/sounds/755084/)，[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。

游戏接入时保留以下署名及修改说明：

> Two marbles colliding by D43thsilence (Freesound), licensed under CC BY 4.0. Modified: right-channel extraction, resampling, trimming, shared gain and edge fades.

## 重现

在开发工作树运行 `python scripts/extract-collision-audio.py /Users/tt/code/other/danzhu`，依赖 ffmpeg 与 numpy。

验证：9 个输出格式、时长、峰值和端点正确；8 段非淡化区与原始右声道经重采样、统一增益后的信号一致（误差不超过 PCM16 半个量化步长）；原文件哈希不变。
