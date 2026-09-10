# 土地滚动模拟 · 第二轮试听

用户认为第一轮仍像瓷砖或木板摩擦，要求继续调整。本轮从原始连续滚动段重新处理，未增加落砂声，未做循环，未接入游戏。实际地面材质未核实，仍是硬地录音的模拟候选。

## 播放顺序

1. `earth-roll-previous.wav`：上一轮更沉闷版，字节完全相同，用作对照。
2. `earth-roll-less-resonant.wav`：180Hz 高通，1.18kHz 衰减 10dB、1.9kHz 衰减 4dB，3kHz 低通；尝试减弱低频隆隆声及中频共鸣。
3. `earth-roll-soft-friction.wav`：240Hz 高通，1.18kHz 衰减 13dB、1.9kHz 衰减 5dB，2.4kHz 低通；增加软拐点压缩，尝试柔化较尖锐起音。压缩阈值 0.018、比例 2.5、起音 2ms、释放 65ms。

每段 2.14 秒；`earth-roll-comparison.wav` 按上述顺序各播一次，段间静音 0.8 秒，总长 9.07 秒。平均 RMS 电平匹配至约 -26dBFS，差异小于 0.1dB，便于比较音色；不代表主观响度完全相同。

频段选择依据原滚动尾段的频谱分布及用户听感反馈。无法仅凭频谱判定哪些频段来自地面、球体或环境，因此是试验参数，不代表已经去除了真实房间混响或得到土面实录。没有变调、添加噪声、时间伸缩或逐个峰值切片。

原文件、此前落地和玻璃珠互撞声音保持不变。来源和加工参数在 manifest.json。运行 `python scripts/process-muted-rolling-v2.py /Users/tt/code/other/danzhu/marble_tile_drop_and_rolling.wav` 可复现，依赖 ffmpeg 与 numpy。

验证：4 个 WAV 的格式、时长、首尾端点、峰值、文件哈希正确，原始文件哈希不变，旧版对照字节一致。最终音色待用户试听。
