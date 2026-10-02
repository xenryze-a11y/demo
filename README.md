# 灰烬圣堂 / Cathedral of Ash

一款可直接运行的 2D Canvas 暗黑西幻动作 RPG Demo。项目采用开放、零后端的 Web 架构，基于 Vite 官方模板的目录约定和 Canvas 2D API 进行改造，方便继续交给 AI 或开发团队扩展。

## 已实现

- 2600×1900 完整可探索墓园地图、镜头跟随与碰撞
- WASD 移动、鼠标瞄准和远程普攻
- 裂魂箭、血月斩、幽冥新星三种独立技能
- 尸鬼、教徒、幽魂和 Boss 四类敌人，含追踪、攻击、受伤和死亡
- 经验、升级、生命/魂能、伤害、护甲和暴击属性
- 随机战利品、靠近按 E 拾取、四槽装备和属性生效
- Boss 血条、任务、背包、技能冷却、死亡重试及响应式 HUD

## 运行

要求 Node.js 20+。项目没有第三方运行依赖，`npm install` 仅生成锁文件：

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 操作

| 操作 | 按键 |
|---|---|
| 移动 | `W A S D` |
| 瞄准 / 普攻 | 鼠标移动 / 左键 |
| 三个技能 | `1` `2` `3` |
| 拾取 | `E` |
| 背包 | `I` |

手机浏览器会自动显示虚拟摇杆、三个技能按钮、攻击和拾取按钮；触控攻击时会自动瞄准最近的敌人。建议横屏游玩。

## 继续开发

- `src/data.js`：集中配置世界大小、技能、装备、怪物和障碍物；修改数值不需要碰引擎代码。
- `src/game.js`：游戏循环、实体、战斗、AI、掉落、碰撞和 Canvas 渲染。
- `src/style.css`：开始界面和 HUD 的全部视觉样式。
- `index.html`：语义化 UI 骨架。

建议下一步将 `drawPlayer` / `drawEnemy` / `drawProps` 替换成精灵图加载器，并把地图数据迁移为 Tiled JSON。现有战斗数据结构无需重写即可复用。

## 开源与资源说明

- 工程结构参考 [Phaser 官方 Vite 模板](https://github.com/phaserjs/template-vite)（MIT），实际运行时仅使用浏览器 Canvas，避免交付时被特定引擎锁定。
- 零第三方运行依赖；开发服务器与构建脚本仅使用 Node.js 标准库，便于直接交付。
- 所有游戏绘制和 UI 代码均在本仓库内；场景、角色与特效为代码实时绘制，没有复制第三方或商业游戏素材。
- 字体通过 Google Fonts 加载；断网时自动回退到系统衬线字体，不影响游玩。

详见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。

交给灵光闪应用继续开发时，请先阅读 [`灵光交接说明.md`](./灵光交接说明.md)。
