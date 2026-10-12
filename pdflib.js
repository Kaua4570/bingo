/* Escritor de PDF mínimo (sem dependências) — o suficiente para desenhar a ficha:
   retângulos, linhas e texto em Helvetica (WinAnsi). Medidas em milímetros,
   origem no canto superior esquerdo, como num formulário de papel.
   Uso: var doc = CE_PDFLIB.create(); doc.rect(...); doc.text(...); doc.save('x.pdf'); */
(function (root) {
  'use strict';

  var MM = 72 / 25.4;
  var PAGE_W = 210, PAGE_H = 297;

  /* larguras (1/1000 de em) dos códigos 32..255 em WinAnsi */
  var W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
  var W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];

  /* caracteres Unicode que ocupam 0x80..0x9F no Windows-1252 */
  var CP1252 = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
    0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E,
    0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
  };

  function toWinAnsi(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var cp = str.charCodeAt(i);
      var code;
      if (cp === 10 || cp === 13 || cp === 9) code = 32;
      else if (cp >= 32 && cp < 127) code = cp;
      else if (cp >= 160 && cp <= 255) code = cp;
      else if (CP1252[cp] !== undefined) code = CP1252[cp];
      else code = 63; // '?'
      out += String.fromCharCode(code);
    }
    return out;
  }

  function esc(s) { return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  function n(v) { return (Math.round(v * 1000) / 1000).toString(); }
  function col(a, b, c) {
    if (b === undefined) return [a / 255, a / 255, a / 255];
    return [a / 255, b / 255, c / 255];
  }

  function create() {
    var ops = [];
    var st = { lw: 0.3, draw: [0, 0, 0], fill: [1, 1, 1], text: [0, 0, 0], bold: false, size: 12 };

    function px(x) { return x * MM; }
    function py(y) { return (PAGE_H - y) * MM; }

    var doc = {
      setLineWidth: function (mm) { st.lw = mm; return doc; },
      setDrawColor: function (a, b, c) { st.draw = col(a, b, c); return doc; },
      setFillColor: function (a, b, c) { st.fill = col(a, b, c); return doc; },
      setTextColor: function (a, b, c) { st.text = col(a, b, c); return doc; },
      setFont: function (family, style) { st.bold = style === 'bold'; return doc; },
      setFontSize: function (pt) { st.size = pt; return doc; },

      rect: function (x, y, w, h, style) {
        style = style || 'S';
        var op = style === 'F' ? 'f' : (style === 'FD' || style === 'DF') ? 'B' : 'S';
        ops.push(n(st.lw * MM) + ' w');
        ops.push(st.draw.map(n).join(' ') + ' RG');
        ops.push(st.fill.map(n).join(' ') + ' rg');
        ops.push(n(px(x)) + ' ' + n(py(y + h)) + ' ' + n(w * MM) + ' ' + n(h * MM) + ' re ' + op);
        return doc;
      },

      line: function (x1, y1, x2, y2) {
        ops.push(n(st.lw * MM) + ' w');
        ops.push(st.draw.map(n).join(' ') + ' RG');
        ops.push('1 J');
        ops.push(n(px(x1)) + ' ' + n(py(y1)) + ' m ' + n(px(x2)) + ' ' + n(py(y2)) + ' l S');
        return doc;
      },

      /* largura em mm com a fonte e o tamanho atuais */
      getTextWidth: function (str) {
        var t = toWinAnsi(String(str));
        var tab = st.bold ? W_BOLD : W_REG;
        var sum = 0;
        for (var i = 0; i < t.length; i++) {
          var c = t.charCodeAt(i);
          sum += c >= 32 ? tab[c - 32] : 0;
        }
        return sum / 1000 * st.size / MM;
      },

      /* quebra o texto em linhas que cabem em maxW (mm); respeita \n */
      splitTextToSize: function (str, maxW) {
        var lines = [];
        String(str).split(/\r?\n/).forEach(function (par) {
          var words = par.split(/\s+/).filter(Boolean);
          if (!words.length) { lines.push(''); return; }
          var cur = '';
          words.forEach(function (w) {
            // palavra maior que a linha: corta por caracteres
            while (doc.getTextWidth(w) > maxW && w.length > 1) {
              var k = w.length - 1;
              while (k > 1 && doc.getTextWidth(w.slice(0, k)) > maxW) k--;
              if (cur) { lines.push(cur); cur = ''; }
              lines.push(w.slice(0, k));
              w = w.slice(k);
            }
            var tentativa = cur ? cur + ' ' + w : w;
            if (doc.getTextWidth(tentativa) <= maxW) cur = tentativa;
            else { lines.push(cur); cur = w; }
          });
          lines.push(cur);
        });
        return lines;
      },

      /* texto na linha de base y; aceita lista de linhas */
      text: function (str, x, y, opts) {
        var align = (opts && opts.align) || 'left';
        var list = Array.isArray(str) ? str : [str];
        var step = st.size * 1.2 / MM;
        list.forEach(function (line, i) {
          var s = String(line);
          var xx = x;
          var w = doc.getTextWidth(s);
          if (align === 'center') xx = x - w / 2;
          else if (align === 'right') xx = x - w;
          ops.push(st.text.map(n).join(' ') + ' rg');
          ops.push('BT /' + (st.bold ? 'F2' : 'F1') + ' ' + n(st.size) + ' Tf ' +
            n(px(xx)) + ' ' + n(py(y + i * step)) + ' Td (' + esc(toWinAnsi(s)) + ') Tj ET');
        });
        return doc;
      },

      /* monta o arquivo PDF (uma página A4) e devolve os bytes */
      output: function () {
        var content = ops.join('\n');
        var objs = [];
        objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
        objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n(PAGE_W * MM) + ' ' + n(PAGE_H * MM) +
          '] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>';
        objs[4] = '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream';
        objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        objs[6] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

        var out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
        var offsets = [];
        for (var i = 1; i <= 6; i++) {
          offsets[i] = out.length;
          out += i + ' 0 obj\n' + objs[i] + '\nendobj\n';
        }
        var xref = out.length;
        out += 'xref\n0 7\n0000000000 65535 f \n';
        for (var j = 1; j <= 6; j++) {
          out += ('0000000000' + offsets[j]).slice(-10) + ' 00000 n \n';
        }
        out += 'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';

        var bytes = new Uint8Array(out.length);
        for (var k = 0; k < out.length; k++) bytes[k] = out.charCodeAt(k) & 255;
        return bytes;
      },

      getNumberOfPages: function () { return 1; },

      /* baixa o arquivo no celular/computador */
      save: function (filename) {
        var blob = new Blob([doc.output()], { type: 'application/pdf' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 4000);
      }
    };
    return doc;
  }

  root.CE_PDFLIB = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
