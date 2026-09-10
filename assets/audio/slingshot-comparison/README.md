# 弹弓对比试听

用户请求补找弹弓素材，与已制作的弓箭版比较。本目录是候选试听，未选择、未接入游戏。

| 文件 | 作者与原始页面 | 内容说明 |
| --- | --- | --- |
| slingshot-a-audition.wav | renne100, https://freesound.org/people/renne100/sounds/353033/ | Slingshot，约 0.987 秒 |
| slingshot-b-audition.wav | olver, https://freesound.org/people/olver/sounds/513934/ | Slingshot 1.wav，约 2.677 秒，作者标注为戏剧/电影拟音，带 cartoon 标签 |
| rubber-stretch-audition.wav | Anthousai, https://freesound.org/people/Anthousai/sounds/399008/ | rubber.wav，约 7.696 秒，原作者描述为拉伸健身弹力带，供蓄力参考，不是弹弓实录 |

三份来源页面均标注 CC0 1.0：https://creativecommons.org/publicdomain/zero/1.0/ 。本轮使用公开 HQ MP3 预览版本，原件保存在 source/。

加工：转为单声道 48kHz PCM16，按有效片段 RMS 调整总增益（目标 -24dBFS，峰值上限 -6dBFS），文件边缘 3ms 淡入淡出。未改变音高/时长或均衡器，保留原时间顺序。该电平匹配不等于主观等响度。

复现：python scripts/prepare-slingshot-comparison.py（NumPy、ffmpeg）。validation.json 保存来源、增益、文件哈希与验证。三个 WAV 的解码、时长、零边缘和无输出削波检查通过。原始素材未经过本人的主观听感验收，由用户比较选择。

弓箭对照保留在 ../gesture-bow-v2/bow-gesture-audition.wav；其作者为 SonoFxAudio，CC BY 4.0，署名见该目录。
