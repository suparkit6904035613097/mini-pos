// API Route ฝั่ง server สำหรับยิงข้อความเข้า Telegram
// เก็บ Bot Token ไว้ฝั่ง server เท่านั้น ไม่ให้หลุดไปกับโค้ด client
export async function POST(request) {
  try {
    const { text } = await request.json();

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return Response.json(
        { ok: false, error: "ไม่พบ TELEGRAM_BOT_TOKEN หรือ TELEGRAM_CHAT_ID" },
        { status: 500 }
      );
    }

    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      }
    );

    const data = await res.json();
    return Response.json({ ok: true, data });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
