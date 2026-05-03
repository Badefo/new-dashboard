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
      } else {
        setAiTip('❌ Ошибка: ' + (result.error || 'неизвестная ошибка'))
      }
    } catch (error) {
      console.error('Ошибка:', error)
      setAiTip('❌ Ошибка соединения. Запусти node server.js')
    }
    
    setLoading(false)
  }

  return (
    <div className="dashboard">
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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="день" stroke="rgba(255,255,255,0.5)" />
            <YAxis stroke="rgba(255,255,255,0.5)" />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #00ffc3' }} />
            <Legend wrapperStyle={{ color: 'white' }} />
            <Line type="monotone" dataKey="продажи" stroke="#00ffc3" strokeWidth={2} dot={{ fill: '#00ffc3', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {forecast && (
        <div className="glass-card" style={{ marginBottom: 20, textAlign: 'center' }}>
          <div className="stat-icon">📈 ПРОГНОЗ НА 3 ДНЯ</div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 10 }}>
            {forecast.map((f, i) => (
              <div key={i}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#00ffc3' }}>{f}</div>
                <div style={{ fontSize: 12, color: '#aaa' }}>День {i + 1}</div>
              </div>
            ))}
          </div>
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