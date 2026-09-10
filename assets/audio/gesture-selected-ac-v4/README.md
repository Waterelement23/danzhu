# 当前候选：连续蓄力、A 发射、取消无附加声音

用户纠正此前判断：取消蓄力正常不应有声音。当前方案覆盖 v2/v3 的倒放或回弹取消设计；历史文件保留对照，不作为接入候选。

- charge-continuous.wav：沿用 v3 连续 C 蓄力，样本不变，2.37 秒。
- release.wav：沿用用户所选 A 的加工发射，样本不变，0.23 秒。
- charge-cancel-audition.wav：1.5 秒蓄力，最后 40ms 淡出，没有倒放、回弹或发射声，没有额外尾部静音。
- gesture-audition.wav：先完整蓄力发射，间隔 0.6 秒，再蓄力取消。

取消只停止正在播放的蓄力层，短淡出用于避免截断杂音，不新增一个“取消音效”。此版本已获用户授权用于游戏，连续蓄力与发射分别复制为 `public/audio/charge.wav` 和 `launch.wav`；其余文件仅为离线试听。实际混音听感仍以游戏试玩为准。

来源 C：Anthousai, rubber.wav, https://freesound.org/people/Anthousai/sounds/399008/ ，CC0 1.0。
来源 A：renne100, Slingshot, https://freesound.org/people/renne100/sounds/353033/ ，CC0 1.0。
当前源自此前公开 HQ MP3 试听的加工结果，具体来源链见前版 README 和 validation.json。

复现 scripts/prepare-gesture-silent-cancel.py（NumPy）。验证包括重新解码、源片段样本一致性、取消前段不变且只在末 40ms 淡出、长度无额外回弹尾音、首尾为零、无削波。
