import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

function App() {
  const [data, setData] = useState([12, 19, 15, 17, 24, 23, 28])
  const [aiTip, setAiTip] = useState('Нажми "Анализ"')

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

  const analyze = () => {
    const avg = (data.reduce((a, b) => a + b, 0) / data.length).toFixed(1)
    const trend = data[data.length - 1] > data[0] ? 'рост' : 'падение'
    setAiTip(`📊 Среднее: ${avg}. Тренд: ${trend}. Рекомендация: ${trend === 'рост' ? 'увеличивайте запасы' : 'проверьте маркетинг'}.`)
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>📊 AI Дашборд</h1>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <label style={{ background: '#4CAF50', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', color: 'white' }}>
          📂 Загрузить Excel
          <input type="file" accept=".xlsx,.csv" onChange={handleUpload} hidden />
        </label>
        <button onClick={() => setData(data.map(() => Math.floor(Math.random() * 50) + 10))}>🎲 Случайные</button>
        <button onClick={exportExcel}>💾 Экспорт</button>
        <button onClick={analyze}>🤖 AI Анализ</button>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#2196F3', color: 'white', padding: 12, borderRadius: 8 }}>Среднее: {(data.reduce((a, b) => a + b, 0) / data.length).toFixed(1)}</div>
        <div style={{ background: '#4CAF50', color: 'white', padding: 12, borderRadius: 8 }}>Макс: {Math.max(...data)}</div>
        <div style={{ background: '#FF9800', color: 'white', padding: 12, borderRadius: 8 }}>Мин: {Math.min(...data)}</div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="день" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="продажи" stroke="#2196F3" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ marginTop: 24, padding: 16, background: '#f0f0f0', borderRadius: 12 }}>
        <strong>🤖 AI совет:</strong> {aiTip}
      </div>
    </div>
  )
}

export default App