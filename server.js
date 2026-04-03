require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { neon } = require('@neondatabase/serverless');
const path = require('path');

const app = express();

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not defined in .env");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

app.use(cors());
app.use(express.json());

// Serve static frontend files from the current directory
app.use(express.static(path.join(__dirname)));

// --- AI PARSING ENDPOINT ---
app.post('/api/parse', async (req, res) => {
  const { text, prompt } = req.body;
  const apiKey = process.env.GROK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Server missing GROK_API_KEY" });
  }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [{ role: 'user', content: prompt }],
        temperature: 0
      }),
    });

    const data = await response.json();
    if (data.error) {
      return res.status(data.status || 500).json(data.error);
    }

    const content = data.choices[0].message.content.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(content));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SETTINGS ENDPOINTS ---
app.get('/api/settings', async (req, res) => {
  try {
    const result = await sql`SELECT * FROM settings WHERE id = 1`;
    res.json(result[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  const { biz, momo, logo, wa } = req.body;
  try {
    await sql`
      INSERT INTO settings (id, biz, momo, logo, wa)
      VALUES (1, ${biz}, ${momo}, ${logo}, ${wa})
      ON CONFLICT (id) DO UPDATE SET
        biz = EXCLUDED.biz,
        momo = EXCLUDED.momo,
        logo = EXCLUDED.logo,
        wa = EXCLUDED.wa
    `;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- INVOICE HISTORY ENDPOINTS ---
app.get('/api/history', async (req, res) => {
  try {
    const result = await sql`SELECT * FROM invoices ORDER BY created_at DESC LIMIT 50`;
    // Map DB fields back to frontend names
    const mapped = result.map(inv => ({
      ...inv,
      _grand: parseFloat(inv.grand),
      discount: parseFloat(inv.discount),
      delivery: parseFloat(inv.delivery)
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/history', async (req, res) => {
  const inv = req.body;
  try {
    await sql`
      INSERT INTO invoices (id, customer, items, discount, delivery, grand, date)
      VALUES (${inv.id}, ${inv.customer}, ${JSON.stringify(inv.items)}, ${inv.discount}, ${inv.delivery}, ${inv.grand}, ${inv.date})
      ON CONFLICT (id) DO NOTHING
    `;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/history', async (req, res) => {
  try {
    await sql`DELETE FROM invoices`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;