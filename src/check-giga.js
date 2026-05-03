import axios from 'axios';
import crypto from 'crypto';
import https from 'https';

const AUTH_KEY = 'MDE5ZGVjZTMtZGY5My03NDk3LWEyMWEtODRiZDMzNzJiNmE0OmQ5N2NlN2U0LTI0MGUtNGJkOS04MjgzLTAwMzFkMTA2MzFlOA==';

const agent = new https.Agent({ rejectUnauthorized: false });

async function test() {
  try {
    console.log('1. Получаю токен...');
    const tokenRes = await axios.post('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', 'scope=GIGACHAT_API_PERS', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'RqUID': crypto.randomUUID(),
        'Authorization': `Basic ${AUTH_KEY}`
      },
      httpsAgent: agent
    });

    const token = tokenRes.data.access_token;
    console.log('Токен получен');

    console.log('2. Запрос к GigaChat...');
    const response = await axios.post('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      model: 'GigaChat',
      messages: [{ role: 'user', content: 'Скажи "Работает"' }]
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      httpsAgent: agent
    });

    console.log('Ответ:', response.data.choices[0].message.content);
  } catch (err) {
    console.log('Ошибка:', err.message);
    if (err.response) console.log('Детали:', err.response.data);
  }
}

test();