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
    console.log('2. Токен получен');

    const response = await axios.post('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      model: 'GigaChat',
      messages: [{ role: 'user', content: 'Скажи "GigaChat работает"' }]
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      httpsAgent: agent
    });

    console.log('✅', response.data.choices[0].message.content);
  } catch(e) {
    console.log('❌ Ошибка:', e.message);
    if (e.response) console.log('Детали:', e.response.data);
  }
}

test();