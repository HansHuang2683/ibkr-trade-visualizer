# IBKR Trade History Visualizer

[English](./README.md) | [简体中文](./README_zh.md)

<div align="center">
  <h3>
    <a href="https://ibkr-trade-visualizer.vercel.app">🚀 Launch App / Live Demo (No installation required)</a>
  </h3>
</div>

A stunning, privacy-first, client-side web application designed to parse, aggregate, and visualize trading history CSV exports from Interactive Brokers (IBKR) and similar platforms.

Built with **React, Vite, ECharts**, and pure CSS for a modern, flat, high-end dark dashboard experience.

## ✨ Features

- **100% Privacy by Design**: All CSV parsing and data processing happen entirely in your local browser. No backend server, no API uploads, and no data leaves your machine.
- **Advanced FIFO Matching Engine**: A highly optimized $O(1)$ pointer-based FIFO algorithm automatically reconstructs trades, handling partial fills and calculating exact commissions and PnL points.
- **Deep Analytics**: 
  - Dynamic Equity Curve and Daily PnL Bar Charts.
  - Multi-tiered Calendar View (Drill down from Yearly -> Monthly -> Daily).
  - Advanced Trading KPIs: Win Rate, Average R/R, Max Drawdown, Profit Factor, Average Hold Times, and Max Streaks.
  - Interactive, informative tooltips for performance thresholds.
- **Multi-Account/Folder Isolation**: Easily manage multiple strategies or sub-accounts. Switch between isolated profiles with a single click.
- **Smart Data Sync**: Incrementally imports new CSVs and instantly filters out duplicates using a high-speed 32-bit FNV hash algorithm. Data is persists across reloads via IndexedDB (`localforage`).

## 🚀 Getting Started

Since this is a fully client-side application, you don't need a database or complex backend setup to run it locally or deploy it.

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/ibkr-trade-history-visualizer.git
   cd ibkr-trade-history-visualizer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

### Production Build
To create a production-ready bundle suitable for Vercel, Netlify, or GitHub Pages:
```bash
npm run build
```
The optimized files will be output to the `/dist` directory.

## 📈 Usage
1. Click **"Import CSV"** to upload an Interactive Brokers export (ensure headers match IBKR standard: `Symbol`, `Side`, `Qty`, `Fill Price`, `Time`, and `Commission`).
2. Explore your cumulative Equity Curve on the **Dashboard**.
3. Use the **Date Filter** at the top to narrow down performance for specific quarters or months.
4. Drill down into specific trades via the **Calendar View** or the detailed **Data Management** table.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](../../issues).

## 📄 License
This project is [MIT](LICENSE) licensed.
