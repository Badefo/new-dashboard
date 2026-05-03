import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import './App.css'

function App() {
  const [data, setData] = useState([12, 19, 15, 17, 24, 23, 28])
  const [aiTip, setAiTip] = useState('🧠 Нажми "AI Анализ" для прогноза и рекомендаций')
  const [loading, setLoading] = useState(false)
  const [forecast, setForecast] = useState(null)
  const [anomalies, setAnomalies] = useState(null)
  const [seasonality, setSeasonality] = useState(null)
  const [theme, setTheme] = useState('light')

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const chartData = data.map((v, i) => ({ день: i + 1, продажи: v }))

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
    const ws = XLSX.utils.aoa_to_sheet([['День', 'Продажи'], ...data.map((v, i) => [i + 1, v])])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Отчет')
    XLSX.writeFile(wb, `report_${Date.now()}.xlsx`)
  }

  const analyzeWithGigaChat = async () => {
    setLoading(true)
    setAiTip('🤔 GigaChat анализирует данные...')

    const avg = (data.reduce((a, b) => a + b, 0) / data.length).toFixed(1)
    const maxValue = Math.max(...data)
    const minValue = Math.min(...data)
    const trend = data[data.length - 1] > data[0] ? 'рост' : 'падение'

    try {
      const response = await fetch('https://gigachat-proxy-ili-liuboe-drugoe.onrender.com/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          salesData: data, 
          avg: avg, 
          max: maxValue, 
          min: minValue, 
          trend: trend 
        }),
      })

      const result = await response.json()
      
      if (result.advice) {
        setAiTip(result.advice)
        if (result.forecast) setForecast(result.forecast)
        if (result.anomalies) setAnomalies(result.anomalies)
        if (result.seasonality) setSeasonality(result.seasonality)
      } else {
        setAiTip('❌ Ошибка: ' + (result.error || 'неизвестная ошибка'))
      }
    } catch (error) {
      console.error('Ошибка:', error)
      setAiTip('❌ Ошибка соединения с сервером. Запусти node server.js')
    }
    
    setLoading(false)
  }

  return (
    <div className="dashboard">
      <button className="theme-toggle" onClick={toggleTheme}>
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      <div className="header">
        <h1>🤖 AI Аналитик Дашборд + GigaChat</h1>
        <p>Загрузи данные, AI проанализирует и даст прогноз</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{(data.reduce((a, b) => a + b, 0) / data.length).toFixed(1)}</div>
          <div className="stat-label">Среднее</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-value">{Math.max(...data)}</div>
          <div className="stat-label">Максимум</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📉</div>
          <div className="stat-value">{Math.min(...data)}</div>
          <div className="stat-label">Минимум</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📐</div>
          <div className="stat-value">{Math.max(...data) - Math.min(...data)}</div>
          <div className="stat-label">Размах</div>
        </div>
      </div>

      <div className="controls">
        <label className="btn">
          📂 Загрузить файл
          <input type="file" accept=".xlsx,.csv" onChange={handleUpload} hidden />
        </label>
        <button className="btn" onClick={() => setData(data.map(() => Math.floor(Math.random() * 50) + 10))}>
          🎲 Случайные данные
        </button>
        <button className="btn" onClick={exportExcel}>
          💾 Экспорт в Excel
        </button>
        <button className="btn btn-primary" onClick={analyzeWithGigaChat} disabled={loading}>
          {loading ? '⏳ Думаю...' : '🧠 AI Анализ (GigaChat)'}
        </button>
      </div>

      <div className="chart-container">
        <div className="chart-title">📈 Динамика продаж</div>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#ccc' : 'rgba(255,255,255,0.1)'} />
            <XAxis dataKey="день" stroke={theme === 'light' ? '#666' : 'rgba(255,255,255,0.5)'} />
            <YAxis stroke={theme === 'light' ? '#666' : 'rgba(255,255,255,0.5)'} />
            <Tooltip contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#1a1a2e', border: '1px solid #667eea' }} />
            <Legend wrapperStyle={{ color: theme === 'light' ? '#333' : '#fff' }} />
            <Line type="monotone" dataKey="продажи" stroke="#667eea" strokeWidth={2} dot={{ fill: '#667eea', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {forecast && (
        <div className="glass-card" style={{ marginBottom: 20, textAlign: 'center', padding: 20, borderRadius: 20, background: 'var(--card-bg)' }}>
          <div className="stat-icon">📈 ПРОГНОЗ НА 3 ДНЯ</div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 10 }}>
            {forecast.map((f, i) => (
              <div key={i}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#667eea' }}>{f}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>День {i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {anomalies && anomalies.length > 0 && (
        <div className="glass-card" style={{ marginBottom: 20, textAlign: 'center', padding: 20, borderRadius: 20, background: 'var(--card-bg)' }}>
          <div className="stat-icon">⚠️ АНОМАЛИИ</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {anomalies.map((a, i) => (
              <div key={i} style={{ background: '#ff4444', padding: '8px 16px', borderRadius: 20, color: 'white' }}>
                День {a.day}: {a.value}
              </div>
            ))}
          </div>
        </div>
      )}

      {seasonality && (
        <div className="glass-card" style={{ marginBottom: 20, textAlign: 'center', padding: 20, borderRadius: 20, background: 'var(--card-bg)' }}>
          <div className="stat-icon">📅 СЕЗОННОСТЬ</div>
          <div style={{ marginTop: 10 }}>{seasonality}</div>
        </div>
      )}

      <div className="ai-card">
        <div className="ai-header">
          <div className="ai-icon"><span>🧠</span></div>
          <div className="ai-title">Анализ и рекомендации GigaChat</div>
        </div>
        <div className="ai-content">
          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              <span>Анализирую данные...</span>
            </div>
          ) : (
            aiTip.split('\n').map((line, i) => <p key={i}>{line}</p>)
          )}
        </div>
      </div>

      <div className="footer">
        AI Дашборд — аналитика с прогнозированием
      </div>
    </div>
  )
}

export default App