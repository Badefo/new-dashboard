import express from 'express';
import cors from 'cors';
import axios from 'axios';
import crypto from 'crypto';
import https from 'https';

const app = express();
app.use(cors());
app.use(express.json());

// ТВОЙ AUTHORIZATION KEY
const AUTH_KEY = 'MDE5ZGVjZTMtZGY5My03NDk3LWEyMWEtODRiZDMzNzJiNmE0OmQ5N2NlN2U0LTI0MGUtNGJkOS04MjgzLTAwMzFkMTA2MzFlOA==';

const httpsAgent = new https.Agent({  
  rejectUnauthorized: false  
});

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

app.post('/api/analyze', async (req, res) => {
  console.log('📥 Получен запрос');

  const { salesData, avg, max, min, trend } = req.body;

  const prompt = `Ты бизнес-аналитик. Данные продаж: ${salesData.join(', ')}. Среднее: ${avg}, Макс: ${max}, Мин: ${min}, Тренд: ${trend}. Напиши короткий анализ и рекомендации на русском языке (3-4 предложения).`;

  try {
    const token = await getAccessToken();
    const response = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      {
        model: 'GigaChat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        httpsAgent
      }
    );

    const advice = response.data.choices[0].message.content;
    res.json({ advice });
  } catch (error) {
    console.error('Ошибка GigaChat:', error.response?.data || error.message);
    res.status(500).json({ error: 'Ошибка GigaChat API' });
  }
});

app.listen(3001, () => {
  console.log('✅ Сервер GigaChat запущен на http://localhost:3001');
});