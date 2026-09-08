# 弹珠 · 再玩一个下午

一个浏览器里的 1V1 地面弹珠原型：空场开局，先手高位发球，后手贴地入场，之后从实际落点轮流弹击。物理模拟由 Rapier 运行，联网结果由服务器判定。

## 启动

使用 Node.js 24（最低 22.12；项目 `.nvmrc` 为 24）。系统 Node.js 20 无法满足当前 Colyseus/Vite 依赖要求。

```sh
npm ci
npm run dev
```

打开 [本地试玩](http://localhost:5173/)。开发服务器监听 `5173`，房间服务监听 `2567`。本机练习无需第二位玩家；联网需创建房间、让另一浏览器输入 8 位房间码，再双方准备。

手机与电脑处于同一局域网时，用电脑的局域网 IP 加 `:5173` 访问；需要两台设备都能访问服务器 `2567` 端口。本地启动不等于互联网部署。

如果使用本任务提供的桌面运行时，可在命令前临时添加：

```sh
env PATH=/Users/tt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm run dev
```

这是当前机器的可选运行方式，不是其他开发者必须采用的路径。

## 操作与规则

- 先选择发球线上的位置，按住自己的弹珠向后拖动，松手弹出；`Esc`、右键或触控取消事件可取消。
- 也可展开「精细瞄准」调整方向和力度，再按按钮发射。
- 只有先手首次入场从高处释放。后手贴地发球可以直接命中获胜，之后每次从实际停留位置出手。
- 球能弹跳、腾空、回落、旋转；从对方上方飞过但未接触不算命中。
- 先命中锁定获胜，之后出界不改判；先出界锁定失败。边界看球心水平投影，空中同样适用。
- 第 4 轮起，双方各行动一次后缩圈。界线不会反弹球。双方同时被圈外淘汰或事件精度内冲突为平局。
- 发球超时判负；普通回合超时先跳过，连续两次本人超时判负。最大 20 轮。
- 联网断线保留席位 30 秒，正在发生的击球完成后暂停新操作。刷新页面可通过「恢复上一局连接」尝试回到本人席位。主动离开视为退出。

## 验证

```sh
npm run typecheck
npm test
npm run build
```

测试使用真实 Rapier 世界与真实 Colyseus 客户端，联网测试需要允许本机监听临时端口。覆盖出手高度、弹跳/坡面/停稳、同一步事件先后、高速碰撞、非法与过期输入、缩圈、超时、重连准备共识和再战重置。

浏览器检查需先在另一个终端运行 `npm run dev`，再运行：

```sh
npm run test:browser
```

使用锁定的 Playwright CLI；首次使用需有可用 Chromium/Chrome，必要时运行 `npx playwright-cli install-browser chromium`。脚本运行本机练习和两个独立浏览器上下文的联机流程，并检查手机布局、鼠标/触摸拖动、玩法弹窗、断线恢复及恢复期间切回练习模式。截图位于被 Git 忽略的 `output/playwright/`。

## 构建与部署

```sh
npm run build
npm start
```

生产构建将静态页面和服务器产物放到 `dist/`，Node 服务默认在 `2567` 同时提供页面与 WebSocket。可通过环境变量 `PORT` 修改监听端口。经支持 WebSocket 的反向代理提供 HTTPS/WSS 后，朋友才能通过公网访问；本次没有发布公网服务。

开发时客户端默认连当前主机的 `2567`；生产时连页面同源。如分开部署，可在构建时设置 `VITE_SERVER_URL=https://你的房间服务域名`。这些 URL 不是凭据。

房间保存在单进程内存中，重启会丢失对局；未提供跨实例迁移、数据库、账号或匹配系统。首次加载练习模式会按需加载物理 WASM。

## 代码与设计

- `src/shared/`：地图、物理、规则、协议；不依赖 Three.js 或浏览器。
- `src/server/`：房间生命周期、权威模拟、输入校验和快照广播。
- `src/client/`：3D 场景、拖动输入、界面、练习/联网适配器。
- [游戏设计](docs/superpowers/specs/2026-09-07-marble-duel-design.md)
- [技术设计](docs/superpowers/specs/2026-09-07-marble-duel-technical-design.md)
- [实施记录](docs/superpowers/plans/2026-09-07-initial-prototype.md)

当前是一张通过 Blender MCP 制作的土地院落地图。水泥/沙地只作为物理测试对照，不是当前可选地图。弹珠大小、地形起伏与阻力仍需玩家试玩调校；未做大规模并发压测或实机手机性能认证。

## Blender 资产与物理表面

已安装用户级 Blender MCP 插件，验证 Blender 5.1.2 / 插件 1.6 / 协议 5。玩家和服务器无需 Blender；开发者重新建模时才需要启动插件连接。安装说明来自 [Blender MCP 项目](https://github.com/ahujasid/blender-mcp)。

- 可编辑源文件：`assets/blender/refined-courtyard.blend`。
- 浏览器环境模型：`public/models/refined-courtyard.glb`，约 3.8 MB、13 个合并网格、51,308 个三角面。
- 比赛表面：`src/shared/generated/court.json`，192 分段、37,249 个顶点、73,728 个三角面。显示与 Rapier 共用；地面高度按同一三角形插值。
- 37 块固定石子使用 Blender 导出的同一凸多面体及落点，显示与凸包碰撞一致。浅沟约 16mm 深、88mm 宽，分支裂缝约 7–9mm 深；粗颗粒起伏最高约 2.2mm。这些都是实际几何，没有只改变视觉的凹凸贴图。
- 粒状土壤目前表现为固定表面起伏，石子也固定；尚未模拟松散砂粒被推走或泥土变形。
- 场外木平台、玻璃房、栅栏、座椅、植物为环境装饰；已清除伸入比赛区的装饰叶片。

复现步骤及资产检查见 [Blender 建模说明](assets/blender/README.md)。物理专项测试对照去除浅沟、颗粒或小石子后的弹珠轨迹，确认这些几何细节实际参与接触。
