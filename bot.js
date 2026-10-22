const axios = require('axios');

const RAW_COOKIES = process.env.FUNPAY_COOKIES;

if (!RAW_COOKIES) {
    console.error("Error: FUNPAY_COOKIES not found in Secrets!");
    process.exit(1);
}

// تنظيف الكوكيز من أي أسطر جديدة أو مسافات زائدة تسبب خطأ 400
const FUNPAY_COOKIES = RAW_COOKIES.replace(/[\r\n]+/g, '').trim();

// ============================================================================
// روابط صفحات العروض (Trade URLs) المراد عمل Boost لها تلقائياً
// ============================================================================
const BOOST_URLS = [
    'https://funpay.com/en/lots/139/trade' // قسم Overwatch 2 Accounts
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8,ar;q=0.7',
    'Cookie': FUNPAY_COOKIES,
    'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"'
};

// متغير لحفظ بيانات الجلسة (CSRF Token & User ID)
let appData = null;

// 1. دالة جلب بيانات الحساب وتحديث حالة الأونلاين
const keepAliveOnline = async () => {
    try {
        const response = await axios.get('https://funpay.com/', {
            headers: {
                ...baseHeaders,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'Referer': 'https://funpay.com/'
            }
        });

        const html = response.data;

        // استخراج بيانات الجلسة (CSRF Token & userId)
        const appDataMatch = html.match(/data-app-data="([^"]+)"/);
        if (appDataMatch) {
            try {
                const decodedJson = appDataMatch[1].replace(/&quot;/g, '"');
                const parsed = JSON.parse(decodedJson);
                appData = Array.isArray(parsed) ? parsed[0] : parsed;
            } catch (e) {
                // تجاهل أخطاء فك الـ JSON إن وجدت
            }
        }

        const isLoggedIn = (appData && appData.userId) || html.includes('ELhafzleek12') || html.includes('user-link-dropdown');

        if (response.status === 200 && isLoggedIn) {
            // إرسال نبضة إلى /runner/ بالصيغة القياسية لـ FunPay (معزولة حتى لا تعطل السكريبت)
            if (appData && appData['csrf-token'] && appData.userId) {
                try {
                    const cpuObj = {
                        type: "c-p-u",
                        id: String(appData.userId),
                        tag: "00000000",
                        data: false
                    };
                    const params = new URLSearchParams();
                    params.append('objects', JSON.stringify([cpuObj]));
                    params.append('request', 'false');
                    params.append('csrf_token', appData['csrf-token']);

                    await axios.post('https://funpay.com/runner/', params.toString(), {
                        headers: {
                            ...baseHeaders,
                            'Accept': 'application/json, text/javascript, */*; q=0.01',
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Origin': 'https://funpay.com',
                            'Referer': 'https://funpay.com/'
                        }
                    });
                } catch (runnerErr) {
                    // حتى لو رفض الـ runner الطلب، فتح الصفحة بالأعلى كافٍ لتجديد الأونلاين كل دقيقتين
                }
            }

            console.log(`[${new Date().toISOString()}] FunPay Status: Online 🟢 (User ID: ${appData?.userId || 'Active'})`);
            return true;
        } else {
            console.log(`[${new Date().toISOString()}] FunPay Error: Cookies Expired / Logged Out 🔴`);
            return false;
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in keepAliveOnline:`, error.response ? error.response.status : error.message);
        return false;
    }
};

// 2. دالة رفع العروض (Boost Offers)
const boostOfferUrl = async (tradeUrl) => {
    try {
        // فتح صفحة العروض لاستخراج game_id و node_id من زر البوست مباشرة
        const pageRes = await axios.get(tradeUrl, {
            headers: {
                ...baseHeaders,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Referer': 'https://funpay.com/'
            }
        });

        const html = pageRes.data;
        const gameMatch = html.match(/data-game="(\d+)"/);
        const nodeMatch = html.match(/data-node="(\d+)"/);

        if (!gameMatch || !nodeMatch) {
            console.log(`[${new Date().toISOString()}] ⚠️ Boost Info: لم يتم العثور على زر Boost في الرابط: ${tradeUrl}`);
            return;
        }

        const gameId = gameMatch[1];
        const nodeId = nodeMatch[1];

        // إرسال طلب الـ Boost الأولي
        const params = new URLSearchParams();
        params.append('game_id', gameId);
        params.append('node_id', nodeId);

        const raiseHeaders = {
            ...baseHeaders,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://funpay.com',
            'Referer': tradeUrl
        };

        const raiseRes = await axios.post('https://funpay.com/lots/raise', params.toString(), { headers: raiseHeaders });
        const data = raiseRes.data;

        // في حال فتح نافذة اختيار أقسام فرعية (Modal) نختارها كلها ونرسل التأكيد
        if (data && data.modal) {
            const checkboxMatches = [...data.modal.matchAll(/name="node_ids\[\]"\s+value="(\d+)"/g)];
            if (checkboxMatches.length > 0) {
                const modalParams = new URLSearchParams();
                modalParams.append('game_id', gameId);
                modalParams.append('node_id', nodeId);
                checkboxMatches.forEach(m => modalParams.append('node_ids[]', m[1]));

                const confirmRes = await axios.post('https://funpay.com/lots/raise', modalParams.toString(), { headers: raiseHeaders });
                console.log(`[${new Date().toISOString()}] 🚀 Boost Result (Node ${nodeId}):`, confirmRes.data.msg || "Boosted Successfully!");
                return;
            }
        }

        // طباعة النتيجة (سواء تم الرفع بنجاح أو طلب الانتظار لانتهاء الـ 3 ساعات)
        if (data && data.msg) {
            const statusIcon = data.error ? '⏳' : '🚀';
            console.log(`[${new Date().toISOString()}] ${statusIcon} Boost Status (Node ${nodeId}): ${data.msg}`);
        } else {
            console.log(`[${new Date().toISOString()}] 🚀 Boost Response (Node ${nodeId}):`, JSON.stringify(data));
        }

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error boosting ${tradeUrl}:`, error.response ? error.response.status : error.message);
    }
};

(async () => {
    console.log("--> Starting FunPay High-Stealth Keep-Alive & Auto-Boost Session...");

    // مدة الجلسة: 5 ساعات و 30 دقيقة
    const maxDurationMs = 5.5 * 60 * 60 * 1000;
    const startTime = Date.now();
    const endTime = startTime + maxDurationMs;

    let lastBoostCheckTime = 0;
    // فحص الـ Boost كل 15 دقيقة
    const boostCheckIntervalMs = 15 * 60 * 1000; 

    let cycle = 1;

    while (Date.now() < endTime) {
        const isOnline = await keepAliveOnline();

        // إذا كان الحساب متصلاً، نتحقق مما إذا حان وقت فحص الـ Boost
        if (isOnline && (Date.now() - lastBoostCheckTime >= boostCheckIntervalMs)) {
            console.log(`[${new Date().toISOString()}] Checking Offers Boost...`);
            for (const url of BOOST_URLS) {
                await boostOfferUrl(url);
                await sleep(randomInt(2000, 4000));
            }
            lastBoostCheckTime = Date.now();
        }

        const remainingTimeMs = endTime - Date.now();
        if (remainingTimeMs > 0) {
            // فاصل زمني قصير وعشوائي (من 1.5 إلى 3 دقائق) لمنع ظهور Offline نهائياً
            const delayMs = randomInt(90000, 180000);
            const actualDelayMs = Math.min(delayMs, remainingTimeMs);
            const delayMinutes = (actualDelayMs / 60000).toFixed(2);

            console.log(`Cycle ${cycle} complete. Waiting ${delayMinutes} minutes for next heartbeat...`);
            await sleep(actualDelayMs);
            cycle++;
        }
    }

    console.log("--> Session finished cleanly. Handing over to the next workflow run immediately...");
})();
