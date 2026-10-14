const axios = require('axios');

const FUNPAY_COOKIES = process.env.FUNPAY_COOKIES;

if (!FUNPAY_COOKIES) {
    console.error("Error: FUNPAY_COOKIES not found in Secrets!");
    process.exit(1);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// بصمة متصفح كاملة وحقيقية لـ FunPay
const funpayHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8,ar;q=0.7',
    'Cookie': FUNPAY_COOKIES,
    'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Referer': 'https://funpay.com/'
};

const pingFunPay = async () => {
    try {
        const response = await axios.get('https://funpay.com/', { headers: funpayHeaders });
        
        // التحقق الذكي: يتأكد من أن الكوكيز صالحة وأن اسم حسابك ظاهر في الصفحة
        if (response.status === 200 && response.data.includes('QuickSellProo')) {
            console.log(`[${new Date().toISOString()}] FunPay Status: Online 🟢`);
        } else if (response.status === 200) {
            console.log(`[${new Date().toISOString()}] FunPay Error: Cookies Expired / Logged Out 🔴`);
        } else {
            console.log(`[${new Date().toISOString()}] FunPay Response Code: ${response.status}`);
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error pinging FunPay:`, error.response ? error.response.status : error.message);
    }
};

(async () => {
    console.log("--> Starting FunPay High-Stealth Keep-Alive Session...");

    // أقصى مدة للتشغيل: 5 ساعات و 45 دقيقة
    const maxDurationMs = 5.75 * 60 * 60 * 1000; 
    const startTime = Date.now();
    const endTime = startTime + maxDurationMs;
    
    let cycle = 1;

    while (Date.now() < endTime) {
        await pingFunPay();
        
        const remainingTimeMs = endTime - Date.now();
        if (remainingTimeMs > 0) {
            // فاصل زمني عشوائي بين النبضات (من 4 إلى 7 دقائق)
            const delayMs = randomInt(240000, 420000); 
            const actualDelayMs = Math.min(delayMs, remainingTimeMs);
            const delayMinutes = (actualDelayMs / 60000).toFixed(2);
            
            console.log(`Cycle ${cycle} complete. Waiting ${delayMinutes} minutes for next ping...`);
            await sleep(actualDelayMs);
            cycle++;
        }
    }
    
    console.log("--> FunPay session finished naturally after ~5 hours and 45 minutes.");
})();
