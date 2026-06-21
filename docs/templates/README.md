# CSV Import Templates

[中文](#中文) | [English](#english)

## 中文

### IBKR 用户

如果你使用 Interactive Brokers，不建议手工填写模板。请直接从 IBKR 下载 **活动报表 / Activity Statement** 的 CSV，然后在应用里选择：

```text
IBKR Transaction History (Report)
```

推荐下载路径：

```text
报表 -> 活动报表 -> 自定义日期范围 -> 综合总结 -> 下载 CSV
```

应用会读取 IBKR CSV 里的 `交易 / Trades` 明细段，用成交流水进行 FIFO 配对，复原开仓价、平仓价、点数、持仓时间和每笔净盈亏。

### 非 IBKR 用户

如果你的券商不能导出 IBKR 活动报表格式，可以使用这个标准模板：

```text
standard-trades-template.csv
```

必需字段：

| Column | 说明 |
| --- | --- |
| `Symbol` | 标的代码，例如 `MESM6` |
| `Side` | `Buy` 或 `Sell` |
| `Qty` | 成交数量，使用正数 |
| `Fill Price` | 成交价格 |
| `Time` | 成交时间，推荐 `YYYY-MM-DD HH:mm:ss` |
| `Commission` | 手续费，使用正数 |
| `Net Amount` | 成交金额；没有也可以留空，但期货建议提供 |

注意：标准模板会使用 FIFO 配对。请尽量导入完整时间段的开仓和平仓成交，否则期初已有持仓可能无法被准确复原。

## English

### IBKR Users

If you use Interactive Brokers, do not fill out this template manually. Download the **Activity Statement** as CSV from IBKR, then choose this importer in the app:

```text
IBKR Transaction History (Report)
```

Recommended download path:

```text
Reports -> Activity Statement -> Custom Date Range -> Consolidated -> Download CSV
```

The app reads the `Trades` section from the IBKR CSV and reconstructs closed trades with FIFO, including entry price, exit price, points, hold time, and net PnL.

### Non-IBKR Users

If your broker cannot export IBKR Activity Statement CSV files, use:

```text
standard-trades-template.csv
```

Required columns:

| Column | Description |
| --- | --- |
| `Symbol` | Instrument symbol, such as `MESM6` |
| `Side` | `Buy` or `Sell` |
| `Qty` | Filled quantity, positive number |
| `Fill Price` | Fill price |
| `Time` | Fill timestamp, preferably `YYYY-MM-DD HH:mm:ss` |
| `Commission` | Commission as a positive number |
| `Net Amount` | Notional/cash amount; optional, but recommended for futures |

The standard template is matched with FIFO. Import a complete range of opening and closing executions whenever possible; otherwise starting positions may not be reconstructed accurately.
