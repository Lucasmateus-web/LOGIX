const btnMenu = document.getElementById('btn-menu');
const btnClose = document.getElementById('btn-close');
const sidebar = document.getElementById('sidebar');


// Função para abrir o menu do Logix //

btnMenu.onclick = function() {
    sidebar.classList.add('active');
    overlay.classList.add('overlay');
}

function fecharMenu() {
    sidebar.classList.remove('active');
    overlay.classList.remove('overlay');
}

btnClose.onclick= fecharMenu;
overlay.click = fecharMenu;



// Função pora abrir o botão de Entrar //


const btnEntrar =  document.getElementById('btn-entrar');
const modal = document.getElementById('modal-overlay');
const btnFechar = document.getElementById('close-model');

// Quando clicar em "Entrar", adiciona um evento com a classe criada "open".. //

btnEntrar.addEventListener('click', () => {
    modal.classList.add('open');
});



// Quando clicar no icone "x" ou qualquer lugar fora do card a janela se fecha. //

const fecharModal = () => modal.classList.remove('open');


// Fechar ao clicar no fundo escuro //

modal.addEventListener('click', (e) => {
    if (e.target === modal) fecharModal();
});


const btnCadastrar = document.getElementById('btn-cadastrar');
const model = document.getElementById('modal-over');
const btnFecharX = document.getElementById('close-model');


btnCadastrar.addEventListener('click', () => {
    model.classList.add('open');
});


const fecharModel = () => model.classList.remove('open');


model.addEventListener('click', (e) => {
    if(e.target === model) fecharModel();
});


document.addEventListener('DOMContentLoaded', () => {
    const screen = document.getElementById('welcome-screen');

    // O tubarão termina de nadar em 5 segundos
    // Vamos dar mais 1 segundo para o LOGIX brilhar na tela
    setTimeout(() => {
        screen.classList.add('welcome-fade-out');
        
        // Remove do DOM após sumir
        setTimeout(() => {
            screen.remove();
        }, 1000);
        
    }, 6000);
});