# Model Price Atlas

主流大模型 API 与订阅方案的价格、缓存策略和 Artificial Analysis Intelligence Index 对比工具。应用完全静态运行，外部数据只在生成版本化快照时访问。

## 功能

- 以每 1 亿 Token 的等效成本为横轴、Artificial Analysis Intelligence Index 为纵轴。
- 调整输入/输出比例、缓存命中率和缓存写入率，实时更新图表与明细。
- 订阅统一折算为月度 API 等值、优惠倍数和每 1 亿 Token 等效成本。
- USD/CNY、线性/对数坐标、渠道、访问方式、证据等级和可自定义最低 Index 筛选。
- Pareto 前沿、全榜排名、成本拆分、来源日期及估算标记。
- 官方与第三方订阅渠道独立着色；渠道图例支持悬浮、键盘聚焦和点击保持高亮。
- 桌面工作台和移动参数抽屉。

## 本地运行

```bash
npm install
npm run dev
```

默认开发地址为 `http://localhost:5173`。

## 计算口径

总 Token 固定为 100,000,000，输入 Token 被划分为普通输入、缓存命中和缓存写入三个互斥部分：

```text
API 成本 = (普通输入×输入价 + 缓存命中×缓存读取价 + 缓存写入×缓存写入价 + 输出×输出价) / 1,000,000
```

缺少单独缓存价格时回退到普通输入价，数值 `0` 仍表示免费。默认场景为输入/输出 `90:10`、缓存命中 `95%`、缓存写入 `0%`。

订阅没有互斥的“倍数法/额度法”显示模式。每个计划先按其公开数据统一计算优惠倍数：

```text
美元额度计划：月 API 等值 = 每期 API Credits × 每月期数
Token 额度计划：月 API 等值 = 参考场景 API 成本 × 月 Token 额度 / 1 亿
优惠倍数 = 月 API 等值 / 月费
订阅每亿 Token 等效成本 = 当前场景 API 成本 / 优惠倍数
```

当前 Codex Pro 20x 的 Astra、Sol、Luna 使用 Codex Radar 的单模型周 API 等值；GLM Coding Plan 使用官方 95% 缓存命中率 Token 区间中点；其他估算值均在目录中保留来源与说明。

最低 Index 默认取当前快照中 GPT-5.6 Luna 的 `37.3`，可在参数面板直接输入任意 `0–100` 数值。

Codex Pro 5x 按同模型 Pro 20x 总额度的四分之一计算，月费为二分之一，因此每 1 亿 Token 等效成本固定为 Pro 20x 的两倍。没有模型级额度依据的 Terra 和 Plus 不生成订阅估算。模型是否进入图表只由当前最低 Index 决定，不因存在更新版本而排除旧模型。

缓存存储时长、Batch/Fast、长上下文倍率、区域处理、搜索和工具调用费用不在当前口径内。

## 数据维护

人工价格、订阅估算和模型映射位于 [`data/catalog.json`](data/catalog.json)，生成快照位于 [`src/data/snapshot.json`](src/data/snapshot.json)。订阅估值使用 `api-credit` 或 `token-quota` 作为数据来源，但两者最终都会生成同一种优惠倍数。每条方案必须包含来源、日期、说明和证据等级：

- `official`：供应商直接公布。
- `derived`：由供应商公布的月费、额度或价格推导。
- `estimated`：没有固定公开额度，按注明的工作负载假设估算。

刷新 Artificial Analysis 数据：

```bash
cp .env.example .env
# 在 .env 中设置 ARTIFICIAL_ANALYSIS_API_KEY
npm run data:sync
npm run data:check
```

同步脚本会分页拉取免费 API、计算全榜竞争排名、合并人工目录，并在官方输入/输出价格与 AA 数据冲突时停止生成。API Key 不会进入浏览器包或 Git。

只修改人工价格或订阅额度、不刷新 AA 时：

```bash
npm run data:build
npm run data:check
```

## 验证

```bash
npm run check       # 数据校验、20 个单元/组件测试、类型检查、生产构建
npm run test:e2e    # Chromium 桌面与移动端 E2E、Canvas 像素检查
```

首次运行 E2E 需要安装浏览器：

```bash
npx playwright install chromium
```

## 部署

```bash
npm ci
npm run build
```

将 `dist/` 发布到任意静态托管服务即可。运行时不需要环境变量、后端或第三方网络请求。

Benchmark data sourced from [Artificial Analysis](https://artificialanalysis.ai/). 使用其数据时应保留页面中的来源归属。
