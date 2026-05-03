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

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

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

  cachedToken = response.data.access_token;
  tokenExpiry = Date.now() + (response.data.expires_in - 10) * 1000;
  console.log('✅ Токен GigaChat получен');
  return cachedToken;
}

function calculateForecast(data) {
  if (!data || data.length < 2) return [0, 0, 0];
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), ai: true });
});

app.post('/api/analyze', async (req, res) => {
  console.log('📥 Запрос на анализ:', req.body.dataType);
  const { salesData, avg, max, min, dataType, stock, leadTime, minStock, recommendedOrder, suppliers } = req.body;

  const forecast = calculateForecast(salesData || []);
  const daysOfCoverage = stock && avg ? Math.round(stock / avg) : 0;
  const needToOrder = recommendedOrder > 0;

  const prompt = `Ты — сотрудник отдела закупок. Отвечай КОРОТКО: 3-4 предложения ТОЛЬКО про закупки и склад.

Складская позиция: "${dataType}"
Единица измерения: штуки или метры (это НЕ ватты и НЕ электричество)
Текущий остаток: ${stock} единиц
Дневной расход: ${avg} единиц
Остатка хватит на: ${daysOfCoverage} дней
Минимальный запас: ${minStock} единиц
Срок поставки: ${leadTime} дней
Нужно заказать: ${needToOrder ? recommendedOrder + ' единиц' : 'не требуется'}

${suppliers && suppliers.length > 0 ? `Поставщики: ${suppliers.map(s => s.name + ' (цена ' + s.price + '₽, доставка ' + s.deliveryDays + ' дн)').join(', ')}` : ''}

Ответь на вопросы (БЕЗ слова "Ватт", БЕЗ "мощность", БЕЗ "электричество"):
1. Хватает ли остатка? На сколько дней?
2. Нужно ли заказывать? Сколько?
3. У кого заказать?
4. Когда заказать?`;

  try {
    const token = await getAccessToken();
    const response = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      {
        model: 'GigaChat',
        messages: [
          { role: 'system', content: 'Ты менеджер по закупкам на складе. Твоя задача — считать остатки и говорить что заказывать. Отвечай коротко: 3-4 предложения. Никогда не говори про электричество, мощность, ватты, вольты, кабельные линии, энергоснабжение. Только про складские остатки и закупки.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 250
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        httpsAgent
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    console.log('✅ Ответ GigaChat:', aiResponse.substring(0, 80) + '...');

    res.json({
      advice: aiResponse,
      forecast,
      daysOfCoverage,
      mode: 'gigachat'
    });
  } catch (error) {
    console.error('❌ Ошибка GigaChat:', error.message);
    res.status(500).json({
      advice: `📊 Локальный анализ:\n\n• Остаток: ${stock} ед.\n• Расход: ${avg} ед./день\n• Хватит на: ${daysOfCoverage} дн.\n• Минимальный запас: ${minStock} ед.\n• Срок поставки: ${leadTime} дн.\n${needToOrder ? '• 🔴 НУЖНО ЗАКАЗАТЬ: ' + recommendedOrder + ' ед.' : '• 🟢 Заказ не требуется'}\n${suppliers && suppliers.length > 0 ? '• Поставщик: ' + suppliers[0].name + ' (' + suppliers[0].price + '₽)' : ''}`,
      forecast,
      daysOfCoverage,
      mode: 'fallback'
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Сервер запущен на порту ${PORT}`));