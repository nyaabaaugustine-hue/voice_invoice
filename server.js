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

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '.')));

// Handle the root route to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- HEALTH CHECK ---
app.get('/api', (req, res) => {
  res.json({ status: "VoiceInvoice API is running", version: "1.0.0" });
});

// --- AI PARSING ENDPOINT ---
app.post('/api/parse', async (req, res) => {
  const { text } = req.body;
  const apiKey = process.env.GROK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Server missing GROK_API_KEY" });
  }

  const systemPrompt = `You are an invoice parser for a Ghanaian market seller. Extract invoice data from the description.
Return ONLY valid JSON. No markdown, no backticks.

Rules:
- Ghanaian pidgin/informal speech: "give am", "pieces", "cedis" are common.
- If price is missing, set to 0.
- If total is given for multiple items ("3 shirts 150 cedis"), calculate unit price (150/3 = 50).
- Customer name is the first proper noun. Default to 'Customer'.

Expected JSON:
{
  "customer": "string",
  "items": [{ "name": "string", "qty": number, "price": number }]
}`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || "grok-2-latest",
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0
      }),
    });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "AI service is currently unavailable.";
        
        if (response.status === 401) {
          errorMessage = "Invalid xAI API Key. Please check your .env file.";
        } else if (response.status === 429) {
          errorMessage = "AI Rate limit reached. Please wait a moment.";
        }

        console.error(`xAI API Error (${response.status}):`, errorText);
        return res.status(response.status).json({ error: errorMessage });
      }

    const data = await response.json();
    if (data.error) {
      return res.status(data.status || 500).json(data.error);
    }

    const rawContent = data.choices[0].message.content;
    // Extract the JSON object even if the AI included conversational text or markdown
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const content = jsonMatch ? jsonMatch[0] : rawContent;
    
    res.json(JSON.parse(content));
  } catch (err) {
    console.error("Parsing Error:", err.message);
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
  const { biz, momo, logo, wa, taxes } = req.body;
  try {
    await sql`
      INSERT INTO settings (id, biz, momo, logo, wa, taxes)
      VALUES (1, ${biz}, ${momo}, ${logo}, ${wa}, ${JSON.stringify(taxes || [])})
      ON CONFLICT (id) DO UPDATE SET
        biz = EXCLUDED.biz,
        momo = EXCLUDED.momo,
        logo = EXCLUDED.logo,
        wa = EXCLUDED.wa,
        taxes = EXCLUDED.taxes
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
    const mapped = result.map(inv => ({
      ...inv,
      _grand: parseFloat(inv.grand || 0),
      type: inv.type || 'invoice',
      discount: parseFloat(inv.discount || 0),
      delivery: parseFloat(inv.delivery || 0),
      // Ensure items and taxes are arrays, regardless of DB driver behavior
      items: Array.isArray(inv.items) ? inv.items : 
             (typeof inv.items === 'string' ? JSON.parse(inv.items) : []),
      taxes: Array.isArray(inv.taxes) ? inv.taxes : 
             (typeof inv.taxes === 'string' ? JSON.parse(inv.taxes) : [])
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
      INSERT INTO invoices (id, customer, items, taxes, discount, delivery, grand, date, type)
      VALUES (${inv.id}, ${inv.customer}, ${JSON.stringify(inv.items)}, ${JSON.stringify(inv.taxes || [])}, ${inv.discount}, ${inv.delivery}, ${inv.grand}, ${inv.date}, ${inv.type || 'invoice'})
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