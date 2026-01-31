/**
 * API do Logix - DeepSeek para TODOS os tipos de análise (chat, anexos, links, boas-vindas, etc.).
 * Pesquisa segura, sem Gemini/GPT.
 *
 * Configure no .env:
 *   DEEPSEEK_API_KEY=sk-...   (obrigatório para produção - https://platform.deepseek.com)
 *   PROVIDER=deepseek
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3001;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;
const PROVIDER = (process.env.PROVIDER || 'deepseek').toLowerCase();
const SERVE_FRONTEND = process.env.SERVE_FRONTEND === '1' || process.env.SERVE_FRONTEND === 'true';

// --- Chat (DeepSeek ou Grok) ---
app.post('/api/chat', async (req, res) => {
  try {
    const { message, system, history = [] } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Campo message é obrigatório.' });
    }

    const systemPrompt = system || 'Você é o Logix, um assistente útil e seguro. Responda em português do Brasil.';

    if (PROVIDER === 'xai' && XAI_API_KEY) {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.flatMap((h) => [
          { role: 'user', content: h.user },
          ...(h.assistant ? [{ role: 'assistant', content: h.assistant }] : []),
        ]),
        { role: 'user', content: message },
      ].filter((m) => m.content);

      const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'grok-3-mini',
          messages,
          max_tokens: 2048,
        }),
      });
      if (!grokRes.ok) {
        const err = await grokRes.text();
        throw new Error(`Grok: ${grokRes.status} ${err}`);
      }
      const data = await grokRes.json();
      const text = data.choices?.[0]?.message?.content || '';
      return res.json({ response: text });
    }

    if (DEEPSEEK_API_KEY) {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.flatMap((h) => [
          { role: 'user', content: h.user },
          ...(h.assistant ? [{ role: 'assistant', content: h.assistant }] : []),
        ]),
        { role: 'user', content: message },
      ].filter((m) => m.content);

      const deepRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          max_tokens: 2048,
        }),
      });
      if (!deepRes.ok) {
        const err = await deepRes.text();
        throw new Error(`DeepSeek: ${deepRes.status} ${err}`);
      }
      const data = await deepRes.json();
      const text = data.choices?.[0]?.message?.content || '';
      return res.json({ response: text });
    }

    return res.status(503).json({
      error: 'Configure DEEPSEEK_API_KEY ou XAI_API_KEY no .env',
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Erro no servidor' });
  }
});

// --- Buscar conteúdo de um link (para o Logix “ler” links) ---
app.post('/api/fetch-url', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Campo url é obrigatório.' });
    }
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'URL inválida.' });
    }
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LogixBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Não foi possível acessar o link.' });
    }
    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000);
    return res.json({ text, url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Erro ao acessar o link' });
  }
});

app.get('/api/health', (_, res) => res.json({ ok: true, provider: PROVIDER }));

// Servir frontend (index.html, css, js, img) na mesma origem para hospedagem completa
if (SERVE_FRONTEND) {
  const frontendDir = path.join(__dirname, '..');
  app.use(express.static(frontendDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Logix API rodando em http://localhost:${PORT}`);
  console.log(`Provider: ${PROVIDER} | DeepSeek para todos os tipos de análise`);
  if (SERVE_FRONTEND) console.log('Frontend servido na mesma origem (hospedagem completa).');
  if (!DEEPSEEK_API_KEY && !XAI_API_KEY) {
    console.warn('Aviso: defina DEEPSEEK_API_KEY no .env para o chat.');
  }
});
