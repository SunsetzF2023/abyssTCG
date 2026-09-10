# abyssTCG 项目上下文（AGENTS.md）

> 本文件用于在另一台设备/另一个 Devin 会话中快速恢复当前项目上下文。只保留与 `abyssTCG` 游戏开发直接相关的内容，略去早期备份、个人资料等无关信息。

---

## 1. 项目与部署

- **本地仓库**：`C:\Users\jefffan\CascadeProjects\abyssTCG`
- **GitHub 仓库**：`https://github.com/SunsetzF2023/abyssTCG.git`
- **GitHub Pages 测试地址**：`https://sunsetzf2023.github.io/abyssTCG/`
- **Vite base path**：`/abyssTCG/`
- **当前最新提交**（截至本文件）：`e89506b`
  - 修复了亡语召唤随从显示 `undefined` 的问题
  - 为卡牌死亡添加了崩解碎片动画
- **部署状态**：CI 与 GitHub Pages 部署均成功

## 2. 技术栈与命令

- **构建工具**：Vite
- **语言**：Vanilla JavaScript ES modules
- **测试**：Vitest
  - 命令：`npm run test` / `npm test -- --run`
  - 当前 3 个测试文件，49 个测试通过
- **Lint**：ESLint flat config
  - 命令：`npm run lint`
- **构建**：`npm run build`
- **浏览器全局变量**：已在 `eslint.config.js` 中声明 `window`、`document`、`console`、`setTimeout`、`clearTimeout`、`Math` 等

## 3. 项目目标与边界

`abyssTCG` 是一个原创的自动战棋/PvP 游戏，灵感来自《月圆之夜：镜中对决》，但必须保持原创：

- 使用原创种族、单位名称、美术占位、数值、效果描述。
- 不直接复制《月圆之夜》的卡牌名、原画、完整数值或完整效果文本。
- 支持离线 8 人模拟（1 真人 + 7 AI），远期目标为 Supabase 在线多人对战。

## 4. 核心架构与关键文件

| 文件 | 作用 |
|------|------|
| `index.html` | 自走棋 DOM 结构、商店详情弹窗、已拥有随从详情弹窗 |
| `src/main.js` | 入口 |
| `src/style.css` | 棋盘、商店、弹窗、战斗动画样式 |
| `src/autobattler/pieces.js` | 原创 8 种族 6 阶单位定义、`RACE_INFO`、`PIECES`、`TOKEN_PIECES`、自动生成 `description` / `flavor` |
| `src/autobattler/shop.js` | 商店/备战席、六格棋盘、购买/出售/放置/合并、放置时战吼 |
| `src/autobattler/battle.js` | 纯战斗引擎、战斗日志、亡语/战吼/相邻触发 |
| `src/autobattler/game.js` | 玩家创建、8 人配对、战斗阶段、回合流转 |
| `src/autobattler/ui.js` | 商店/棋盘/备战席 UI、拖拽、弹窗、战斗流程 |
| `src/autobattler/animator.js` | 战斗回放与动画（攻击、光束、伤害数字、治疗/增益、死亡碎片、召唤） |
| `src/supabase-config.js` / `src/supabase-auth.js` | Supabase 客户端、GitHub/匿名登录 |
| `tests/autobattler.test.js` / `tests/autobattler_shop.test.js` / `tests/engine.test.js` | 测试 |

## 5. 棋盘模型

- 棋盘固定 6 格：前排 0/1/2，后排 3/4/5。
- 相邻判定使用 2×3 网格，包含左右同排和上下前后排：
  - 例如位置 1 的相邻为 0、2、4。
  - 位置 0 的相邻为 1、3。
- 放置时战吼（`battlecry`）只在从备战席拖到棋盘时触发一次。

## 6. 最近已完成的关键改动

1. **相邻检测修复**：前后排同列也算相邻。
2. **棋盘随从点击弹窗**：棋盘与备战席上的随从都能点开查看详情；拖拽完成后 250ms 内不会误触发。
3. **亡语召唤修复**：战斗日志 `summon` 事件现在携带完整属性（`race`/`tier`/`star`/`attack`/`health`/`maxHealth`/`shield`）。
4. **死亡动画**：
   - `.ab-minion.ab-dead` 使用 `card-shatter` 关键帧（放大变灰→缩小旋转消失）。
   - `markDead` 会生成 10 个 `.ab-shard` 碎片，从卡牌中心飞散。
   - `updateHp` 在生命值 ≤0 时自动调用 `markDead`。

## 7. 当前待确认/待实现：经济系统对齐《月圆之夜》PVP

### 7.1 已查到的公开信息

- 随从/装备购买统一 **3 金币**。
- 出售随从获得 **1 金币**。
- 每回合开始时获得金币 = **当前回合数 + 2**。
- 商店初始 1 级；升级后解锁高阶随从/装备。
- 商店升级所需金币每回合 **-2**。
- 未花完的金币可保留到下一回合。
- 升到 2 级商店后开始刷新装备。

### 7.2 需要确认/回忆的数值

- **首回合 4 金币** 如何处理：
  - 是初始固定给 4，然后从第 2 回合起才按“回合数 + 2”发钱？
  - 还是把公式改为“回合数 + 3”，使第 1 回合金币 = 4？
- **商店升级费用/经验表**：
  - 2/3/4/5/6 级商店各需要多少金币/经验？
  - 用户提到“每回合固定增长 2 经验 + 可用金币购买经验”，但公开攻略里写的是“升级商店所需金币每回合 -2”。
  - 需要确认采用哪种机制，并给出具体数值。

### 7.3 当前代码位置

- 经济相关常量：`src/autobattler/shop.js` 顶部 `STARTING_GOLD`、`MAX_GOLD`、`REROLL_COST`、`BASE_INCOME`、`INTEREST_*` 等。
- 升级系统：`src/autobattler/shop.js` 中的 `buyXP`、`LEVEL_TABLE`、`startRound`。
- 回合开始发钱：`startRound` 在 `src/autobattler/shop.js`；首次调用在 `src/autobattler/game.js` 的 `createGame` 中。

## 8. 用户工作流

- 希望**每次修改后直接 commit + push**，方便在 GitHub Pages 实际测试。
- UI/说明文字使用中文。
- 测试流程：`npm run lint` → `npm test -- --run` → `npm run build` → `git commit` → `git push` → 确认 CI / GitHub Pages 部署成功。

## 9. 补充约定

- 不引入未经验证的新依赖；尽量使用项目已有工具。
- 不在代码中暴露/打印密钥或 Supabase 配置。
- 保持中文界面，避免在文件中使用 emoji（除非用户要求）。
