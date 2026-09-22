import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("./components/PriceChart", () => ({
  PriceChart: ({ points, currency }: { points: unknown[]; currency: string }) => (
    <div data-testid="price-chart">{points.length} points · {currency}</div>
  ),
}));

describe("comparison workbench", () => {
  it("renders the default filtered snapshot", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "模型价格图谱" })).toBeInTheDocument();
    expect(screen.getByLabelText("当前结果摘要")).toHaveTextContent("11 模型");
    expect(await screen.findByTestId("price-chart")).toHaveTextContent("29 points · USD");
    expect(screen.getByText("DeepSeek V4 Pro 0813")).toBeInTheDocument();
    expect(screen.queryByText("GPT-5.5")).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /输入 : 输出/ })).toHaveValue("90");
    expect(screen.getByRole("slider", { name: /缓存命中/ })).toHaveValue("95");
    expect(screen.getByRole("spinbutton", { name: "最高单价（1 亿 Token）" })).toHaveValue(300);
    expect(screen.getByRole("spinbutton", { name: "Codex 工具加分" })).toHaveValue(1);
  });

  it("switches currency while keeping unified subscription valuation", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "CNY" }));
    expect(await screen.findByTestId("price-chart")).toHaveTextContent("29 points · CNY");
    expect(screen.getByText("订阅按月度 API 等值自动折算")).toBeInTheDocument();
    expect(screen.getByText(/月费 ¥579\.92/)).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "最高单价（1 亿 Token）" })).toHaveValue(300);
  });

  it("filters estimates and applies a custom Index threshold", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("checkbox", { name: "估算" }));
    expect(await screen.findByTestId("price-chart")).toHaveTextContent("4 points");
    fireEvent.change(screen.getByRole("spinbutton", { name: "最低 Intelligence Index" }), { target: { value: "0" } });
    expect(await screen.findByTestId("price-chart")).toHaveTextContent("5 points");
  });

  it("filters by maximum cost and restores the default limit", () => {
    render(<App />);
    const maximumCost = screen.getByRole("spinbutton", { name: "最高单价（1 亿 Token）" });
    expect(screen.getByText("MiMo API", { selector: "span" })).toBeInTheDocument();
    fireEvent.change(maximumCost, { target: { value: "10" } });
    expect(screen.queryByText("MiMo API", { selector: "span" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));
    expect(maximumCost).toHaveValue(300);
  });

  it("adjusts only ChatGPT subscription intelligence and resets to plus one", () => {
    render(<App />);
    const bonus = screen.getByRole("spinbutton", { name: "Codex 工具加分" });
    const astraSubscription = screen.getByRole("row", { name: /GPT-6 AstraChatGPT Pro 20x/ });
    expect(within(astraSubscription).getByText("53.7")).toBeInTheDocument();
    fireEvent.change(bonus, { target: { value: "0" } });
    expect(within(astraSubscription).getByText("52.7")).toBeInTheDocument();
    fireEvent.change(bonus, { target: { value: "3" } });
    expect(within(astraSubscription).getByText("55.7")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));
    expect(bonus).toHaveValue(1);
    expect(within(astraSubscription).getByText("53.7")).toBeInTheDocument();
  });

  it("does not list a model as excluded when its Codex-adjusted subscription clears the threshold", () => {
    render(<App />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "最低 Intelligence Index" }), { target: { value: "38" } });
    const notes = screen.getByRole("region", { name: "未进入当前图表" });
    expect(screen.getByRole("row", { name: /GPT-5.6 LunaChatGPT Pro 20x 38.3/ })).toBeInTheDocument();
    expect(within(notes).queryByText("GPT-5.6 Luna")).not.toBeInTheDocument();
  });

  it("opens and closes the mobile parameter drawer", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "参数" }));
    expect(screen.getByRole("dialog", { name: "比较参数" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "关闭参数面板" })[1] as HTMLElement);
    expect(screen.queryByRole("dialog", { name: "比较参数" })).not.toBeInTheDocument();
  });
});
