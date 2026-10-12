# Controle de Entregas (PWA)

Ficha digital de controle de pacotes: grade de 1 a 120 em 6 colunas, contadores automáticos,
AM/PM, rodapé operacional, PDF em uma folha A4, salvamento automático e histórico de fichas.

## Como usar

Os números de 1 a 120 são as **paradas**. Cada toque numa parada conta 1 pacote:
parada com 2 pacotes = 2 toques, parada com 7 pacotes = 7 toques. O número no canto da parada
mostra quantos pacotes ela tem, e o total de pacotes é a soma de todas.

- **Toque** = +1 pacote. **Segurar** (meio segundo) = −1 pacote. **Desfazer** volta a última mudança.
- **Conferir paradas** (o "bingo"): toque no botão, depois numa parada, e informe quantos pacotes ela
  **deve ter** (esperado). Paradas incompletas ficam com borda vermelha e aparecem na lista
  "Conferência" com o que falta ("Parada 5 — faltam 3", "Parada 9 — não veio").
- Contados, pendentes (PCTS − contados) e faltantes são números separados. O campo "Pacotes faltantes"
  é seu; os botões só sugerem um valor.
- No PDF, cada parada com pacote sai com um risco por pacote e o "×N"; as faltas da conferência
  saem numa caixa própria.

Sem dependências e sem build: são arquivos estáticos (HTML, CSS e JavaScript).

## Rodar no computador

    cd controle-entregas
    python3 -m http.server 8080

Abra http://localhost:8080. (Abrir o index.html direto pelo arquivo funciona, mas o modo offline e a instalação só funcionam via http://localhost ou https.)

## Publicar (precisa de https para instalar na tela inicial)

Qualquer hospedagem de site estático serve. Envie esta pasta inteira:

- **Netlify Drop**: entre em app.netlify.com/drop e arraste a pasta (ou o .zip). Recebe um link https na hora.
- **GitHub Pages**: suba os arquivos num repositório e ative Pages (Settings > Pages > branch main).
- **Vercel / Cloudflare Pages**: importe a pasta; não precisa de comando de build nem de pasta de saída.

## Instalar no celular

- **Android (Chrome)**: abra o link > menu (três pontinhos) > "Instalar e criar atalho".
- **iPhone (Safari)**: botão Compartilhar > "Adicionar à Tela de Início".

Depois de aberto uma vez com internet, o app funciona sem internet.

## Onde ficam os dados

No próprio celular (localStorage), cada ficha num registro separado. Limpar os dados do navegador
ou desinstalar o app apaga as fichas. Os dados não vão para nenhum servidor.

## Arquivos

- `index.html`, `styles.css`: telas e visual
- `app.js`: ficha, contadores, salvamento, histórico
- `pdf.js`: desenho da ficha em A4; `pdflib.js`: gerador de PDF próprio (sem biblioteca externa)
- `sw.js`, `manifest.webmanifest`, `icon-*.png`: instalação e uso offline

Ao mudar qualquer arquivo e republicar, aumente `VERSION` em `sw.js` para os celulares pegarem a atualização.
