# IBKR 交易记录可视化引擎 (Trade History Visualizer)

[English](./README.md) | [简体中文](./README_zh.md)

<div align="center">
  <h3>
    <a href="https://ibkr-trade-visualizer.vercel.app">🚀 立即免费使用 (免安装，即点即用)</a>
  </h3>
</div>

这是一个令人惊艳的、**隐私优先**的纯前端(Client-Side)网页应用。专门用于解析、撮合、并以极简极夜风格可视化您的盈亏历史记录（完美适配 Interactive Brokers 盈透证券及类似平台的 CSV 导出格式）。

基于 **React, Vite, ECharts** 构建，利用全原生 CSS 编写，为您带来最高级的量化复盘和交易分析体验。

## ✨ 核心亮点

- **🛡️ 100% 绝对隐私保障**：这是本应用的最大卖点。没有任何后端数据服务器！您的所有交易记录、成交流水和资金细节，**全部都在您本地浏览器的沙盒内进行解析和计算**。没有任何一条数据会离开您的个人电脑屏幕。
- **⚡ 先进的 FIFO 撮合引擎**：底层采用了极度优化的 $O(1)$ 指针式先进先出匹配算法。它能自动重建开平仓、处理部分成交 (Partial Fills)，并精准计算出每一笔做多/做空的净盈亏点数和手续费。
- **📊 深度分析指标 (Advanced Analytics)**： 
  - 动态资金曲线 (Equity Curve) 与 每日盈亏柱状图。
  - 多级下钻日历视图（支持从年度 -> 月度 -> 每日的具体交易明细穿透查看）。
  - 高阶交易者 KPI 库：实时计算胜率 (Win Rate)、平均盈亏比 (Average R/R)、最大回撤绝对值 (Max Drawdown)、盈利因子 (Profit Factor)、平均持仓时间以及最大连胜/连败纪录，附带智能评估气泡。
- **📂 多账户与策略隔离**：支持建立“平行文件夹”，一键快速在不同的子账户或不同量化策略之间安全切换数据，互不干扰。
- **🔄 智能增量导入与本地保存**：您可以随意重复上传不同日期的 CSV 报表。系统底层搭载了极速的 32-bit FNV 哈希查重算法，能瞬间丢弃重复数据，只导入新交易。一切数据通过 `localforage` 安全、长期地持久化保存在您浏览器的 IndexedDB 中。

## 🚀 如何使用 (终端用户)

您完全不需要懂任何代码，更不需要下载任何安装包程序。
只需两步即可开始您的复盘之旅：

1. **点击顶部的 [👉 立即使用 👈](https://ibkr-trade-visualizer.vercel.app) 链接。**
2. 在左侧菜单点击 **"Import CSV"**，上传您从盈透证券 (IBKR) 后台导出的 HTML/CSV 格式历史订单记录（请确保表头包含：`Symbol`, `Side`, `Qty`, `Fill Price`, `Time`, 和 `Commission`）。
3. 尽情享受您的专属极客仪表盘！即使您关闭了网页或者断开网络，明天重新打开同样的网址，您的所有数据和图表依然都在。

---

## 💻 开发者指南

如果您是一名开发者，希望在本地运行或基于此框架二次开发修改：

### 预备环境
- Node.js (推荐 v18 或更高版本)
- npm 或 yarn

### 本地启动
1. 克隆代码仓库:
   ```bash
   git clone https://github.com/HansHuang2683/ibkr-trade-visualizer.git
   cd ibkr-trade-visualizer
   ```

2. 安装所有依赖:
   ```bash
   npm install
   ```

3. 启动本地开发热更新服务器:
   ```bash
   npm run dev
   ```

4. 打开浏览器并访问 `http://localhost:5173`。

### 生产环境打包
如果您想自己部署到 Vercel、Netlify 或 GitHub Pages 托管，请执行：
```bash
npm run build
```
Vite 会自动进行依赖树摇并为您在 `/dist` 目录下生成极致精简的纯静态生产级代码。

## 🤝 参与贡献
我们非常欢迎开源社区的 Pull Requests 和功能建议！如果您发现了 Bug 或者希望增加对其他券商 CSV 格式的兼容支持，请直接在 [Issues](../../issues) 页面提交您的想法。

## 📄 开源协议
本项目采用 [MIT](LICENSE) 宽松开源协议。
