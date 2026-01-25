// --- Seleção de Elementos ---
const $ = (id) => document.getElementById(id);
const btnMenu = $('btn-menu');
const btnClose = $('btn-close');
const sidebar = $('sidebar');
const overlay = $('overlay');

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

// --- Inicialização e Persistência de Login ---
document.addEventListener('DOMContentLoaded', () => {
    const screen = $('welcome-screen');
    if (screen) {
        setTimeout(() => {
            screen.classList.add('welcome-fade-out');
            setTimeout(() => screen.remove(), 1000);
        }, 6000);
    }

    // Recupera dados do localStorage para manter logado ao atualizar
    const savedUser = JSON.parse(localStorage.getItem('logix_user'));
    if (savedUser) atualizarInterfaceUsuario(savedUser);
});

// --- Lógica do Chat e IA ---

function formatarResposta(texto) {
    return texto
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.*)$/gim, '<li>$1</li>')
        .replace(/\n/g, '<br>');
}

// Efeito de digitação suave
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

async function btnEnviar() {
    const inputField = document.querySelector('.text-input');
    const chatContainer = $('chat-messages');
    const loadingElement = $('logix-typing');

    const promptUsuario = inputField.value.trim();
    if (promptUsuario === "" || !chatContainer) return;

    inputField.value = '';
    
    // Mensagem do Usuário
    const userDiv = document.createElement('div');
    userDiv.className = 'message-user';
    userDiv.textContent = promptUsuario;
    chatContainer.appendChild(userDiv);

    // --- AJUSTE NA ANIMAÇÃO: TUBARÃO NADANDO + CÍRCULO GRADIENTE ---
    if (loadingElement) {
        loadingElement.innerHTML = `
            <div class="logix-load-box" style="display: flex; align-items: center; gap: 15px; padding: 10px 0;">
                <div class="swim-container">
                    <div class="gradient-ring"></div>
                    <img src="img/ico-principal.png" class="swimming-shark">
                </div>
                <span class="thinking-text-shimmer">Logix está pensando...</span>
            </div>
        `;
        loadingElement.style.display = 'flex';
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        const response = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "deepseek-coder:1.3b",
                prompt: promptUsuario,
                stream: false
            })
        });

        const data = await response.json();
        if (loadingElement) loadingElement.style.display = 'none';

        // Estrutura da resposta com ícone de tubarão
        const logixDiv = document.createElement('div');
        logixDiv.className = 'message-logix';
        logixDiv.innerHTML = `
            <img src="img/ico-principal.png" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #00fbff; background: transparent; flex-shrink: 0;">
            <div class="logix-bubble"></div>
        `;
        
        chatContainer.appendChild(logixDiv);
        const bolhaTexto = logixDiv.querySelector('.logix-bubble');
        efeitoDigitacao(bolhaTexto, formatarResposta(data.response));

    } catch (error) {
        if (loadingElement) loadingElement.style.display = 'none';
        console.error("Erro Ollama:", error);
    }
}

// --- LÓGICA DE USUÁRIO (Salvar Login e Header Limpo) ---
function atualizarInterfaceUsuario(user) {
    if (!user) return;
    
    // Persistência no localStorage
    localStorage.setItem('logix_user', JSON.stringify({
        displayName: user.displayName,
        photoURL: user.photoURL
    }));

    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
        // Renderização sem background, apenas texto e foto
        headerActions.innerHTML = `
            <div class="user-profile-header" onclick="toggleProfile()" style="display: flex; align-items: center; gap: 12px; cursor: pointer; background: none; border: none; padding: 0;">
                <p style="color: white; font-size: 0.9rem; margin:0;">Olá, <span style="color: #00fbff; font-weight: bold;">${user.displayName.split(' ')[0]}</span></p>
                <img src="${user.photoURL || 'img/ico-principal.png'}" style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid #00fbff; object-fit: cover; background: none;">
            </div>
        `;
        
        const modalImg = $('profile-image');
        if (modalImg) modalImg.src = user.photoURL || 'img/ico-principal.png';
        
        fecharModal();
        fecharModel();
    }
}

// Escuta mudanças de autenticação do Firebase
if (window.auth) {
    window.auth.onAuthStateChanged((user) => {
        if (user) atualizarInterfaceUsuario(user);
    });
}

function toggleProfile() {
    $('profile-modal')?.classList.toggle('active');
}

async function logarGoogle() {
    const provider = new window.GoogleAuthProvider();
    try {
        const result = await window.signInWithPopup(window.auth, provider);
        atualizarInterfaceUsuario(result.user);
    } catch (error) {
        console.error("Erro Google Auth:", error);
    }
}

// Tecla Enter para enviar
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && document.activeElement.classList.contains('text-input')) {
        btnEnviar();
    }
});