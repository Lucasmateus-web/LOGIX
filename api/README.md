# API do Logix

API robusta para o Logix usar **DeepSeek** ou **Grok (xAI)** — pesquisa segura, sem Gemini/GPT.

## O que faz

- **Chat**: responde a qualquer dúvida, em qualquer área (estudos, trabalho, programação, etc.).
- **Leitura de links**: quando o usuário envia um link, a API pode buscar o conteúdo e o Logix usa na resposta.
- **Pesquisa segura**: use DeepSeek ou Grok; as chaves ficam só no servidor.

## Configuração

1. Copie o arquivo de exemplo:
   ```bash
   cp .env.example .env
   ```

2. Edite o `.env` e coloque sua chave:
   - **DeepSeek** (recomendado): [platform.deepseek.com](https://platform.deepseek.com) → `DEEPSEEK_API_KEY=sk-...`
   - **Grok (xAI/Twitter)**: [console.x.ai](https://console.x.ai) → `XAI_API_KEY=...` e `PROVIDER=xai`

3. Instale e rode:
   ```bash
   npm install
   npm start
   ```

4. No Logix (Configurações), informe a URL da API: `http://localhost:3001/api/chat`

## Endpoints

- `POST /api/chat` — envia mensagem e recebe resposta do modelo.
- `POST /api/fetch-url` — retorna o texto de uma URL (para o Logix “ler” links).
- `GET /api/health` — verifica se a API está no ar.

## Uso sem API

Se você não configurar a URL da API, o Logix usa o **Ollama** local (modelo `deepseek-coder:1.3b` ou o que estiver instalado).
