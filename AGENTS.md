# abyssTCG 项目上下文（AGENTS.md）

> 本文件用于在另一台设备/另一个 Devin 会话中快速恢复当前项目上下文。只保留与 `abyssTCG` 游戏开发直接相关的内容，略去早期备份、个人资料等无关信息。
> 当前卡池：**48 张随从，0 张咒术**；用户计划新增咒术牌与更多随从。

---

## 1. 项目与部署

- **本地仓库**：`C:\Users\jefffan\CascadeProjects\abyssTCG`
- **GitHub 仓库**：`https://github.com/SunsetzF2023/abyssTCG.git`
- **GitHub Pages 测试地址**：`https://sunsetzf2023.github.io/abyssTCG/`
- **Vite base path**：`/abyssTCG/`
- **当前最新提交**：`4bd3a28`
  - 修复 PVP 广播通道未订阅 + 房主拖拽放置失效
- **部署状态**：CI 与 GitHub Pages 部署均成功

## 2. 技术栈与命令

- **构建工具**：Vite
- **语言**：Vanilla JavaScript ES modules
- **测试**：Vitest（3 个测试文件，50 个测试通过）
  - 命令：`npm run test` / `npm test -- --run`
- **Lint**：ESLint flat config
  - 命令：`npm run lint`
- **构建**：`npm run build`
- **工作流**：`npm run lint` → `npm run test` → `npm run build` → `git commit` → `git push` → 确认 CI / Pages

## 3. 项目目标与边界

`abyssTCG` 是原创自动战棋/PvP 游戏，灵感来自《月圆之夜：镜中对决》：

- 使用原创种族、单位名称、数值、效果描述，不直接复制参考游戏。
- 当前支持离线 8 人模拟（1 真人 + 7 AI），远期目标 Supabase 在线多人。
- 棋盘 6 格：前排 0/1/2，后排 3/4/5。
- 相邻判定：左右同排 + 前后同列。

## 4. 核心架构与关键文件

| 文件 | 作用 |
|------|------|
| `index.html` | 自走棋 DOM 结构、商店/备战席/详情弹窗 |
| `src/main.js` | 入口 |
| `src/style.css` | 棋盘、商店、弹窗、战斗动画样式 |
| `src/autobattler/pieces.js` | 8 种族 6 阶单位定义、`RACE_INFO`、`PIECES`、`TOKEN_PIECES`、自动生成 `description`/`flavor` |
| `src/autobattler/shop.js` | 商店/备战席/六格棋盘、购买/出售/放置/合并、放置时战吼、三连合成、升级商店 |
| `src/autobattler/battle.js` | 纯战斗引擎、事件日志、目标选择、攻击顺序、亡语/成长/盾/先手/连击/顺劈/贯穿 |
| `src/autobattler/game.js` | 玩家创建、8 人配对、战斗阶段、回合流转、伤害结算、成长持久化 |
| `src/autobattler/ui.js` | 商店/棋盘/备战席 UI、拖拽、弹窗、战斗按钮、玩家信息显示 |
| `src/autobattler/room.js` | 本地 8 人房间大厅（8 插槽、房主、添加/踢出/一键补全 AI） |
| `src/autobattler/animator.js` | 战斗回放与动画（卡牌飞跃、伤害数字、治疗/增益/减益、死亡碎片、召唤） |
| `src/supabase-config.js` / `src/supabase-auth.js` | Supabase 客户端、GitHub/匿名登录 |
| `supabase/schema.sql` | Supabase 实时 PVP 表结构（profiles、rooms、invitations） |
| `src/supabase-room.js` | Supabase 房间/邀请/在线列表/订阅客户端 |
| `tests/autobattler.test.js` / `tests/autobattler_shop.test.js` / `tests/engine.test.js` | 测试 |

## 5. 当前卡池

- **总卡牌**：47 张（全部随从，0 咒术；已移除「花匠」）
- **阵营**：neutral、ghost、warrior、starborne、mech、nature、beast、dragon（各 6 张）
- **星级/tier**：1~6 阶，每阶 8 张，每个阵营每个 tier 1 张
- **token 随从**：见 `TOKEN_PIECES`
- 已新增约 112 条原始咒术牌数据到 `src/autobattler/spells.js`（效果逻辑尚未实现）
- 用户计划后续新增咒术牌与更多随从

## 6. 经济与商店等级

- `STARTING_GOLD = 0`
- 每回合开始收入：`当前回合 + 2`（第 1 回 3，第 2 回 4，第 3 回 5…）
- 购买任意商店卡牌：**3 金币**
- 出售任意随从：**1 金币**
- 刷新商店：**1 金币**
- 金币跨回合完全保留，无利息机制
- 商店等级 1~6，升级后解锁高阶随从卡池
- 每回合战斗结束（无论胜负/平局），存活玩家获得 **2 点商店经验**
- 升级需一次性全额买断：`剩余金币 = 升级总经验 - 当前经验`；升级后经验清零、等级 +1
- 升级经验：1→2 需 7，2→3 需 13，3→4 需 17，4→5 需 19，5→6 需 21
- 升级后奖励目标等级随机随从卡到备战席
- 代码位置：`src/autobattler/shop.js` `LEVEL_TABLE`、`upgradeShop`、`startRound`；`src/autobattler/game.js` `resolveCombatPhase`

## 7. 随从实例与三连合成

- `PIECES` 是静态只读模板；`rollShop` 使用 `{ ...piece }` 生成镜像，`buyPiece` 通过 `createMinionInstance` 创建私有实例。
- 准备阶段属性变更（入场战吼、装备等）只作用于 `Minion Instance` 的 `attack`/`health`/`maxHealth`，永不回写 `PIECES`。
- `tryMerge`（三连合成）：
  1. 新星级实例基础值 = `模板属性 × 新星级`
  2. 累计三个旧实例的永久增量：`attack - 模板攻击×旧星级`、`health/maxHealth - 模板生命×旧星级`
  3. 将累计增量加到新实例
  4. 奖励一张 `(商店等级 + 1)` tier 随机随从到备战席（最高 6 级）
  5. 旧实例 GUID 销毁，新实例获得全新 GUID
- 战斗运行时：`getCombatBoard` 生成临时克隆；非成长类伤害/buff 只在克隆上发生。
- 战后持久化：遍历战斗日志，把 `subtype === 'grow'` 的 `buff` 事件增量写回 `player.board` 原始实例。其余战斗内变化不保留。

## 8. 战斗行为与伤害结算

- **攻击顺序**：前排从左到右，双方交替出手；前排全部完成本轮攻击后，后排从左到右继续。
- **目标锁定**：优先攻击敌方前排；若前排有存活则只打前排，按左到右选择；前排全灭后解锁后排，同样左到右。
- **剧毒机制已移除**。
- 战斗持续直到一方所有随从阵亡，立即结算。
- 单次交战采用**双向同时结伤**：进攻方造成伤害的同时，防守方立即反击；即使防守方被击杀，其反击伤害仍完整结算。
- **先手**：先手随从在战斗回合开始阶段发动一次单向攻击；无论目标是否存活，先手方都不承受反击。
- **护盾**：护盾优先抵消一次受到的 damage，但随从仍正常反击；被攻击方破盾后，该次伤害不扣血。
- 玩家受到伤害 = `胜利方存活随从星级之和 + 胜利方当前商店等级`
- 平局双方不受伤害。
- 先手/连击/顺劈/贯穿/护盾/亡语/成长等按 `battle.js` 实现。

## 9. 动画与 UI 要点

- 攻击：攻击卡牌克隆飞撞目标并返回，命中时目标闪红、弹伤害数字、扣血。
- 增益：卡牌上攻击/生命数字直接变成金色并放大，无向上箭头。
- 减益：数字闪白色/淡蓝色并放大。
- 死亡：卡牌崩解成 10 个碎片飞散。
- 召唤：从日志完整属性重建卡牌并播放入场动画。
- 战斗动画始终将玩家置于右侧「我方」、对手置于左侧「敌方」，与 `result.attacker/defender` 无关。
- 商店升级按钮显示具体剩余金币，金币足够时才可点击。

## 10. 用户工作流

- 每次修改后 `commit + push`，方便在 GitHub Pages 实际测试。
- UI/说明文字使用中文。
- 不引入未验证新依赖；不暴露 Supabase 密钥。
- 尽量避免 emoji（除非用户要求）。

## 11. 近期待办（根据用户最新计划）

- 用户将新增咒术牌与更多随从牌，需扩展 `PIECES` 数据模型或新增 `type` 字段区分 `minion`/`spell`。
- 咒术牌在商店、手牌/备战席、战斗中的使用逻辑需进一步设计。
- 8 人房间系统：本地已实现 8 插槽、房主、添加/踢出/一键补全 AI、开始游戏；Supabase 在线部分已写 schema 与 `supabase-room.js`。
- 在线 PVP 与 AI 同构处理：真人 vs 真人/AI vs AI/真人 vs AI 的匹配与战斗广播/纯结算流程。
- 下一步：把 `supabase-room.js` 的创建/加入/邀请 UI 接入主菜单和房间大厅。
