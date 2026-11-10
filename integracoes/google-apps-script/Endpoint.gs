/**
 * COLOR COMPUTER — endpoint de pedidos (NÃO PUBLICAR ANTES DA CONFIGURAÇÃO).
 *
 * Requer Script Properties:
 *   COLOR_COMPUTER_SHEET_ID: ID da planilha de solicitações
 *   COLOR_COMPUTER_TURNSTILE_SECRET: segredo Cloudflare Turnstile
 *   COLOR_COMPUTER_ALLOWED_HOST: danitrm.github.io
 *
 * A chave secreta NUNCA deve ser incluída no site ou no GitHub.
 * O endpoint aceita POST de formulário e valida o desafio no servidor.
 * A resposta abre em uma nova aba: sucesso ou falha explícitos.
 */

function doPost(e) {
  try {
    const p = e && e.parameter || {};
    const result = registrarSolicitacaoPublica_(p);
    return respostaHtml_(true, 'Solicitação registrada! Protocolo: ' + result.protocolo +
      '. Um e-mail de confirmação foi solicitado. Verifique sua caixa de entrada.');
  } catch (error) {
    console.error(error);
    return respostaHtml_(false, 'Não foi possível registrar a solicitação. ' +
      'Volte ao carrinho e tente novamente ou fale com Daniel ou Renan pelo WhatsApp.');
  }
}

function respostaHtml_(ok, message) {
  const safe = String(message).replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
  return HtmlService.createHtmlOutput(
    '<!doctype html><html lang="pt-BR"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Color Computer | Solicitação</title>' +
    '<body style="font:17px system-ui;background:#071326;color:#eaf6ff;' +
    'padding:40px;max-width:650px;margin:auto"><h1>COLOR COMPUTER</h1>' +
    '<h2>' + (ok ? 'Solicitação registrada' : 'Não foi possível registrar') +
    '</h2><p>' + safe + '</p><p>Não houve pagamento ou compra confirmada.</p>' +
    '<p>Você pode fechar esta aba e voltar ao carrinho.</p></body></html>'
  ).setTitle('Color Computer | Solicitação');
}

function registrarSolicitacaoPublica_(p) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('COLOR_COMPUTER_SHEET_ID');
  const secret = props.getProperty('COLOR_COMPUTER_TURNSTILE_SECRET');
  const allowedHost = props.getProperty('COLOR_COMPUTER_ALLOWED_HOST');
  if (!sheetId || !secret || allowedHost !== 'danitrm.github.io') {
    throw new Error('Integração não configurada');
  }
  // Nunca ativar produção apenas removendo a trava de teste.
  // Produção exige duas propriedades explícitas e distintas.
  const testMode = props.getProperty('COLOR_COMPUTER_TEST_MODE') === 'ATIVO';
  const productionMode = !testMode &&
    props.getProperty('COLOR_COMPUTER_PRODUCTION_MODE') === 'ATIVO' &&
    props.getProperty('COLOR_COMPUTER_PRODUCTION_APPROVED') === 'SIM';
  if (!testMode && !productionMode) throw new Error('Recebimento público não habilitado');
  if (testMode) {
    const testSummary = String(p.summary || '').replace(/\r\n?/g, '\n').trim();
    const isFixedTest = testSummary === 'COLOR COMPUTER - TESTE DE INTEGRACAO SEM PEDIDO REAL';
    const isCartTest = testSummary.startsWith('COLOR COMPUTER - TESTE DE CARRINHO - SEM PEDIDO REAL') &&
      testSummary.length <= 12000 &&
      testSummary.includes('TOTAL ESTIMADO:') &&
      testSummary.includes('NÃO É PEDIDO CONFIRMADO');
    if (String(p.email || '').trim().toLowerCase() !== STORE_EMAIL.toLowerCase() ||
        String(p.name || '').trim() !== 'Cliente de teste Color Computer' ||
        !(isFixedTest || isCartTest)) {
      throw new Error('Somente teste interno permitido');
    }
  }
  if (p.website) throw new Error('Envio rejeitado');
  if (p.site_host !== allowedHost) throw new Error('Origem inválida');
  const token = String(p['cf-turnstile-response'] || '');
  if (!token || token.length > 2048) throw new Error('Verificação ausente');
  const verification = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'post', muteHttpExceptions: true,
    payload: {secret: secret, response: token}
  });
  if (verification.getResponseCode() !== 200) throw new Error('Verificação indisponível');
  const check = JSON.parse(verification.getContentText());
  if (!check.success || check.hostname !== allowedHost) throw new Error('Verificação recusada');

  const name = campo_(p.name, 100);
  const email = campo_(p.email, 180);
  const phone = campo_(p.phone, 30);
  const attendant = campo_(p.attendant, 10);
  const summary = campo_(p.summary, 12000);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !['DANIEL','RENAN'].includes(attendant) || summary.length < 25 ||
      !summary.startsWith('COLOR COMPUTER')) throw new Error('Dados inválidos');
  if (productionMode && (
      p.privacy_ack !== 'SIM' ||
      !summary.startsWith('COLOR COMPUTER — SOLICITAÇÃO DE ORÇAMENTO') ||
      !summary.includes('TOTAL ESTIMADO:') ||
      !summary.includes('Não é pedido pago.') ||
      /TESTE DE CARRINHO|TESTE DE INTEGRACAO/.test(summary)
    )) throw new Error('Solicitação pública inválida');
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let protocol;
  try {
    const sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Solicitacoes');
    if (!sheet) throw new Error('Planilha não configurada');
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
    const cache = CacheService.getScriptCache();
    const fingerprint = Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
        email.toLowerCase() + '|' + summary));
    if (cache.get('cc:' + fingerprint)) throw new Error('Solicitação repetida');
    const sentToday = Number(props.getProperty('COLOR_COMPUTER_DAILY_COUNT_' + today) || 0);
    const dailyLimit = testMode ? 3 : 25;
    if (sentToday >= dailyLimit || MailApp.getRemainingDailyQuota() < 2) {
      throw new Error('Limite diário atingido');
    }
    protocol = 'CC-' + today + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    // Fórmulas em planilhas não podem ser originadas de entradas do cliente.
    const asCell = function(v) { return /^[=+@\-]/.test(v) ? "'" + v : v; };
    sheet.appendRow([new Date(), protocol, asCell(name), asCell(email),
      asCell(phone), attendant, asCell(summary), 'REGISTRADO — E-MAIL PENDENTE']);
    SpreadsheetApp.flush();
    cache.put('cc:' + fingerprint, '1', 600);
    props.setProperty('COLOR_COMPUTER_DAILY_COUNT_' + today, String(sentToday + 1));
    const row = sheet.getLastRow();
    const nl = String.fromCharCode(10);
    const isTest = testMode;
    const testLabel = isTest ? '[TESTE INTERNO — NÃO É PEDIDO REAL] ' : '';
    const clientBody = [
      'Olá, ' + name + '! 💙', '',
      'Recebemos sua solicitação de orçamento na COLOR COMPUTER!',
      'Seu computador personalizado está um passo mais perto de sair do papel.', '',
      'PROTOCOLO: ' + protocol, '',
      'SEU ORÇAMENTO', '',
      summary, '',
      'TOTAL: consulte o total estimado no resumo acima.',
      'Atendente responsável: ' + attendant, '',
      'O QUE ACONTECE AGORA?',
      'Nossa equipe vai analisar as configurações, verificar disponibilidade e confirmar os valores e as condições do orçamento.',
      'Se precisarmos de alguma informação adicional, entraremos em contato pelos dados fornecidos.', '',
      'IMPORTANTE: esta mensagem confirma apenas o recebimento da solicitação.',
      'Nenhuma compra foi concluída e nenhum pagamento foi realizado.',
      'Preços e disponibilidade estão sujeitos à confirmação.', '',
      'Obrigado por escolher a COLOR COMPUTER!',
      'COLOR COMPUTER',
      'Seu PC. Seu estilo. Sua configuração.'
    ].join(nl);
    const storeBody = [
      'NOVA SOLICITAÇÃO DE ORÇAMENTO — COLOR COMPUTER', '',
      'Uma nova solicitação foi recebida pelo site!', '',
      'Protocolo: ' + protocol,
      'Atendente escolhido: ' + attendant, '',
      'DADOS DO CLIENTE',
      'Nome: ' + name,
      'E-mail: ' + email,
      'WhatsApp: ' + phone, '',
      'PCS SOLICITADOS', '',
      summary, '',
      'PRÓXIMA AÇÃO',
      'Verificar preços, compatibilidade e disponibilidade dos componentes.',
      'Entrar em contato com o cliente para confirmar o orçamento e as condições.', '',
      'STATUS: AGUARDANDO ANÁLISE',
      'Solicitação de orçamento — não representa compra confirmada.',
      'COLOR COMPUTER | SISTEMA DE ORÇAMENTOS'
    ].join(nl);
    let clientSent = false;
    let storeSent = false;
    try {
      MailApp.sendEmail({to: email,
        subject: testLabel + 'Color Computer | Recebemos seu orçamento — ' + protocol,
        body: clientBody, name: 'Color Computer', replyTo: STORE_EMAIL});
      clientSent = true;
    } catch (err) { console.error('Falha no e-mail do cliente: ' + err); }
    try {
      MailApp.sendEmail({to: STORE_EMAIL,
        subject: testLabel + 'NOVO ORÇAMENTO | ' + protocol + ' | ' + attendant,
        body: storeBody, name: 'Color Computer'});
      storeSent = true;
    } catch (err) { console.error('Falha na cópia para loja: ' + err); }
    sheet.getRange(row, 8).setValue(
      'REGISTRADO | Cliente: ' + (clientSent ? 'enviado' : 'falhou') +
      ' | Loja: ' + (storeSent ? 'enviado' : 'falhou'));
    return {protocolo: protocol, clientSent: clientSent, storeSent: storeSent};
  } finally { lock.releaseLock(); }
}

function campo_(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}
