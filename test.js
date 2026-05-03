import axios from 'axios';
import crypto from 'crypto';
import https from 'https';

const AUTH_KEY = 'MDE5ZGVjZTMtZGY5My03NDk3LWEyMWEtODRiZDMzNzJiNmE0OmQ5N2NlN2U0LTI0MGUtNGJkOS04MjgzLTAwMzFkMTA2MzFlOA==';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function test() {
  console.log('🔑 Получаю токен...');
  
  const authResponse = await axios.post(
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
  
  const token = authResponse.data.access_token;
  console.log('✅ Токен получен!');
  
  console.log('🤖 Отправляю запрос...');
  
  const response = await axios.post(
    'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
    {
      model: 'GigaChat',
      messages: [
        { role: 'system', content: 'Ты менеджер по закупкам. Отвечай коротко о закупках и складе. Не используй слова: мощность, ватты, электричество.' },
        { role: 'user', content: 'Товар: Болт М12 оцинкованный. Остаток на складе: 2000 штук. Дневной расход: 150 штук. Минимальный запас: 500 штук. Срок поставки: 3 дня. Нужно ли заказывать? Сколько? Ответь коротко в 2-3 предложения.' }
      ],
      temperature: 0.3,
      max_tokens: 200
    },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      httpsAgent
    }
  );
  
  console.log('✅ Ответ GigaChat:');
  console.log('——————————————————');
  console.log(response.data.choices[0].message.content);
  console.log('——————————————————');
}

test().catch(err => {
  console.error('❌ Ошибка:', err.message);
  if (err.response) {
    console.error('Статус:', err.response.status);
    console.error('Данные:', JSON.stringify(err.response.data, null, 2));
  }
});