# Docker 与已有 Nginx 共用域名

游戏为单容器、单进程服务，2567 端口同时提供页面、HTTP 房间接口及 WebSocket。生产环境只连接已有 Nginx 的 Docker 网络，不向宿主机公开游戏端口。

## 配置

在服务器项目目录创建 `.env`（不提交凭据）：

```dotenv
NGINX_NETWORK=existing-proxy-network
GAME_BASE_PATH=/danzhu/
IMAGE_TAG=release-tag
```

`GAME_BASE_PATH` 是构建参数，必须以 `/` 开头和结尾。更换路径后需要重新构建镜像。页面、模型、音效及 Colyseus HTTP/WebSocket 地址均使用该前缀，Nginx 转发时剥离前缀。开发环境默认仍为 `/`。

```sh
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=80 danzhu
```

将 `nginx-location.conf.example` 中的规则按实际路径加入现有域名的 `server` 块。先备份挂载的 Nginx 配置，再运行容器内 `nginx -t`，通过后执行 `nginx -s reload`。现有域名的 TLS 配置继续复用。不要替换其他服务的 location 或重建已有 Nginx 容器。

## 上线验证与回滚

确认 `/danzhu` 跳转到 `/danzhu/`，`/danzhu/health` 返回成功；模型、音效与脚本能从子路径加载。用两个客户端创建/加入房间，验证双方准备、WebSocket 同步和击球；检查同域名已有服务继续可用。

升级前记录当前镜像标签并保留旧镜像。出现问题时将 `IMAGE_TAG` 改为旧标签，使用 `docker compose up -d --no-build` 恢复；若游戏容器地址发生变化，需重新测试并 reload Nginx，让 upstream 重新解析。配置问题则恢复备份后测试并 reload。对局保存在进程内存中，重启游戏容器会结束正在进行的对局。

## 2026-09-10 腾讯云部署记录

- 公网地址：https://www.learntaskrevise.asia/danzhu/
- 服务器目录：`/opt/danzhu/releases/20260910-audio`；Compose 项目名 `danzhu`。
- 游戏容器：`danzhu-danzhu-1`；镜像：`danzhu:20260910-audio`。
- 镜像 digest：`sha256:64e4e86331e1036caeb08e42cac1ce0cb7a106257c4715046eac10a32b20cfef`。
- 已有 Nginx：`homework-nginx`；共享网络：`homework-agent_homework-network`。
- Nginx 宿主机配置：`/opt/homework-agent/nginx/nginx.conf`。
- 修改前备份：`/opt/homework-agent/nginx/nginx.conf.before-danzhu-20260910`。
- 新配置先在容器内独立 `nginx -t`，通过后写回原文件并热重载；保留原有其他服务配置。
- 游戏容器以非 root 用户运行，设有健康检查、自动重启和日志轮转，2567 只在 Docker 网络内开放。

已通过子路径生产构建、服务器 Docker 镜像构建及健康检查。公网验证涵盖资源、HTTPS 房间接口、双客户端 WebSocket、准备、相同场地/弹珠状态和发射/落地音效事件；浏览器实际院落加载与创建房间成功。`/exam` 与 `/health` 部署前后均为 200 且响应正文一致；`/api/` 保持原有 404，只有响应时间戳变化。未做大规模并发压测。

维护命令：

```sh
sudo docker compose --project-directory /opt/danzhu/releases/20260910-audio -p danzhu ps
sudo docker compose --project-directory /opt/danzhu/releases/20260910-audio -p danzhu logs --tail=80 danzhu
```

在开发目录复查公网联机（会创建并关闭一个临时房间）：

```sh
node --import tsx scripts/deployment-smoke.ts https://www.learntaskrevise.asia/danzhu/
```

本记录不包含登录密码、私钥或其他凭据。


## 2026-09-10 首次加载优化升级

当前版本目录改为 `/opt/danzhu/releases/20260910-startup`，镜像标签为 `danzhu:20260910-startup`；Compose 项目仍为 `danzhu`，网络与 Nginx location 不变。旧 `20260910-audio` 目录及镜像保留，可按该目录的 Compose 配置回滚。

镜像构建自动生成预压缩资源，不依赖 Nginx 的 Brotli 模块。客户端模型 URL 带内容哈希；修改模型后构建会生成新 URL。更新容器后执行 Nginx 配置测试与 reload，以重新解析游戏容器地址。

当前 startup 镜像 digest：`sha256:a5732ebd0f7892894d114da46c2ac873d4e10dc134624f1f5a7f321c3f578d86`。公网模型传输由未压缩 9.90 MB / 27.24 秒降为 Brotli 4.36 MB / 11.80 秒（此次网络测量）。

## 2026-09-10 移动端与好友邀请升级

发布目录 `/opt/danzhu/releases/20260910-mobile`，镜像 `danzhu:20260910-mobile`。沿用现有 Docker 网络和 Nginx path；保留 `20260910-startup` 作为回滚版本。

移动端对局采用全屏布局、回合自动放大与全景切换、底部瞄准区和固定像素轨迹。邀请使用 `/danzhu/?room=XXXXXXXX`；链接只含房间号，刷新原页面通过 sessionStorage 恢复本人席位。双方准备开局；再战需要双方接受，服务端规则和物理参数不变。

部署代码提交 `cefb355`；镜像 digest `sha256:7739957ed7653e74ba3c3b4b3cf40d2e54863f035571295c13b3c1c9fbd95c80`。容器健康，Nginx 检查与热重载成功。公网七项冒烟检查、手机双页面邀请入房及身份/发球提示验证通过；同域名 `/exam` 与 `/health` 保持 200。

## 2026-09-10 碰撞判胜修复

当前发布目录 `/opt/danzhu/releases/20260910-hit-fix`，镜像 `danzhu:20260910-hit-fix`，代码提交 `f978689`。镜像 digest：`sha256:4aef7bc36b595030975e7c69ac8d5a1df748dc0a17014cd3399cbae13f581a7d`。保留 `20260910-mobile` 作为回滚版本。

修复 Rapier 已产生接触响应但斜向碰撞未被胜负逻辑识别的问题。77 项测试及生产构建通过。公网用两名临时客户端执行合法发球和命中，双方收到完全一致的 `reason: hit`、获胜方与判定时间；容器健康，Nginx 检查及热重载成功。

## 2026-09-11 手机持续渲染负载优化

当前发布目录 `/opt/danzhu/releases/20260911-thermal`，镜像 `danzhu:20260911-thermal`，代码提交 `9c661af`。镜像 digest：`sha256:dfe6fb557e85fd8ee13700e71a217827f8a9ddcee1af0688d029b7e105e46eab`。保留 `20260910-hit-fix` 目录与镜像用于回滚。

移动设备采用活动 30 fps、静止 15 fps、DPR 上限 1.25 及独立光学预算；普通静态阴影和固定视角反射缓存，页面隐藏停止渲染。物理步长及胜负规则不变。83 项测试和生产构建通过，详细测量见 `docs/superpowers/plans/2026-09-11-mobile-render-budget.md`。

容器健康，Nginx 配置检查与热重载成功。公网七项冒烟检查和双客户端实际命中判胜通过；同域名 `/exam`、`/health` 保持 200。线上 Chromium 手机视口模拟（390×844、DPR=3）确认主画布 487×660，静止 6 秒 29778 次绘制调用，页面无 JavaScript 错误。未测量实际 iPhone 温度或功耗，微信及 Safari 的长时间体验仍需真机复测。

## 2026-09-11 出界后院落碰撞与标注修复

当前发布目录 `/opt/danzhu/releases/20260911-outgoing`，镜像 `danzhu:20260911-outgoing`，代码提交 `91faa31`。镜像 digest：`sha256:4f38c2ce3dfbdf56de305cacb3f036df88ee6f35811701a37f7680b86d0f39cc`。保留 `20260911-thermal` 目录及镜像用于回滚。

原先比赛土地以外的院落只有渲染模型，出界弹珠会掉穿地面；玩家标注则只判断屏幕范围。现在从实际 GLB 提取界外实体碰撞，世界创建时完成准备；标注复用已有 BVH 检查遮挡。首次击中/出界的判定顺序、1.8 秒结算延迟和手机渲染预算不变。

89 项测试和生产构建通过，包括四个方向出界持续运动、部分/完全遮挡、模型与碰撞源一致性。公网七项冒烟检查通过；双客户端实际斜向高处发球出界后，连续 34 个快照验证院落地基范围内未掉穿、球继续运动、双方结果相同。模型外缘以外自然下落不作为穿模。线上手机视口确认画布 487×660、页面无 JavaScript 错误；`/exam`、`/health` 保持 200。容器健康，Nginx 检查与热重载成功。

## 2026-09-11 当前操作者的出手朝向镜头

当前发布目录 `/opt/danzhu/releases/20260911-turn-camera`，镜像 `danzhu:20260911-turn-camera`，代码提交 `5494453`。镜像 digest：`sha256:ae6d5956b03cd7c9203c40ddf37b41791de0ba95dab97d0db80c9bfb78a2edd5`。保留 `20260911-outgoing` 目录及镜像用于回滚。

双方均已入场后，当前操作者使用从自己弹珠朝向对手的 58° 俯视透视镜头；发球及观战保持固定全景。镜头以 0.5 秒平滑过渡，瞄准和出手立即锁定，支持手动返回全景；新角度存在遮挡时尝试安全取景，否则回退全景。手机拖动方向按当前相机朝向转换，沿用现有渲染预算。物理、胜负和网络协议不变。

99 项测试、生产构建及公网七项冒烟检查通过。两个手机视口的真实线上房间完成两次发球、双方独立镜头及全景切换检查，画布保持 487×660，无 JavaScript 错误；另用两名客户端执行合法命中，双方 `hit` 判胜一致。本地验证还覆盖横屏、转场中出手、回合交接及贴边取景。容器健康，Nginx 配置检查与热重载成功，原有 `/exam`、`/health` 继续返回 200。没有实际测量 iPhone 温度或微信/Safari 手感。

## 2026-09-11 手机全场拖动与画面扩展

发布目录 `/opt/danzhu/releases/20260911-direct-aim`，镜像 `danzhu:20260911-direct-aim`，代码提交 `4933a2c`。镜像 digest：`sha256:4b92107e4574094f51449b4d31a1fded250d4e449fd1e51da3a5c85bf3bfdb29`。保留 `20260911-turn-camera` 目录及镜像用于回滚。

移除手机 242px 底部面板和横屏右侧栏，支持从画布空白处触摸拖动当前弹珠；首次操作提示在发射后收起，菜单与发球控件悬浮显示，拖回起点/多指/系统打断取消。保留桌面球附近拖动和既有联网、物理规则。手机取景仅对下方预留蓄力空间。

101 项测试、生产构建通过。浏览器原生触摸事件完成手机横竖屏、误触取消和两次入场回归；两个本地联网页面完成回合交接和转场中出手锁定，桌面操作回归通过。公网七项冒烟检查及两个手机视口的触摸发球、独立镜头、全景切换通过，无 JavaScript 错误。390×844 视口内画面从 390×528 扩展为 390×770，内部画布 487×962；保持 30/15fps、DPR 1.25 和 90 万像素上限，但实际填充像素随画面面积增加。未做真机功耗/温度测量。

容器健康，Nginx 检查与热重载成功，同域名 `/exam`、`/health` 保持 200。

## 2026-09-11 发球线直接点选

发布目录 `/opt/danzhu/releases/20260911-serve-line`，镜像 `danzhu:20260911-serve-line`，代码提交 `00f6a9c`。镜像 digest：`sha256:f7b5b79229ab69b17ae321984af5b3d4326094f20583a5ff17243064955fb87d`。保留 `20260911-direct-aim` 目录和镜像用于回滚。

移除发球滑条，轻点可用发球线附近并抬手后选定位置，拖动仍从原位置瞄准。选择线与短刻度沿地面高度和相机透视投影，触摸判定范围为线外 22px，桌面为 12px；拖动超过 5px 后即使回到起点也只取消，不重新选点。默认中间，首次提示在发球后收起。画布及物理、网络协议保持原有实现。

106 项测试和生产构建通过。手机横竖屏触摸、桌面精细瞄准的实际发射位置、双人回合/再战/断线结算、发球高度及预测轨迹回归通过。公网七项冒烟检查及两手机视口实际点选发球通过，无 JavaScript 错误；普通回合选择线隐藏，自动视角正常。容器健康，Nginx 配置检查与热重载成功，已有 `/exam`、`/health` 保持 200。

## 2026-09-11 手机退回起点取消

发布目录 `/opt/danzhu/releases/20260911-return-cancel`，镜像 `danzhu:20260911-return-cancel`，代码提交 `a6bd96f`。镜像 digest：`sha256:5b82396975ad1fa87ec36686f3164cb87bff5481a6c92b09a06ac187bf08a733`。保留 `20260911-serve-line` 目录及镜像用于回滚。

移除顶部取消按钮。触摸蓄力显示起点标记，手指附近显示力度；曾拉开 28px 后，退回起点 14px 内显示“松手取消”，立即清除轨迹和停止蓄力声，拉开到 22px 恢复蓄力。首次轻力度发射保持原死区；抬手时复核最终坐标。取消不播放新音效，发球点选择、镜头及物理和网络规则保持原有实现。

110 项测试、生产构建通过。横竖屏原生触摸覆盖取消、滞回、恢复发射、初次弱发射、多指与系统打断；桌面和双人对局回归通过。公网七项冒烟检查、两名手机视口玩家的取消后不消耗回合、继续选点发球及独立镜头验证通过，无页面错误。容器健康，Nginx 检查与热重载成功；同域名 `/exam`、`/health` 保持 200。未做真机手指遮挡和触感测量。

## 2026-09-11 真实球身取消与竖向力度条

发布目录 `/opt/danzhu/releases/20260911-marble-meter`，镜像 `danzhu:20260911-marble-meter`，代码提交 `a397c61`。镜像 digest：`sha256:fe99585698df3948dfbd456558cd4eb8ccfe3fded71fcc22224a019554fa849f`。保留 `20260911-return-cancel` 目录及镜像用于回滚。

取消目标改为当前真实弹珠的屏幕投影，覆盖高位发球与普通出手；从球身起手先拉离再返回才取消，从空白处起手可直接滑入球身取消。触摸容差至少 18px，恢复阈值额外增加 8px 防止抖动。移除额外白色起点及提示底板，在球侧边显示竖向力度条、百分比和松手提示；不增加渲染通道，物理和联网规则不变。

111 项测试和生产构建通过，手机横竖屏原生触摸检查覆盖球内/球外起手取消、轻力度出手、取消后恢复、最终坐标及系统打断。公网七项冒烟检查通过；双人手机视口验证高位和低位发球滑回球身不消耗回合，随后选点发球及独立镜头正常，力度组件背景透明且无额外圆点，无页面错误。容器健康，Nginx 检查及热重载成功，同域名 `/exam`、`/health` 保持 200。未做真机手指遮挡测量。
