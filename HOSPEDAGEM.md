# Como subir o LOGIX completo para hospedagem

O Logix usa **DeepSeek** para **todos** os tipos de análise (chat, anexos, links, boas-vindas, etc.). A chave da API fica só no servidor (nunca no navegador).

**Chave DeepSeek:** O projeto já vem com a API configurada em `api/.env`. Em **produção**, use uma chave nova gerada em [platform.deepseek.com](https://platform.deepseek.com) e defina só como variável de ambiente na hospedagem (não suba o `.env` com a chave no Git).

---

## Opção 1: Tudo em um único serviço (Recomendado)

Um único deploy serve o frontend (HTML, CSS, JS) e a API na mesma origem. Assim não é preciso configurar CORS nem URL da API no front.

### 1. Onde hospedar

- **Render** (render.com) – plano gratuito
- **Railway** (railway.app) – créditos grátis
- **Fly.io** (fly.io) – plano gratuito
- Qualquer VPS (Node.js instalado)

### 2. Preparar o projeto

Na raiz do projeto (pasta onde está `index.html` e a pasta `api/`):

1. **Chave DeepSeek**  
   A pasta `api/` já tem um arquivo `.env` com a chave.  
   Em produção, **não use a mesma chave em rede pública**. Gere uma nova em [platform.deepseek.com](https://platform.deepseek.com) e use só no servidor.

2. **Variável para servir o frontend**  
   No mesmo `.env` da API (ou nas variáveis de ambiente do serviço), defina:
   ```env
   SERVE_FRONTEND=1
   ```
   Assim o mesmo servidor Node entrega o site e a API.

### 3. Deploy no Render (exemplo)

1. Crie uma conta em [render.com](https://render.com).
2. **New → Web Service**.
3. Conecte o repositório Git do projeto (GitHub/GitLab).
4. Configure:
   - **Root Directory:** deixe em branco (raiz do repo).
   - **Runtime:** `Node`.
   - **Build Command:**  
     `cd api && npm install`
   - **Start Command:**  
     `cd api && node server.js`
5. Em **Environment** (variáveis de ambiente), adicione:
   - `DEEPSEEK_API_KEY` = sua chave DeepSeek (ex.: `sk-...`)
   - `SERVE_FRONTEND` = `1`
   - `NODE_ENV` = `production` (opcional)
6. Deploy. O Render vai dar uma URL tipo `https://seu-logix.onrender.com`.
7. Acesse essa URL: você vê o site e o chat usa a API na mesma origem (DeepSeek para todas as análises).

### 4. Deploy no Railway (exemplo)

1. Crie uma conta em [railway.app](https://railway.app).
2. **New Project → Deploy from GitHub** e escolha o repositório.
3. O projeto já tem um `package.json` na raiz com `"start": "cd api && node server.js"`. O Railway usa esse script.
4. No dashboard do Railway, em **Variables**, adicione:
   - `DEEPSEEK_API_KEY` = sua chave
   - `SERVE_FRONTEND` = `1`
5. O Railway detecta Node e usa `npm start`. A URL será algo como `https://seu-logix.up.railway.app`.

### 5. Firebase (login e histórico)

O front já usa Firebase (Auth e Firestore). Para produção:

1. No [Console do Firebase](https://console.firebase.google.com), no seu projeto:
   - Em **Authentication → Sign-in method**, deixe ativos os métodos que você usa (e-mail/senha, Google, etc.).
   - Em **Firestore**, mantenha as regras adequadas para leitura/escrita apenas de usuários autenticados.
2. No código do front, o `firebaseConfig` já está em `index.html`. Se você usar um projeto Firebase diferente em produção, troque só esse objeto.
3. Em **Authentication → Authorized domains**, adicione o domínio da hospedagem (ex.: `seu-logix.onrender.com`).

Assim, login e histórico continuam funcionando na versão publicada.

---

## Opção 2: Frontend e API em serviços separados

- **Frontend:** Vercel, Netlify ou similar (só arquivos estáticos: `index.html`, `css/`, `js/`, `img/`).
- **API:** Render, Railway, Fly.io, etc., com a API do projeto (`api/server.js`).

Passos gerais:

1. **Deploy da API**
   - Suba só a pasta `api/` (ou o repo inteiro com start apontando para `api/server.js`).
   - **Não** defina `SERVE_FRONTEND=1`.
   - Defina `DEEPSEEK_API_KEY` e, se quiser, `CORS_ORIGIN` (veja abaixo).
   - Anote a URL da API (ex.: `https://logix-api.onrender.com`).

2. **CORS na API**  
   O `server.js` já usa `cors({ origin: true })`. Se o front estiver em outro domínio, pode restringir:
   - No `api/server.js`, troque para algo como:
     ```js
     const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://seu-front.vercel.app';
     app.use(cors({ origin: CORS_ORIGIN }));
     ```
   - E na hospedagem da API, defina a variável `CORS_ORIGIN` com a URL do front.

3. **URL da API no frontend**  
   Como a API não está na mesma origem, o front precisa saber a URL:
   - Crie um arquivo `js/config.js` (ou inclua antes do `script.js`):
     ```html
     <script>window.LOGIX_API_URL = 'https://logix-api.onrender.com/api/chat';</script>
     ```
   - Ou defina `window.LOGIX_API_URL` no próprio `script.js` com a URL da sua API.

4. **Deploy do frontend**  
   Envie para a Vercel/Netlify a pasta do projeto (com `index.html`, `css/`, `js/`, `img/` e o `config.js` ou o `script.js` já com a URL). O site vai chamar a API na URL configurada; todas as análises continuam usando DeepSeek no servidor.

---

## Resumo

| Onde está        | O que fazer |
|------------------|-------------|
| **Chave DeepSeek** | No servidor (`.env` ou variáveis de ambiente). Nunca no HTML/JS público. |
| **Um único serviço** | Use `SERVE_FRONTEND=1` e o mesmo servidor serve site + API (Opção 1). |
| **Dois serviços** | API em um lugar com `DEEPSEEK_API_KEY`; front em outro com `window.LOGIX_API_URL` apontando para a API (Opção 2). |
| **Firebase**     | Mesmo projeto e `firebaseConfig`; adicione o domínio da hospedagem em Authorized domains. |

Com isso, o Logix sobe completo e usa a API do DeepSeek para todos os tipos de análise em produção.
