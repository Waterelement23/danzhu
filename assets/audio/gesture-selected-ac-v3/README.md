# 蓄力末段与取消回弹反馈 v3

用户反馈连续蓄力最后约一秒像无声、取消体验不到松开。检查上一版：蓄力本体末段仍约 -29dBFS RMS，但独立试听有 0.35 秒尾部静音；取消仅约 0.374 秒、整体比蓄力轻，尾部很快衰减。此修订不等于确认玩家主观无声感只由留白导致。

- charge-continuous-audition.wav（2.37 秒）：去掉前后留白，使用上版连续拉伸的内部片段，整体约 -26.5dBFS RMS，只在末尾 25ms 收尾。最后半秒有效部分比前段高 1.19dB，没有整段末秒静音。
- charge-cancel-audition.wav（2.135 秒）：约 1.485 秒进入取消声，倒放最近 0.85 秒拉伸，以变化的重采样速度造成从高到低的回弹感，再衰减，取消长度 0.65 秒，交叉淡化 15ms。此为有意改变音高的拟音设计，不是保音高倒放，也不是真实物理模拟。
- cancel-only-audition.wav：单独的 0.65 秒取消声。
- gesture-audition.wav（5.32 秒）：先蓄力发射，中间留 0.6 秒分隔，再蓄力取消；取消发生在约 4.67 秒。

取消起始 150ms RMS 比前段蓄力高约 0.52dB，避免一开始就被蓄力掩盖；尾部逐渐变弱。主观是否有松开感仍需用户试听。原选 A 发射保持不变。所有文件末尾没有额外静音填充。

来源：C / rubber.wav by Anthousai，https://freesound.org/people/Anthousai/sounds/399008/ ，CC0 1.0，使用公开 HQ MP3 预览的前版加工结果。组合发射：A / Slingshot by renne100，https://freesound.org/people/renne100/sounds/353033/ ，CC0 1.0。许可链接：https://creativecommons.org/publicdomain/zero/1.0/ 。没有添加弓箭或独立合成弹簧层。

复现脚本 scripts/refine-gesture-release-feedback.py（NumPy）。4 个 WAV 的解码、采样格式、首尾、无削波检查通过；另测蓄力最后半秒有效音量、取消起音音量及尾部静音长度。结果和哈希见 validation.json。离线候选，未接入游戏，未标记听感通过。
