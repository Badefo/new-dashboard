import express from 'express';
import cors from 'cors';
import axios from 'axios';
import crypto from 'crypto';
import https from 'https';

const app = express();
app.use(cors());
app.use(express.json());

const AUTH_KEY = 'MDE5ZGVjZTMtZGY5My03NDk3LWEyMWEtODRiZDMzNzJiNmE0OmQ5N2NlN2U0LTI0MGUtNGJkOS04MjgzLTAwMzFkMTA2MzFlOA==';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function getAccessToken() {
  const response = await axios.post(
    'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
    'scope=GIGACHAT_API_PERS',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'RqUID': crypto.randomUUID(),
        'Authorization': `Basic ${AUTH_KEY}`
      },
      httpsAgent
    }
  );
  return response.data.access_token;
}

function calculateForecast(data) {
  const n = data.length;
  const x = Array.from({ length: n }, (_, i) => i + 1);
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += data[i];
    sumXY += x[i] * data[i];
    sumX2 += x[i] * x[i];
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return [
    Math.round(slope * (n + 1) + intercept),
    Math.round(slope * (n + 2) + intercept),
    Math.round(slope * (n + 3) + intercept)
  ];
}

function findAnomalies(data) {
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  return data
    .map((v, i) => ({ day: i + 1, value: v, isAnomaly: v > avg * 1.5 || v < avg * 0.5 }))
    .filter(a => a.isAnomaly);
}

app.post('/api/analyze', async (req, res) => {
  console.log('📥 Запрос получен');
  const { salesData, avg, max, min, trend } = req.body;
  
  const forecast = calculateForecast(salesData);
  const anomalies = findAnomalies(salesData);
  const firstHalf = salesData.slice(0, Math.floor(salesData.length / 2));
  const secondHalf = salesData.slice(-Math.floor(salesData.length / 2));
  const seasonality = (secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length) > 
                       (firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length) 
                       ? 'рост во второй половине периода' : 'спад во второй половине периода';

  const prompt = `Ты бизнес-аналитик. Данные: ${salesData.join(', ')}. Среднее: ${avg}, Тренд: ${trend}. Прогноз: ${forecast.join(', ')}. Аномалии: ${anomalies.length}. Сезонность: ${seasonality}. Дай анализ и рекомендации (4-5 предложений).`;

  try {
    const token = await getAccessToken();
    const response = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      { model: 'GigaChat', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 500 },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, httpsAgent }
    );
    res.json({ advice: response.data.choices[0].message.content, forecast, anomalies, seasonality });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка GigaChat API' });
  }
});

app.listen(3001, () => console.log('✅ Сервер на порту 3001'));