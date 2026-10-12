/* Desenha a ficha em PDF, uma única folha A4 (retrato), com o escritor de PDF do projeto (pdflib.js).
   CE_PDF.build(ficha, contagem, dataFormatada) devolve o documento (use .save('nome.pdf')). */
(function (root) {
  'use strict';

  var M = 10;            // margem (mm)
  var W = 190;           // largura útil (A4 = 210 - 2 x 10)
  var YELLOW = [255, 230, 0];

  function build(f, c, dataTxt) {
    var doc = root.CE_PDFLIB.create();   // A4 retrato, medidas em mm
    doc.setLineWidth(0.3);
    doc.setDrawColor(0);
    doc.setTextColor(0);

    /* escreve um texto numa caixa, reduzindo a fonte até caber */
    function fit(txt, x, y, maxW, size, style, align) {
      doc.setFont('helvetica', style || 'normal');
      var s = size;
      doc.setFontSize(s);
      while (s > 6 && doc.getTextWidth(txt) > maxW) { s -= 0.5; doc.setFontSize(s); }
      doc.text(txt, x, y, { align: align || 'left' });
    }

    /* caixa com rótulo pequeno em cima e valor embaixo */
    function campo(x, y, w, h, rotulo, valor, tamanho) {
      doc.rect(x, y, w, h);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(90);
      doc.text(rotulo.toUpperCase(), x + 1.6, y + 3.2);
      doc.setTextColor(0);
      fit(String(valor || ''), x + 1.6, y + h - 2.4, w - 3.2, tamanho || 11, 'bold');
    }

    /* ---------- título ---------- */
    doc.setFillColor(YELLOW[0], YELLOW[1], YELLOW[2]);
    doc.rect(M, M, W, 9, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('CONTROLE DE ENTREGAS', M + 3, M + 6.4);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Ficha de controle de pacotes', M + W - 3, M + 6.2, { align: 'right' });

    /* ---------- cabeçalho ---------- */
    var y = 22;
    campo(M, y, 74, 12, 'Motorista', f.motorista);
    campo(M + 74, y, 32, 12, 'Rota', f.rota);
    campo(M + 106, y, 38, 12, 'Data', dataTxt);
    campo(M + 144, y, 46, 12, 'PCTS', f.pcts);

    /* ---------- AM / PM e totais ---------- */
    y = 35;
    doc.rect(M, y, 70, 10);
    ['AM', 'PM'].forEach(function (p, i) {
      var bx = M + 4 + i * 32;
      doc.rect(bx, y + 2.6, 4.8, 4.8);
      if (f.periodo === p) {
        doc.setLineWidth(0.6);
        doc.line(bx + 0.8, y + 3.4, bx + 4, y + 6.6);
        doc.line(bx + 4, y + 3.4, bx + 0.8, y + 6.6);
        doc.setLineWidth(0.3);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(p, bx + 7, y + 6.9);
    });

    doc.rect(M + 70, y, W - 70, 10);
    var pend = c.pendentes === null ? '-' : String(c.pendentes);
    var pct = c.pct === null ? '-' : c.pct + '%';
    var cols = [
      ['TOTAL', c.total > 0 ? String(c.total) : '-'],
      ['CONTADOS', String(c.contados)],
      ['PENDENTES', pend],
      ['CONCLUÍDO', pct]
    ];
    var cw = (W - 70) / 4;
    cols.forEach(function (col, i) {
      var cx = M + 70 + i * cw;
      if (i > 0) doc.line(cx, y, cx, y + 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(90);
      doc.text(col[0], cx + cw / 2, y + 3.3, { align: 'center' });
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(col[1], cx + cw / 2, y + 8.4, { align: 'center' });
    });

    /* ---------- grade 1..120 (6 colunas x 20 linhas) ---------- */
    var gy = 48;
    var rowH = 8.4;
    var colW = W / 6;
    for (var r = 0; r < 20; r++) {
      for (var col = 0; col < 6; col++) {
        var n = col * 20 + r + 1;
        var x = M + col * colW;
        var yy = gy + r * rowH;
        var cnt = (f.counts && f.counts[n]) || 0;
        var marcado = cnt > 0;
        if (marcado) {
          doc.setFillColor(YELLOW[0], YELLOW[1], YELLOW[2]);
          doc.rect(x, yy, colW, rowH, 'FD');
        } else {
          doc.rect(x, yy, colW, rowH);
        }
        /* número da parada à esquerda; um risco por pacote no meio; ×N à direita */
        doc.setFont('helvetica', marcado ? 'bold' : 'normal');
        doc.setFontSize(11);
        doc.text(String(n), x + 3, yy + rowH / 2 + 1.6);
        if (marcado) {
          doc.setLineWidth(0.45);
          var riscos = Math.min(cnt, 8);
          for (var t = 0; t < riscos; t++) {
            var tx = x + 12 + t * 1.35;
            doc.line(tx, yy + 2, tx, yy + rowH - 2);
          }
          doc.setLineWidth(0.3);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text('×' + cnt, x + colW - 2, yy + rowH / 2 + 1.5, { align: 'right' });
        }
      }
    }
    doc.setLineWidth(0.6);
    doc.rect(M, gy, W, 20 * rowH);
    doc.setLineWidth(0.3);

    /* ---------- rodapé ---------- */
    var fy = gy + 20 * rowH + 4;      // 220
    campo(M, fy, W, 10, 'Agência', f.agencia);
    fy += 11;
    campo(M, fy, 60, 10, 'Parada', f.parada1);
    campo(M + 60, fy, 35, 10, 'Total', f.total1);
    campo(M + 95, fy, 60, 10, '2ª parada', f.parada2);
    campo(M + 155, fy, 35, 10, 'Total', f.total2);
    fy += 11;
    campo(M, fy, W, 10, 'Pacotes faltantes', f.faltantes);
    fy += 11;

    /* conferência: paradas com pacote faltando (só aparece se houver) */
    if (c.faltas && c.faltas.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      var partes = c.faltas.map(function (x) {
        return 'P' + x.n + (x.contado === 0 ? ' não veio (' + x.esperado + ')' : ' -' + x.falta);
      });
      var txtF = 'Faltam ' + c.faltaTotal + ' em ' + c.faltas.length + ' parada(s): ' + partes.join('   |   ');
      var ls = doc.splitTextToSize(txtF, W - 3.2);
      if (ls.length > 5) { ls = ls.slice(0, 5); ls[4] = ls[4].replace(/.{0,3}$/, '...'); }
      var hF = 5 + ls.length * 3.2;
      doc.rect(M, fy, W, hF);
      doc.setFontSize(6.5);
      doc.setTextColor(90);
      doc.text('FALTAS POR PARADA (CONFERÊNCIA)', M + 1.6, fy + 3.2);
      doc.setTextColor(0);
      doc.setFontSize(7.5);
      doc.text(ls, M + 1.6, fy + 6.6);
      fy += hF + 1;
    }

    var obsH = 287 - fy;              // até a margem inferior
    doc.rect(M, fy, W, obsH);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(90);
    doc.text('OBSERVAÇÕES', M + 1.6, fy + 3.2);
    doc.setTextColor(0);
    doc.setFontSize(9);
    var linhas = doc.splitTextToSize(String(f.obs || ''), W - 3.2);
    var maxLinhas = Math.max(1, Math.floor((obsH - 6) / 4));
    if (linhas.length > maxLinhas) {
      linhas = linhas.slice(0, maxLinhas);
      linhas[maxLinhas - 1] = linhas[maxLinhas - 1].replace(/.{0,3}$/, '...');
    }
    doc.text(linhas, M + 1.6, fy + 7.6);

    return doc;
  }

  root.CE_PDF = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
