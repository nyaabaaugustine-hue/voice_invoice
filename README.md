# VoiceInvoice AI

VoiceInvoice AI is a next-generation mobile-first invoicing app designed to help freelancers, small business owners, and service providers create, manage, and send invoices instantly, whether by voice or manual entry.

## Features

- **Voice-Activated Invoicing**: Generate invoices using natural speech commands.
- **AI Parsing Engine**: Powered by Grok AI for accurate data extraction from informal speech.
- **Professional Branding**: Branded invoices with custom business names and logo support.
- **Instant Sharing**: Multi-channel sharing via WhatsApp, Telegram, SMS, or Email.
- **Persistent History**: Invoice history securely stored in a Neon PostgreSQL database.

## Tech Stack

- **Frontend**: Vanilla JavaScript, CSS3 (Syne & DM Mono fonts), HTML5.
- **Backend**: Node.js, Express.
- **Database**: Neon (Serverless PostgreSQL).
- **AI**: Grok (xAI API).

## Local Development

1. Install dependencies: `npm install`
2. Create a `.env` file based on the environment variables needed (DATABASE_URL, GROK_API_KEY).
3. Start the server: `node server.js`
