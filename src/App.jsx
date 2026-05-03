import { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import './App.css'

function App() {
  const [data, setData] = useState([12, 19, 15, 17, 24, 23, 28])
  const [aiTip, setAiTip] = useState('🧠 Нажми "AI Анализ"')
  const [loading, setLoading] = useState(false)
  const [forecast, setForecast] = useState(null)
  const [anomalies, setAnomalies] = useState(null)
  const [seasonality, setSeasonality] = useState(null)
  const [theme, setTheme] = useState('light')
  const [activeDashboard, setActiveDashboard] = useState('sales')
  const [bitcoinData, setBitcoinData] = useState([])
  const [weatherData, setWeatherData] = useState([])
  const [btcLoading, setBtcLoading] = useState(false)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [chartType, setChartType] = useState('line')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [history, setHistory] = useState([])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const fetchBitcoinData = async () => {
    setBtcLoading(true)
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7')
      const result = await response.json()
      const prices = result.prices.slice(-7).map((item) => Math.round(item[1]))
      setBitcoinData(prices)
      setAiTip('📊 Данные биткоина загружены!')
    } catch (error) {
      setAiTip('❌ Ошибка загрузки биткоина')
    }
    setBtcLoading(false)
  }

  const fetchWeatherData = async () => {
    setWeatherLoading(true)
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=55.75&longitude=37.62&daily=temperature_2m_max&timezone=Europe/Moscow&days=7')
      const result = await response.json()
      const temps = result.daily.temperature_2m_max.map(t => Math.round(t))
      setWeatherData(temps)
      setAiTip('🌡️ Данные погоды загружены!')
    } catch (error) {
      setAiTip('❌ Ошибка загрузки погоды')
    }
    setWeatherLoading(false)
  }

  useEffect(() => {
    if (activeDashboard === 'bitcoin' && bitcoinData.length === 0) fetchBitcoinData()
    if (activeDashboard === 'weather' && weatherData.length === 0) fetchWeatherData()
  }, [activeDashboard])

  const currentData = activeDashboard === 'sales' ? data : activeDashboard === 'bitcoin' ? bitcoinData : weatherData
  const currentChartData = currentData.map((v, i) => ({ день: i + 1, продажи: v }))

  const handleUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
      const numbers = rows.flat().filter(v => typeof v === 'number')
      if (numbers.length) setData(numbers.slice(0, 14))
    }
    reader.readAsArrayBuffer(file)
  }

  const exportExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([['День', 'Значение'], ...currentData.map((v, i) => [i + 1, v])])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Отчет')
    XLSX.writeFile(wb, `report_${Date.now()}.xlsx`)
  }

  const exportToPDF = async () => {
    const element = document.querySelector('.dashboard')
    const canvas = await html2canvas(element, { scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const imgWidth = 210
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    pdf.save(`analytics_${Date.now()}.pdf`)
  }

  const analyzeWithGigaChat = async () => {
    setLoading(true)
    setAiTip('🤔 GigaChat анализирует данные...')

    const avg = (currentData.reduce((a, b) => a + b, 0) / currentData.length).toFixed(1)
    const maxValue = Math.max(...currentData)
    const minValue = Math.min(...currentData)
    const trend = currentData[currentData.length - 1] > currentData[0] ? 'рост' : 'падение'
    const dataType = activeDashboard === 'sales' ? 'продажи' : activeDashboard === 'bitcoin' ? 'цена биткоина' : 'температура'

    try {
      const response = await fetch('https://gigachat-proxy-ili-liuboe-drugoe.onrender.com/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesData: currentData, avg, max: maxValue, min: minValue, trend, dataType }),
      })
      const result = await response.json()
      if (result.advice) {
        setAiTip(result.advice)
        if (result.forecast) setForecast(result.forecast)
        if (result.anomalies) setAnomalies(result.anomalies)
        if (result.seasonality) setSeasonality(result.seasonality)
        const newHistory = [{ date: new Date().toLocaleString(), dataType, data: currentData, analysis: result.advice }, ...history].slice(0, 10)
        setHistory(newHistory)
        localStorage.setItem('analytics_history', JSON.stringify(newHistory))
      }
    } catch (error) {
      setAiTip('❌ Ошибка соединения')
    }
    setLoading(false)
  }

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h2>🔐 AI Дашборд</h2>
          <input type="text" placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => {
            if (username === 'admin' && password === '123') {
              setIsLoggedIn(true)
              const saved = localStorage.getItem('analytics_history')
              if (saved) setHistory(JSON.parse(saved))
            } else alert('Неверный логин или пароль (admin/123)')
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
        <h1>🤖 AI Аналитик Дашборд + GigaChat</h1>
        <p>Загрузи данные или выбери реальный источник</p>
      </div>

      <div className="dashboard-tabs">
        <button className={`tab-btn ${activeDashboard === 'sales' ? 'active' : ''}`} onClick={() => setActiveDashboard('sales')}>📊 Мои продажи</button>
        <button className={`tab-btn ${activeDashboard === 'bitcoin' ? 'active' : ''}`} onClick={() => setActiveDashboard('bitcoin')}>₿ Биткоин 7 дней</button>
        <button className={`tab-btn ${activeDashboard === 'weather' ? 'active' : ''}`} onClick={() => setActiveDashboard('weather')}>🌤️ Погода Москва</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon">📊</div><div className="stat-value">{(currentData.reduce((a, b) => a + b, 0) / currentData.length).toFixed(1)}</div><div className="stat-label">Среднее</div></div>
        <div className="stat-card"><div className="stat-icon">📈</div><div className="stat-value">{Math.max(...currentData)}</div><div className="stat-label">Максимум</div></div>
        <div className="stat-card"><div className="stat-icon">📉</div><div className="stat-value">{Math.min(...currentData)}</div><div className="stat-label">Минимум</div></div>
        <div className="stat-card"><div className="stat-icon">📐</div><div className="stat-value">{Math.max(...currentData) - Math.min(...currentData)}</div><div className="stat-label">Размах</div></div>
      </div>

      <div className="chart-type-switch">
        <button className={`chart-type-btn ${chartType === 'line' ? 'active' : ''}`} onClick={() => setChartType('line')}>📈 Линия</button>
        <button className={`chart-type-btn ${chartType === 'bar' ? 'active' : ''}`} onClick={() => setChartType('bar')}>📊 Столбцы</button>
        <button className={`chart-type-btn ${chartType === 'area' ? 'active' : ''}`} onClick={() => setChartType('area')}>🌊 Область</button>
      </div>

      <div className="controls">
        {activeDashboard === 'sales' && (<label className="btn">📂 Загрузить файл<input type="file" accept=".xlsx,.csv" onChange={handleUpload} hidden /></label>)}
        {activeDashboard === 'bitcoin' && (<button className="btn" onClick={fetchBitcoinData} disabled={btcLoading}>{btcLoading ? '⏳...' : '🔄 BTC'}</button>)}
        {activeDashboard === 'weather' && (<button className="btn" onClick={fetchWeatherData} disabled={weatherLoading}>{weatherLoading ? '⏳...' : '🔄 Погода'}</button>)}
        <button className="btn" onClick={() => { if (activeDashboard === 'sales') setData(data.map(() => Math.floor(Math.random() * 50) + 10)) }}>🎲 Случайные</button>
        <button className="btn" onClick={exportExcel}>💾 Excel</button>
        <button className="btn" onClick={exportToPDF}>📄 PDF</button>
        <button className="btn btn-primary" onClick={analyzeWithGigaChat} disabled={loading}>{loading ? '⏳ Думаю...' : '🧠 AI Анализ'}</button>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={350}>
          {chartType === 'line' && <LineChart data={currentChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="день" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="продажи" stroke="#667eea" strokeWidth={2} dot={{ r: 4 }} /></LineChart>}
          {chartType === 'bar' && <BarChart data={currentChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="день" /><YAxis /><Tooltip /><Legend /><Bar dataKey="продажи" fill="#667eea" radius={[8,8,0,0]} /></BarChart>}
          {chartType === 'area' && <AreaChart data={currentChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="день" /><YAxis /><Tooltip /><Legend /><Area type="monotone" dataKey="продажи" stroke="#667eea" fill="rgba(102,126,234,0.2)" /></AreaChart>}
        </ResponsiveContainer>
      </div>

      {forecast && (<div className="glass-card"><div className="stat-icon">📈 ПРОГНОЗ НА 3 ДНЯ</div><div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>{forecast.map((f, i) => (<div key={i}><div style={{ fontSize: 24, fontWeight: 'bold' }}>{f}</div><div>День {i + 1}</div></div>))}</div></div>)}
      {anomalies && anomalies.length > 0 && (<div className="glass-card"><div className="stat-icon">⚠️ АНОМАЛИИ</div><div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>{anomalies.map((a, i) => (<div key={i} style={{ background: '#ff4444', padding: '8px 16px', borderRadius: 20, color: 'white' }}>День {a.day}: {a.value}</div>))}</div></div>)}
      {seasonality && (<div className="glass-card"><div className="stat-icon">📅 СЕЗОННОСТЬ</div><div>{seasonality}</div></div>)}

      <div className="ai-card">
        <div className="ai-header"><div className="ai-icon"><span>🧠</span></div><div className="ai-title">Анализ GigaChat</div></div>
        <div className="ai-content">{loading ? <div className="loading"><div className="spinner"></div><span>Анализирую...</span></div> : aiTip.split('\n').map((line, i) => <p key={i}>{line}</p>)}</div>
      </div>

      {history.length > 0 && (<div className="history-card"><h3>📜 История анализов</h3>{history.map((item, i) => (<div key={i} className="history-item"><strong>{item.date}</strong> — {item.dataType}: {item.analysis.substring(0, 100)}...</div>))}</div>)}

      <div className="footer">AI Дашборд — полная аналитика</div>
    </div>
  )
}

export default App