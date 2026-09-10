# 连续蓄力与倒放取消 v2

用户反馈上一版蓄力断断续续、取消没有反馈，提出拼接倒放蓄力声。本轮按这一方向修订离线试听，尚未接入游戏，尚待用户听感确认。

## 文件

- charge-continuous-audition.wav：3.1 秒，只演示一次 2.5 秒连续后拉，没有多个手势之间的停顿。
- charge-cancel-audition.wav：2.8 秒，先拉约 1.45 秒，再接约 0.375 秒的倒放收回声。
- gesture-audition.wav：8 秒，先蓄力并发射，后蓄力并取消。第二次取消约在 6.328 秒，后面不播放发射。
- charge-continuous.wav / charge-cancel.wav：独立候选片段；取消声仅对应本次演示所拉过的尾段，不是所有拖动时长均可直接复用的最终运行时素材。

## 调整

继续使用 C：Anthousai / rubber.wav，https://freesound.org/people/Anthousai/sounds/399008/ ，CC0 1.0。原料是公开 HQ MP3 预览。改选 1.70–3.10 秒连续源段，110Hz 高通、6kHz 低通；相对 45ms RMS 的软限幅削弱短促尖峰，100ms RMS/60ms 平滑增益减小断续的音量感。随后用 atempo 0.56 保音高延长，一次蓄力不拼入不同拉伸周期，也不循环原录音。仍可能存在原录音的频谱变化或变速质感，信号检查不能证明听感已自然。

取消从当前已拉过内容的最后 0.5 秒倒放，以 1.35 倍保音高变速收短，音量逐渐衰减；与后拉末端交叉淡化 22ms，避免先静音再发声。运行时需要从真实操作位置取尾段，停止拖动与主动取消应区别处理。

发射保留上一版 renne100 / Slingshot 的剪辑（A，CC0 1.0）：https://freesound.org/people/renne100/sounds/353033/ 。来源为 ../gesture-selected-ac/release.wav。

## 验证

运行 python scripts/refine-gesture-charge.py（NumPy、ffmpeg）。5 个 WAV 重新解码检查通过：48kHz 单声道 PCM16，时长匹配、首尾为零、无输出削波。取消在拉伸结束后确实有非零音频，末尾能量低于起始段。底声内部 100ms RMS 范围约 3.74dB；这只是音量稳定性检查，不是主观连续性保证。哈希与详细参数见 validation.json。
