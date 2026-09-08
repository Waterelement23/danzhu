# 精细院落资产

当前源文件 `refined-courtyard.blend` 保留逐件可编辑的建筑、家具、植物、地面与碰撞石子；导出时才将环境复制件按材质合并。场景使用米，游戏 `(x,y,z)` 对应 Blender `(x,-z,y)`，GLB 导出 Y-up。

## MCP 建模复现

1. 用户级配置运行 `/Users/tt/.local/bin/uvx --python 3.11 blender-mcp`。通过 `uvx --python 3.11 blender-mcp install-addon` 安装插件，在 Blender 偏好中启用 `blender_mcp` 并启动本地 9876 端口；使用 `get_addon_status` 验证协议一致。
2. 在 `scripts/blender/01_surface.py` 中将 `ROOT` 设置为本机仓库路径。Blender MCP 的 `execute_blender_code` 通过如下方式调用脚本，每一步均在同一命名空间中执行：

```python
import bpy
ROOT = '/absolute/path/to/danzhu'
ns = bpy.app.driver_namespace.setdefault('danzhu_refined', {})
exec(compile(open(ROOT + '/scripts/blender/01_surface.py').read(), '01_surface.py', 'exec'), ns)
```

3. 顺序为 **01_surface → 02_architecture → 03_planting → 05_finalize → 04_export**。每步独立 MCP 调用，便于查看与修正。`05_finalize` 校准落点、地表颜色，清除越过赛场边缘的叶片；`04_export` 保存源文件、合并临时副本导出 GLB、记录面数清单，随后移除临时副本。
4. 执行 `npm test`、`npm run build`，启动 `npm run dev` 后执行 `npm run test:browser`。检查控制台无模型加载错误，在正常游戏镜头与手机宽度下复核。

## 物理约束

`src/shared/generated/court.json` 是地面及石子的单一来源。沟槽、分支裂缝和固定粗颗粒均在该几何中；地表色差依据实际凹凸，不额外制造假起伏。所有场内石子复用导出凸网格。装饰植被、木平台、家具在白线之外，不能通过可见装饰暗示场内存在实际上没有的碰撞。

环境未使用外部付费资产或生成服务；采用确定性种子 260908，通过 Blender 几何制作。视觉以参考图的布局与材质关系为依据，不宣称达到照片级还原。当前约 51k 环境三角面和 74k 地面三角面，细分地形会增加物理计算及下载体积，仍需在目标手机上进一步实测。
