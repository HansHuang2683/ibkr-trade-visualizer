# IBKR Trade History Visualizer

<p align="center">
  <a href="https://ibkr-trade-visualizer.vercel.app/"><strong>Launch App</strong></a>
  ·
  <a href="#中文">中文</a>
  ·
  <a href="#english">English</a>
</p>

<p align="center">
  <a href="https://ibkr-trade-visualizer.vercel.app/">https://ibkr-trade-visualizer.vercel.app/</a>
</p>

---

## 中文

这是一个纯前端的交易历史可视化工具。你可以直接访问线上版本使用，不需要安装：

[打开在线应用](https://ibkr-trade-visualizer.vercel.app/)

所有 CSV 解析、收益计算、图表展示和本地保存都发生在你的浏览器里。项目没有后端服务，也不会把你的交易数据上传到服务器。

### 功能

- 导入 Interactive Brokers 活动报表 CSV
- 导入 TradingView / 标准成交 CSV
- 按账户隔离不同交易数据
- 自动去重，避免重复导入同一批成交
- 展示净值曲线、每日盈亏柱状图、日历视图和交易明细
- 统计胜率、盈亏因子、平均盈亏比、最大回撤、平均持仓时间、最大连胜/连败

### 推荐的 IBKR 报表下载方式

如果你使用 Interactive Brokers，请下载 **活动报表 / Activity Statement** 的 CSV。不要使用 PDF、HTML，也不要只导出现金流水。

![IBKR 活动报表 CSV 下载位置](./docs/ibkr-activity-report-download.svg)

在 IBKR 网页端按下面步骤下载：

1. 进入 **报表** 页面
2. 选择 **活动报表**
3. 时间段选择 **自定义日期范围**
4. 选择起始日期和结束日期
5. 多账户格式选择 **综合总结**
6. 点击底部的 **下载 CSV**

导入时选择：

```text
IBKR Transaction History (Report)
```

### 收益口径

对于 IBKR 活动报表，本项目会读取 CSV 里的 `交易` 明细段，并优先使用 IBKR 自带的 `已实现的损益` 字段计算已平仓交易收益。

不会计入交易收益的项目：

- 利息
- 入金
- 出金
- 转账
- 现金报告
- 应计利息变化

如果报表期初已经有持仓，直接从报告期内成交做纯 FIFO 会缺少期初仓位成本，结果可能偏差很大。因此 IBKR 活动报表导入会以 IBKR 已实现损益为准；普通标准成交 CSV 仍使用 FIFO 撮合。

### 本地运行

```bash
npm install
npm run dev
```

然后打开：

```text
http://127.0.0.1:5173/
```

---

## English

This is a client-side trade history visualizer. You can use the hosted app directly without installing anything:

[Open the live app](https://ibkr-trade-visualizer.vercel.app/)

CSV parsing, PnL calculation, chart rendering, and storage all happen locally in your browser. There is no backend service, and your trade data is not uploaded to a server.

### Features

- Import Interactive Brokers Activity Statement CSV files
- Import TradingView / standard execution CSV files
- Keep multiple accounts or strategies isolated
- Deduplicate repeated imports
- Visualize equity curve, daily PnL bars, calendar view, and trade logs
- Track win rate, profit factor, average reward/risk, max drawdown, hold time, and streaks

### Recommended IBKR Report

For Interactive Brokers, download the **Activity Statement** as CSV. Do not use PDF, HTML, or a cash-only transaction export.

![IBKR Activity Statement CSV export settings](./docs/ibkr-activity-report-download.svg)

Download path in the IBKR web portal:

1. Go to **Reports**
2. Choose **Activity Statement**
3. Set the period to **Custom Date Range**
4. Select your start date and end date
5. Set multi-account format to **Consolidated**
6. Click **Download CSV**

When importing, choose:

```text
IBKR Transaction History (Report)
```

### PnL Methodology

For IBKR Activity Statement files, this project reads the `Trades` section and uses IBKR's realized PnL field for closed trades.

The trading PnL does not include:

- Interest
- Deposits
- Withdrawals
- Transfers
- Cash reports
- Accrued interest changes

If a report starts with existing open positions, a pure FIFO reconstruction using only the report-period executions may miss the original cost basis and produce misleading results. For IBKR Activity Statements, the app therefore trusts IBKR's realized PnL. For standard execution CSV files, the app still uses FIFO matching.

### Run Locally

```bash
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:5173/
```

## Development

Useful source files:

- [`src/App.tsx`](./src/App.tsx)
- [`src/adapters/ibkrAdapter.ts`](./src/adapters/ibkrAdapter.ts)
- [`src/adapters/tradingViewAdapter.ts`](./src/adapters/tradingViewAdapter.ts)
- [`src/utils/tradeLogic.ts`](./src/utils/tradeLogic.ts)
- [`src/utils/statistics.ts`](./src/utils/statistics.ts)

## License

MIT
