require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { neon } = require('@neondatabase/serverless');
const path    = require('path');

const app = express();

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not defined in .env");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

app.use(cors());
app.use(express.json());

// ── ENSURE DB TABLES ──────────────────────────────────────
async function ensureTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY,
        biz TEXT DEFAULT 'My Business',
        momo TEXT DEFAULT '',
        logo TEXT DEFAULT '',
        wa TEXT DEFAULT '',
        taxes JSONB DEFAULT '[]'
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        customer TEXT,
        items JSONB DEFAULT '[]',
        taxes JSONB DEFAULT '[]',
        discount NUMERIC DEFAULT 0,
        delivery NUMERIC DEFAULT 0,
        grand NUMERIC DEFAULT 0,
        date TEXT,
        due_date TEXT DEFAULT '',
        reminders JSONB DEFAULT '[]',
        payment_method TEXT DEFAULT '',
        type TEXT DEFAULT 'invoice',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    // Safe migrations — add columns if they don't exist yet
    const migrations = [
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date TEXT DEFAULT ''`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminders JSONB DEFAULT '[]'`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT ''`,
    ];
    for (const m of migrations) {
      try { await sql.unsafe(m); } catch(e) {}
    }
    console.log('✅ DB tables ready');
  } catch(err) {
    console.error('❌ DB table creation failed:', err.message);
  }
}
ensureTables();

// ── HEALTH CHECK ──────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({ status: "VoiceBill API running", version: "3.0.0" });
});

// ── AI PARSING ────────────────────────────────────────────
app.post('/api/parse', async (req, res) => {
  const { text } = req.body;
  const apiKey   = process.env.GROK_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "Server missing GROK_API_KEY" });

  const systemPrompt = `You are an invoice parser for a Ghanaian market seller. Extract invoice data from the description.
Return ONLY valid JSON. No markdown, no backticks, no explanation.

Rules:
- Ghanaian pidgin/informal speech: "give am", "pieces", "cedis" = common words.
- If price is missing, set to 0.
- If total given for multiple items ("3 shirts 150 cedis"), compute unit price (150/3 = 50).
- Customer name is the first proper noun. Default to 'Customer'.
- If a discount is mentioned, include it as a number in "discount" field.

Required JSON format:
{
  "customer": "string",
  "items": [{ "name": "string", "qty": number, "price": number }],
  "discount": number
}`;

  const isGroq   = apiKey.startsWith('gsk_');
  const apiUrl   = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.x.ai/v1/chat/completions';
  const modelName = process.env.GROK_MODEL ||
    (isGroq ? 'llama-3.3-70b-versatile' : 'grok-3-latest');

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: text }
        ],
        temperature: 0
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = "AI service is currently unavailable.";
      if (response.status === 401) errMsg = "Invalid API Key. Please check your .env file.";
      else if (response.status === 429) errMsg = "AI Rate limit reached. Please wait a moment.";
      console.error(`AI API Error (${response.status}):`, errText);
      return res.status(response.status).json({ error: errMsg });
    }

    const data = await response.json();
    if (data.error) {
      const errMsg = typeof data.error === 'string' ? data.error : (data.error.message || 'AI error');
      return res.status(400).json({ error: errMsg });
    }

    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("AI returned an empty response");

    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const content   = jsonMatch ? jsonMatch[0] : rawContent;
    res.json(JSON.parse(content));
  } catch (err) {
    console.error("Parsing Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── SETTINGS ──────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
  try {
    const result = await sql`SELECT * FROM settings WHERE id = 1`;
    res.json(result[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings', async (req, res) => {
  const { biz, momo, logo, wa, taxes } = req.body;
  try {
    await sql`
      INSERT INTO settings (id, biz, momo, logo, wa, taxes)
      VALUES (1, ${biz}, ${momo}, ${logo}, ${wa}, ${JSON.stringify(taxes || [])})
      ON CONFLICT (id) DO UPDATE SET
        biz   = EXCLUDED.biz,
        momo  = EXCLUDED.momo,
        logo  = EXCLUDED.logo,
        wa    = EXCLUDED.wa,
        taxes = EXCLUDED.taxes
    `;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── HISTORY ───────────────────────────────────────────────
app.get('/api/history', async (req, res) => {
  try {
    const result = await sql`SELECT * FROM invoices ORDER BY created_at DESC LIMIT 50`;
    const mapped = result.map(inv => ({
      ...inv,
      _grand:   parseFloat(inv.grand  || 0),
      type:     inv.type     || 'invoice',
      discount: parseFloat(inv.discount || 0),
      delivery: parseFloat(inv.delivery || 0),
      items:  Array.isArray(inv.items)  ? inv.items  : (typeof inv.items  === 'string' ? JSON.parse(inv.items)  : []),
      taxes:  Array.isArray(inv.taxes)  ? inv.taxes  : (typeof inv.taxes  === 'string' ? JSON.parse(inv.taxes)  : []),
      reminders: Array.isArray(inv.reminders) ? inv.reminders : [],
    }));
    res.json(mapped);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/history', async (req, res) => {
  const inv = req.body;
  try {
    await sql`
      INSERT INTO invoices (id, customer, items, taxes, discount, delivery, grand, date, due_date, reminders, payment_method, type)
      VALUES (
        ${inv.id}, ${inv.customer},
        ${JSON.stringify(inv.items)}, ${JSON.stringify(inv.taxes || [])},
        ${inv.discount}, ${inv.delivery}, ${inv.grand},
        ${inv.date}, ${inv.dueDate || ''}, ${JSON.stringify(inv.reminders || [])},
        ${inv.paymentMethod || ''}, ${inv.type || 'invoice'}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/history/:id/status', async (req, res) => {
  const { id }     = req.params;
  const { status } = req.body;
  try {
    await sql`UPDATE invoices SET status = ${status} WHERE id = ${id}`;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/history', async (req, res) => {
  try {
    await sql`DELETE FROM invoices`;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── STATIC ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => console.log(`🚀 VoiceBill running on http://localhost:${PORT}`));
}

module.exports = app;
