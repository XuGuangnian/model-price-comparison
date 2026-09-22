import { LineChart, ScatterChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { init, use } from "echarts/core";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsType, SeriesOption } from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";
import { convertUsd } from "../domain/pricing";
import { getParetoPointIds, type ComparisonPoint } from "../domain/comparison";

use([
  ScatterChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  AriaComponent,
  LabelLayout,
  CanvasRenderer,
]);

const providerColors: Record<string, string> = {
  OpenAI: "#171b18",
  DeepSeek: "#2f6fed",
  "Z AI": "#17936b",
  SpaceXAI: "#dc4a3d",
  Anthropic: "#d06b3c",
  Meta: "#128c91",
  Google: "#d79c12",
  Xiaomi: "#f05a28",
  OpenCode: "#7656d6",
  "Command Code": "#ae4f83",
};

const channelOrder = [
  "OpenAI",
  "Anthropic",
  "DeepSeek",
  "Xiaomi",
  "Google",
  "Meta",
  "Z AI",
  "SpaceXAI",
  "OpenCode",
  "Command Code",
];

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] as string);
}

type PriceChartProps = {
  points: ComparisonPoint[];
  currency: "USD" | "CNY";
  usdToCny: number;
  scale: "linear" | "log";
  indexThreshold: number;
  showPareto: boolean;
};

export function PriceChart(props: PriceChartProps) {
  const chartElement = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType | null>(null);
  const [compact, setCompact] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);
  const paretoIds = useMemo(() => getParetoPointIds(props.points), [props.points]);
  const channels = useMemo(() => {
    const available = new Set(props.points.map((point) => point.offer.provider));
    return [
      ...channelOrder.filter((channel) => available.has(channel)),
      ...[...available].filter((channel) => !channelOrder.includes(channel)).sort(),
    ];
  }, [props.points]);
  const activeChannel = hoveredChannel ?? selectedChannel;

  useEffect(() => {
    if (!chartElement.current) return;
    chart.current ??= init(chartElement.current, undefined, { renderer: "canvas" });
    const formatter = new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: props.currency,
      maximumFractionDigits: 2,
    });
    const labeledModels = new Set<string>();

    const series: SeriesOption[] = channels.map((channel, channelIndex) => ({
      name: channel,
      type: "scatter" as const,
      symbolSize: 15,
      z: 4,
      itemStyle: {
        color: providerColors[channel] ?? "#6b706b",
        borderColor: "#f4f1e8",
        borderWidth: 2,
        opacity: activeChannel && activeChannel !== channel ? 0.14 : 1,
      },
      emphasis: { focus: "series", scale: 1.45, itemStyle: { opacity: 1, shadowBlur: 10 } },
      labelLayout: { hideOverlap: true, moveOverlap: "shiftY" as const },
      data: props.points
        .filter((point) => point.offer.provider === channel)
        .map((point) => {
          const shouldLabel =
            !compact &&
            (activeChannel === channel ||
              (!activeChannel && point.offer.kind === "api" && (point.model.benchmark?.intelligenceIndex ?? 0) >= 44)) &&
            !labeledModels.has(point.model.id);
          if (shouldLabel) labeledModels.add(point.model.id);
          const isEstimate = point.offer.evidence.level === "estimated";
          return {
            value: [
              convertUsd(point.costUsd, props.currency, props.usdToCny),
              point.model.benchmark?.intelligenceIndex ?? 0,
            ],
            point,
            symbol: point.offer.kind === "api" ? "circle" : isEstimate ? "emptyDiamond" : "diamond",
            symbolSize: paretoIds.has(point.id) ? 19 : 14,
            itemStyle: paretoIds.has(point.id)
              ? { borderColor: "#00a6a6", borderWidth: 3, shadowColor: "rgba(0,166,166,.24)", shadowBlur: 8 }
              : undefined,
            label: {
              show: shouldLabel,
              formatter: point.model.name.replace("GPT-5.6 ", "5.6 ").replace("DeepSeek ", "DS "),
              position: channelIndex % 2 === 0 ? "top" : "bottom",
              color: "#343934",
              fontFamily: "IBM Plex Mono",
              fontSize: 10,
              distance: 8,
            },
          };
        }),
      markLine:
        channelIndex === 0
          ? {
              silent: true,
              symbol: ["none", "none"],
              lineStyle: { color: "#b1a99b", type: "dashed", width: 1 },
              label: {
                formatter: `Index 门槛  ${props.indexThreshold.toFixed(1)}`,
                color: "#6f6a62",
                fontFamily: "IBM Plex Mono",
                fontSize: 10,
                position: "insideEndTop",
              },
              data: [{ yAxis: props.indexThreshold }],
            }
          : undefined,
    }));

    if (props.showPareto && props.points.length > 1) {
      const frontier = props.points
        .filter((point) => paretoIds.has(point.id))
        .sort((left, right) => left.costUsd - right.costUsd);
      series.push({
        name: "Pareto",
        type: "line",
        symbolSize: 0,
        z: 2,
        itemStyle: { color: "#00a6a6", borderColor: "#00a6a6", borderWidth: 0 },
        labelLayout: { hideOverlap: true, moveOverlap: "shiftY" },
        data: frontier.map((point) => ({
          value: [convertUsd(point.costUsd, props.currency, props.usdToCny), point.model.benchmark?.intelligenceIndex ?? 0],
          point,
          symbol: "none",
          symbolSize: 0,
          itemStyle: { color: "#00a6a6" },
          label: { show: false },
        })),
        lineStyle: { color: "#00a6a6", width: 2, type: "dashed", opacity: activeChannel ? 0.22 : 1 },
        tooltip: { show: false },
      });
    }

    chart.current.setOption(
      {
        animationDuration: 480,
        animationEasing: "cubicOut",
        aria: { enabled: true, decal: { show: true } },
        grid: { left: 64, right: 32, top: 24, bottom: 66, containLabel: false },
        tooltip: {
          trigger: "item",
          confine: true,
          borderWidth: 0,
          backgroundColor: "#151915",
          padding: 0,
          extraCssText: "border-radius:4px;box-shadow:0 14px 35px rgba(20,23,20,.22)",
          formatter: (parameters: unknown) => {
            const data = (parameters as { data?: { point?: ComparisonPoint } }).data;
            const point = data?.point;
            if (!point) return "";
            const benchmark = point.model.benchmark;
            const evidence = { official: "官方", estimated: "估算" }[point.offer.evidence.level];
            const subscription = point.subscriptionCost;
            const extra =
              point.offer.kind === "subscription"
                ? `<div class="chart-tip__row"><span>优惠倍数</span><b>${subscription?.effectiveMultiplier.toFixed(2)}×</b></div><div class="chart-tip__row"><span>月 API 等值</span><b>${formatter.format(
                    convertUsd(subscription?.monthlyApiValueUsd ?? 0, props.currency, props.usdToCny),
                  )}</b></div><div class="chart-tip__row"><span>月费</span><b>${formatter.format(
                    convertUsd(point.offer.monthlyFeeUsd, props.currency, props.usdToCny),
                  )}</b></div>${
                    subscription?.monthlyTokenQuota
                      ? `<div class="chart-tip__row"><span>月 Token / 参考命中</span><b>${new Intl.NumberFormat("zh-CN", {
                          notation: "compact",
                          maximumFractionDigits: 2,
                        }).format(subscription.monthlyTokenQuota)} · ${Math.round(
                          point.offer.valuation.basis === "token-quota"
                            ? point.offer.valuation.referenceScenario.cacheReadRate * 100
                            : 0,
                        )}%</b></div>`
                      : ""
                  }<div class="chart-tip__muted">参照 ${escapeHtml(point.referenceApiOffer.label)}</div>`
                : `<div class="chart-tip__row"><span>输入 / 缓存 / 写入 / 输出</span><b>${formatter.format(
                    convertUsd(point.apiCost.regularInputCost, props.currency, props.usdToCny),
                  )} · ${formatter.format(convertUsd(point.apiCost.cachedInputCost, props.currency, props.usdToCny))} · ${formatter.format(
                    convertUsd(point.apiCost.cacheWriteCost, props.currency, props.usdToCny),
                  )} · ${formatter.format(convertUsd(point.apiCost.outputCost, props.currency, props.usdToCny))}</b></div>`;
            return `<div class="chart-tip"><div class="chart-tip__head"><span>${escapeHtml(point.model.provider)} · ${escapeHtml(point.offer.provider)}</span><em>${evidence}</em></div><strong>${escapeHtml(
              point.model.name,
            )}</strong><small>${escapeHtml(point.offer.label)}</small><div class="chart-tip__price">${formatter.format(
              convertUsd(point.costUsd, props.currency, props.usdToCny),
            )}</div><div class="chart-tip__row"><span>Intelligence / 全榜</span><b>${benchmark?.intelligenceIndex.toFixed(1)} · #${benchmark?.globalRank}</b></div>${extra}<div class="chart-tip__muted">数据 ${escapeHtml(
              point.offer.evidence.asOf,
            )}</div></div>`;
          },
        },
        xAxis: {
          type: props.scale === "log" ? "log" : "value",
          name: `每 1 亿 Token 等效成本 · ${props.currency}`,
          nameLocation: "middle",
          nameGap: 43,
          nameTextStyle: { color: "#555b55", fontFamily: "IBM Plex Sans", fontSize: 12 },
          axisLine: { lineStyle: { color: "#8c918b" } },
          axisLabel: {
            color: "#6a706a",
            fontFamily: "IBM Plex Mono",
            hideOverlap: true,
            formatter: (value: number) =>
              compact
                ? new Intl.NumberFormat("zh-CN", {
                    style: "currency",
                    currency: props.currency,
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(value)
                : formatter.format(value),
          },
          splitLine: { lineStyle: { color: "#ddd8cd", type: "dashed" } },
          minorSplitLine: { show: props.scale === "log", lineStyle: { color: "#e8e4dc" } },
        },
        yAxis: {
          type: "value",
          name: "Artificial Analysis Intelligence Index",
          nameLocation: "middle",
          nameGap: 48,
          min: (value: { min: number }) => Math.max(0, Math.floor(value.min - 2)),
          max: (value: { max: number }) => Math.ceil(value.max + 2),
          nameTextStyle: { color: "#555b55", fontFamily: "IBM Plex Sans", fontSize: 12 },
          axisLabel: { color: "#6a706a", fontFamily: "IBM Plex Mono" },
          splitLine: { lineStyle: { color: "#ddd8cd", type: "dashed" } },
        },
        series,
      },
      true,
    );

    const observer = new ResizeObserver(([entry]) => {
      chart.current?.resize();
      if (entry) {
        const nextCompact = entry.contentRect.width < 600;
        setCompact((current) => (current === nextCompact ? current : nextCompact));
      }
    });
    observer.observe(chartElement.current);
    return () => observer.disconnect();
  }, [activeChannel, channels, compact, paretoIds, props]);

  useEffect(
    () => () => {
      chart.current?.dispose();
      chart.current = null;
    },
    [],
  );

  return (
    <div className="price-chart">
      <div className="channel-legend" role="group" aria-label="渠道高亮">
        {channels.map((channel) => (
          <button
            type="button"
            key={channel}
            className={activeChannel === channel ? "is-active" : activeChannel ? "is-dimmed" : ""}
            aria-label={`高亮 ${channel} 渠道`}
            aria-pressed={selectedChannel === channel}
            onMouseEnter={() => setHoveredChannel(channel)}
            onMouseLeave={() => setHoveredChannel(null)}
            onFocus={() => setHoveredChannel(channel)}
            onBlur={() => setHoveredChannel(null)}
            onClick={() => setSelectedChannel((current) => (current === channel ? null : channel))}
          >
            <span className="channel-swatch" style={{ backgroundColor: providerColors[channel] ?? "#6b706b" }} />
            {channel}
          </button>
        ))}
      </div>
      <div
        ref={chartElement}
        className="price-chart-canvas"
        role="img"
        aria-label="模型能力与每 1 亿 Token 等效成本散点图"
      />
    </div>
  );
}
