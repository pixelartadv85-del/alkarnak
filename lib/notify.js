// تنبيهات فورية على تيليجرام عند وصول طلب جديد أو طلب خلطة أو تقييم.
// الإعدادات محفوظة في db.notify (وليس في settings) لأن الإعدادات العامة تُرسل للمتصفح.

async function telegram(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(data.description || `Telegram HTTP ${res.status}`);
  return data;
}

// آخر محادثة أرسلت رسالة للبوت: لمعرفة رقم المحادثة (chat id) تلقائياً
async function detectChat(token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(data.description || 'رمز البوت غير صحيح');
  const msgs = (data.result || []).map((u) => u.message || u.channel_post || u.my_chat_member).filter(Boolean);
  const last = msgs[msgs.length - 1];
  if (!last || !last.chat) return null;
  return { id: String(last.chat.id), name: last.chat.title || [last.chat.first_name, last.chat.last_name].filter(Boolean).join(' ') || last.chat.username || '' };
}

const escHtml = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

function create(getConfig) {
  // يُرسل بدون انتظار حتى لا يتأخر رد الزبون؛ الأخطاء تُسجل فقط
  return function notify(event, text) {
    const cfg = getConfig() || {};
    if (!cfg.enabled || !cfg.botToken || !cfg.chatId) return;
    if (cfg.events && cfg.events[event] === false) return;
    telegram(cfg.botToken, cfg.chatId, text).catch((e) => console.error('Telegram notify failed:', e.message));
  };
}

module.exports = { telegram, detectChat, create, escHtml };
