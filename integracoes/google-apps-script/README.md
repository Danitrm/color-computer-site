# Color Computer — Gmail de teste

Conta de teste: **trindadedaniel591@gmail.com**.

## Etapa 1 — testar o envio sem expor a conta
1. Entre em https://script.google.com com a conta de teste.
2. Crie um **Novo projeto** chamado **Color Computer — E-mails de teste**.
3. Abra `Code.gs` e cole o conteúdo de `integracoes/google-apps-script/Code.gs`.
4. Salve e, no menu de funções, selecione `testarEmail`.
5. Clique **Executar** e autorize as permissões do Google, após conferi-las.
6. Verifique a caixa de entrada e spam de **trindadedaniel591@gmail.com**.

**Não é necessário implantar como aplicativo da Web nesta etapa.**
Não compartilhe senha, código de verificação, token ou URL de implantação pública no repositório.

## Etapa 2 — integração real (ainda não implementada)
Para que o cliente receba uma confirmação de verdade, é preciso:
- receber e validar o pedido em um backend;
- proteger o endpoint contra disparos abusivos e spam;
- registrar o pedido e gerar protocolo no servidor;
- enviar o e-mail **somente após** o registro bem-sucedido;
- mostrar sucesso apenas depois da confirmação do servidor;
- definir aviso de privacidade e política de retenção de dados.

O carrinho continua enviando a mensagem para Daniel ou Renan via WhatsApp.
Abrir o WhatsApp **não prova que o cliente enviou a mensagem**. Por isso, não
deve gerar sozinho um e-mail dizendo que o pedido foi recebido.

Este projeto é apenas um teste de envio autenticado na conta Google; não
inclui um endpoint público, armazenamento de pedidos ou envio automático ao cliente.
