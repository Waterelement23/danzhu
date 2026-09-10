# 土地滚动模拟 · 低通与落砂叠加

用户认为此前仍过于尖锐，明确建议过滤原音频高频、降低摩擦声并叠加落砂。本轮按该方案制作离线试听；尚未接入游戏，听感待用户判断。

## 试听顺序

1. `earth-roll-low-friction.wav`：仅滚动底声。原录音 2.02–4.16 秒，140Hz 高通，1.18kHz 衰减 8dB，750Hz 四阶低通。RMS 目标 -33dBFS，比上一轮约低 7dB。
2. `earth-roll-light-sand.wav`：同一滚动底声，加较轻落砂层，落砂 RMS 目标 -39dBFS。
3. `earth-roll-more-sand.wav`：同一滚动底声，加较明显落砂层，落砂 RMS 目标 -35dBFS。

落砂取 Sheyvan 原录音 0.15–2.29 秒，180Hz 高通、1.5kHz 四阶低通，软拐点压缩阈值 0.003、比例 4、起音 0.5ms、释放 45ms。意图压轻突出的落砂撞击，不代表完全消除原录音里的落砂事件。

每段均 2.14 秒，不循环、不切成孤立撞击、不变调。首尾 20ms/60ms 淡化。三段底声相同，混合后不重新归一化，落砂较多版会稍响。`earth-roll-layered-comparison.wav` 按上述顺序播放，每段之间停 0.8 秒，共 9.07 秒。

## 来源与复现

- 用户提供的 `marble_tile_drop_and_rolling.wav`：听感属于硬地，实际录音地面与原始许可未核实，仅本地试验。
- [Gravel Stone Dirt Debris Falling Small 1 5 — Sheyvan](https://freesound.org/people/Sheyvan/sounds/569738/)，CC0 1.0。此次经用户明确要求重新用作叠加层；先前作为独立滚动声被否定的结论不变。

运行 `python scripts/mix-earth-rolling.py /Users/tt/code/other/danzhu`，依赖 ffmpeg 与 numpy。来源哈希、切点、滤镜、增益、混合电平和输出哈希见 manifest.json。

验证了 4 个 WAV 的格式、时长、首尾、无削波、RMS 电平与哈希，两个原文件哈希保持不变。已认可的土地落地声及玻璃珠碰撞声未修改。
