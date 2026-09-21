# Model Price Atlas

主流大模型 API 与订阅方案的价格、缓存策略和 Artificial Analysis Intelligence Index 对比工具。应用完全静态运行，外部数据只在生成版本化快照时访问。

## 功能

- 以每 1 亿 Token 的等效成本为横轴、Artificial Analysis Intelligence Index 为纵轴。
- 调整输入/输出比例、缓存命中率和缓存写入率，实时更新图表与明细。
- API、订阅价值倍数、订阅固定额度三种价格口径。
- USD/CNY、线性/对数坐标、渠道、访问方式、证据等级和 Luna 门槛筛选。
- Pareto 前沿、全榜排名、成本拆分、来源日期及估算标记。
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

缺少单独缓存价格时回退到普通输入价，数值 `0` 仍表示免费。订阅倍数法使用 `API 场景成本 / 价值倍数`；额度法使用 `月费 × 1 亿 / 月度 Token 额度`。

缓存存储时长、Batch/Fast、长上下文倍率、区域处理、搜索和工具调用费用不在当前口径内。

## 数据维护

人工价格、订阅估算和模型映射位于 [`data/catalog.json`](data/catalog.json)，生成快照位于 [`src/data/snapshot.json`](src/data/snapshot.json)。每条方案必须包含来源、日期、说明和证据等级：

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

## 验证

```bash
npm run check       # 数据校验、17 个单元/组件测试、类型检查、生产构建
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
