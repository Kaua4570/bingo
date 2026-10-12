/* Controle de Entregas — ficha digital de pacotes.
   Sem framework: tudo roda direto no navegador e salva no localStorage. */
(function () {
  'use strict';

  var STORE_KEY = 'ce:v1:fichas';
  var CURRENT_KEY = 'ce:v1:atual';
  var CELLS = 120;
  var TEXT_FIELDS = ['motorista', 'rota', 'data', 'pcts', 'agencia', 'parada1', 'total1', 'parada2', 'total2', 'faltantes', 'obs'];

  /* ---------- armazenamento (uma ficha = um registro isolado) ---------- */
  var fichas = {};
  var atualId = null;
  var saveTimer = null;

  function hoje() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dia = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + dia;
  }

  function novaFicha() {
    var agora = Date.now();
    return {
      id: 'f' + agora.toString(36) + Math.random().toString(36).slice(2, 6),
      motorista: '', rota: '', data: hoje(), pcts: '', periodo: 'AM',
      marked: {}, history: [],
      agencia: '', parada1: '', total1: '', parada2: '', total2: '',
      faltantes: '', obs: '',
      createdAt: agora, updatedAt: agora
    };
  }

  function lerStorage() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    } catch (e) { return {}; }
  }

  function gravarAgora() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(fichas));
      localStorage.setItem(CURRENT_KEY, atualId);
    } catch (e) { /* armazenamento cheio ou bloqueado */ }
  }

  function gravar() {
    var f = fichaAtual();
    if (f) f.updatedAt = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(gravarAgora, 120);
  }

  function fichaAtual() { return fichas[atualId]; }

  function temDados(f) {
    if (Object.keys(f.marked).length > 0) return true;
    for (var i = 0; i < TEXT_FIELDS.length; i++) {
      var k = TEXT_FIELDS[i];
      if (k === 'data') continue;
      if (String(f[k] || '').trim() !== '') return true;
    }
    return false;
  }

  function iniciar() {
    fichas = lerStorage();
    var id = null;
    try { id = localStorage.getItem(CURRENT_KEY); } catch (e) {}
    if (!id || !fichas[id]) {
      var f = novaFicha();
      fichas[f.id] = f;
      id = f.id;
    }
    atualId = id;
    gravarAgora();
  }

  /* ---------- contas ---------- */
  function contar(f) {
    var marcados = Object.keys(f.marked).length;
    var total = parseInt(f.pcts, 10);
    if (!(total > 0)) total = 0;
    var pendentes = total > 0 ? Math.max(0, total - marcados) : null;
    var pct = total > 0 ? Math.min(100, Math.round(marcados / total * 100)) : null;
    return { total: total, marcados: marcados, pendentes: pendentes, pct: pct };
  }

  function dataBR(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || '');
  }

  /* ---------- elementos ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var gridEl = $('grid');
  var cellEls = [];

  function montarGrade() {
    /* 6 colunas x 20 linhas; a coluna 1 tem 1..20, a 2 tem 21..40, etc. */
    var frag = document.createDocumentFragment();
    for (var r = 0; r < 20; r++) {
      for (var c = 0; c < 6; c++) {
        var n = c * 20 + r + 1;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'num';
        b.textContent = String(n);
        b.setAttribute('data-n', String(n));
        b.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-label', 'Pacote ' + n);
        frag.appendChild(b);
        cellEls[n] = b;
      }
    }
    gridEl.appendChild(frag);
    gridEl.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.num') : null;
      if (!t) return;
      alternar(parseInt(t.getAttribute('data-n'), 10));
    });
  }

  function alternar(n) {
    var f = fichaAtual();
    var estava = !!f.marked[n];
    if (estava) delete f.marked[n]; else f.marked[n] = true;
    f.history.push({ n: n, was: estava });
    if (f.history.length > 500) f.history.shift();
    cellEls[n].setAttribute('aria-pressed', estava ? 'false' : 'true');
    atualizarContadores();
    gravar();
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
  }

  function desfazer() {
    var f = fichaAtual();
    var ult = f.history.pop();
    if (!ult) { aviso('Nada para desfazer'); return; }
    if (ult.was) f.marked[ult.n] = true; else delete f.marked[ult.n];
    cellEls[ult.n].setAttribute('aria-pressed', ult.was ? 'true' : 'false');
    atualizarContadores();
    gravar();
    aviso('Marcação do ' + ult.n + ' desfeita');
  }

  function atualizarContadores() {
    var c = contar(fichaAtual());
    $('c-total').textContent = c.total > 0 ? c.total : '—';
    $('c-marked').textContent = c.marcados;
    $('c-pending').textContent = c.pendentes === null ? '—' : c.pendentes;
    $('c-pct').textContent = c.pct === null ? '—' : c.pct + '%';
    $('bar-fill').style.width = (c.pct || 0) + '%';
    $('bar').setAttribute('aria-valuenow', String(c.pct || 0));
    $('hint-total').hidden = c.total > 0;
  }

  function desenharFicha() {
    var f = fichaAtual();
    for (var i = 0; i < TEXT_FIELDS.length; i++) {
      var k = TEXT_FIELDS[i];
      var el = document.querySelector('[data-field="' + k + '"]');
      if (el) el.value = f[k] || '';
    }
    for (var n = 1; n <= CELLS; n++) {
      cellEls[n].setAttribute('aria-pressed', f.marked[n] ? 'true' : 'false');
    }
    var ps = document.querySelectorAll('[data-period]');
    for (var j = 0; j < ps.length; j++) {
      ps[j].setAttribute('aria-pressed', ps[j].getAttribute('data-period') === f.periodo ? 'true' : 'false');
    }
    atualizarContadores();
  }

  /* ---------- janela de confirmação e aviso ---------- */
  var modalResolve = null;
  function confirmar(titulo, msg, ok) {
    return new Promise(function (resolve) {
      $('modal-title').textContent = titulo;
      $('modal-msg').textContent = msg;
      $('modal-ok').textContent = ok || 'Confirmar';
      $('modal').hidden = false;
      modalResolve = resolve;
      $('modal-ok').focus();
    });
  }
  function fecharModal(valor) {
    $('modal').hidden = true;
    if (modalResolve) { var r = modalResolve; modalResolve = null; r(valor); }
  }
  $('modal-ok').addEventListener('click', function () { fecharModal(true); });
  $('modal-cancel').addEventListener('click', function () { fecharModal(false); });
  document.querySelector('#modal [data-close]').addEventListener('click', function () { fecharModal(false); });

  var toastTimer = null;
  function aviso(txt) {
    var t = $('toast');
    t.textContent = txt;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* ---------- ações ---------- */
  function limparTudo() {
    var f = fichaAtual();
    if (Object.keys(f.marked).length === 0) { aviso('Não há marcações'); return; }
    confirmar('Limpar todas as marcações?', 'As ' + Object.keys(f.marked).length + ' marcações desta ficha serão apagadas. Os campos preenchidos ficam.', 'Limpar')
      .then(function (ok) {
        if (!ok) return;
        f.marked = {};
        f.history = [];
        desenharFicha();
        gravar();
        aviso('Marcações apagadas');
      });
  }

  function criarNova() {
    var f = fichaAtual();
    function criar() {
      if (!temDados(f)) delete fichas[f.id]; /* ficha vazia não vai pro histórico */
      var nf = novaFicha();
      fichas[nf.id] = nf;
      atualId = nf.id;
      gravarAgora();
      desenharFicha();
      window.scrollTo(0, 0);
      aviso('Nova ficha criada');
    }
    if (temDados(f)) {
      confirmar('Começar uma nova ficha?', 'A ficha atual continua salva no Histórico e você pode abrir de novo depois.', 'Nova ficha')
        .then(function (ok) { if (ok) criar(); });
    } else {
      criar();
    }
  }

  function usarNaoMarcados() {
    var c = contar(fichaAtual());
    if (c.pendentes === null) { aviso('Preencha o PCTS primeiro'); return; }
    var f = fichaAtual();
    f.faltantes = String(c.pendentes);
    $('f-faltantes').value = f.faltantes;
    gravar();
    aviso('Sugestão: ' + c.pendentes + '. Ajuste se precisar.');
  }

  function nomeArquivo(f) {
    var base = 'controle-entregas-' + (f.data || 'sem-data') + (f.rota ? '-rota-' + f.rota : '');
    return base.replace(/[^a-zA-Z0-9_\-]+/g, '-').replace(/-+/g, '-') + '.pdf';
  }

  function exportarPDF(f) {
    if (!window.CE_PDFLIB || !window.CE_PDF) { aviso('PDF indisponível: recarregue o app'); return; }
    try {
      var doc = window.CE_PDF.build(f, contar(f), dataBR(f.data));
      doc.save(nomeArquivo(f));
      aviso('PDF gerado');
    } catch (e) {
      aviso('Não foi possível gerar o PDF');
      if (window.console) console.error(e);
    }
  }

  /* ---------- histórico ---------- */
  function desenharHistorico() {
    var lista = $('hist-list');
    lista.innerHTML = '';
    var itens = Object.keys(fichas).map(function (k) { return fichas[k]; })
      .filter(temDados)
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    $('hist-empty').hidden = itens.length > 0;
    itens.forEach(function (f) {
      var c = contar(f);
      var li = document.createElement('li');
      li.className = 'hist-item';

      var head = document.createElement('div');
      head.className = 'hist-head';
      var nome = document.createElement('span');
      nome.className = 'hist-name';
      nome.textContent = (f.motorista || 'Sem motorista') + (f.rota ? ' · Rota ' + f.rota : '');
      var dt = document.createElement('span');
      dt.className = 'hist-date';
      dt.textContent = dataBR(f.data) + (f.periodo ? ' · ' + f.periodo : '');
      head.appendChild(nome);
      head.appendChild(dt);
      li.appendChild(head);

      if (f.id === atualId) {
        var tag = document.createElement('span');
        tag.className = 'hist-tag';
        tag.textContent = 'Em andamento';
        tag.style.alignSelf = 'flex-start';
        li.appendChild(tag);
      }

      var nums = document.createElement('div');
      nums.className = 'hist-nums';
      [['Total', c.total > 0 ? c.total : '—'], ['Marcados', c.marcados], ['Pendentes', c.pendentes === null ? '—' : c.pendentes]]
        .forEach(function (p) {
          var d = document.createElement('div');
          var b = document.createElement('b'); b.textContent = p[1];
          var s = document.createElement('span'); s.textContent = p[0];
          d.appendChild(b); d.appendChild(s);
          nums.appendChild(d);
        });
      li.appendChild(nums);

      var acoes = document.createElement('div');
      acoes.className = 'hist-actions';
      function botao(txt, cls, fn) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn ' + cls;
        b.textContent = txt;
        b.addEventListener('click', fn);
        acoes.appendChild(b);
      }
      botao('Abrir', 'btn-secondary', function () {
        atualId = f.id;
        gravarAgora();
        desenharFicha();
        irPara('ficha');
        aviso('Ficha aberta');
      });
      botao('PDF', 'btn-outline', function () { exportarPDF(f); });
      botao('Excluir', 'btn-danger', function () {
        confirmar('Excluir esta ficha?', 'Isso apaga a ficha de ' + (f.motorista || 'sem motorista') + ' de ' + dataBR(f.data) + ' e não dá para recuperar.', 'Excluir')
          .then(function (ok) {
            if (!ok) return;
            delete fichas[f.id];
            if (f.id === atualId) {
              var nf = novaFicha();
              fichas[nf.id] = nf;
              atualId = nf.id;
              desenharFicha();
            }
            gravarAgora();
            desenharHistorico();
            aviso('Ficha excluída');
          });
      });
      li.appendChild(acoes);
      lista.appendChild(li);
    });
  }

  /* ---------- abas ---------- */
  function irPara(aba) {
    $('view-ficha').hidden = aba !== 'ficha';
    $('view-hist').hidden = aba !== 'hist';
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('data-tab') === aba) tabs[i].setAttribute('aria-current', 'page');
      else tabs[i].removeAttribute('aria-current');
    }
    if (aba === 'hist') desenharHistorico();
    window.scrollTo(0, 0);
  }

  /* ---------- ligações ---------- */
  function ligar() {
    var campos = document.querySelectorAll('[data-field]');
    for (var i = 0; i < campos.length; i++) {
      campos[i].addEventListener('input', function (e) {
        var k = e.target.getAttribute('data-field');
        fichaAtual()[k] = e.target.value;
        if (k === 'pcts') atualizarContadores();
        gravar();
      });
    }
    var ps = document.querySelectorAll('[data-period]');
    for (var j = 0; j < ps.length; j++) {
      ps[j].addEventListener('click', function (e) {
        fichaAtual().periodo = e.currentTarget.getAttribute('data-period');
        desenharFicha();
        gravar();
      });
    }
    $('btn-undo').addEventListener('click', desfazer);
    $('btn-clear').addEventListener('click', limparTudo);
    $('btn-new').addEventListener('click', criarNova);
    $('btn-calc').addEventListener('click', usarNaoMarcados);
    $('btn-pdf').addEventListener('click', function () { exportarPDF(fichaAtual()); });
    $('btn-pdf-big').addEventListener('click', function () { exportarPDF(fichaAtual()); });
    var tabs = document.querySelectorAll('.tab');
    for (var t = 0; t < tabs.length; t++) {
      tabs[t].addEventListener('click', function (e) { irPara(e.currentTarget.getAttribute('data-tab')); });
    }
    /* grava na hora se o usuário sair/fechar a página */
    window.addEventListener('pagehide', gravarAgora);
    document.addEventListener('visibilitychange', function () { if (document.hidden) gravarAgora(); });
  }

  iniciar();
  montarGrade();
  ligar();
  desenharFicha();

  /* ---------- instalação offline ---------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  /* usado só nos testes automáticos */
  window.__CE = { contar: contar, fichas: function () { return fichas; }, atual: fichaAtual };
})();
