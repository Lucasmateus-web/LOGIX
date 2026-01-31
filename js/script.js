// --- API própria do Logix (mesma origem; não exposta nas configurações) ---
if (typeof window.LOGIX_API_URL === 'undefined') {
    window.LOGIX_API_URL = window.location.origin + '/api/chat';
}
const LOGIX_SYSTEM_PROMPT = `Você é o Logix, uma IA segura e confiável. Sua função é ajudar em qualquer dúvida ou necessidade, em qualquer área: estudos, trabalho, saúde, finanças, idiomas, rotina, curiosidades, redação, explicações, ideias, etc. Responda sempre em português do Brasil, de forma clara e objetiva. Seja seguro: não invente informações, não dê conselhos perigosos, e se não souber algo, diga.

ANEXOS: Quando o usuário enviar anexos (aparecerá como [Anexos: nome do arquivo (tipo)]), você DEVE considerar e ajudar com eles. Nunca diga que "não tem direito de visualizar" ou que "não pode ver anexos". Para imagens: se o usuário pedir para "ler" ou analisar a imagem e você não tiver o conteúdo visual na conversa, peça que ele descreva o que há na imagem ou o que precisa, e ajude a partir da descrição. Para outros arquivos, ofereça ajuda com base no nome e tipo (ex.: resumir texto, orientar sobre o formato).

BOAS-VINDAS: Se a mensagem do usuário for apenas um cumprimento (oi, olá, hey, tudo bem, e aí, etc.) sem pedido concreto de ajuda, responda com uma mensagem breve de boas-vindas e pergunte como pode ajudar.

Se o usuário enviar links e você tiver acesso ao conteúdo na conversa, use-o para ajudar. O Logix é um assistente geral e seguro para o dia a dia.`;

// --- Seleção de Elementos ---
const $ = (id) => document.getElementById(id);
const btnMenu = $('btn-menu');
const btnClose = $('btn-close');
const sidebar = $('sidebar');
const overlay = $('overlay');

// --- Anexos ---
let selectedFiles = [];
const previewContainer = $('attachments-preview');
const uploadInput = $('upload-file');

// --- Controle de envio (só aceita "pare" enquanto a IA responde) ---
let waitingForResponse = false;
let currentAbortController = null;

function isPedidoParaParar(texto) {
    return /^(pare|para|stop|cancela|cancelar)$/i.test((texto || '').trim());
}

function renderAttachmentsPreview() {
    if (!previewContainer) return;
    previewContainer.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const chip = document.createElement('div');
        chip.className = 'attachment-chip';
        chip.innerHTML = `<i class="bi bi-file-earmark"></i><span title="${file.name}">${file.name.length > 20 ? file.name.slice(0, 17) + '...' : file.name}</span><button type="button" class="remove-attachment" data-index="${index}" aria-label="Remover">×</button>`;
        chip.querySelector('.remove-attachment').onclick = (e) => {
            e.preventDefault();
            selectedFiles.splice(parseInt(e.target.dataset.index), 1);
            renderAttachmentsPreview();
            if (uploadInput) uploadInput.value = '';
        };
        previewContainer.appendChild(chip);
    });
}

if (uploadInput) {
    uploadInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        for (let i = 0; i < files.length; i++) selectedFiles.push(files[i]);
        renderAttachmentsPreview();
        e.target.value = '';
    });
}

// --- Lógica do Menu Lateral ---
btnMenu.onclick = function() {
    sidebar.classList.add('active');
    overlay.classList.add('active');
}

function fecharMenu() {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
}

btnClose.onclick = fecharMenu;
overlay.onclick = fecharMenu;

// --- Lógica dos Modais de Autenticação ---
const modalLogin = $('modal-overlay');
const modalCadastro = $('modal-over');

$('btn-entrar')?.addEventListener('click', () => modalLogin.classList.add('open'));
$('btn-cadastrar')?.addEventListener('click', () => modalCadastro.classList.add('open'));

const fecharModal = () => modalLogin.classList.remove('open');
const fecharModel = () => modalCadastro.classList.remove('open');

[modalLogin, modalCadastro].forEach(m => {
    m?.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('open');
    });
});

// --- Sistema de Histórico ---
let conversaAtual = [];
let historicoConversas = JSON.parse(localStorage.getItem('logix_historico')) || [];

async function salvarConversa() {
    if (conversaAtual.length > 0) {
        const expiraEm = getExpiraEm();
        const novaConversa = {
            id: Date.now(),
            titulo: (conversaAtual[0] || '').substring(0, 50) || 'Nova Conversa',
            mensagens: [...conversaAtual],
            data: new Date().toLocaleString('pt-BR'),
            expiraEm: expiraEm || undefined
        };
        historicoConversas.unshift(novaConversa);
        if (historicoConversas.length > 50) historicoConversas = historicoConversas.slice(0, 50);
        filtrarConversasExpiradas();
        localStorage.setItem('logix_historico', JSON.stringify(historicoConversas));
        await salvarHistoricoNoBanco(novaConversa);
    }
}

function filtrarConversasExpiradas() {
    const agora = new Date().toISOString();
    historicoConversas = historicoConversas.filter(c => !c.expiraEm || c.expiraEm > agora);
}

async function excluirConversa(conversaId, e) {
    if (e) e.stopPropagation();
    if (!confirm('Excluir esta conversa do histórico?')) return;
    historicoConversas = historicoConversas.filter(c => String(c.id) !== String(conversaId));
    localStorage.setItem('logix_historico', JSON.stringify(historicoConversas));
    await excluirHistoricoNoBanco(conversaId);
    abrirHistorico();
}

function carregarConversa(conversaId) {
    const conversa = historicoConversas.find(c => String(c.id) === String(conversaId));
    if (!conversa) return;
    
    const chatContainer = $('chat-messages');
    chatContainer.innerHTML = '';
    conversaAtual = [...conversa.mensagens];
    
    conversa.mensagens.forEach((msg, index) => {
        if (index % 2 === 0) {
            const userDiv = document.createElement('div');
            userDiv.className = 'message-user';
            userDiv.textContent = msg;
            chatContainer.appendChild(userDiv);
        } else {
            const logixDiv = document.createElement('div');
            logixDiv.className = 'message-logix';
            logixDiv.innerHTML = `
                <img src="img/ico-principal.png" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--cor-primaria, #00fbff); background: transparent; flex-shrink: 0;">
                <div class="logix-bubble">${formatarResposta(msg)}</div>
            `;
            chatContainer.appendChild(logixDiv);
        }
    });
    
    fecharMenu();
    fecharHistorico();
}

function novoChat() {
    if (conversaAtual.length > 0) {
        salvarConversa();
    }
    conversaAtual = [];
    $('chat-messages').innerHTML = '';
    fecharMenu();
}

async function abrirHistorico() {
    const modal = $('modal-historico');
    const lista = $('historico-lista');

    const historicoBanco = await carregarHistoricoDoBanco();
    if (historicoBanco.length > 0) {
        historicoConversas = historicoBanco.map(conv => ({
            id: conv.id || Date.now(),
            titulo: conv.titulo,
            mensagens: conv.mensagens || [],
            data: conv.data || new Date(conv.timestamp).toLocaleString('pt-BR'),
            expiraEm: conv.expiraEm || null
        }));
        localStorage.setItem('logix_historico', JSON.stringify(historicoConversas));
    }

    filtrarConversasExpiradas();
    const exibidas = historicoConversas;

    if (exibidas.length === 0) {
        lista.innerHTML = '<p style="color: var(--texto-muted, #888); text-align: center; padding: 20px;">Nenhuma conversa salva ainda.</p>';
    } else {
        lista.innerHTML = exibidas.map(conv => `
            <div class="historico-item-wrap">
                <div class="historico-item" onclick="carregarConversa('${conv.id}')">
                    <div class="historico-titulo">${conv.titulo}</div>
                    <div class="historico-data">${conv.data}</div>
                </div>
                <button type="button" class="btn-excluir-chat" onclick="excluirConversa('${conv.id}', event)" title="Excluir conversa"><i class="bi bi-trash"></i></button>
            </div>
        `).join('');
    }

    modal.classList.add('open');
    fecharMenu();
}

function fecharHistorico() {
    $('modal-historico').classList.remove('open');
}

function abrirAjuda() {
    $('modal-ajuda').classList.add('open');
    fecharMenu();
}

function fecharAjuda() {
    $('modal-ajuda').classList.remove('open');
}

function abrirConfiguracoes() {
    const modal = $('modal-configuracoes');
    const toggleTema = $('toggle-tema');
    const temaAtual = localStorage.getItem('logix_tema') || 'escuro';
    if (toggleTema) toggleTema.checked = temaAtual === 'claro';
    modal.classList.add('open');
    fecharMenu();
}

function fecharConfiguracoes() {
    $('modal-configuracoes').classList.remove('open');
}

// --- Sistema de Temas ---
function aplicarTema(tema) {
    document.documentElement.setAttribute('data-tema', tema);
    localStorage.setItem('logix_tema', tema);
    atualizarCoresTema(tema);
}

function atualizarCoresTema(tema) {
    const root = document.documentElement;
    const cores = {
        cyan: { primaria: '#3ac5c7', secundaria: '#a155ff' },
        purple: { primaria: '#0F0F0F', secundaria: '#2563EB' },
        green: { primaria: '#7C3AED', secundaria: '#2563EB' },
        orange: { primaria: '#8DCC16', secundaria: '#0EA5E9' },
        blue: { primaria: '#22D3EE', secundaria: '#22C55E' },
        pink: { primaria: '#EC4899', secundaria: '#8B5CF6' },
        indigo: { primaria: '#8B5CF6', secundaria: '#4f46e5' },
        yellow: { primaria: '#f5c542', secundaria: '#0a0a0a' },
        tark: { primaria: '#00F5A0', secundaria: '#00D9F5' }
    };
    
    const cor = cores[tema] || cores.cyan;
    root.style.setProperty('--cor-primaria', cor.primaria);
    root.style.setProperty('--cor-secundaria', cor.secundaria);
}

// Inicializar tema e API URL
document.addEventListener('DOMContentLoaded', () => {
    const temaSalvo = localStorage.getItem('logix_tema_cor') || 'cyan';
    aplicarTema(temaSalvo);
    atualizarCoresTema(temaSalvo);

    const modoTema = localStorage.getItem('logix_tema') || 'escuro';
    if (modoTema === 'claro') {
        document.body.classList.add('tema-claro');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    getChatTemporarioDias();

    const toggleTema = $('toggle-tema');
    if (toggleTema) {
        toggleTema.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('tema-claro');
                localStorage.setItem('logix_tema', 'claro');
            } else {
                document.body.classList.remove('tema-claro');
                localStorage.setItem('logix_tema', 'escuro');
            }
        });
    }

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tema = e.target.dataset.theme;
            aplicarTema(tema);
            localStorage.setItem('logix_tema_cor', tema);
        });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const screen = $('welcome-screen');
    if (screen) {
        setTimeout(() => {
            screen.classList.add('welcome-fade-out');
            setTimeout(() => screen.remove(), 1000);
        }, 6000);
    }

    const savedUser = JSON.parse(localStorage.getItem('logix_user'));
    if (savedUser && window.auth?.currentUser) {
        // Não mostrar boas-vindas ao recarregar a página
        atualizarInterfaceUsuario(window.auth.currentUser, false);
        const profileName = $('profile-name');
        const profileUser = $('profile-user');
        if (profileName) profileName.value = savedUser.displayName || '';
        if (profileUser) profileUser.value = savedUser.username || '';
    }
    
    [$('modal-historico'), $('modal-ajuda'), $('modal-configuracoes')].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('open');
                }
            });
        }
    });
});


function formatarResposta(texto) {
    return texto
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.*)$/gim, '<li>$1</li>')
        .replace(/\n/g, '<br>');
}

function efeitoDigitacao(elemento, texto, velocidade = 15) {
    let i = 0;
    elemento.innerHTML = "";
    const chatContainer = $('chat-messages');

    function digitar() {
        if (i < texto.length) {
            if (texto.charAt(i) === '<') {
                let tagFim = texto.indexOf('>', i);
                elemento.innerHTML += texto.substring(i, tagFim + 1);
                i = tagFim + 1;
            } else {
                elemento.innerHTML += texto.charAt(i);
                i++;
            }
            chatContainer.scrollTop = chatContainer.scrollHeight;
            setTimeout(digitar, velocidade);
        }
    }
    digitar();
}

function getChatTemporarioDias() {
    const el = $('chat-temporario-dias');
    const saved = localStorage.getItem('logix_chat_temporario_dias');
    if (el) {
        if (saved != null) el.value = saved;
        el.addEventListener('change', () => localStorage.setItem('logix_chat_temporario_dias', el.value));
        return parseInt(el.value, 10) || 0;
    }
    return saved != null ? parseInt(saved, 10) : 0;
}

function getExpiraEm() {
    const dias = getChatTemporarioDias();
    if (dias <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString();
}

function extrairUrls(texto) {
    const regex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    return (texto.match(regex) || []).filter((url, i, arr) => arr.indexOf(url) === i);
}

async function buscarConteudoLinks(urls) {
    if (!urls.length) return '';
    const base = window.LOGIX_API_URL ? window.LOGIX_API_URL.replace(/\/api\/chat\/?$/, '') : '';
    if (!base) return '';
    const partes = [];
    for (const url of urls.slice(0, 3)) {
        try {
            const res = await fetch(base + '/api/fetch-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.text) partes.push(`Conteúdo do link ${url}:\n${data.text.slice(0, 4000)}`);
            }
        } catch (e) {
            console.warn('Erro ao buscar link:', url, e);
        }
    }
    return partes.length ? partes.join('\n\n') : '';
}

async function getLogixResponse(promptUsuario, anexosTexto, signal) {
    let promptCompleto = anexosTexto ? `[Anexos: ${anexosTexto}]\n\n${promptUsuario}` : promptUsuario;
    const urls = extrairUrls(promptUsuario);
    if (urls.length && window.LOGIX_API_URL) {
        const conteudoLinks = await buscarConteudoLinks(urls);
        if (conteudoLinks) promptCompleto = `${conteudoLinks}\n\n---\nPergunta do usuário: ${promptUsuario}`;
    }
    const apiUrl = window.LOGIX_API_URL;
    const apiKey = window.LOGIX_API_KEY;

    if (apiUrl) {
        try {
            const headers = { "Content-Type": "application/json" };
            if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
            const res = await fetch(apiUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    message: promptCompleto,
                    system: LOGIX_SYSTEM_PROMPT,
                    history: conversaAtual.filter((_, i) => i % 2 === 0).map((msg, i) => ({
                        user: msg,
                        assistant: conversaAtual[i * 2 + 1] || ''
                    })).slice(-10)
                }),
                signal
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            return data.response || data.text || data.message || data.content || '';
        } catch (e) {
            if (e.name === 'AbortError') throw e;
            console.warn("API Logix falhou, tentando Ollama:", e);
        }
    }

    const systemPrompt = LOGIX_SYSTEM_PROMPT + '\n\nPergunta do usuário:';
    const fullPrompt = `${systemPrompt}\n${promptCompleto}`;
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "deepseek-coder:1.3b",
            prompt: fullPrompt,
            stream: false
        }),
        signal
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    return data.response || '';
}

function limparEstadoEnvio(chatContainer, btnEnviarEl) {
    const loadingInline = chatContainer?.querySelector('#logix-typing-inline');
    if (loadingInline) loadingInline.remove();
    if (btnEnviarEl) {
        btnEnviarEl.classList.remove('sending');
        const icon = $('send-icon');
        if (icon) {
            icon.classList.remove('bi-hourglass-split');
            icon.classList.add('bi-send-fill');
        }
    }
    waitingForResponse = false;
    currentAbortController = null;
}

async function lerAnexosParaExibicao(files) {
    const displays = [];
    for (const f of files) {
        if (f.type.startsWith('image/')) {
            try {
                const dataUrl = await new Promise((res, rej) => {
                    const r = new FileReader();
                    r.onload = () => res(r.result);
                    r.onerror = rej;
                    r.readAsDataURL(f);
                });
                displays.push({ type: 'image', name: f.name, dataUrl });
            } catch (_) {
                displays.push({ type: 'file', name: f.name });
            }
        } else {
            displays.push({ type: 'file', name: f.name });
        }
    }
    return displays;
}

function montarMensagemUsuarioComAnexos(texto, attachmentDisplays) {
    const wrap = document.createElement('div');
    wrap.className = 'message-user';
    const partes = [];
    if (attachmentDisplays && attachmentDisplays.length > 0) {
        const anexosDiv = document.createElement('div');
        anexosDiv.className = 'message-user-attachments';
        attachmentDisplays.forEach(att => {
            if (att.type === 'image' && att.dataUrl) {
                const img = document.createElement('img');
                img.src = att.dataUrl;
                img.alt = att.name;
                img.className = 'message-user-attachment-img';
                anexosDiv.appendChild(img);
            } else {
                const chip = document.createElement('span');
                chip.className = 'message-user-attachment-file';
                chip.innerHTML = `<i class="bi bi-file-earmark"></i> ${att.name}`;
                anexosDiv.appendChild(chip);
            }
        });
        partes.push(anexosDiv);
    }
    if (texto) {
        const p = document.createElement('div');
        p.className = 'message-user-text';
        p.textContent = texto;
        partes.push(p);
    }
    partes.forEach(el => wrap.appendChild(el));
    return wrap;
}

async function btnEnviar() {
    const inputField = $('text-input') || document.querySelector('.text-input');
    const chatContainer = $('chat-messages');
    const loadingElement = $('logix-typing');
    const btnEnviarEl = $('btn-enviar') || document.querySelector('.send-btn');

    const promptUsuario = inputField?.value?.trim() || '';
    if (!chatContainer) return;
    if (!promptUsuario && selectedFiles.length === 0) return;

    if (waitingForResponse) {
        if (isPedidoParaParar(promptUsuario)) {
            if (currentAbortController) currentAbortController.abort();
            inputField.value = '';
            return;
        }
        inputField.value = '';
        if (typeof alert !== 'undefined') alert('Aguarde a resposta terminar ou digite "pare" para cancelar.');
        return;
    }

    const anexosTexto = selectedFiles.length > 0
        ? selectedFiles.map(f => `${f.name} (${f.type})`).join(', ')
        : '';

    const attachmentDisplays = await lerAnexosParaExibicao([...selectedFiles]);

    inputField.value = '';
    selectedFiles = [];
    renderAttachmentsPreview();
    if (uploadInput) uploadInput.value = '';

    const sendIconEl = $('send-icon');
    if (btnEnviarEl) {
        btnEnviarEl.classList.add('sending');
        if (sendIconEl) {
            sendIconEl.classList.remove('bi-send-fill');
            sendIconEl.classList.add('bi-hourglass-split');
        }
    }

    const welcomeMsg = chatContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.classList.add('fade-out');
        setTimeout(() => welcomeMsg.remove(), 500);
    }

    const userDiv = montarMensagemUsuarioComAnexos(promptUsuario || '', attachmentDisplays);
    chatContainer.appendChild(userDiv);

    const textoParaHistorico = promptUsuario || (anexosTexto ? `[Anexos: ${anexosTexto}]` : '');
    conversaAtual.push(textoParaHistorico);

    chatContainer.scrollTop = chatContainer.scrollHeight;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'typing-container';
    loadingDiv.id = 'logix-typing-inline';
    loadingDiv.innerHTML = `
        <div class="logix-load-box" style="display: flex; align-items: center; gap: 15px; padding: 10px 0;">
            <div class="swim-container">
                <div class="gradient-ring"></div>
                <img src="img/ico-principal.png" class="swimming-shark">
            </div>
            <span class="thinking-text-shimmer">Logix está pensando...</span>
        </div>
    `;
    loadingDiv.style.display = 'flex';
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    waitingForResponse = true;
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    try {
        const textoParaIA = promptUsuario || (anexosTexto ? 'Por favor, considere os anexos que enviei acima.' : '');
        const resposta = await getLogixResponse(textoParaIA, anexosTexto || undefined, signal);

        limparEstadoEnvio(chatContainer, btnEnviarEl);
        if (loadingElement) loadingElement.style.display = 'none';

        const logixDiv = document.createElement('div');
        logixDiv.className = 'message-logix';
        logixDiv.innerHTML = `
            <img src="img/ico-principal.png" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--cor-primaria, #00fbff); background: transparent; flex-shrink: 0;">
            <div class="logix-bubble"></div>
        `;
        chatContainer.appendChild(logixDiv);
        const bolhaTexto = logixDiv.querySelector('.logix-bubble');
        efeitoDigitacao(bolhaTexto, formatarResposta(resposta));

        conversaAtual.push(resposta);
    } catch (error) {
        limparEstadoEnvio(chatContainer, btnEnviarEl);
        if (loadingElement) loadingElement.style.display = 'none';
        if (error.name === 'AbortError') {
            const logixDiv = document.createElement('div');
            logixDiv.className = 'message-logix';
            logixDiv.innerHTML = `
                <img src="img/ico-principal.png" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--cor-primaria, #00fbff); flex-shrink: 0;">
                <div class="logix-bubble">Resposta cancelada. Como posso ajudar?</div>
            `;
            chatContainer.appendChild(logixDiv);
            conversaAtual.push('Resposta cancelada.');
        } else {
            console.error("Erro Logix:", error);
            const logixDiv = document.createElement('div');
            logixDiv.className = 'message-logix';
            logixDiv.innerHTML = `
                <img src="img/ico-principal.png" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--cor-primaria, #00fbff); flex-shrink: 0;">
                <div class="logix-bubble">Desculpe, não consegui responder agora. Verifique se o Ollama está rodando (modelo deepseek-coder) ou se a API do Logix está disponível.</div>
            `;
            chatContainer.appendChild(logixDiv);
            conversaAtual.push('');
        }
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function atualizarInterfaceUsuario(user, mostrarBoasVindas = false) {
    if (!user) return;
    
    const userData = {
        displayName: user.displayName || user.email?.split('@')[0] || 'Usuário',
        photoURL: user.photoURL || 'img/ico-principal.png',
        email: user.email,
        uid: user.uid,
        username: JSON.parse(localStorage.getItem('logix_user'))?.username || user.displayName?.toLowerCase().replace(/\s/g, '') || user.email?.split('@')[0] || 'usuario'
    };
    
    // Persistência no localStorage
    localStorage.setItem('logix_user', JSON.stringify(userData));

    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
        // Renderização sem fundo, apenas texto e foto
        headerActions.innerHTML = `
            <div class="user-profile-header" onclick="toggleProfile()" style="display: flex; align-items: center; gap: 12px; cursor: pointer; background: none; border: none; padding: 0;">
                <p style="color: white; font-size: 0.9rem; margin:0;">Olá, <span style="color: var(--cor-primaria, #00fbff); font-weight: bold;">${userData.displayName.split(' ')[0]}</span></p>
                <img src="${userData.photoURL || 'img/ico-principal.png'}" style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid var(--cor-primaria, #00fbff); object-fit: cover;">
            </div>
        `;
        
        const modalImg = $('profile-image');
        const profileName = $('profile-name');
        const profileUser = $('profile-user');
        
        if (modalImg) modalImg.src = userData.photoURL || 'img/ico-principal.png';
        if (profileName) profileName.value = userData.displayName || '';
        if (profileUser) profileUser.value = userData.username || '';
        
        fecharModal();
        fecharModel();
        
        // Mostrar mensagem de boas-vindas apenas se for um novo login
        if (mostrarBoasVindas) {
            mostrarMensagemBoasVindas(userData.displayName.split(' ')[0]);
        }
        
        // Criar evento de login bem-sucedido
        const evento = new CustomEvent('logixLoginSucesso', { detail: userData });
        document.dispatchEvent(evento);
    }
}

function mostrarMensagemBoasVindas(nome) {
    const chatContainer = $('chat-messages');
    if (!chatContainer) return;
    
    // Limpar mensagens anteriores se necessário
    const mensagemBoasVindas = document.createElement('div');
    mensagemBoasVindas.className = 'welcome-message';
    mensagemBoasVindas.innerHTML = `
        <div class="welcome-icon">
            <img src="img/ico-principal.png" alt="Logix" class="shark-welcome">
        </div>
        <div class="welcome-text-content">
            <p class="welcome-greeting">Olá, ${nome}</p>
            <p class="welcome-question">Por onde começamos?</p>
        </div>
    `;
    
    chatContainer.appendChild(mensagemBoasVindas);
    
    // Scroll suave
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}

// Escuta mudanças de autenticação do Firebase
let usuarioJaLogado = false;
if (window.auth) {
    window.auth.onAuthStateChanged((user) => {
        if (user) {
            const foiLoginNovo = !usuarioJaLogado;
            usuarioJaLogado = true;
            atualizarInterfaceUsuario(user, foiLoginNovo);
        } else {
            usuarioJaLogado = false;
        }
    });
}

function toggleProfile() {
    const modal = $('profile-modal');
    if (modal) {
        modal.classList.toggle('active');
    }
}

function salvarPerfil() {
    const profileName = $('profile-name');
    const profileUser = $('profile-user');
    const profileImage = $('profile-image');
    const fileInput = $('file-input-profile');
    
    const userData = JSON.parse(localStorage.getItem('logix_user')) || {};
    
    if (profileName && profileName.value) {
        userData.displayName = profileName.value;
    }
    
    if (profileUser && profileUser.value) {
        userData.username = profileUser.value;
    }
    
    if (fileInput && fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            userData.photoURL = e.target.result;
            if (profileImage) profileImage.src = e.target.result;
            localStorage.setItem('logix_user', JSON.stringify(userData));
            atualizarInterfaceUsuario(userData);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        localStorage.setItem('logix_user', JSON.stringify(userData));
        atualizarInterfaceUsuario(userData);
    }
    
    toggleProfile();
}

// Event listener para upload de foto
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = $('file-input-profile');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const profileImage = $('profile-image');
                    if (profileImage) profileImage.src = event.target.result;
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
});

async function logarGoogle() {
    const provider = new window.GoogleAuthProvider();
    try {
        const result = await window.signInWithPopup(window.auth, provider);
        await salvarUsuarioNoBanco(result.user);
        atualizarInterfaceUsuario(result.user, true);
        
        // Criar evento customizado de login
        const evento = new CustomEvent('logixLoginSucesso', { 
            detail: {
                user: result.user,
                timestamp: new Date().toISOString()
            }
        });
        document.dispatchEvent(evento);
    } catch (error) {
        console.error("Erro Google Auth:", error);
        alert("Erro ao fazer login com Google: " + error.message);
    }
}

async function sairConta() {
    if (window.auth && window.signOut) {
        try {
            await window.signOut(window.auth);
        } catch (error) {
            console.error("Erro ao sair:", error);
        }
    }
    
    localStorage.removeItem('logix_user');
    conversaAtual = [];
    
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
        headerActions.innerHTML = `
            <button class="enter" id="btn-entrar">Entrar</button>
            <button class="new-account" id="btn-cadastrar">Cadastre-se</button>
        `;
        
        // Re-adicionar event listeners
        setTimeout(() => {
            $('btn-entrar')?.addEventListener('click', () => $('modal-overlay').classList.add('open'));
            $('btn-cadastrar')?.addEventListener('click', () => $('modal-over').classList.add('open'));
        }, 100);
    }
    
    toggleProfile();
    
    // Limpar chat
    $('chat-messages').innerHTML = '';
}

// Tecla Enter para enviar (sem Shift = enviar)
document.addEventListener('keydown', (e) => {
    const input = $('text-input') || document.querySelector('.text-input');
    if (e.key === 'Enter' && !e.shiftKey && input && document.activeElement === input) {
        e.preventDefault();
        btnEnviar();
    }
});


async function CadastrarGoogle() {
    const provider = new window.GoogleAuthProvider();
    try {
        const result = await window.signInWithPopup(window.auth, provider);
        await salvarUsuarioNoBanco(result.user);
        atualizarInterfaceUsuario(result.user, true);
        
        // Criar evento customizado de cadastro
        const evento = new CustomEvent('logixLoginSucesso', { 
            detail: {
                user: result.user,
                timestamp: new Date().toISOString(),
                tipo: 'cadastro'
            }
        });
        document.dispatchEvent(evento);
    } catch (error) {
        console.error("Erro Google Auth:", error);
        alert("Erro ao fazer login com Google: " + error.message);
    }
}

async function criarContaEmail() {
    const email = $('cadastro-email')?.value;
    const senha = $('cadastro-senha')?.value;
    
    if (!email || !senha) {
        alert("Por favor, preencha todos os campos.");
        return;
    }
    
    if (senha.length < 6) {
        alert("A senha deve ter pelo menos 6 caracteres.");
        return;
    }
    
    try {
        const result = await window.createUserWithEmailAndPassword(window.auth, email, senha);
        const userData = {
            uid: result.user.uid,
            email: email,
            displayName: email.split('@')[0],
            photoURL: 'img/ico-principal.png',
            createdAt: new Date().toISOString()
        };
        
        await salvarUsuarioNoBanco(result.user, userData);
        atualizarInterfaceUsuario(result.user, true);
        
        alert("Conta criada com sucesso!");
    } catch (error) {
        console.error("Erro ao criar conta:", error);
        alert("Erro ao criar conta: " + error.message);
    }
}

async function logarEmail() {
    const email = $('login-email')?.value;
    const senha = $('login-senha')?.value;
    
    if (!email || !senha) {
        alert("Por favor, preencha todos os campos.");
        return;
    }
    
    try {
        const result = await window.signInWithEmailAndPassword(window.auth, email, senha);
        atualizarInterfaceUsuario(result.user, true);
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        alert("Erro ao fazer login: " + error.message);
    }
}

async function salvarUsuarioNoBanco(user, dadosAdicionais = {}) {
    if (!window.db) return;
    
    try {
        const userRef = window.doc(window.db, 'usuarios', user.uid);
        const userDoc = await window.getDoc(userRef);
        
        if (!userDoc.exists()) {
            await window.setDoc(userRef, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email?.split('@')[0] || 'Usuário',
                photoURL: user.photoURL || 'img/ico-principal.png',
                createdAt: new Date().toISOString(),
                ...dadosAdicionais
            });
        }
    } catch (error) {
        console.error("Erro ao salvar usuário no banco:", error);
    }
}

async function salvarHistoricoNoBanco(conversa) {
    if (!window.db || !window.auth?.currentUser) return;
    try {
        const docRef = window.doc(window.db, 'historico', String(conversa.id));
        await window.setDoc(docRef, {
            userId: window.auth.currentUser.uid,
            titulo: conversa.titulo,
            mensagens: conversa.mensagens,
            data: conversa.data,
            expiraEm: conversa.expiraEm || null,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Erro ao salvar histórico no banco:", error);
    }
}

async function excluirHistoricoNoBanco(conversaId) {
    if (!window.db || !window.auth?.currentUser) return;
    if (!window.deleteDoc) return;
    try {
        const docRef = window.doc(window.db, 'historico', String(conversaId));
        await window.deleteDoc(docRef);
    } catch (e) {
        console.warn("Exclusão no Firestore:", e);
    }
}

async function carregarHistoricoDoBanco() {
    if (!window.db || !window.auth?.currentUser) return [];
    
    try {
        const historicoRef = window.collection(window.db, 'historico');
        const q = window.query(historicoRef, window.where('userId', '==', window.auth.currentUser.uid));
        const querySnapshot = await window.getDocs(q);
        
        const historico = [];
        querySnapshot.forEach((doc) => {
            historico.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return historico.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
        console.error("Erro ao carregar histórico do banco:", error);
        return [];
    }
}

