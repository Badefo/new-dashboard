import axios from 'axios'; 
import crypto from 'crypto'; 
import https from 'https'; 
 
const AUTH_KEY = 'MDE5ZGVjZTMtZGY5My03NDk3LWEyMWEtODRiZDMzNzJiNmE0OmQ5N2NlN2U0LTI0MGUtNGJkOS04MjgzLTAwMzFkMTA2MzFlOA=='; 
 
const httpsAgent = new https.Agent({ rejectUnauthorized: false }); 
 
async function checkGigaChat() { 
  console.log('?? Проверка GigaChat...\n'); 
  try { 
    console.log('1?? Получаю Access Token...'); 
    const tokenRes = await axios.post( 
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
    const response = await axios.post( 
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions', 
      { 
        model: 'GigaChat', 
        messages: [{ role: 'user', content: 'Ответь "ДА, РАБОТАЕТ" одной фразой' }], 
        temperature: 0.7, 
        max_tokens: 50 
      }, 
      { 
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        }, 
        httpsAgent 
      } 
    ); 
    console.log('?? ОТВЕТ GigaChat:', response.data.choices[0].message.content); 
    console.log('\n? GigaChat РАБОТАЕТ!'); 
  } catch (error) { 
    console.error('? ОШИБКА:'); 
    if (error.response) { 
      console.error('Статус:', error.response.status); 
      console.error('Данные:', error.response.data); 
    } else { 
      console.error(error.message); 
    } 
  } 
} 
checkGigaChat(); 
