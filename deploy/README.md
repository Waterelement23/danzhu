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
