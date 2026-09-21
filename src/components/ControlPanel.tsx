import { RotateCcw, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ComparisonScenario } from "../domain/pricing";
import type { EvidenceLevel } from "../domain/schema";

type ControlPanelProps = {
  channels: string[];
  selectedChannels: Set<string>;
  setSelectedChannels: Dispatch<SetStateAction<Set<string>>>;
  selectedKinds: Set<"api" | "subscription">;
  setSelectedKinds: Dispatch<SetStateAction<Set<"api" | "subscription">>>;
  selectedEvidence: Set<EvidenceLevel>;
  setSelectedEvidence: Dispatch<SetStateAction<Set<EvidenceLevel>>>;
  scenario: ComparisonScenario;
  setScenario: Dispatch<SetStateAction<ComparisonScenario>>;
  includeBelowThreshold: boolean;
  setIncludeBelowThreshold: (value: boolean) => void;
  onReset: () => void;
  onClose?: () => void;
};

const evidenceLabels: Record<EvidenceLevel, string> = {
  official: "官方",
  derived: "推导",
  estimated: "估算",
};

function toggleSet<T>(set: Set<T>, value: T) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function RangeControl({
  label,
  value,
  max = 100,
  onChange,
  valueLabel,
}: {
  label: string;
  value: number;
  max?: number;
  onChange: (value: number) => void;
  valueLabel: string;
}) {
  return (
    <label className="range-control">
      <span className="control-label">
        {label}
        <output>{valueLabel}</output>
      </span>
      <input
        type="range"
        aria-label={label}
        min="0"
        max={max}
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function ControlPanel(props: ControlPanelProps) {
  const readPercent = Math.round(props.scenario.cacheReadRate * 100);
  const writePercent = Math.round(props.scenario.cacheWriteRate * 100);
  const inputPercent = Math.round(props.scenario.inputShare * 100);

  return (
    <aside className="control-panel" aria-label="比较参数">
      <div className="control-panel__header">
        <div>
          <span className="eyebrow">SCENARIO</span>
          <h2>比较参数</h2>
        </div>
        {props.onClose ? (
          <button className="icon-button close-controls" type="button" onClick={props.onClose} aria-label="关闭参数面板">
            <X size={18} />
          </button>
        ) : null}
      </div>

      <section className="control-section">
        <RangeControl
          label="输入 : 输出"
          value={inputPercent}
          onChange={(value) => props.setScenario((current) => ({ ...current, inputShare: value / 100 }))}
          valueLabel={`${inputPercent} : ${100 - inputPercent}`}
        />
        <RangeControl
          label="缓存命中"
          value={readPercent}
          max={100 - writePercent}
          onChange={(value) => props.setScenario((current) => ({ ...current, cacheReadRate: value / 100 }))}
          valueLabel={`${readPercent}%`}
        />
        <RangeControl
          label="缓存写入"
          value={writePercent}
          max={100 - readPercent}
          onChange={(value) => props.setScenario((current) => ({ ...current, cacheWriteRate: value / 100 }))}
          valueLabel={`${writePercent}%`}
        />
        <div className="partition-bar" aria-label={`普通输入 ${100 - readPercent - writePercent}%，缓存命中 ${readPercent}%，缓存写入 ${writePercent}%`}>
          <span className="partition-regular" style={{ width: `${100 - readPercent - writePercent}%` }} />
          <span className="partition-read" style={{ width: `${readPercent}%` }} />
          <span className="partition-write" style={{ width: `${writePercent}%` }} />
        </div>
        <div className="partition-legend" aria-hidden="true">
          <span>普通 {100 - readPercent - writePercent}%</span>
          <span>命中 {readPercent}%</span>
          <span>写入 {writePercent}%</span>
        </div>
      </section>

      <section className="control-section">
        <h3>访问方式</h3>
        <div className="check-grid">
          {(["api", "subscription"] as const).map((kind) => (
            <label className="check-row" key={kind}>
              <input
                type="checkbox"
                checked={props.selectedKinds.has(kind)}
                onChange={() => props.setSelectedKinds((current) => toggleSet(current, kind))}
              />
              <span>{kind === "api" ? "API" : "订阅"}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="control-section">
        <h3>证据等级</h3>
        <div className="check-grid">
          {(Object.keys(evidenceLabels) as EvidenceLevel[]).map((level) => (
            <label className="check-row" key={level}>
              <input
                type="checkbox"
                checked={props.selectedEvidence.has(level)}
                onChange={() => props.setSelectedEvidence((current) => toggleSet(current, level))}
              />
              <span>{evidenceLabels[level]}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="control-section control-section--channels">
        <div className="section-heading">
          <h3>渠道</h3>
          <button type="button" className="text-button" onClick={() => props.setSelectedChannels(new Set(props.channels))}>
            全选
          </button>
        </div>
        <div className="channel-list">
          {props.channels.map((channel) => (
            <label className="check-row" key={channel}>
              <input
                type="checkbox"
                checked={props.selectedChannels.has(channel)}
                onChange={() => props.setSelectedChannels((current) => toggleSet(current, channel))}
              />
              <span>{channel}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="control-section control-section--switch">
        <label className="switch-row">
          <span>显示 Luna 门槛以下</span>
          <input
            type="checkbox"
            checked={props.includeBelowThreshold}
            onChange={(event) => props.setIncludeBelowThreshold(event.target.checked)}
          />
        </label>
      </section>

      <button type="button" className="reset-button" onClick={props.onReset}>
        <RotateCcw size={15} />
        恢复默认
      </button>
    </aside>
  );
}
