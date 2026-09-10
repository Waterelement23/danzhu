# 硬地滚动声 → 沉闷音色试听

用户要求尝试将瓷砖滚动声加工得沉闷一些，作为土地滚动的模拟候选。未确认其听感符合土地，未接入游戏。原始录音的实际地面材质未核实，“瓷砖”是此前用户的听感归类。

## 试听

- `earth-roll-reference.wav`：原滚动段对照，80Hz 高通、试听增益与切口淡化。
- `earth-roll-mild.wav`：轻度变闷，1.8kHz 宽带衰减 3dB，2.8kHz 二阶低通。
- `earth-roll-muted.wav`：更沉闷，100Hz 高通、2.2kHz 宽带衰减 5dB、1.4kHz 二阶低通。
- `earth-roll-comparison.wav`：依次播放对照、轻度、更沉闷，各一次，间隔 0.8 秒，共 9.07 秒。

均使用原录音 2.02–4.16 秒的连续滚动段，每段 2.14 秒，不含前面的主要落地弹跳。没有变调、伸缩时间、添加砂砾、逐峰切割或循环。三段按 RMS -26dBFS 匹配电平，淡化后电平差小于 0.1dB；这只是比较辅助，不等于严格的主观等响度。首尾做 12ms/40ms 淡化，非动态压缩。

## 来源与复现

来源：用户提供的 `marble_tile_drop_and_rolling.wav`，原文件未修改，来源网站及许可未随文件提供。目前仅本地试听。哈希、完整滤镜、增益和输出参数见 manifest.json。

运行 `python scripts/process-muted-rolling.py /Users/tt/code/other/danzhu/marble_tile_drop_and_rolling.wav`，需 ffmpeg 与 numpy。

验证了四个输出的格式、时长、首尾端点、无削波，三段 RMS 差异及源文件哈希。高频能量占比依次降低，但是否接近土地仍需用户试听；滤波不会产生原录音没有的土面接触细节。
