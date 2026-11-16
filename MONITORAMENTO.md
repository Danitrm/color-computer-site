# Monitoramento do site público

A verificação em `.github/workflows/public-site.yml` consulta o endereço real:
`https://danitrm.github.io/color-computer-site/`.

## Quando roda

- Após uma implantação bem-sucedida pelo workflow de GitHub Pages;
- Diariamente às 11:15 UTC (horário UTC, não horário local);
- Manualmente pela aba **Actions → Verificar site publico COLOR COMPUTER → Run workflow**.

## O que valida

- HTTP 200 e estrutura esperada nas seis páginas principais;
- 21 arquivos originais de imagens de produtos respondendo a HTTP HEAD;
- 21 seletores de acabamento e script de troca de cores na homepage;
- Desativação explícita do registro automático de orçamento no carrinho.

A verificação é **somente leitura**: não envia pedidos, mensagens, formulários ou dados pessoais. O status fica no GitHub Actions. O GitHub pode emitir notificações de falhas conforme as configurações do repositório, mas este projeto não configura alertas por e-mail ou WhatsApp.

**Limitações:** não é uma auditoria visual nem testa performance real, pagamentos ou a entrega de mensagens. A verificação pode falhar durante propagação do CDN, problemas de rede ou indisponibilidade temporária. Os testes locais de navegador continuam em `.github/workflows/quality.yml`.

## Auditoria visual e de desempenho (Fase 15)

O workflow `.github/workflows/public-performance.yml` executa o Chromium contra o **site publicado**, após deploy bem-sucedido, às segundas-feiras às 12:30 UTC, ou manualmente em Actions.

O arquivo `performance-reports/measurements.json` e seis capturas de tela (homepage, catálogo e carrinho, em 390px e 1440px) são disponibilizados no artefato `color-computer-public-performance`, retido por 30 dias.

A auditoria visita as seis páginas principais em mobile e desktop e registra: tempos de navegação e carregamento, LCP sintético quando disponível, tamanho de transferência reportado pelo navegador, imagens carregadas, imagens visíveis quebradas, largura de overflow, exceções JavaScript e respostas HTTP de erro de recursos locais. Erros JavaScript, imagens visíveis quebradas e requisições locais com erro reprovam a auditoria.

**Interpretação:** cada execução é uma amostra sintética sem limitação de rede ou CPU. Não representa a experiência média dos clientes, não mede Core Web Vitals reais de campo e não constitui uma pontuação Lighthouse. O arquivo JSON fornece observações para comparação, sem afirmar melhora percentual ou cumprimento de metas de velocidade. Capturas são para inspeção humana, não para comparação automática de pixels. A auditoria não envia mensagens nem orçamentos.
