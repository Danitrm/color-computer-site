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
