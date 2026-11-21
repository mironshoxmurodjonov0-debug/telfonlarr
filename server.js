import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_CHANNEL_ID, INITIAL_PRODUCTS, ORDER_STATUSES, formatPriceUZS } from './src/data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

// Ephemeral in-memory fallback signing key when SESSION_SECRET env var is unset
const RUNTIME_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret() {
  return process.env.SESSION_SECRET || RUNTIME_SESSION_SECRET;
}

function getTelegramConfig() {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const channelId = (process.env.TELEGRAM_CHANNEL_ID || DEFAULT_CHANNEL_ID).trim();
  return { botToken, channelId };
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initialStore = {
      nextOrderNumber: 1001,
      adminHash: null,
      products: INITIAL_PRODUCTS,
      orders: [],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
    return initialStore;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      nextOrderNumber: Number(parsed.nextOrderNumber) || 1001,
      adminHash: parsed.adminHash || null,
      products: Array.isArray(parsed.products) ? parsed.products : INITIAL_PRODUCTS,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    };
  } catch {
    const fallback = {
      nextOrderNumber: 1001,
      adminHash: null,
      products: INITIAL_PRODUCTS,
      orders: [],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

function writeStore(store) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function verifyPassword(password, record) {
  if (!record || typeof record.salt !== 'string' || typeof record.hash !== 'string') {
    return false;
  }
  const derived = crypto.scryptSync(password, record.salt, 64);
  const expected = Buffer.from(record.hash, 'hex');
  if (derived.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expected);
}

function verifyEnvPasscode(candidate, expected) {
  const a = crypto.createHash('sha256').update(String(candidate)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

function signSessionToken(role = 'admin') {
  const payload = {
    role,
    exp: Date.now() + 12 * 60 * 60 * 1000,
    jti: crypto.randomBytes(8).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin avtorizatsiyasi talab qilinadi.' });
  }
  const token = authHeader.slice(7).trim();
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'admin') {
    return res.status(401).json({ error: 'Sessiya muddati tugagan yoki yaroqsiz.' });
  }
  req.admin = payload;
  next();
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeImageUrl(url) {
  if (typeof url !== 'string') {
    return '/src/assets/images/product_phone_black_1795241778296.jpg';
  }
  const trimmed = url.trim();
  if (trimmed.startsWith('/src/assets/images/') && !trimmed.includes('..')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // ignore invalid URL
  }
  return '/src/assets/images/product_phone_black_1795241778296.jpg';
}

function formatOrderTelegramHtml(order, prefixTitle = 'YANGI BUYURTMA') {
  const itemsText = order.items
    .map(
      (item, idx) =>
        `${idx + 1}. <b>${escapeHtml(item.name)}</b> (${escapeHtml(item.variant)}${
          item.color ? `, ${escapeHtml(item.color)}` : ''
        }) × ${item.qty} — <code>${escapeHtml(formatPriceUZS(item.lineTotal))}</code>`
    )
    .join('\n');

  const timeFormatted = new Date(order.createdAt).toLocaleString('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return [
    `<b>${escapeHtml(prefixTitle)} #${escapeHtml(order.id)}</b>`,
    `Holat: <b>${escapeHtml(order.status)}</b>`,
    ``,
    `<b>Mijoz:</b> ${escapeHtml(order.customerName)}`,
    `<b>Telefon:</b> <code>${escapeHtml(order.phone)}</code>`,
    `<b>Yetkazib berish:</b> ${escapeHtml(order.deliveryMethod)}`,
    `<b>Manzil:</b> ${escapeHtml(order.address)}`,
    `<b>To'lov turi:</b> ${escapeHtml(order.paymentMethod)}`,
    order.note ? `<b>Izoh:</b> ${escapeHtml(order.note)}` : null,
    ``,
    `<b>Mahsulotlar:</b>`,
    itemsText,
    ``,
    `<b>Jami summa:</b> <code>${escapeHtml(formatPriceUZS(order.total))}</code>`,
    `Vaqt: ${escapeHtml(timeFormatted)}`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

async function sendTelegramMessage(htmlText) {
  const { botToken, channelId } = getTelegramConfig();
  if (!botToken) {
    return {
      sent: false,
      error: 'TELEGRAM_BOT_TOKEN server muhitida (Secrets) sozlanmagan.',
      messageId: null,
    };
  }
  if (!channelId) {
    return {
      sent: false,
      error: 'TELEGRAM_CHANNEL_ID ko‘rsatilmagan.',
      messageId: null,
    };
  }

  const endpoint = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      return {
        sent: false,
        error: data.description || `Telegram API xatosi (${response.status})`,
        messageId: null,
      };
    }
    return {
      sent: true,
      error: null,
      messageId: data.result?.message_id || null,
      sentAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      sent: false,
      error: err?.name === 'AbortError' ? 'Telegram serveri javob bermadi (vaqt tugadi).' : 'Telegramga ulanishda tarmoq xatosi.',
      messageId: null,
    };
  }
}

async function startServer() {
  ensureStore();
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // Public catalog
  app.get('/api/products', (_req, res) => {
    const store = ensureStore();
    res.json({ products: store.products });
  });

  // Public order creation with server-side price validation & real-time Telegram dispatch
  app.post('/api/orders', async (req, res) => {
    const body = req.body || {};
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const deliveryMethod =
      body.deliveryMethod === "Do'kondan olib ketish" ? "Do'kondan olib ketish" : 'Kuryer (Toshkent)';
    const paymentMethod =
      body.paymentMethod === 'Click / Payme' || body.paymentMethod === "Bo'lib to'lash (0%)"
        ? body.paymentMethod
        : 'Naqd pul';
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (customerName.length < 2 || customerName.length > 80) {
      return res.status(400).json({ error: 'Iltimos, ismingizni to‘g‘ri kiriting (kamida 2 belgi).' });
    }
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 9 || digitsOnly.length > 15) {
      return res.status(400).json({ error: 'Telefon raqamini to‘g‘ri formatda kiriting (+998 90 123 45 67).' });
    }
    if (deliveryMethod !== "Do'kondan olib ketish" && address.length < 4) {
      return res.status(400).json({ error: 'Yetkazib berish manzilini kiriting.' });
    }
    if (rawItems.length === 0 || rawItems.length > 25) {
      return res.status(400).json({ error: 'Savatda kamida bitta mahsulot bo‘lishi kerak.' });
    }

    const store = ensureStore();
    const resolvedItems = [];
    let total = 0;

    for (const rawItem of rawItems) {
      const productId = typeof rawItem?.productId === 'string' ? rawItem.productId : '';
      const qty = Number(rawItem?.qty);
      if (!productId || !Number.isInteger(qty) || qty < 1 || qty > 20) {
        return res.status(400).json({ error: 'Buyurtma tarkibidagi mahsulot soni noto‘g‘ri.' });
      }
      const product = store.products.find((p) => p.id === productId);
      if (!product) {
        return res.status(400).json({ error: 'Tanlangan mahsulot topilmadi.' });
      }
      if (!product.inStock) {
        return res.status(400).json({ error: `"${product.name}" hozirda sotuvda mavjud emas.` });
      }
      const variant =
        typeof rawItem.variant === 'string' && rawItem.variant.trim()
          ? rawItem.variant.trim().slice(0, 40)
          : product.variants?.[0] || 'Standart';
      const color =
        typeof rawItem.color === 'string' && rawItem.color.trim()
          ? rawItem.color.trim().slice(0, 40)
          : product.colors?.[0] || '';
      const lineTotal = product.price * qty;
      total += lineTotal;
      resolvedItems.push({
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        qty,
        variant,
        color,
        lineTotal,
      });
    }

    const orderNumber = store.nextOrderNumber;
    store.nextOrderNumber = orderNumber + 1;

    const order = {
      id: `OM-${orderNumber}`,
      createdAt: new Date().toISOString(),
      status: 'Yangi',
      customerName,
      phone,
      address: deliveryMethod === "Do'kondan olib ketish" ? "Do'kondan olib ketish (Amir Temur 42)" : address,
      deliveryMethod,
      paymentMethod,
      note,
      items: resolvedItems,
      total,
      telegram: {
        sent: false,
        error: null,
        messageId: null,
      },
    };

    const telegramResult = await sendTelegramMessage(formatOrderTelegramHtml(order, 'YANGI BUYURTMA'));
    order.telegram = telegramResult;

    store.orders.unshift(order);
    writeStore(store);

    res.status(201).json({
      order,
      telegramSent: telegramResult.sent,
      telegramError: telegramResult.error,
    });
  });

  // Admin status & auth
  app.get('/api/admin/status', (_req, res) => {
    const store = ensureStore();
    const { botToken, channelId } = getTelegramConfig();
    const hasEnvPasscode = Boolean((process.env.ADMIN_PASSCODE || '').trim());
    const authMode = hasEnvPasscode ? 'env' : store.adminHash ? 'claimed' : 'unclaimed';
    res.json({
      authMode,
      telegramConfigured: Boolean(botToken),
      channelId,
    });
  });

  app.post('/api/admin/claim', (req, res) => {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    if (envPasscode) {
      return res.status(409).json({ error: 'Admin paroli muhit sozlamalarida allaqachon belgilangan.' });
    }
    const store = ensureStore();
    if (store.adminHash) {
      return res.status(409).json({ error: 'Admin paroli allaqachon o‘rnatilgan. Tizimga kiring.' });
    }
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak.' });
    }
    store.adminHash = hashPassword(password);
    writeStore(store);
    const token = signSessionToken('admin');
    res.status(201).json({ token, expiresIn: 12 * 60 * 60 });
  });

  app.post('/api/admin/login', (req, res) => {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password) {
      return res.status(400).json({ error: 'Parolni kiriting.' });
    }
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const store = ensureStore();

    let authorized = false;
    if (envPasscode) {
      authorized = verifyEnvPasscode(password, envPasscode);
    } else if (store.adminHash) {
      authorized = verifyPassword(password, store.adminHash);
    } else {
      return res.status(409).json({ error: 'Avval birinchi admin parolini o‘rnating.' });
    }

    if (!authorized) {
      return res.status(401).json({ error: 'Parol noto‘g‘ri.' });
    }

    const token = signSessionToken('admin');
    res.json({ token, expiresIn: 12 * 60 * 60 });
  });

  // Protected Admin routes
  app.get('/api/orders', requireAdmin, (_req, res) => {
    const store = ensureStore();
    res.json({ orders: store.orders });
  });

  app.patch('/api/orders/:id', requireAdmin, async (req, res) => {
    const orderId = req.params.id;
    const status = typeof req.body?.status === 'string' ? req.body.status : '';
    const notifyTelegram = Boolean(req.body?.notifyTelegram);

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Noto‘g‘ri buyurtma holati.' });
    }

    const store = ensureStore();
    const order = store.orders.find((o) => o.id === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Buyurtma topilmadi.' });
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();

    let telegramUpdate = null;
    if (notifyTelegram) {
      telegramUpdate = await sendTelegramMessage(
        formatOrderTelegramHtml(order, `HOLAT YANGILANDI (${status.toUpperCase()})`)
      );
      if (telegramUpdate.sent) {
        order.telegram = telegramUpdate;
      }
    }

    writeStore(store);
    res.json({ order, telegramUpdate });
  });

  app.post('/api/orders/:id/resend-telegram', requireAdmin, async (req, res) => {
    const store = ensureStore();
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Buyurtma topilmadi.' });
    }
    const result = await sendTelegramMessage(formatOrderTelegramHtml(order, 'BUYURTMA MA’LUMOTI'));
    order.telegram = result;
    writeStore(store);
    res.json({ order, telegramResult: result });
  });

  app.post('/api/products', requireAdmin, (req, res) => {
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const price = Number(body.price);
    const specs = typeof body.specs === 'string' ? body.specs.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const variants = Array.isArray(body.variants)
      ? body.variants.map((v) => String(v).trim()).filter(Boolean).slice(0, 6)
      : typeof body.variants === 'string'
        ? body.variants.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6)
        : ['Standart'];
    const colors = Array.isArray(body.colors)
      ? body.colors.map((c) => String(c).trim()).filter(Boolean).slice(0, 6)
      : typeof body.colors === 'string'
        ? body.colors.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6)
        : ['Qora'];

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ error: 'Mahsulot nomi 2 dan 80 belgigacha bo‘lishi kerak.' });
    }
    if (!['Smartfonlar', 'Quloqchinlar', 'Soatlar', 'Aksessuarlar'].includes(category)) {
      return res.status(400).json({ error: 'Toifa noto‘g‘ri tanlangan.' });
    }
    if (!Number.isFinite(price) || price <= 0 || price > 500000000) {
      return res.status(400).json({ error: 'Mahsulot narxini to‘g‘ri kiriting.' });
    }

    const store = ensureStore();
    const slugBase = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    const product = {
      id: `${slugBase || 'item'}-${crypto.randomBytes(3).toString('hex')}`,
      name,
      category,
      price: Math.round(price),
      specs: specs || 'Rasmiy kafolat · Yangi avlod',
      description: description || `${name} — Olov Mobil katalogidagi rasmiy mahsulot.`,
      variants: variants.length > 0 ? variants : ['Standart'],
      colors: colors.length > 0 ? colors : ['Qora'],
      image: sanitizeImageUrl(body.image),
      inStock: body.inStock !== false,
      featured: Boolean(body.featured),
    };

    store.products.unshift(product);
    writeStore(store);
    res.status(201).json({ product });
  });

  app.patch('/api/products/:id', requireAdmin, (req, res) => {
    const store = ensureStore();
    const product = store.products.find((p) => p.id === req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Mahsulot topilmadi.' });
    }
    const body = req.body || {};
    if (typeof body.name === 'string' && body.name.trim().length >= 2) {
      product.name = body.name.trim().slice(0, 80);
    }
    if (body.price !== undefined) {
      const nextPrice = Number(body.price);
      if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
        return res.status(400).json({ error: 'Narx noto‘g‘ri.' });
      }
      product.price = Math.round(nextPrice);
    }
    if (typeof body.inStock === 'boolean') {
      product.inStock = body.inStock;
    }
    if (typeof body.specs === 'string') {
      product.specs = body.specs.trim().slice(0, 140);
    }
    writeStore(store);
    res.json({ product });
  });

  app.delete('/api/products/:id', requireAdmin, (req, res) => {
    const store = ensureStore();
    const idx = store.products.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Mahsulot topilmadi.' });
    }
    const [removed] = store.products.splice(idx, 1);
    writeStore(store);
    res.json({ removedId: removed.id });
  });

  app.post('/api/telegram/test', requireAdmin, async (_req, res) => {
    const { channelId } = getTelegramConfig();
    const now = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
    const result = await sendTelegramMessage(
      [
        `<b>OLOV MOBIL — Sinov xabari</b>`,
        `Kanal ulanishi muvaffaqiyatli tekshirildi.`,
        `Kanal ID: <code>${escapeHtml(channelId)}</code>`,
        `Vaqt: ${escapeHtml(now)}`,
      ].join('\n')
    );
    if (!result.sent) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  // Frontend middleware / static serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Olov Mobil server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
