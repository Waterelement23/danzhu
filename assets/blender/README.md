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

3. 顺序为 **01_surface → 02_architecture → 03_planting → 06_natural_surface → 07_glass_marble → 05_finalize → 08_rooted_planting → 09_soft_furnishings → 10_glazing → 04_export**。每步独立 MCP 调用，便于查看与修正。`05_finalize` 校准落点、地表颜色，清除越过赛场边缘的叶片；`04_export` 保存源文件、合并临时副本导出 GLB、记录面数清单，随后移除临时副本。
4. 执行 `npm test`、`npm run build`，启动 `npm run dev` 后执行 `npm run test:browser`。检查控制台无模型加载错误，在正常游戏镜头与手机宽度下复核。

## 物理约束

`src/shared/generated/court.json` 是地面及石子的单一来源。不规则浅凹和固定粗颗粒均在该几何中；色差表示土质和矿物颜色，不用深色线条绘制假沟壑。所有场内石子复用导出凸网格。装饰植被、木平台、家具在白线之外，不能通过可见装饰暗示场内存在实际上没有的碰撞。

环境未使用外部付费资产或生成服务；采用确定性种子 260908，通过 Blender 几何制作。视觉以参考图的布局与材质关系为依据，不宣称达到照片级还原。当前约 168k 环境三角面和 131k 地面三角面，细分地形会增加物理计算及下载体积，仍需在目标手机上进一步实测。

## 自然土地与玻璃弹珠修订

`06_natural_surface` 用多尺度不规则起伏替换连续沟线，将两处土坡降低并打破对称，采用 256×256 网格、142 颗有碰撞的石子。毫米级地表细节与显示共用网格；`terrain-components.json` 仅供测试做去除浅凹/颗粒的对照，不进入游戏包。

`07_glass_marble` 建立可编辑的 96×64 球壳与 2,560 三角面的弯曲彩片，保存在源文件的 `Glass_marble_source` 集合中（位于院外且默认不参与院落渲染）。游戏加载导出的彩片顶点、索引，用相同分段重建球壳；蓝/琥珀配色由客户端材质提供。

浏览器使用非金属透射玻璃（IOR 1.52），不使用不透明球芯和粘在球面的白色亮点。一次性捕获院落与程序天空的 256px 立方体反射，供球壳使用；高光会随观察方向变化。WebGL 的屏幕空间折射采用 0.36 倍半径的有效厚度，避免内部彩片被统一球径过度放大，这属于实时外观近似，不能当作离线光线追踪。普通阴影贴图仍近似球体遮挡，未实现玻璃焦散。

## 植物、软装与门玻璃修订

`08_rooted_planting` 替换旧的散点叶片。枝条自泥土中的根部生长，每片叶通过叶柄接在枝条上，木平台植物均放入中空圆盆或有底花槽。侧平台高度 0.17m、入口平台高度 0.11m，容器底面分别贴合；露天地栽根部埋入土面。脚本检查完整叶片不越入物理场地，保留根部和枝叶数量清单 `planting-manifest.json`，不通过剪掉重叠叶片掩盖布局问题。

`09_soft_furnishings` 用上下两个鼓起的布片、收紧边缘与连续滚边制作六个软垫。抱枕具有饱满体积、圆角与倾斜摆放；256px 可平铺的经纬织纹法线和粗糙度贴图打包进 GLB，UV 按物理尺寸设置，避免 Blender 程序节点在导出后丢失。材质以高粗糙度和柔和掠射绒光表现布面。

`10_glazing` 将门玻璃改为透射率 0.95、IOR 1.52、非金属玻璃，增加把手。浏览器的 `src/client/glazing.ts` 为四扇共面的玻璃共用一个 768px 平面反射目标，使用镜像相机与裁剪平面保持正确透视，反射强度随视角变化。玻璃不投射整块不透明阴影；房间、框架和屋顶仍正常投影。探针只服务弹珠球壳，避免将同一份近似倒影强行赋给平面门。

当前环境为 16 个网格、167,568 三角面、GLB 约 7.58MB。平面反射增加一次场景渲染；这版优先解决用户指出的几何与材质缺陷。场景卸载会释放织物贴图和反射目标，目标手机的性能仍需实机检查。
