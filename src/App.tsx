import { ChartNoAxesCombined, Database, Info, SlidersHorizontal, TrendingUp } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { ComparisonTable } from "./components/ComparisonTable";
import { ControlPanel } from "./components/ControlPanel";
import snapshotJson from "./data/snapshot.json";
import { buildComparisonPoints } from "./domain/comparison";
import type { ComparisonScenario, SubscriptionMode } from "./domain/pricing";
import { snapshotSchema, type EvidenceLevel } from "./domain/schema";

const snapshot = snapshotSchema.parse(snapshotJson);
const defaultScenario: ComparisonScenario = { inputShare: 0.8, cacheReadRate: 0.5, cacheWriteRate: 0 };
const allChannels = [...new Set(snapshot.offers.map((offer) => offer.provider))].sort();
const PriceChart = lazy(() => import("./components/PriceChart").then((module) => ({ default: module.PriceChart })));

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="toolbar-group">
      <span>{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className={value === option.value ? "is-active" : ""}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function App() {
  const [currency, setCurrency] = useState<"USD" | "CNY">("USD");
  const [scale, setScale] = useState<"linear" | "log">("linear");
  const [subscriptionMode, setSubscriptionMode] = useState<SubscriptionMode>("multiplier");
  const [scenario, setScenario] = useState<ComparisonScenario>(defaultScenario);
  const [selectedChannels, setSelectedChannels] = useState(new Set(allChannels));
  const [selectedKinds, setSelectedKinds] = useState(new Set<"api" | "subscription">(["api", "subscription"]));
  const [selectedEvidence, setSelectedEvidence] = useState(
    new Set<EvidenceLevel>(["official", "derived", "estimated"]),
  );
  const [includeBelowThreshold, setIncludeBelowThreshold] = useState(false);
  const [showPareto, setShowPareto] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(false);

  const luna = snapshot.models.find((model) => model.id === "gpt-5-6-luna");
  if (!luna?.benchmark) throw new Error("Snapshot is missing the Luna benchmark threshold");
  const lunaThreshold = luna.benchmark.intelligenceIndex;

  const allPoints = useMemo(
    () => buildComparisonPoints(snapshot, scenario, subscriptionMode),
    [scenario, subscriptionMode],
  );
  const points = useMemo(
    () =>
      allPoints.filter((point) => {
        const score = point.model.benchmark?.intelligenceIndex;
        return (
          score !== undefined &&
          (includeBelowThreshold || score >= lunaThreshold) &&
          selectedChannels.has(point.offer.provider) &&
          selectedKinds.has(point.offer.kind) &&
          selectedEvidence.has(point.offer.evidence.level)
        );
      }),
    [allPoints, includeBelowThreshold, lunaThreshold, selectedChannels, selectedEvidence, selectedKinds],
  );
  const belowThreshold = snapshot.models.filter(
    (model) => model.benchmark && model.benchmark.intelligenceIndex < lunaThreshold,
  );
  const unscored = snapshot.models.filter((model) => !model.benchmark);
  const visibleModels = new Set(points.map((point) => point.model.id)).size;
  const estimatedCount = points.filter((point) => point.offer.evidence.level === "estimated").length;

  function resetControls() {
    setScenario(defaultScenario);
    setSelectedChannels(new Set(allChannels));
    setSelectedKinds(new Set(["api", "subscription"]));
    setSelectedEvidence(new Set(["official", "derived", "estimated"]));
    setIncludeBelowThreshold(false);
  }

  const controlProps = {
    channels: allChannels,
    selectedChannels,
    setSelectedChannels,
    selectedKinds,
    setSelectedKinds,
    selectedEvidence,
    setSelectedEvidence,
    scenario,
    setScenario,
    includeBelowThreshold,
    setIncludeBelowThreshold,
    onReset: resetControls,
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <ChartNoAxesCombined size={23} />
          </div>
          <div>
            <span className="eyebrow">MODEL PRICE ATLAS · 2026</span>
            <h1>模型价格图谱</h1>
          </div>
        </div>
        <div className="snapshot-status">
          <Database size={15} />
          <span>
            数据快照 <time dateTime={snapshot.generatedAt}>{snapshot.generatedAt.slice(0, 10)}</time>
          </span>
          <i>AA v{luna.benchmark.indexVersion}</i>
        </div>
      </header>

      <nav className="top-toolbar" aria-label="显示选项">
        <button className="mobile-filter-button" type="button" onClick={() => setControlsOpen(true)}>
          <SlidersHorizontal size={16} />
          参数
        </button>
        <SegmentedControl
          label="货币"
          value={currency}
          options={[
            { value: "USD", label: "USD" },
            { value: "CNY", label: "CNY" },
          ]}
          onChange={setCurrency}
        />
        <SegmentedControl
          label="订阅折算"
          value={subscriptionMode}
          options={[
            { value: "multiplier", label: "价值倍数" },
            { value: "quota", label: "固定额度" },
          ]}
          onChange={setSubscriptionMode}
        />
        <SegmentedControl
          label="价格轴"
          value={scale}
          options={[
            { value: "linear", label: "线性" },
            { value: "log", label: "对数" },
          ]}
          onChange={setScale}
        />
        <label className="pareto-toggle">
          <input type="checkbox" checked={showPareto} onChange={(event) => setShowPareto(event.target.checked)} />
          <TrendingUp size={15} />
          Pareto
        </label>
      </nav>

      <main className="workspace">
        <div className="desktop-controls">
          <ControlPanel {...controlProps} />
        </div>

        <section className="analysis-stage" aria-labelledby="chart-heading">
          <div className="stage-heading">
            <div>
              <span className="eyebrow">COST × INTELLIGENCE</span>
              <h2 id="chart-heading">能力成本分布</h2>
            </div>
            <div className="stage-metrics" aria-label="当前结果摘要">
              <span><b>{visibleModels}</b> 模型</span>
              <span><b>{points.length}</b> 方案</span>
              <span><b>{estimatedCount}</b> 估算</span>
            </div>
          </div>
          <div className="chart-key">
            <span><i className="dot dot--api" />API</span>
            <span><i className="dot dot--subscription" />订阅</span>
            <span><i className="dot dot--estimate" />估算</span>
          </div>
          <Suspense fallback={<div className="price-chart chart-loading">正在绘制价格分布…</div>}>
            <PriceChart
              points={points}
              currency={currency}
              usdToCny={snapshot.exchangeRate.usdToCny}
              scale={scale}
              lunaThreshold={lunaThreshold}
              showPareto={showPareto}
              subscriptionMode={subscriptionMode}
            />
          </Suspense>
          <div className="chart-footnote">
            <Info size={14} />
            <span>标准文本 Token；不含 Batch、Fast、长上下文、工具调用与缓存存储费。</span>
            <span>USD/CNY {snapshot.exchangeRate.usdToCny.toFixed(4)} · {snapshot.exchangeRate.asOf}</span>
          </div>
        </section>
      </main>

      <section className="results-section" aria-labelledby="results-heading">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">COMPARISON LEDGER</span>
            <h2 id="results-heading">方案明细</h2>
          </div>
          <span>{subscriptionMode === "multiplier" ? "订阅按价值倍数折算" : "订阅按月度 Token 额度折算"}</span>
        </div>
        <ComparisonTable points={points} currency={currency} usdToCny={snapshot.exchangeRate.usdToCny} />
      </section>

      {(belowThreshold.length > 0 || unscored.length > 0) && (
        <section className="catalog-notes" aria-labelledby="excluded-heading">
          <div>
            <span className="eyebrow">CATALOG NOTES</span>
            <h2 id="excluded-heading">未进入默认图表</h2>
          </div>
          <div className="excluded-list">
            {belowThreshold.map((model) => (
              <div key={model.id}>
                <strong>{model.name}</strong>
                <span>{model.benchmark?.intelligenceIndex.toFixed(1)} · 低于 Luna {lunaThreshold.toFixed(1)}</span>
              </div>
            ))}
            {unscored.map((model) => (
              <div key={model.id}>
                <strong>{model.name}</strong>
                <span>暂无 Artificial Analysis 评分</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer>
        <span>MODEL PRICE ATLAS</span>
        <p>
          Benchmark data sourced from{" "}
          <a href="https://artificialanalysis.ai/" target="_blank" rel="noreferrer">Artificial Analysis</a>.
          价格与订阅额度以各条来源及快照日期为准。
        </p>
      </footer>

      {controlsOpen ? (
        <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label="比较参数">
          <button className="drawer-backdrop" type="button" onClick={() => setControlsOpen(false)} aria-label="关闭参数面板" />
          <div className="drawer-sheet">
            <ControlPanel {...controlProps} onClose={() => setControlsOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
