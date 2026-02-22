import pandas as pd

def process_trades_fifo(file_path):
    # 1. 加载数据并按时间排序
    df = pd.read_csv(file_path)
    df['Time'] = pd.to_datetime(df['Time'])
    df = df.sort_values(by='Time').reset_index(drop=True)
    
    # 存放最终匹配好的一开一平交易回合
    results = []
    
    # 存放当前未平仓头寸的库存字典 (支持多品种，按 Symbol 分类)
    inventory = {} 

    for index, row in df.iterrows():
        symbol = row['Symbol']
        trade_side = row['Side']
        trade_qty = row['Qty']
        trade_price = row['Fill Price']
        trade_time = row['Time']
        
        # 计算单张合约的手续费，方便后续按匹配数量拆分
        trade_comm_per_qty = row['Commission'] / row['Qty']
        
        # 自动推算合约乘数：净交易额 / (成交价 * 数量)
        multiplier = row['Net Amount'] / (row['Fill Price'] * row['Qty'])
        if pd.isna(multiplier):
            multiplier = 5
            
        if symbol not in inventory:
            inventory[symbol] = []
            
        # 当这笔新交易还有未匹配的数量时，循环处理
        while trade_qty > 0:
            # 检查是否有反向持仓需要平仓
            if len(inventory[symbol]) > 0 and inventory[symbol][0]['Side'] != trade_side:
                # 找到最老的一笔持仓单 (FIFO)
                match = inventory[symbol][0]
                
                # 取新单和老单数量的最小值作为本次的匹配数量
                matched_qty = min(trade_qty, match['Qty'])
                
                # 计算盈亏 (P&L)
                if trade_side == 'Sell': # 说明在平多头仓位 (Long)
                    buy_price = match['Price']
                    sell_price = trade_price
                    position_type = 'Long'
                else:                    # 说明在平空头仓位 (Short)
                    buy_price = trade_price
                    sell_price = match['Price']
                    position_type = 'Short'
                    
                gross_pnl = (sell_price - buy_price) * matched_qty * abs(multiplier)
                commissions = (trade_comm_per_qty + match['Commission_per_qty']) * matched_qty
                net_pnl = gross_pnl - commissions
                
                # 记录这笔完整的交易回合
                results.append({
                    'Symbol': symbol,
                    'Position': position_type,
                    'Qty': matched_qty,
                    'Open Time': match['Time'],
                    'Open Price': match['Price'],
                    'Close Time': trade_time,
                    'Close Price': trade_price,
                    'Gross P&L': round(gross_pnl, 2),
                    'Commissions': round(commissions, 2),
                    'Net P&L': round(net_pnl, 2)
                })
                
                # 扣减剩余数量
                trade_qty -= matched_qty
                match['Qty'] -= matched_qty
                
                # 如果最老的这笔单子被完全平仓，从库存队列中移除
                if match['Qty'] == 0:
                    inventory[symbol].pop(0)
                    
            else:
                # 如果没有反向持仓（空仓状态，或同向加仓），直接把剩余数量加入库存池
                inventory[symbol].append({
                    'Side': trade_side,
                    'Qty': trade_qty,
                    'Price': trade_price,
                    'Time': trade_time,
                    'Commission_per_qty': trade_comm_per_qty,
                    'Multiplier': multiplier
                })
                # 新交易已全部入库，将当前循环数量清零，结束当前 while
                trade_qty = 0

    # 转换成 DataFrame 输出
    matched_df = pd.DataFrame(results)
    
    # 按平仓时间排序（可选）
    if not matched_df.empty:
        matched_df = matched_df.sort_values(by='Close Time').reset_index(drop=True)
    
    return matched_df, inventory

matched_df, inventory = process_trades_fifo('interactive-brokers-trade-history-2026-02-21T11_01_49.653Z_a6b2c.csv')
if not matched_df.empty:
    print("Python Script Net PnL:", matched_df['Net P&L'].sum())
    matched_df['Date'] = matched_df['Close Time'].dt.date
    daily = matched_df.groupby('Date')['Net P&L'].sum().reset_index()
    print("\nDaily Breakdown:")
    for index, row in daily.iterrows():
        print(f"{row['Date']}: ${row['Net P&L']:.2f}")
