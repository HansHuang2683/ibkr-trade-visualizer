# IBKR 交易记录可视化工具

[English / Main README](./README.md) | [在线使用](https://ibkr-trade-visualizer.vercel.app/)

这是一个隐私优先的纯前端交易复盘工具。所有 CSV 解析、FIFO 撮合、盈亏计算、图表展示和本地保存都发生在你的浏览器里，没有后端服务，也不会上传你的交易数据。

## 在线使用

直接打开：

https://ibkr-trade-visualizer.vercel.app/

## 用户应该导入什么文件？

### IBKR 用户

请导入 **Interactive Brokers 活动报表 / Activity Statement 的 CSV 文件**。

推荐下载路径：

```text
报表 -> 活动报表 -> 自定义日期范围 -> 综合总结 -> 下载 CSV
```

不要导入：

- PDF
- HTML
- Excel `.xlsx`
- 只有现金流水的报表

导入时选择：

```text
IBKR Transaction History (Report)
```

应用会读取 IBKR CSV 里的 `交易 / Trades` 明细段，把期货成交作为 Buy/Sell 执行流水导入，并用 FIFO 复原开仓、平仓、点数、持仓时间和每笔净盈亏。

### 非 IBKR 用户

如果你的券商不能导出 IBKR 活动报表格式，可以使用标准成交 CSV 模板：

[下载标准成交 CSV 模板](./docs/templates/standard-trades-template.csv)

[查看模板字段说明](./docs/templates/README.md)

标准模板需要包含：

```csv
Symbol,Side,Qty,Fill Price,Time,Commission,Net Amount
```

## 收益口径

项目专注于开仓和平仓带来的交易收益，不计入：

- 利息
- 入金
- 出金
- 转账
- 现金报告
- 应计利息变化

如果报表期初已经有持仓，而开仓发生在报表开始日期之前，应用无法知道真实期初成本。遇到没有开仓腿的平仓记录，系统会跳过无法复原的部分，避免制造假的开仓价。为了获得完整复盘，请尽量导入覆盖完整开仓和平仓周期的活动报表。

## 本地运行

```bash
npm install
npm run dev
```

然后打开：

```text
http://127.0.0.1:5173/
```

## 开源协议

MIT
