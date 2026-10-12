/* Controle de Entregas — ficha digital de paradas e pacotes.
   Os números de 1 a 120 são as PARADAS. Cada toque numa parada conta 1 pacote
   (parada com 7 pacotes = 7 toques). Sem framework: roda direto no navegador
   e salva no localStorage. */
(function () {
  'use strict';

  var STORE_KEY = 'ce:v1:fichas';
  var CURRENT_KEY = 'ce:v1:atual';
  var CELLS = 120;
  var MAXC = 99;          /* máximo de pacotes por parada */
  var HOLD_MS = 500;      /* tempo do toque longo (tira 1 pacote) */
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
      counts: {},      /* parada -> pacotes contados */
      expected: {},    /* parada -> pacotes esperados (conferência, opcional) */
      history: [],     /* para desfazer: { n, was } */
      agencia: '', parada1: '', total1: '', parada2: '', total2: '',
      faltantes: '', obs: '',
      createdAt: agora, updatedAt: agora
    };
  }

  /* fichas salvas na versão anterior marcavam cada número uma vez só */
  function migrar(f) {
    if (!f.counts) {
      f.counts = {};
      if (f.marked) {
        for (var k in f.marked) { if (f.marked[k]) f.counts[k] = 1; }
      }
    }
    delete f.marked;
    if (!f.expected) f.expected = {};
    f.history = (f.history || []).filter(function (h) { return typeof h.was === 'number'; });
    return f;
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
    if (Object.keys(f.counts).length > 0 || Object.keys(f.expected).length > 0) return true;
    for (var i = 0; i < TEXT_FIELDS.length; i++) {
      var k = TEXT_FIELDS[i];
      if (k === 'data') continue;
      if (String(f[k] || '').trim() !== '') return true;
    }
    return false;
  }

  function iniciar() {
    fichas = lerStorage();
    for (var k in fichas) { migrar(fichas[k]); }
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
    var contados = 0, paradas = 0, faltaTotal = 0, temEsperado = false;
    var faltas = [], sobras = [];
    for (var n = 1; n <= CELLS; n++) {
      var c = f.counts[n] || 0;
      var e = f.expected[n] || 0;
      contados += c;
      if (c > 0) paradas++;
      if (e > 0) temEsperado = true;
      if (e > c) { faltas.push({ n: n, falta: e - c, esperado: e, contado: c }); faltaTotal += e - c; }
      else if (c > e && e > 0) sobras.push({ n: n, sobra: c - e, esperado: e, contado: c });
    }
    var total = parseInt(f.pcts, 10);
    if (!(total > 0)) total = 0;
    var pendentes = total > 0 ? Math.max(0, total - contados) : null;
    var pct = total > 0 ? Math.min(100, Math.round(contados / total * 100)) : null;
    return {
      total: total, contados: contados, paradas: paradas,
      pendentes: pendentes, pct: pct,
      temEsperado: temEsperado, faltas: faltas, faltaTotal: faltaTotal, sobras: sobras
    };
  }

  function dataBR(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || '');
  }

  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

  /* ---------- elementos ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var gridEl = $('grid');
  var cellEls = [];
  var modoConf = false;
  var pressTimer = null;
  var pressFired = false;

  function numEl(e) { return e.target && e.target.closest ? e.target.closest('.num') : null; }

  function montarGrade() {
    /* 6 colunas x 20 linhas; a coluna 1 tem 1..20, a 2 tem 21..40, etc. */
    var frag = document.createDocumentFragment();
    for (var r = 0; r < 20; r++) {
      for (var c = 0; c < 6; c++) {
        var n = c * 20 + r + 1;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'num';
        b.setAttribute('data-n', String(n));
        b.setAttribute('aria-pressed', 'false');
        var num = document.createElement('span');
        num.className = 'n';
        num.textContent = String(n);
        var badge = document.createElement('span');
        badge.className = 'badge';
        badge.hidden = true;
        b.appendChild(num);
        b.appendChild(badge);
        b._badge = badge;
        frag.appendChild(b);
        cellEls[n] = b;
      }
    }
    gridEl.appendChild(frag);

    /* toque = +1 pacote; segurar = -1 pacote (na conferência, toque abre a parada) */
    gridEl.addEventListener('pointerdown', function (e) {
      var t = numEl(e);
      pressFired = false;
      clearTimeout(pressTimer);
      pressTimer = null;
      if (!t || modoConf) return;
      var n = parseInt(t.getAttribute('data-n'), 10);
      pressTimer = setTimeout(function () {
        pressTimer = null;
        pressFired = true;
        var atual = fichaAtual().counts[n] || 0;
        if (atual > 0 && setCount(n, atual - 1)) {
          vibrar(25);
          aviso('Parada ' + n + ': ' + plural(atual - 1, 'pacote', 'pacotes'));
        }
      }, HOLD_MS);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      gridEl.addEventListener(ev, function () { clearTimeout(pressTimer); pressTimer = null; });
    });
    gridEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    gridEl.addEventListener('click', function (e) {
      var t = numEl(e);
      if (!t) return;
      if (pressFired) { pressFired = false; return; }
      var n = parseInt(t.getAttribute('data-n'), 10);
      if (modoConf) abrirParada(n);
      else incrementar(n);
    });
  }

  function vibrar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* define a quantidade de pacotes de uma parada; registra para desfazer */
  function setCount(n, v, registrar) {
    var f = fichaAtual();
    var antes = f.counts[n] || 0;
    v = Math.max(0, Math.min(MAXC, v));
    if (v === antes) return false;
    if (v === 0) delete f.counts[n]; else f.counts[n] = v;
    if (registrar !== false) {
      f.history.push({ n: n, was: antes });
      if (f.history.length > 500) f.history.shift();
    }
    pintar(n);
    atualizarContadores();
    gravar();
    return true;
  }

  function incrementar(n) {
    var atual = fichaAtual().counts[n] || 0;
    if (!setCount(n, atual + 1)) { aviso('Máximo de ' + MAXC + ' pacotes por parada'); return; }
    vibrar(8);
  }

  function desfazer() {
    var f = fichaAtual();
    var ult = f.history.pop();
    if (!ult) { aviso('Nada para desfazer'); return; }
    setCount(ult.n, ult.was, false);
    aviso('Parada ' + ult.n + ': ' + plural(ult.was, 'pacote', 'pacotes'));
  }

  /* redesenha uma parada */
  function pintar(n) {
    var f = fichaAtual();
    var c = f.counts[n] || 0;
    var e = f.expected[n] || 0;
    var el = cellEls[n];
    el.setAttribute('aria-pressed', c > 0 ? 'true' : 'false');
    el.classList.toggle('falta', e > c);
    var t = e > 0 ? c + '/' + e : (c > 0 ? String(c) : '');
    el._badge.textContent = t;
    el._badge.hidden = t === '';
    el.setAttribute('aria-label', 'Parada ' + n + ': ' + plural(c, 'pacote', 'pacotes') + (e > 0 ? ' de ' + e + ' esperados' : ''));
  }

  function pintarTudo() { for (var n = 1; n <= CELLS; n++) pintar(n); }

  function atualizarContadores() {
    var c = contar(fichaAtual());
    $('c-total').textContent = c.total > 0 ? c.total : '—';
    $('c-marked').textContent = c.contados;
    $('c-pending').textContent = c.pendentes === null ? '—' : c.pendentes;
    $('c-pct').textContent = c.pct === null ? '—' : c.pct + '%';
    $('bar-fill').style.width = (c.pct || 0) + '%';
    $('bar').setAttribute('aria-valuenow', String(c.pct || 0));
    $('hint-total').hidden = c.total > 0;
    $('line-paradas').textContent = plural(c.paradas, 'parada com pacote', 'paradas com pacote') + ' · ' + plural(c.contados, 'pacote contado', 'pacotes contados');
    desenharFaltas(c);
  }

  /* ---------- conferência (bingo): qual parada está faltando pacote ---------- */
  function desenharFaltas(c) {
    var lista = $('falta-list');
    lista.innerHTML = '';
    $('conf-empty').hidden = c.temEsperado;
    $('conf-summary').hidden = !c.temEsperado;
    $('btn-faltas-usar').hidden = !c.temEsperado;
    lista.hidden = !c.temEsperado;
    if (!c.temEsperado) return;
    $('conf-summary').textContent = c.faltaTotal === 0
      ? 'Nenhuma parada com pacote faltando.'
      : 'Faltam ' + plural(c.faltaTotal, 'pacote', 'pacotes') + ' em ' + plural(c.faltas.length, 'parada', 'paradas') + ':';
    function item(txt, cls) {
      var li = document.createElement('li');
      li.textContent = txt;
      if (cls) li.className = cls;
      lista.appendChild(li);
    }
    c.faltas.forEach(function (x) {
      if (x.contado === 0) item('Parada ' + x.n + ' — não veio (esperado ' + x.esperado + ')', 'f-none');
      else item('Parada ' + x.n + ' — faltam ' + x.falta + ' (contados ' + x.contado + ' de ' + x.esperado + ')');
    });
    c.sobras.forEach(function (x) {
      item('Parada ' + x.n + ' — ' + x.sobra + ' a mais (contados ' + x.contado + ', esperado ' + x.esperado + ')', 'f-extra');
    });
  }

  function usarFaltasConferencia() {
    var c = contar(fichaAtual());
    var f = fichaAtual();
    f.faltantes = String(c.faltaTotal);
    $('f-faltantes').value = f.faltantes;
    gravar();
    aviso('Faltantes: ' + c.faltaTotal + '. Ajuste se precisar.');
  }

  function alternarModo() {
    modoConf = !modoConf;
    clearTimeout(pressTimer);
    $('btn-conf').setAttribute('aria-pressed', modoConf ? 'true' : 'false');
    $('btn-conf').textContent = modoConf ? 'Sair da conferência' : 'Conferir paradas';
    $('mode-hint').textContent = modoConf
      ? 'Conferência: toque numa parada para informar quantos pacotes ela deve ter e quantos você contou.'
      : 'Toque = +1 pacote · Segure = −1 pacote';
    gridEl.classList.toggle('conf', modoConf);
  }

  /* janela da parada (modo conferência) */
  var stopN = null;
  function abrirParada(n) {
    stopN = n;
    desenharParada();
    $('stop-modal').hidden = false;
    $('st-close').focus();
  }
  function desenharParada() {
    var f = fichaAtual();
    var e = f.expected[stopN] || 0;
    var c = f.counts[stopN] || 0;
    $('stop-title').textContent = 'Parada ' + stopN;
    $('st-exp').textContent = e;
    $('st-cnt').textContent = c;
    $('st-diff').textContent = e === 0
      ? 'Informe quantos pacotes esta parada deve ter.'
      : c < e ? 'Faltam ' + plural(e - c, 'pacote', 'pacotes') + ' nesta parada.'
      : c === e ? 'Parada completa.'
      : (c - e) + ' a mais que o esperado.';
  }
  function mudarEsperado(d) {
    var f = fichaAtual();
    var v = Math.max(0, Math.min(MAXC, (f.expected[stopN] || 0) + d));
    if (v === 0) delete f.expected[stopN]; else f.expected[stopN] = v;
    pintar(stopN);
    atualizarContadores();
    gravar();
    desenharParada();
  }
  function mudarContado(d) {
    setCount(stopN, (fichaAtual().counts[stopN] || 0) + d);
    desenharParada();
  }
  function zerarParada() {
    var f = fichaAtual();
    delete f.expected[stopN];
    setCount(stopN, 0);
    pintar(stopN);
    atualizarContadores();
    gravar();
    desenharParada();
  }
  function fecharParada() { $('stop-modal').hidden = true; stopN = null; }

  function desenharFicha() {
    var f = fichaAtual();
    for (var i = 0; i < TEXT_FIELDS.length; i++) {
      var k = TEXT_FIELDS[i];
      var el = document.querySelector('[data-field="' + k + '"]');
      if (el) el.value = f[k] || '';
    }
    pintarTudo();
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
    var c = contar(f);
    if (c.contados === 0 && !c.temEsperado) { aviso('Não há marcações'); return; }
    confirmar('Limpar todas as paradas?',
      'Os ' + plural(c.contados, 'pacote contado', 'pacotes contados') + ' e a conferência desta ficha serão apagados. Os campos preenchidos ficam.', 'Limpar')
      .then(function (ok) {
        if (!ok) return;
        f.counts = {};
        f.expected = {};
        f.history = [];
        desenharFicha();
        gravar();
        aviso('Paradas limpas');
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

  function usarPendentes() {
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
      [['Total', c.total > 0 ? c.total : '—'], ['Contados', c.contados], ['Pendentes', c.pendentes === null ? '—' : c.pendentes]]
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
    $('btn-calc').addEventListener('click', usarPendentes);
    $('btn-conf').addEventListener('click', alternarModo);
    $('btn-faltas-usar').addEventListener('click', usarFaltasConferencia);
    $('btn-pdf').addEventListener('click', function () { exportarPDF(fichaAtual()); });
    $('btn-pdf-big').addEventListener('click', function () { exportarPDF(fichaAtual()); });
    $('st-exp-minus').addEventListener('click', function () { mudarEsperado(-1); });
    $('st-exp-plus').addEventListener('click', function () { mudarEsperado(1); });
    $('st-cnt-minus').addEventListener('click', function () { mudarContado(-1); });
    $('st-cnt-plus').addEventListener('click', function () { mudarContado(1); });
    $('st-zero').addEventListener('click', zerarParada);
    $('st-close').addEventListener('click', fecharParada);
    document.querySelector('#stop-modal [data-close]').addEventListener('click', fecharParada);
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
