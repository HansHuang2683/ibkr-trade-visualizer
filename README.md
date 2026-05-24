# IBKR Trade History Visualizer 使用说明与算法解读

这是一个**纯前端**的交易历史分析工具。导入券商导出的 CSV 后，应用会在浏览器本地完成解析、FIFO 撮合、统计计算和图表展示，不需要后端服务，也不会把数据上传到服务器。

## 这个项目能做什么

- 导入交易 CSV
- 按账户隔离数据
- 自动去重，重复导入相同数据不会重复计入
- 自动把原始成交单撮合成已平仓交易
- 生成净值曲线、每日盈亏柱状图、日历视图和明细表
- 在本地浏览器中长期保存数据

## 如何打开项目

在项目根目录执行：

```bash
npm install
npm run dev
```

然后在浏览器打开：

```text
http://127.0.0.1:5173/
```

如果 5173 端口被占用，Vite 会自动换一个端口，终端里会显示新的地址。

## 使用说明

### 1. 创建或切换账户

左侧栏顶部是账户选择器。

- 第一次打开时，系统会自动创建一个 `Default Account`
- 你可以继续新建账户，用来区分不同策略、不同子账户或不同测试组
- 账户之间的数据完全隔离，互不影响

### 2. 导入 CSV

点击左下角的 **Import CSV**。

当前支持两类导入格式：

- `TradingView / Standard CSV`
- `IBKR Transaction History (Report)`

你也可以直接把文件拖到上传区域里。

### 3. 查看分析结果

导入成功后，Dashboard 会显示：

- 总净盈亏
- 总手续费
- 胜率
- 盈亏因子
- 平均盈亏比
- 最大回撤
- 平均持仓时间
- 最大连胜/连败
- 日均收益
- 净值曲线
- 每日净盈亏柱状图
- 日历视图和交易明细表

### 4. 数据管理

右侧的 `Data Management` 页面会列出每次导入的文件。

- 可以查看每个文件导入了多少条有效交易
- 可以删除某个文件对应的全部交易

### 5. 清空数据

左下角的 **Clear Data** 会清空所有账户、交易和批次记录。

- 这是不可恢复操作
- 只会清除浏览器本地存储的数据

## 支持的导入格式

### 推荐：IBKR 活动报表 CSV

如果你使用 Interactive Brokers，推荐下载 **活动报表 / Activity Statement** 的 CSV，而不是 PDF、HTML 或只有现金流水的 Transaction History。

![IBKR 活动报表 CSV 下载位置](./docs/ibkr-activity-report-download.svg)

在 IBKR 网页端按下面路径下载：

1. 进入 **报表** 页面
2. 选择 **活动报表**
3. 时间段选择 **自定义日期范围**
4. 选择你的起始日期和结束日期
5. 多账户格式选择 **综合总结**
6. 点击底部的 **下载 CSV**

这个项目会读取 CSV 里的 `交易` 明细段，优先使用 IBKR 自带的 `已实现的损益` 字段计算已平仓交易收益。利息、入金、出金、转账和现金报告不会计入交易收益。

### A. TradingView / Standard CSV

需要这些字段：

- `Symbol`
- `Side`
- `Qty`
- `Fill Price`
- `Time`

可选字段：

- `Commission`
- `Net Amount`

说明：

- `Side` 只能是 `Buy` 或 `Sell`
- `Time` 支持多种常见时间格式
- 如果有手续费，会自动取绝对值
- 如果有 `Net Amount`，会被保留用于后续计算

### B. IBKR Transaction History / Realized P&L

这个解析器支持 IBKR 官方导出的交易历史/已实现盈亏报表。

当前实现里有几个重要约定：

- 中文报表会优先识别 `交易 / Header / Data` 结构
- 英文历史报表也支持
- 中文报表里目前只处理 `期货` 行
- `数量` 为正表示买入，为负表示卖出
- `佣金/手续费` 在原文件里通常是负数，程序会自动转成正数
- 同一秒内的多笔成交，会按原 CSV 顺序处理，尽量保持撮合顺序一致

## 算法解读

这部分是整个项目最核心的地方。

### 1. 原始成交单先被标准化

每一行 CSV 都会被解析成一条 `RawTrade`，字段包括：

- `symbol`
- `side`
- `qty`
- `fillPrice`
- `date`
- `commission`
- `netAmount`

为了避免重复导入，系统还会给每条成交生成一个稳定的 `hashId`。

### 2. 去重逻辑

导入时，系统只会在**当前账户**内去重。

判断方式不是看文件名，而是看每条成交的内容指纹 `hashId`。

因此：

- 同一个账户里重复导入相同数据，会自动忽略重复行
- 不同账户之间的数据不会互相去重

### 3. 按品种分组

撮合不会跨品种进行。

也就是说：

- `AAPL` 只和 `AAPL` 自己撮合
- `ES` 只和 `ES` 自己撮合
- 不同 `symbol` 彼此独立

### 4. FIFO 撮合

核心规则是 **先进先出**。

逻辑可以理解为：

- 先买入的一笔，优先和最早卖出的那笔平仓
- 先卖出的一笔，优先和最早买入的那笔平仓
- 如果数量不够，就按部分成交继续拆分

实现上没有直接频繁 `shift()` 数组，而是用一个读取指针来提升性能。

### 5. 手续费按成交量比例分摊

如果一笔开仓单只被平掉一部分，那么手续费也会按比例拆分。

例如：

- 开仓单 10 手
- 手续费 5 元
- 这次只平掉 4 手

那么会分摊：

- 开仓手续费 = `5 * 4 / 10 = 2`

平仓单的手续费也会按同样方式分摊，然后两边相加，作为这次平仓的总手续费。

### 6. 盈亏计算

撮合后的每一笔已平仓交易都会得到：

- `entryPrice`
- `exitPrice`
- `qty`
- `commission`
- `grossPnL`
- `netPnL`
- `holdTimeMs`

盈亏公式大致是：

- 做多：`(exitPrice - entryPrice) * qty * multiplier`
- 做空：`(entryPrice - exitPrice) * qty * multiplier`
- 净盈亏：`grossPnL - commission`

### 7. 合约乘数的估算

如果报表里有 `netAmount`，程序会尝试从它推断合约乘数。

估算方式是：

```text
multiplierRaw = abs(netAmount) / (fillPrice * qty)
```

然后会优先匹配常见乘数：

- `100`
- `50`
- `20`
- `10`
- `5`
- `2`
- `1`

如果和某个常见乘数的误差在 5% 以内，就用那个标准值。

如果没有命中，而且原始值明显大于 1，程序会取最接近的整数。

这样做的目的是尽量兼容：

- 股票
- 期货
- 带乘数的合约品种

### 8. 统计指标怎么算

`statistics.ts` 里主要做两件事：

#### 日统计

按 `exitDate` 分组，得到每天的：

- 交易笔数
- 毛盈亏
- 净盈亏
- 手续费
- 当天是否盈利
- 当天的平仓明细

#### 全局统计

全局指标包括：

- `winRate`：胜率
- `profitFactor`：总盈利 / 总亏损
- `averageRR`：平均盈亏比
- `maxDrawdown`：最大回撤
- `maxConsecutiveWins` / `maxConsecutiveLosses`：最大连胜/连败
- `profitPerDay`：日均收益

其中：

- 净值曲线是按时间顺序累加 `netPnL`
- 最大回撤是从历史峰值到当前净值的最大回撤幅度
- 胜率只统计已经平仓的交易

## 这个项目的几个限制

- 当前是本地浏览器应用，没有后端数据库
- 数据只存在于浏览器本地存储里
- 如果清除浏览器数据，分析结果也会一起消失
- IBKR 中文报表目前只处理期货行，股票行尚未完整支持

## 二次开发入口

如果你想继续改这个项目，建议先看这几个文件：

- [`src/App.tsx`](./src/App.tsx)
- [`src/utils/tradeLogic.ts`](./src/utils/tradeLogic.ts)
- [`src/utils/statistics.ts`](./src/utils/statistics.ts)
- [`src/adapters/ibkrAdapter.ts`](./src/adapters/ibkrAdapter.ts)
- [`src/adapters/tradingViewAdapter.ts`](./src/adapters/tradingViewAdapter.ts)

## 一句话总结

这个项目的核心不是“预测”，而是把券商导出的原始成交记录，按 FIFO 规则还原成真实的平仓交易，再基于这些交易做绩效分析。
