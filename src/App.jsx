import { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import './App.css'

// ПУСТОЙ ШАБЛОН — пользователь сам загрузит свои товары
const defaultItems = [
  { id: 1, name: 'Пример товара 1', unit: 'шт', stock: 100, leadTime: 5, minStock: 20, consumption: [10,12,11,13,10,12,11], price: 500 },
  { id: 2, name: 'Пример товара 2', unit: 'уп', stock: 50, leadTime: 3, minStock: 15, consumption: [5,6,5,7,6,5,5], price: 300 },
]

const defaultSuppliers = [
  { name: 'Поставщик А', itemId: 1, price: 500, deliveryDays: 5, reliability: 0.95 },
  { name: 'Поставщик Б', itemId: 1, price: 520, deliveryDays: 4, reliability: 0.92 },
]

function App() {
  const [items, setItems] = useState(defaultItems)
  const [suppliers, setSuppliers] = useState(defaultSuppliers)
  const [aiTip, setAiTip] = useState('🧠 Нажми "AI Анализ товара"')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('stock')
  const [selectedItem, setSelectedItem] = useState(null)
  const [theme, setTheme] = useState('light')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [orders, setOrders] = useState([])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const avgConsumption = (consumption) => consumption.reduce((a,b)=>a+b,0)/consumption.length
  const weeklyForecast = (item) => Math.round(avgConsumption(item.consumption) * 7)
  const reorderPoint = (item) => Math.round(avgConsumption(item.consumption) * item.leadTime + item.minStock)
  const recommendedOrder = (item) => {
    const forecast = weeklyForecast(item)
    const need = forecast + item.minStock
    return Math.max(0, need - item.stock)
  }
  const getStatus = (item) => {
    if (item.stock <= reorderPoint(item)) return 'danger'
    if (item.stock <= reorderPoint(item) * 1.3) return 'warning'
    return 'normal'
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
      if (rows.length < 2) return
      const headers = rows[0]
      const newItems = rows.slice(1).map((row, idx) => ({
        id: idx + 1,
        name: row[0] || 'Товар',
        unit: row[1] || 'шт',
        stock: Number(row[2]) || 0,
        leadTime: Number(row[3]) || 1,
        minStock: Number(row[4]) || 10,
        consumption: [Number(row[5]) || 10, Number(row[6]) || 10, Number(row[7]) || 10, Number(row[8]) || 10, Number(row[9]) || 10, Number(row[10]) || 10, Number(row[11]) || 10],
        price: Number(row[12]) || 0
      }))
      setItems(newItems)
      setAiTip(`✅ Загружено ${newItems.length} товаров`)
    }
    reader.readAsArrayBuffer(file)
  }

  const exportExcel = () => {
    const wsData = [['Наименование', 'Ед', 'Остаток', 'Срок поставки', 'Мин. остаток', 'Расход за 7 дней', 'Цена']]
    items.forEach(item => {
      wsData.push([item.name, item.unit, item.stock, item.leadTime, item.minStock, item.consumption.join(','), item.price])
    })
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Товары')
    XLSX.writeFile(wb, `inventory_${Date.now()}.xlsx`)
  }

  const exportOrder = () => {
    const orderItems = items.filter(item => recommendedOrder(item) > 0).map(item => ({
      Наименование: item.name,
      Рекомендуемый_заказ: recommendedOrder(item),
      Ед: item.unit,
      Цена: item.price,
      Сумма: recommendedOrder(item) * item.price
    }))
    const ws = XLSX.utils.json_to_sheet(orderItems)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Заказ')
    XLSX.writeFile(wb, `order_${Date.now()}.xlsx`)
  }

  const exportToPDF = async () => {
    const element = document.querySelector('.dashboard')
    const canvas = await html2canvas(element, { scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const imgWidth = 210
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    pdf.save(`procurement_${Date.now()}.pdf`)
  }

  const analyzeItem = async () => {
    if (!selectedItem) {
      setAiTip('❌ Выберите товар для анализа')
      return
    }
    setLoading(true)
    setAiTip('🤔 GigaChat анализирует...')

    const avg = avgConsumption(selectedItem.consumption).toFixed(1)
    const forecast = weeklyForecast(selectedItem)
    const reorder = reorderPoint(selectedItem)
    const recommend = recommendedOrder(selectedItem)
    const itemSuppliers = suppliers.filter(s => s.itemId === selectedItem.id)

    const prompt = `Ты эксперт по управлению запасами.
Товар: ${selectedItem.name}
Средний расход в день: ${avg}
Текущий остаток: ${selectedItem.stock}
Точка заказа (мин. остаток): ${reorder}
Срок поставки: ${selectedItem.leadTime} дней
Прогноз на неделю: ${forecast}
Рекомендуемый заказ: ${recommend}
Доступные поставщики: ${itemSuppliers.map(s => `${s.name} (${s.price} руб, срок ${s.deliveryDays} дн)`).join('; ')}

Напиши рекомендации:
1. Нужно ли срочно заказывать?
2. Сколько заказать?
3. Какого поставщика выбрать?
4. Какие риски?`

    try {
      const response = await fetch('https://gigachat-proxy-ili-liuboe-drugoe.onrender.com/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesData: selectedItem.consumption, avg, max: Math.max(...selectedItem.consumption), min: Math.min(...selectedItem.consumption), trend: 'нейтральный', dataType: selectedItem.name }),
      })
      const result = await response.json()
      setAiTip(result.advice || '✅ Анализ завершён')
      if (recommend > 0) {
        const newOrder = { item: selectedItem.name, quantity: recommend, date: new Date().toLocaleString(), status: 'рекомендовано' }
        setOrders([newOrder, ...orders].slice(0, 20))
        localStorage.setItem('procurement_orders', JSON.stringify([newOrder, ...orders].slice(0, 20)))
      }
    } catch (error) {
      setAiTip('❌ Ошибка соединения с AI')
    }
    setLoading(false)
  }

  useEffect(() => {
    const savedOrders = localStorage.getItem('procurement_orders')
    if (savedOrders) setOrders(JSON.parse(savedOrders))
  }, [])

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h2>🔐 Управление запасами</h2>
          <input type="text" placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => {
            if (username === 'admin' && password === '123') setIsLoggedIn(true)
            else alert('Неверный логин или пароль (admin/123)')
          }}>Войти</button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <button className="theme-toggle" onClick={toggleTheme}>{theme === 'light' ? '🌙' : '☀️'}</button>
      <button className="logout-btn" onClick={() => setIsLoggedIn(false)}>🚪 Выйти</button>

      <div className="header">
        <h1>📦 Управление запасами и закупками</h1>
        <p>Универсальная система для любого бизнеса</p>
      </div>

      <div className="procurement-tabs">
        <button className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>📦 Товары / Остатки</button>
        <button className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>🛒 Рекомендации по закупке</button>
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>📜 История заказов</button>
      </div>

      <div className="procurement-controls">
        <label className="btn">📂 Загрузить Excel (Товары)<input type="file" accept=".xlsx,.csv" onChange={handleFileUpload} hidden /></label>
        <button className="btn" onClick={exportExcel}>💾 Excel (Товары)</button>
        <button className="btn" onClick={exportOrder}>📄 Excel (Заказ)</button>
        <button className="btn" onClick={exportToPDF}>📄 PDF (Отчёт)</button>
      </div>

      {activeTab === 'stock' && (
        <div className="stock-table">
          <h3>📋 Складские остатки <span style={{ fontSize: 12, color: '#888' }}>(Выберите товар для AI-анализа)</span></h3>
          <table className="procurement-table">
            <thead><tr><th>Товар</th><th>Ед</th><th>Остаток</th><th>Мин. остаток</th><th>Прогноз на неделю</th><th>Статус</th><th>Действие</th></tr></thead>
            <tbody>
              {items.map(item => {
                const status = getStatus(item)
                return (
                  <tr key={item.id} className={selectedItem?.id === item.id ? 'selected-row' : ''}>
                    <td>{item.name}</td><td>{item.unit}</td><td className={status === 'danger' ? 'danger' : status === 'warning' ? 'warning' : ''}>{item.stock}</td>
                    <td>{reorderPoint(item)}</td><td>{weeklyForecast(item)}</td>
                    <td>{status === 'danger' ? '🔴 Срочно' : status === 'warning' ? '🟡 Планово' : '🟢 Норма'}</td>
                    <td><button className="small-btn" onClick={() => setSelectedItem(item)}>Выбрать</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {selectedItem && (
            <div className="selected-item-panel">
              <h4>🧠 AI анализ: {selectedItem.name}</h4>
              <button className="btn" onClick={analyzeItem} disabled={loading}>{loading ? '⏳ Анализ...' : '🤖 Запустить AI анализ'}</button>
              <div className="ai-result"><strong>Рекомендация:</strong> {aiTip}</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="orders-table">
          <h3>🛒 Что заказать</h3>
          <table className="procurement-table">
            <thead><tr><th>Товар</th><th>Остаток</th><th>Прогноз</th><th>Точка заказа</th><th>Рекомендуемый заказ</th><th>Статус</th></tr></thead>
            <tbody>
              {items.filter(item => recommendedOrder(item) > 0).map(item => (
                <tr key={item.id} className="order-row">
                  <td>{item.name}</td><td>{item.stock}</td><td>{weeklyForecast(item)}</td><td>{reorderPoint(item)}</td>
                  <td className="order-qty">{recommendedOrder(item)} {item.unit}</td>
                  <td>🔴 Срочная закупка</td>
                </tr>
              ))}
              {items.filter(item => recommendedOrder(item) === 0).map(item => (
                <tr key={item.id}><td>{item.name}</td><td>{item.stock}</td><td>{weeklyForecast(item)}</td><td>{reorderPoint(item)}</td><td>0</td><td>🟢 Норма</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history-section">
          <h3>📜 История рекомендаций</h3>
          {orders.length === 0 && <p>Пока нет истории. Запустите AI анализ для товара.</p>}
          {orders.map((order, idx) => (
            <div key={idx} className="history-item">
              <strong>{order.date}</strong> — {order.item}: заказать {order.quantity} шт
            </div>
          ))}
        </div>
      )}

      <div className="footer">Универсальная система управления запасами — подходит для любого бизнеса</div>
    </div>
  )
}

export default App