import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByLabelText("当前结果摘要")).toHaveTextContent("13 模型");
    expect(await screen.findByTestId("price-chart")).toHaveTextContent("39 points · USD");
    expect(screen.getByText("DeepSeek V4 Pro 0813")).toBeInTheDocument();
    expect(screen.queryByText("GPT-5.5")).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /输入 : 输出/ })).toHaveValue("90");
    expect(screen.getByRole("slider", { name: /缓存命中/ })).toHaveValue("95");
    expect(screen.getByRole("spinbutton", { name: "最高单价（1 亿 Token）" })).toHaveValue(300);
  });

  it("switches currency while keeping unified subscription valuation", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "CNY" }));
    expect(await screen.findByTestId("price-chart")).toHaveTextContent("39 points · CNY");
    expect(screen.getByText("订阅按月度 API 等值自动折算")).toBeInTheDocument();
    expect(screen.getByText(/月费 ¥579\.92/)).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "最高单价（1 亿 Token）" })).toHaveValue(2024.61);
  });

  it("filters estimates and applies a custom Index threshold", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("checkbox", { name: "估算" }));
    expect(await screen.findByTestId("price-chart")).toHaveTextContent("12 points");
    fireEvent.change(screen.getByRole("spinbutton", { name: "最低 Intelligence Index" }), { target: { value: "0" } });
    expect(await screen.findByTestId("price-chart")).toHaveTextContent("14 points");
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

  it("opens and closes the mobile parameter drawer", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "参数" }));
    expect(screen.getByRole("dialog", { name: "比较参数" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "关闭参数面板" })[1] as HTMLElement);
    expect(screen.queryByRole("dialog", { name: "比较参数" })).not.toBeInTheDocument();
  });
});
