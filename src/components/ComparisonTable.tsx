import { ArrowUpDown, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { convertUsd } from "../domain/pricing";
import type { ComparisonPoint } from "../domain/comparison";

type ComparisonTableProps = {
  points: ComparisonPoint[];
  currency: "USD" | "CNY";
  usdToCny: number;
};

export function ComparisonTable({ points, currency, usdToCny }: ComparisonTableProps) {
  const [sort, setSort] = useState<"cost" | "score">("cost");
  const rows = useMemo(
    () =>
      [...points].sort((left, right) =>
        sort === "cost"
          ? left.costUsd - right.costUsd
          : (right.model.benchmark?.intelligenceIndex ?? 0) - (left.model.benchmark?.intelligenceIndex ?? 0),
      ),
    [points, sort],
  );
  const formatter = new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 1,
  });

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>模型 / 渠道</th>
            <th>
              <button type="button" className="sort-button" onClick={() => setSort("score")}>
                Intelligence <ArrowUpDown size={13} />
              </button>
            </th>
            <th>
              <button type="button" className="sort-button" onClick={() => setSort("cost")}>
                1 亿 Token <ArrowUpDown size={13} />
              </button>
            </th>
            <th>优惠倍数</th>
            <th>证据</th>
            <th>来源</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((point) => (
            <tr key={point.id}>
              <td>
                <strong>{point.model.name}</strong>
                <span>{point.offer.label}</span>
              </td>
              <td className="numeric-cell">
                <strong>{point.model.benchmark?.intelligenceIndex.toFixed(1)}</strong>
                <span>#{point.model.benchmark?.globalRank}</span>
              </td>
              <td className="numeric-cell cost-cell">
                {formatter.format(convertUsd(point.costUsd, currency, usdToCny))}
              </td>
              <td className="numeric-cell multiplier-cell">
                {point.subscriptionCost ? `${point.subscriptionCost.effectiveMultiplier.toFixed(1)}×` : "1.0×"}
                {point.subscriptionCost && point.offer.kind === "subscription" ? (
                  <span>
                    月费 {formatter.format(convertUsd(point.offer.monthlyFeeUsd, currency, usdToCny))} · 月值{" "}
                    {formatter.format(convertUsd(point.subscriptionCost.monthlyApiValueUsd, currency, usdToCny))}
                  </span>
                ) : null}
              </td>
              <td>
                <span className={`evidence-tag evidence-tag--${point.offer.evidence.level}`}>
                  {{ official: "官方", derived: "推导", estimated: "≈ 估算" }[point.offer.evidence.level]}
                </span>
              </td>
              <td>
                <a href={point.offer.evidence.sourceUrl} target="_blank" rel="noreferrer" aria-label={`查看 ${point.offer.label} 数据来源`}>
                  {point.offer.evidence.asOf}
                  <ExternalLink size={13} />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <div className="empty-state">当前筛选条件下没有可比较方案</div> : null}
    </div>
  );
}
