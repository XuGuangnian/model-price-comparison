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
    expect(screen.getByLabelText("当前结果摘要")).toHaveTextContent("10 模型");
    expect(await screen.findByTestId("price-chart")).toHaveTextContent("36 points · USD");
    expect(screen.getByText("DeepSeek V4 Pro 0813")).toBeInTheDocument();
  });

  it("switches currency and subscription mapping", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "CNY" }));
    fireEvent.click(screen.getByRole("button", { name: "固定额度" }));
    expect(await screen.findByTestId("price-chart")).toHaveTextContent("36 points · CNY");
    expect(screen.getByText("订阅按月度 Token 额度折算")).toBeInTheDocument();
  });

  it("filters estimates and includes below-threshold models", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("checkbox", { name: "估算" }));
    expect(await screen.findByTestId("price-chart")).toHaveTextContent("16 points");
    fireEvent.click(screen.getByRole("checkbox", { name: "显示 Luna 门槛以下" }));
    expect(await screen.findByTestId("price-chart")).toHaveTextContent("18 points");
  });

  it("opens and closes the mobile parameter drawer", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "参数" }));
    expect(screen.getByRole("dialog", { name: "比较参数" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "关闭参数面板" })[1] as HTMLElement);
    expect(screen.queryByRole("dialog", { name: "比较参数" })).not.toBeInTheDocument();
  });
});
