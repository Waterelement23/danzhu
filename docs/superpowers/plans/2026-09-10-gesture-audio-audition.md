# Gesture Audio Audition Implementation Plan

**Goal:** 制作用户已授权的蓄力/发射试听及弱中强衔接。
**Architecture:** 独立离线 NumPy 合成脚本，所有结果存入 assets/audio/gesture-candidates，保留运行时接口不变。
**Tech Stack:** Python、NumPy、PCM16 WAV。

- [x] scripts/build-gesture-audio.py：生成低通摩擦底声、三段阻尼弹击、带停止与渐变的蓄力演示，以及三档完整手势。
- [x] 输出 README.md 与 validation.json：记录来源为合成、参数、试听时间轴及客观信号检查。
- [x] 验证每个 WAV 可解码、48kHz/单声道/16bit、峰值小于 0dBFS、边缘平滑；交付三条试听，不宣称听感已验收。
