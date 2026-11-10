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
  // MODO DE TESTE: bloquear clientes reais até a integração ser aprovada.
  // Não remova este bloqueio antes de revisar segurança, privacidade e limites.
  if (props.getProperty('COLOR_COMPUTER_TEST_MODE') !== 'ATIVO') {
    throw new Error('Modo de teste não habilitado');
  }
  const testSummary = String(p.summary || '').replace(/\r\n?/g, '\n').trim();
  const isFixedTest = testSummary === 'COLOR COMPUTER - TESTE DE INTEGRACAO SEM PEDIDO REAL';
  const isCartTest = testSummary.startsWith('COLOR COMPUTER - TESTE DE CARRINHO - SEM PEDIDO REAL') &&
    testSummary.length <= 12000 &&
    testSummary.includes('COLOR COMPUTER') &&
    testSummary.includes('TOTAL ESTIMADO:') &&
    testSummary.includes('NÃO É PEDIDO CONFIRMADO');
  const testNameOk = String(p.name || '').trim() === 'Cliente de teste Color Computer';
  const testEmailOk = String(p.email || '').trim().toLowerCase() === STORE_EMAIL.toLowerCase();
  if (!testNameOk || !testEmailOk || !(isFixedTest || isCartTest)) {
    // Somente indicadores booleanos; nunca registrar dados pessoais ou tokens.
    console.error('Diagnóstico do modo de teste: ' + JSON.stringify({
      nameOk: testNameOk, emailOk: testEmailOk,
      fixedSummary: isFixedTest, cartSummary: isCartTest,
      summaryLength: testSummary.length,
      cartPrefix: testSummary.startsWith('COLOR COMPUTER - TESTE DE CARRINHO')
    }));
    throw new Error('Somente teste interno permitido');
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
    if (sentToday >= 3 || MailApp.getRemainingDailyQuota() < 2) {
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
    const clientBody = [
      'Olá, ' + name + '!', '',
      'Sua solicitação de orçamento foi registrada.',
      'Protocolo: ' + protocol, '',
      summary, '',
      'A equipe ainda precisa confirmar preço, disponibilidade e condições.',
      'Não houve compra ou pagamento confirmado.',
      'COLOR COMPUTER'
    ].join(nl);
    let clientSent = false;
    let storeSent = false;
    try {
      MailApp.sendEmail({to: email,
        subject: 'Color Computer | Solicitação ' + protocol,
        body: clientBody, name: 'Color Computer', replyTo: STORE_EMAIL});
      clientSent = true;
    } catch (err) { console.error('Falha no e-mail do cliente: ' + err); }
    try {
      MailApp.sendEmail({to: STORE_EMAIL,
        subject: 'Color Computer | Novo orçamento ' + protocol + ' | ' + attendant,
        body: ['Novo orçamento registrado', 'Protocolo: ' + protocol,
          'Atendente: ' + attendant, 'Nome: ' + name,
          'E-mail: ' + email, 'WhatsApp: ' + phone, '', summary].join(nl),
        name: 'Color Computer'});
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
