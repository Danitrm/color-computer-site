# Integração pública — preparar antes de ativar

O arquivo `Endpoint.gs` é uma base de servidor para a futura integração.
**NÃO implante como aplicativo público ainda.** O carrinho permanece no
WhatsApp até que a proteção seja configurada e testada.

## O que já existe
- `Code.gs`: testes privados de envio, planilha e protocolos.
- `Endpoint.gs`: recebe dados, valida Cloudflare Turnstile no servidor,
  aplica limite diário, reduz duplicações, registra na planilha e tenta enviar
  e-mails para o cliente e para a loja.
- O resumo e os valores vêm do navegador e são **estimativas não verificadas**:
  a equipe precisa confirmar tudo antes de vender.

## Próximos passos
1. Criar uma conta Cloudflare e um widget Turnstile para
   `danitrm.github.io`. O site key é público; o secret é privado.
2. No Apps Script, em Configurações do projeto > Propriedades do script, definir:
   `COLOR_COMPUTER_SHEET_ID` (ID da planilha de testes já criada),
   `COLOR_COMPUTER_TURNSTILE_SECRET` (segredo, apenas nas propriedades),
   `COLOR_COMPUTER_ALLOWED_HOST` = `danitrm.github.io`.
3. Copiar `Endpoint.gs` para um **novo arquivo** no mesmo projeto Apps Script,
   sem substituir `Code.gs`.
4. Revisar quotas do Gmail/Apps Script, políticas de privacidade e retenção de
   dados pessoais. A proteção por CAPTCHA e limites reduz abusos, mas não os
   elimina; para uma operação comercial robusta, considerar um backend dedicado.
5. Fazer testes controlados, verificar o registro e as falhas de entrega.
6. Só então implantar como aplicativo Web e integrar o formulário do carrinho
   com o site key público e a URL da implantação.

## Importante
Não envie ao assistente o segredo Turnstile, senha do Gmail, tokens de
autorização ou chaves privadas. A URL pública da implantação não é uma senha.
Não afirmar que e-mails foram entregues apenas porque o servidor solicitou
o envio. Não confundir o clique em WhatsApp com envio efetivo da mensagem.
