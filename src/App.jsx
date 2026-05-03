import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import './App.css'

const AI_SERVER_URL = 'https://gigachat-proxy-ili-liuboe-drugoe.onrender.com/api/analyze';

const defaultItems = [
  { id: 1, name: 'Болт М12 оцинкованный', unit: 'шт', stock: 2000, leadTime: 3, minStock: 500, consumption: [140, 160, 150, 155, 145, 165, 170], price: 12, category: 'Крепёж', supplier: 'МетизСервис' },
  { id: 2, name: 'Труба полиэтиленовая 110 мм', unit: 'м', stock: 80, leadTime: 14, minStock: 200, consumption: [50, 55, 48, 60, 52, 58, 54], price: 320, category: 'Трубы', supplier: 'ТрубПласт' },
  { id: 3, name: 'Краска фасадная белая 20л', unit: 'шт', stock: 25, leadTime: 5, minStock: 40, consumption: [8, 10, 12, 9, 11, 10, 13], price: 2500, category: 'ЛКМ', supplier: 'СтройМаркет' },
  { id: 4, name: 'Перчатки рабочие х/б', unit: 'пар', stock: 300, leadTime: 2, minStock: 500, consumption: [150, 160, 140, 170, 155, 165, 175], price: 45, category: 'СИЗ', supplier: 'СпецОдежда' },
  { id: 5, name: 'Светильник светодиодный 40W', unit: 'шт', stock: 60, leadTime: 10, minStock: 100, consumption: [25, 30, 28, 32, 27, 29, 31], price: 890, category: 'Освещение', supplier: 'ЭлектроСнаб' },
  { id: 6, name: 'Саморез кровельный 4.8х35', unit: 'шт', stock: 5000, leadTime: 2, minStock: 2000, consumption: [600, 650, 700, 680, 720, 690, 750], price: 1.5, category: 'Крепёж', supplier: 'МетизСервис' },
  { id: 7, name: 'Утеплитель минеральный 50мм', unit: 'м²', stock: 120, leadTime: 7, minStock: 300, consumption: [40, 45, 50, 48, 52, 55, 58], price: 380, category: 'Утеплители', supplier: 'СтройМаркет' },
  { id: 8, name: 'Фильтр масляный двигатель', unit: 'шт', stock: 15, leadTime: 14, minStock: 30, consumption: [3, 4, 3, 5, 4, 3, 4], price: 450, category: 'Запчасти', supplier: 'АвтоСнаб' },
]

function App() {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('procurement_items')
    return saved ? JSON.parse(saved) : defaultItems
  })
  const [aiAdvice, setAiAdvice] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedItem, setSelectedItem] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [userRole, setUserRole] = useState('')
  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem('procurement_orders')
    return saved ? JSON.parse(saved) : []
  })
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [aiChatMessages, setAiChatMessages] = useState([
    { role: 'agent', text: '👋 Здравствуйте! Я ИИ-агент снабжения. Выберите товар и нажмите 🤖 для анализа.' }
  ])

  const users = [
    { login: 'admin', password: '123', role: 'Администратор' },
    { login: 'manager', password: '123', role: 'Руководитель' },
    { login: 'buyer', password: '123', role: 'Закупщик' },
  ]

  const handleLogin = () => {
    const user = users.find(u => u.login === username && u.password === password)
    if (user) {
      setIsLoggedIn(true)
      setUserRole(user.role)
      localStorage.setItem('user_role', user.role)
      localStorage.setItem('user_name', user.login)
    } else { alert('Неверный логин или пароль') }
  }

  const handleLogout = () => {
    setIsLoggedIn(false); setUsername(''); setPassword(''); setUserRole('')
    localStorage.removeItem('user_role'); localStorage.removeItem('user_name')
  }

  const avgConsumption = (c) => Math.round(c.reduce((a, b) => a + b, 0) / c.length)
  const reorderPoint = (item) => avgConsumption(item.consumption) * item.leadTime + item.minStock
  const recommendedOrder = (item) => Math.max(0, reorderPoint(item) - item.stock)
  const getStatus = (item) => {
    const ratio = item.stock / reorderPoint(item)
    if (ratio < 1) return 'danger'
    if (ratio < 1.3) return 'warning'
    return 'normal'
  }
  const coverageDays = (item) => Math.round(item.stock / avgConsumption(item.consumption))

  const analyzeItem = async (item) => {
    if (!item) { setAiAdvice('❌ Выберите товар'); return }
    setAiLoading(true)
    setAiAdvice('🤔 Анализирую...')

    const avg = avgConsumption(item.consumption)
    try {
      const response = await fetch(AI_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesData: item.consumption, avg, max: Math.max(...item.consumption), min: Math.min(...item.consumption),
          dataType: item.name, stock: item.stock, leadTime: item.leadTime, minStock: item.minStock,
          recommendedOrder: recommendedOrder(item),
          suppliers: [{ name: item.supplier || 'Поставщик', price: item.price, deliveryDays: item.leadTime }]
        }),
      })
      const result = await response.json()
      setAiAdvice(result.advice || '✅ Анализ завершён')
      setAiChatMessages(prev => [...prev, { role: 'user', text: `Анализ: ${item.name}` }, { role: 'agent', text: result.advice }])
      if (recommendedOrder(item) > 0) {
        const newOrder = { item: item.name, quantity: recommendedOrder(item), unit: item.unit, date: new Date().toLocaleString('ru-RU'), status: 'AI рекомендует' }
        setOrders(prev => [newOrder, ...prev].slice(0, 50))
        localStorage.setItem('procurement_orders', JSON.stringify([newOrder, ...orders].slice(0, 50)))
      }
    } catch (error) {
      setAiAdvice('❌ Сервер AI не отвечает')
    }
    setAiLoading(false)
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
      const newItems = rows.slice(1).map((row, idx) => ({
        id: Date.now() + idx, name: row[0] || 'Товар', unit: row[1] || 'шт',
        stock: Number(row[2]) || 0, leadTime: Number(row[3]) || 7, minStock: Number(row[4]) || 10,
        consumption: [Number(row[5])||10, Number(row[6])||10, Number(row[7])||10, Number(row[8])||10, Number(row[9])||10, Number(row[10])||10, Number(row[11])||10],
        price: Number(row[12]) || 0, category: row[13] || 'Без категории', supplier: row[14] || 'Не указан'
      }))
      setItems(newItems)
      localStorage.setItem('procurement_items', JSON.stringify(newItems))
      setAiAdvice(`✅ Загружено ${newItems.length} товаров`)
    }
    reader.readAsArrayBuffer(file)
  }

  const exportExcel = () => {
    const data = items.map(item => ({
      'Товар': item.name, 'Категория': item.category || '', 'Ед.изм': item.unit,
      'Остаток': item.stock, 'Срок поставки': item.leadTime, 'Мин.запас': item.minStock,
      'Средний расход': avgConsumption(item.consumption), 'Точка заказа': reorderPoint(item),
      'Заказ': recommendedOrder(item), 'Покрытие (дн)': coverageDays(item), 'Цена': item.price,
      'Статус': getStatus(item) === 'danger' ? 'Дефицит' : getStatus(item) === 'warning' ? 'Планово' : 'Норма'
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Товары')
    XLSX.writeFile(wb, `inventory_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const exportOrderExcel = () => {
    const orderItems = items.filter(i => recommendedOrder(i) > 0).map(item => ({
      'Товар': item.name, 'Остаток': item.stock, 'Точка заказа': reorderPoint(item),
      'Заказать': recommendedOrder(item), 'Ед': item.unit, 'Цена': item.price, 'Сумма': recommendedOrder(item) * item.price
    }))
    if (orderItems.length === 0) { setAiAdvice('✅ Все товары в норме'); return }
    const totalSum = orderItems.reduce((s, i) => s + i['Сумма'], 0)
    orderItems.push({ 'Товар': 'ИТОГО', 'Остаток': '', 'Точка заказа': '', 'Заказать': '', 'Ед': '', 'Цена': '', 'Сумма': totalSum })
    const ws = XLSX.utils.json_to_sheet(orderItems)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Заказ')
    XLSX.writeFile(wb, `order_${new Date().toISOString().slice(0,10)}.xlsx`)
    setAiAdvice(`📄 Заказ на ${orderItems.length-1} позиций. Сумма: ${totalSum.toLocaleString()} руб.`)
  }

  const exportPDF = async () => {
    const el = document.querySelector('.dashboard-content')
    if (!el) return
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: theme === 'dark' ? '#0f0f1a' : '#fff' })
    const pdf = new jsPDF('l', 'mm', 'a4')
    const w = 297, h = (canvas.height * w) / canvas.width
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h)
    pdf.save(`report_${new Date().toISOString().slice(0,10)}.pdf`)
    setAiAdvice('📄 PDF-отчёт сформирован')
  }

  const kpi = {
    total: items.length,
    critical: items.filter(i => getStatus(i) === 'danger').length,
    warning: items.filter(i => getStatus(i) === 'warning').length,
    normal: items.filter(i => getStatus(i) === 'normal').length,
    orderValue: items.filter(i => recommendedOrder(i) > 0).reduce((s, i) => s + recommendedOrder(i)*i.price, 0),
    coverage: Math.round(items.reduce((s, i) => s + coverageDays(i), 0) / items.length),
  }

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme) }, [theme])
  useEffect(() => { localStorage.setItem('procurement_items', JSON.stringify(items)) }, [items])
  useEffect(() => { localStorage.setItem('procurement_orders', JSON.stringify(orders)) }, [orders])

  if (!isLoggedIn) {
    return (
      <div className="login-page">
        <div className="login-bg">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="floating-circle" style={{
              left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 6}s`, width: `${20 + Math.random() * 80}px`, height: `${20 + Math.random() * 80}px`
            }} />
          ))}
        </div>
        <div className="login-container">
          <div className="login-card">
            <div className="login-icon">🏭</div>
            <h1>SmartProcure AI</h1>
            <p className="login-subtitle">Интеллектуальное управление снабжением</p>
            <div className="login-form">
              <div className="input-group"><span className="input-icon">👤</span><input type="text" placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} /></div>
              <div className="input-group"><span className="input-icon">🔒</span><input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} /></div>
              <button className="login-btn" onClick={handleLogin}><span>Войти в систему</span></button>
              <div className="login-hints"><span>admin</span><span>manager</span><span>buyer</span></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`app ${theme}`}>
      <header className="top-bar">
        <div className="top-bar-left"><span className="logo">🏭 SmartProcure AI</span><span className="role-badge">{userRole}</span></div>
        <div className="top-bar-right">
          <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button className="icon-btn" onClick={handleLogout}>🚪</button>
        </div>
      </header>

      <nav className="main-nav">
        {[{ id: 'dashboard', icon: '📊', label: 'Дашборд' }, { id: 'stock', icon: '📦', label: 'Товары' }, { id: 'orders', icon: '🛒', label: 'Закупки' }, { id: 'history', icon: '📜', label: 'История' }].map(tab => (
          <button key={tab.id} className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.icon} {tab.label}</button>
        ))}
      </nav>

      <main className="dashboard-content">
        <div className="toolbar">
          <label className="tool-btn">📂 Загрузить Excel<input type="file" accept=".xlsx,.csv" onChange={handleFileUpload} hidden /></label>
          <button className="tool-btn" onClick={exportExcel}>💾 Excel</button>
          <button className="tool-btn" onClick={exportOrderExcel}>📄 Заказ</button>
          <button className="tool-btn" onClick={exportPDF}>📄 PDF</button>
        </div>

        {aiAdvice && (
          <div className={`ai-status ${aiAdvice.startsWith('❌') ? 'error' : ''}`}>
            {aiAdvice.split('\n').map((line, i) => <p key={i}>{line}</p>)}
            <button className="ai-close" onClick={() => setAiAdvice('')}>✕</button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="tab-content">
            <div className="kpi-grid">
              <div className="kpi-card"><div className="kpi-icon">📦</div><div className="kpi-value">{kpi.total}</div><div className="kpi-label">Товаров</div></div>
              <div className="kpi-card danger"><div className="kpi-icon">🔴</div><div className="kpi-value">{kpi.critical}</div><div className="kpi-label">Дефицит</div></div>
              <div className="kpi-card warning"><div className="kpi-icon">🟡</div><div className="kpi-value">{kpi.warning}</div><div className="kpi-label">На грани</div></div>
              <div className="kpi-card success"><div className="kpi-icon">🟢</div><div className="kpi-value">{kpi.normal}</div><div className="kpi-label">В норме</div></div>
              <div className="kpi-card"><div className="kpi-icon">💰</div><div className="kpi-value">{kpi.orderValue.toLocaleString()} ₽</div><div className="kpi-label">Объём закупки</div></div>
              <div className="kpi-card"><div className="kpi-icon">📅</div><div className="kpi-value">{kpi.coverage} дн.</div><div className="kpi-label">Покрытие</div></div>
            </div>
            <div className="chart-container">
              <h3>📈 Расход vs Запас</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={items.map(i => ({ name: i.name.substring(0, 14), Расход: avgConsumption(i.consumption), Запас: i.stock }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px' }} />
                  <Legend />
                  <Bar dataKey="Расход" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Запас" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="tab-content">
            <div className="table-container">
              <div className="table-header"><h3>📋 Складские остатки</h3><span className="hint">Выберите товар → нажмите 🤖</span></div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Товар</th><th>Остаток</th><th>Точка заказа</th><th>Расход/день</th><th>Покрытие</th><th>Заказ</th><th>Статус</th><th>AI</th></tr></thead>
                  <tbody>
                    {items.map(item => {
                      const s = getStatus(item)
                      const sel = selectedItem?.id === item.id
                      return (
                        <tr key={item.id} className={`${sel ? 'selected' : ''} row-${s}`}>
                          <td><strong>{item.name}</strong><br /><small>{item.category}</small></td>
                          <td className={`val-${s}`}>{item.stock} {item.unit}</td>
                          <td>{reorderPoint(item)}</td>
                          <td>{avgConsumption(item.consumption)}</td>
                          <td>{coverageDays(item)} дн.</td>
                          <td>{recommendedOrder(item) > 0 ? <span className="order-tag">{recommendedOrder(item)} {item.unit}</span> : <span className="order-zero">0</span>}</td>
                          <td><span className={`dot ${s}`}></span> {s === 'danger' ? 'Срочно' : s === 'warning' ? 'Планово' : 'Норма'}</td>
                          <td><button className={`ai-btn ${sel && aiLoading ? 'loading' : ''}`} onClick={() => { setSelectedItem(item); analyzeItem(item); }} disabled={aiLoading}>{sel && aiLoading ? '⏳' : '🤖'}</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {selectedItem && aiAdvice && (
              <div className="ai-panel">
                <div className="ai-panel-header"><span>🧠 AI-анализ: {selectedItem.name}</span><button onClick={() => { setSelectedItem(null); setAiAdvice(''); }}>✕</button></div>
                <div className="ai-panel-body">{aiAdvice.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="tab-content">
            <div className="table-container">
              <h3>🛒 Рекомендации по закупке</h3>
              {items.filter(i => recommendedOrder(i) > 0).length === 0 ? (
                <div className="empty">✅ Все товары в норме</div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Товар</th><th>Остаток</th><th>Точка заказа</th><th>Заказать</th><th>Цена</th><th>Сумма</th><th>AI</th></tr></thead>
                    <tbody>
                      {items.filter(i => recommendedOrder(i) > 0).map(item => (
                        <tr key={item.id} className="row-danger">
                          <td>{item.name}</td><td className="val-danger">{item.stock} {item.unit}</td><td>{reorderPoint(item)}</td>
                          <td><span className="order-tag">{recommendedOrder(item)} {item.unit}</span></td><td>{item.price} ₽</td>
                          <td>{(recommendedOrder(item) * item.price).toLocaleString()} ₽</td>
                          <td><button className="ai-btn" onClick={() => analyzeItem(item)}>🤖</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="tab-content">
            <div className="table-container">
              <h3>📜 История заказов</h3>
              {orders.length === 0 ? (
                <div className="empty">📭 История пуста. Запустите AI-анализ.</div>
              ) : (
                <div className="history-list">
                  {orders.map((o, i) => (
                    <div key={i} className="history-item">
                      <span className="h-date">{o.date}</span><span className="h-item">{o.item}</span>
                      <span className="order-tag">{o.quantity} {o.unit || 'шт'}</span><span className="h-status">{o.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <div className={`ai-chat ${aiChatOpen ? 'open' : ''}`}>
        <div className="ai-chat-header" onClick={() => setAiChatOpen(!aiChatOpen)}>🧠 ИИ-Агент {aiChatOpen ? '▼' : '▲'}</div>
        {aiChatOpen && (
          <div className="ai-chat-body">
            <div className="ai-chat-messages">
              {aiChatMessages.map((m, i) => (
                <div key={i} className={`msg ${m.role}`}><span className="msg-icon">{m.role === 'agent' ? '🤖' : '👤'}</span><span className="msg-text">{m.text}</span></div>
              ))}
            </div>
            <input className="ai-chat-input" placeholder="Спросите про товар..." onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                setAiChatMessages(prev => [...prev, { role: 'user', text: e.target.value }])
                e.target.value = ''
                setTimeout(() => setAiChatMessages(prev => [...prev, { role: 'agent', text: 'Выберите товар в таблице и нажмите 🤖 для детального AI-анализа.' }]), 500)
              }
            }} />
          </div>
        )}
      </div>
    </div>
  )
}

export default App