/**
 * COLOR COMPUTER — PROTÓTIPO de confirmação por e-mail.
 * Cole este código em https://script.google.com usando a conta de testes.
 * Não publique endpoint público antes de configurar proteção contra abuso.
 * A versão abaixo é para teste manual, NÃO para integrar diretamente ao site público.
 */
const STORE_EMAIL = 'trindadedaniel591@gmail.com';

function testarEmail() {
  const destinatario = Session.getEffectiveUser().getEmail();
  if (!destinatario) throw new Error('Não foi possível identificar a conta Google.');
  const assunto = 'Color Computer | Teste de confirmação';
  const texto = [
    'Olá!',
    '',
    'Este é um teste de envio da Color Computer.',
    'Nenhuma solicitação de orçamento foi registrada.',
    'Nenhum pedido ou pagamento foi confirmado.',
    '',
    'COLOR COMPUTER'
  ].join('\n');
  MailApp.sendEmail({to: destinatario, subject: assunto, body: texto, name: 'Color Computer'});
  Logger.log('E-mail de teste enviado para: ' + destinatario);
}

/**
 * Uso futuro: após implementar registro autenticado/validado de solicitações,
 * chamar esta função somente no servidor e somente após registro bem-sucedido.
 */
function enviarConfirmacaoAposRegistro_(pedido) {
  if (!pedido || !pedido.registrado || !pedido.email || !pedido.protocolo) {
    throw new Error('Solicitação ainda não registrada.');
  }
  const email = String(pedido.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) {
    throw new Error('E-mail inválido.');
  }
  const texto = [
    'Olá, ' + String(pedido.nome || 'cliente').slice(0, 100) + '!',
    '',
    'Sua solicitação de orçamento foi registrada.',
    'Protocolo: ' + pedido.protocolo,
    '',
    String(pedido.resumo || '').slice(0, 12000),
    '',
    'Os valores são estimados e dependem de confirmação da equipe.',
    'Esta mensagem não confirma compra, estoque, prazo ou pagamento.',
    '',
    'COLOR COMPUTER'
  ].join('\n');
  MailApp.sendEmail({
    to: email,
    subject: 'Color Computer | Solicitação ' + String(pedido.protocolo).slice(0, 40),
    body: texto,
    name: 'Color Computer',
    replyTo: STORE_EMAIL
  });
}

/**
 * Testa os DOIS e-mails do fluxo usando apenas a conta do proprietário.
 * Não cria um pedido real e não envia mensagem para clientes.
 */
function testarEmailDuplo() {
  const destinatario = Session.getEffectiveUser().getEmail();
  if (!destinatario) throw new Error('Não foi possível identificar a conta Google.');
  const exemplo = {
    protocolo: 'CC-TESTE-0001',
    nome: 'Cliente de teste',
    email: destinatario,
    atendente: 'RENAN',
    resumo: 'Modelo: ASCENSION\\nAcabamento: Preto\\nTotal estimado: R$ 0 (exemplo fictício)'
  };
  MailApp.sendEmail({
    to: destinatario,
    subject: 'Color Computer | TESTE de confirmação ao cliente | ' + exemplo.protocolo,
    body: [
      'Olá, ' + exemplo.nome + '!',
      '',
      'ESTE É UM TESTE. Nenhuma solicitação real foi registrada.',
      'Exemplo de protocolo: ' + exemplo.protocolo,
      '',
      exemplo.resumo,
      '',
      'Os valores são estimados e sujeitos à confirmação.',
      'Este e-mail não confirma compra ou pagamento.',
      '',
      'COLOR COMPUTER'
    ].join('\\n'),
    name: 'Color Computer',
    replyTo: STORE_EMAIL
  });
  MailApp.sendEmail({
    to: STORE_EMAIL,
    subject: 'Color Computer | TESTE de cópia para loja | ' + exemplo.protocolo + ' | ' + exemplo.atendente,
    body: [
      'TESTE INTERNO — NÃO É UM PEDIDO REAL.',
      'Protocolo de exemplo: ' + exemplo.protocolo,
      'Atendente escolhido: ' + exemplo.atendente,
      'Nome: ' + exemplo.nome,
      'E-mail: ' + exemplo.email,
      '',
      exemplo.resumo,
      '',
      'A integração com o carrinho ainda não foi ativada.'
    ].join('\\n'),
    name: 'Color Computer'
  });
  Logger.log('Dois e-mails de demonstração enviados para: ' + destinatario);
}

/**
 * Etapa 2: simula o fluxo COMPLETO em ambiente privado:
 * registra uma solicitação fictícia em uma planilha e envia dois e-mails.
 * Execute manualmente uma vez na conta Google proprietária.
 * Não cria endpoint público nem aceita pedidos do site.
 */
function testarRegistroCompleto() {
  const emailTeste = Session.getEffectiveUser().getEmail();
  if (!emailTeste) throw new Error('Não foi possível identificar a conta Google.');
  const props = PropertiesService.getScriptProperties();
  let planilha;
  const id = props.getProperty('COLOR_COMPUTER_SHEET_ID');
  if (id) {
    planilha = SpreadsheetApp.openById(id);
  } else {
    planilha = SpreadsheetApp.create('Color Computer - Solicitações de orçamento (TESTES)');
    props.setProperty('COLOR_COMPUTER_SHEET_ID', planilha.getId());
  }
  let aba = planilha.getSheetByName('Solicitacoes');
  if (!aba) {
    aba = planilha.insertSheet('Solicitacoes');
    aba.appendRow(['Data', 'Protocolo', 'Nome', 'Email', 'WhatsApp', 'Atendente', 'Resumo', 'Status']);
    aba.setFrozenRows(1);
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let protocolo;
  try {
    protocolo = 'CC-TESTE-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
    const resumo = 'Modelo: ASCENSION\\nCor: Preto\\nQuantidade: 1\\nValor: apenas exemplo, sem preço real';
    aba.appendRow([new Date(), protocolo, 'Cliente de teste', emailTeste, 'Não informado', 'DANIEL', resumo, 'TESTE — SEM PEDIDO REAL']);
    SpreadsheetApp.flush();
    MailApp.sendEmail({
      to: emailTeste,
      subject: 'Color Computer | TESTE de confirmação registrada | ' + protocolo,
      body: ['Olá, cliente de teste!', '', 'ESTE É UM TESTE, NÃO UM PEDIDO REAL.', 'Protocolo: ' + protocolo, '', resumo, '', 'Orçamento sujeito à confirmação. Não houve compra ou pagamento.'].join('\\n'),
      name: 'Color Computer',
      replyTo: STORE_EMAIL
    });
    MailApp.sendEmail({
      to: STORE_EMAIL,
      subject: 'Color Computer | TESTE de registro na planilha | ' + protocolo,
      body: ['TESTE INTERNO — NENHUM PEDIDO REAL.', 'Protocolo: ' + protocolo, 'Atendente: DANIEL', 'Cliente: Cliente de teste', 'E-mail: ' + emailTeste, '', resumo, '', 'Planilha: ' + planilha.getUrl()].join('\\n'),
      name: 'Color Computer'
    });
    aba.getRange(aba.getLastRow(), 8).setValue('TESTE — 2 E-MAILS DISPARADOS');
    Logger.log('Planilha de testes: ' + planilha.getUrl());
    Logger.log('Protocolo de teste: ' + protocolo);
  } finally {
    lock.releaseLock();
  }
}
