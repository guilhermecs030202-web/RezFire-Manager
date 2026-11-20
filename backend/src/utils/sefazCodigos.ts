export type CategoriaRetornoSefaz =
  | 'autorizada'
  | 'em_processamento'
  | 'rejeitada'
  | 'denegada'
  | 'indisponivel'
  | 'consulta_vazia'
  | 'servico_ativo';

export interface DefinicaoCodigoSefaz {
  cStat: string;
  categoria: CategoriaRetornoSefaz;
  titulo: string;
  mensagemAmigavel: string;
  acaoRecomendada: string;
  permiteReenvioMesmoNumero: boolean;
  sugereAvancarNumero: boolean;
}

export interface InterpretacaoCodigoSefaz extends DefinicaoCodigoSefaz {
  xMotivoOriginal?: string | null;
}

const DICIONARIO_SEFAZ: Record<string, DefinicaoCodigoSefaz> = {
  '100': {
    cStat: '100',
    categoria: 'autorizada',
    titulo: 'NF-e autorizada',
    mensagemAmigavel: 'Nota Fiscal Eletrônica autorizada com sucesso pela SEFAZ.',
    acaoRecomendada: 'Armazene o protocolo e o XML autorizado (nfeProc) para envio/DANFE.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '150': {
    cStat: '150',
    categoria: 'autorizada',
    titulo: 'NF-e autorizada fora de prazo',
    mensagemAmigavel: 'NF-e autorizada pela SEFAZ fora do prazo regulamentar.',
    acaoRecomendada: 'Verifique com a contabilidade o motivo do envio extemporâneo e guarde o nfeProc.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '103': {
    cStat: '103',
    categoria: 'em_processamento',
    titulo: 'Lote recebido pela SEFAZ',
    mensagemAmigavel: 'A SEFAZ recebeu o lote e o retorno definitivo ainda está em fila.',
    acaoRecomendada: 'Consulte a situação na SEFAZ antes de tentar um novo envio para evitar duplicidade.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '105': {
    cStat: '105',
    categoria: 'em_processamento',
    titulo: 'Lote em processamento',
    mensagemAmigavel: 'A NF-e ainda está em processamento nos servidores da SEFAZ.',
    acaoRecomendada: 'Aguarde alguns instantes e clique em "Consultar Situação" na SEFAZ.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '107': {
    cStat: '107',
    categoria: 'servico_ativo',
    titulo: 'Serviço em operação',
    mensagemAmigavel: 'O serviço autorizador da SEFAZ está ativo e respondendo normalmente.',
    acaoRecomendada: 'Operação disponível para transmissão e consulta.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '108': {
    cStat: '108',
    categoria: 'indisponivel',
    titulo: 'Serviço paralisado momentaneamente',
    mensagemAmigavel: 'SEFAZ temporariamente indisponível para recebimento de notas (manutenção ou sobrecarga).',
    acaoRecomendada: 'Aguarde alguns minutos e tente consultar ou retransmitir novamente.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '109': {
    cStat: '109',
    categoria: 'indisponivel',
    titulo: 'Serviço paralisado sem previsão',
    mensagemAmigavel: 'O serviço da SEFAZ encontra-se paralisado sem previsão de retorno.',
    acaoRecomendada: 'Tente novamente mais tarde ou avalie contingência junto à contabilidade.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '110': {
    cStat: '110',
    categoria: 'denegada',
    titulo: 'Uso denegado',
    mensagemAmigavel: 'Uso denegado pela SEFAZ. A numeração foi consumida e não pode ser reutilizada.',
    acaoRecomendada: 'Não tente reenviar esta numeração. Consulte a contabilidade para regularização cadastral.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '204': {
    cStat: '204',
    categoria: 'rejeitada',
    titulo: 'Duplicidade de NF-e',
    mensagemAmigavel: 'Já existe uma NF-e autorizada ou registrada na SEFAZ com esta chave de acesso ou numeração.',
    acaoRecomendada: 'Consulte a situação desta chave na SEFAZ ou gere nova versão avançando o número da NF-e.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: true,
  },
  '207': {
    cStat: '207',
    categoria: 'rejeitada',
    titulo: 'CNPJ do emitente inválido',
    mensagemAmigavel: 'O CNPJ informado para o emitente é inválido ou não corresponde ao cadastro fiscal.',
    acaoRecomendada: 'Corrija o CNPJ do emitente em Configuração Fiscal, regere a nota assinada e reenvie.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '209': {
    cStat: '209',
    categoria: 'rejeitada',
    titulo: 'IE do emitente inválida',
    mensagemAmigavel: 'A Inscrição Estadual do emitente é inválida ou incompatível com a UF informada.',
    acaoRecomendada: 'Revise a IE do emitente em Configuração Fiscal, regere e assine a nota.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '210': {
    cStat: '210',
    categoria: 'rejeitada',
    titulo: 'IE do destinatário inválida',
    mensagemAmigavel: 'A Inscrição Estadual informada para o destinatário é inválida.',
    acaoRecomendada: 'Atualize os dados fiscais do destinatário no pedido, regere a nota e retransmita.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '215': {
    cStat: '215',
    categoria: 'rejeitada',
    titulo: 'Falha no schema XML',
    mensagemAmigavel: 'O XML gerado não atendeu à estrutura XSD exigida pela SEFAZ v4.00.',
    acaoRecomendada: 'Revise os campos obrigatórios de emitente, destinatário e produtos, regere e reenvie.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '217': {
    cStat: '217',
    categoria: 'consulta_vazia',
    titulo: 'NF-e não consta na base da SEFAZ',
    mensagemAmigavel: 'A SEFAZ confirmou que esta chave de acesso ainda não foi registrada em sua base.',
    acaoRecomendada: 'É seguro retransmitir a NF-e sem risco de duplicidade.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '225': {
    cStat: '225',
    categoria: 'rejeitada',
    titulo: 'Falha no schema XML do lote de NF-e',
    mensagemAmigavel: 'Estrutura do lote enviado à SEFAZ apresentou erro de validação XML.',
    acaoRecomendada: 'Revise os dados fiscais da nota, regere o XML assinado e tente novamente.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '228': {
    cStat: '228',
    categoria: 'rejeitada',
    titulo: 'Data de emissão muito atrasada',
    mensagemAmigavel: 'A data/hora de emissão informada no XML ultrapassa o limite permitido pela SEFAZ.',
    acaoRecomendada: 'Regere o XML com data/hora atualizada, assine novamente e retransmita.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '280': {
    cStat: '280',
    categoria: 'rejeitada',
    titulo: 'Certificado do transmissor inválido',
    mensagemAmigavel: 'Certificado digital A1 expirado, revogado ou fora da cadeia ICP-Brasil aceita pela SEFAZ.',
    acaoRecomendada: 'Substitua o certificado A1 em Configuração Fiscal, reassine a nota e retransmita.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '290': {
    cStat: '290',
    categoria: 'rejeitada',
    titulo: 'Certificado de assinatura inválido',
    mensagemAmigavel: 'O certificado usado na assinatura digital do XML é inválido ou não pertence ao CNPJ base.',
    acaoRecomendada: 'Verifique o certificado A1 configurado, reassine o XML e tente novamente.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '297': {
    cStat: '297',
    categoria: 'rejeitada',
    titulo: 'Assinatura difere do calculado',
    mensagemAmigavel: 'A assinatura XMLDSig não confere com o digest SHA-1 calculado pela SEFAZ.',
    acaoRecomendada: 'Clique em "Corrigir / Regerar XML Assinado" antes de reenviar à SEFAZ.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '301': {
    cStat: '301',
    categoria: 'denegada',
    titulo: 'Uso denegado — emitente irregular',
    mensagemAmigavel: 'Uso denegado por irregularidade fiscal do emitente junto à SEFAZ.',
    acaoRecomendada: 'Regularize a situação cadastral/IE do emitente na SEFAZ; este número não pode ser reaproveitado.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '302': {
    cStat: '302',
    categoria: 'denegada',
    titulo: 'Uso denegado — destinatário irregular',
    mensagemAmigavel: 'Uso denegado por irregularidade fiscal do destinatário junto à SEFAZ estadual.',
    acaoRecomendada: 'A numeração foi denegada e não pode ser reutilizada. Verifique o cadastro do cliente.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '303': {
    cStat: '303',
    categoria: 'denegada',
    titulo: 'Destinatário não habilitado na UF',
    mensagemAmigavel: 'Uso denegado: destinatário não habilitado para operar na UF informada.',
    acaoRecomendada: 'Confirme a situação cadastral do destinatário antes de emitir nova numeração.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '528': {
    cStat: '528',
    categoria: 'rejeitada',
    titulo: 'Valor do ICMS difere do produto BC e alíquota',
    mensagemAmigavel: 'Divergência no cálculo tributário do ICMS em um ou mais itens da NF-e.',
    acaoRecomendada: 'Revise CST/CSOSN e alíquotas fiscais dos produtos, regere a nota e retransmita.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '531': {
    cStat: '531',
    categoria: 'rejeitada',
    titulo: 'Total da BC ICMS difere do somatório dos itens',
    mensagemAmigavel: 'O total da base de cálculo de ICMS não bate com a soma dos itens.',
    acaoRecomendada: 'Regere o XML assinado e valide os parâmetros tributários antes de retransmitir.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '539': {
    cStat: '539',
    categoria: 'rejeitada',
    titulo: 'Duplicidade com diferença na chave de acesso',
    mensagemAmigavel: 'Este número e série já foram autorizados anteriormente com outra chave de acesso na SEFAZ.',
    acaoRecomendada: 'Corrija usando a opção de avançar o número da NF-e e retransmita.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: true,
  },
  '591': {
    cStat: '591',
    categoria: 'rejeitada',
    titulo: 'Ambiente de emissão divergente',
    mensagemAmigavel: 'O ambiente configurado no XML (`tpAmb`) não condiz com o serviço SEFAZ acionado.',
    acaoRecomendada: 'Verifique se a empresa está em Homologação ou Produção e regere a nota.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '594': {
    cStat: '594',
    categoria: 'rejeitada',
    titulo: 'Número de sequência do item inválido',
    mensagemAmigavel: 'A sequência de itens da NF-e apresentou numeração inválida ou saltada.',
    acaoRecomendada: 'Regere o XML assinado da NF-e e tente retransmitir.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '602': {
    cStat: '602',
    categoria: 'rejeitada',
    titulo: 'Total do PIS difere do somatório dos itens',
    mensagemAmigavel: 'Divergência entre o total de PIS e o somatório dos itens tributados.',
    acaoRecomendada: 'Ajuste os tributos dos produtos, regere a NF-e e retransmita.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '610': {
    cStat: '610',
    categoria: 'rejeitada',
    titulo: 'Total da NF difere do somatório dos valores',
    mensagemAmigavel: 'O valor total da NF-e (`vNF`) não confere com produtos, frete, descontos e tributos.',
    acaoRecomendada: 'Confira os valores dos itens/totais do pedido, regere o XML e retransmita.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '693': {
    cStat: '693',
    categoria: 'rejeitada',
    titulo: 'Alíquota de ICMS interestadual incompatível',
    mensagemAmigavel: 'Alíquota de ICMS interestadual ou CFOP incompatível com a UF de destino.',
    acaoRecomendada: 'Ajuste o CFOP (ex.: 5102 vs 6102) e os dados do destinatário, regere e retransmita.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '703': {
    cStat: '703',
    categoria: 'rejeitada',
    titulo: 'Data/hora de emissão posterior ao recebimento',
    mensagemAmigavel: 'O horário de emissão (`dhEmi`) está adiantado em relação ao relógio da SEFAZ.',
    acaoRecomendada: 'Regere a NF-e com o horário sincronizado e retransmita.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '778': {
    cStat: '778',
    categoria: 'rejeitada',
    titulo: 'NCM inexistente',
    mensagemAmigavel: 'O código NCM informado em um dos produtos não existe na tabela vigente da SEFAZ/TIPI.',
    acaoRecomendada: 'Corrija o NCM no cadastro do produto, regere a NF-e assinada e retransmita.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  // Eventos (Cancelamento / Carta de Correção) e Inutilização (Story 33f)
  '102': {
    cStat: '102',
    categoria: 'autorizada',
    titulo: 'Inutilização homologada',
    mensagemAmigavel: 'Numeração inutilizada e homologada pela SEFAZ.',
    acaoRecomendada: 'Arquive o XML procInutNFe para comprovação fiscal da faixa.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '128': {
    cStat: '128',
    categoria: 'em_processamento',
    titulo: 'Lote de evento processado',
    mensagemAmigavel: 'A SEFAZ processou o lote de eventos enviado.',
    acaoRecomendada: 'Leia o resultado específico dentro de <retEvento>.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '135': {
    cStat: '135',
    categoria: 'autorizada',
    titulo: 'Evento registrado e vinculado',
    mensagemAmigavel: 'Evento homologado pela SEFAZ e vinculado à NF-e.',
    acaoRecomendada: 'Arquive o protocolo e o XML procEventoNFe.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '136': {
    cStat: '136',
    categoria: 'autorizada',
    titulo: 'Evento registrado sem vinculação local',
    mensagemAmigavel: 'Evento registrado pela SEFAZ (cStat 136).',
    acaoRecomendada: 'Conserve o protocolo emitido pela SEFAZ.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '155': {
    cStat: '155',
    categoria: 'autorizada',
    titulo: 'Cancelamento homologado extemporâneo',
    mensagemAmigavel: 'Cancelamento homologado pela SEFAZ fora do prazo regular.',
    acaoRecomendada: 'Registre na contabilidade e arquive o procEventoNFe.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '206': {
    cStat: '206',
    categoria: 'rejeitada',
    titulo: 'Numeração já inutilizada',
    mensagemAmigavel: 'Este número já está inutilizado na SEFAZ.',
    acaoRecomendada: 'Avance para o próximo número sequencial disponível.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: true,
  },
  '218': {
    cStat: '218',
    categoria: 'rejeitada',
    titulo: 'NF-e já cancelada',
    mensagemAmigavel: 'Esta NF-e já foi cancelada anteriormente na SEFAZ.',
    acaoRecomendada: 'Sincronize a situação da NF-e via consulta de protocolo.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '220': {
    cStat: '220',
    categoria: 'rejeitada',
    titulo: 'Prazo de cancelamento excedido',
    mensagemAmigavel: 'O prazo legal para cancelamento desta NF-e encerrou.',
    acaoRecomendada: 'Avalie emissão de NF-e de devolução junto à contabilidade.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '256': {
    cStat: '256',
    categoria: 'rejeitada',
    titulo: 'Faixa já inutilizada',
    mensagemAmigavel: 'Parte desta faixa já consta inutilizada na SEFAZ.',
    acaoRecomendada: 'Informe somente números ainda não utilizados ou inutilizados.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '494': {
    cStat: '494',
    categoria: 'rejeitada',
    titulo: 'Chave inexistente para evento',
    mensagemAmigavel: 'Chave de acesso não encontrada na base da SEFAZ.',
    acaoRecomendada: 'Consulte a NF-e na SEFAZ antes de enviar o evento.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '501': {
    cStat: '501',
    categoria: 'rejeitada',
    titulo: 'Cancelamento fora do prazo (> 24h)',
    mensagemAmigavel: 'O cancelamento por evento superou o prazo de 24 horas após autorização.',
    acaoRecomendada: 'Para estornar a operação após 24h, emita NF-e de devolução com orientação contábil.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '563': {
    cStat: '563',
    categoria: 'rejeitada',
    titulo: 'Inutilização duplicada para a faixa',
    mensagemAmigavel: 'Já existe inutilização registrada para esta série e faixa.',
    acaoRecomendada: 'Consulte a tabela de inutilizações homologadas.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '573': {
    cStat: '573',
    categoria: 'rejeitada',
    titulo: 'Duplicidade de evento',
    mensagemAmigavel: 'Evento idêntico já registrado com a mesma sequência.',
    acaoRecomendada: 'Para nova Carta de Correção, incremente a sequência do evento.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
  '578': {
    cStat: '578',
    categoria: 'rejeitada',
    titulo: 'Data do evento adiantada',
    mensagemAmigavel: 'Data/hora do evento está adiantada perante o servidor SEFAZ.',
    acaoRecomendada: 'Sincronize o horário do servidor e envie novamente.',
    permiteReenvioMesmoNumero: true,
    sugereAvancarNumero: false,
  },
  '580': {
    cStat: '580',
    categoria: 'rejeitada',
    titulo: 'Nota precisa estar autorizada',
    mensagemAmigavel: 'O evento exige que a NF-e esteja autorizada na SEFAZ.',
    acaoRecomendada: 'Confirme a autorização da NF-e antes de enviar eventos.',
    permiteReenvioMesmoNumero: false,
    sugereAvancarNumero: false,
  },
};

export function interpretarCodigoSefaz(
  cStatInput: string | number | null | undefined,
  xMotivoOriginal?: string | null
): InterpretacaoCodigoSefaz {
  const cStat = String(cStatInput ?? '').trim();

  if (cStat && DICIONARIO_SEFAZ[cStat]) {
    return {
      ...DICIONARIO_SEFAZ[cStat],
      xMotivoOriginal: xMotivoOriginal ?? null,
    };
  }

  let categoria: CategoriaRetornoSefaz = 'rejeitada';
  if (cStat === '100' || cStat === '150' || cStat === '102' || cStat === '135' || cStat === '136' || cStat === '155') categoria = 'autorizada';
  else if (cStat === '103' || cStat === '105' || cStat === '128') categoria = 'em_processamento';
  else if (cStat === '107') categoria = 'servico_ativo';
  else if (cStat === '108' || cStat === '109') categoria = 'indisponivel';
  else if (cStat === '110' || cStat === '301' || cStat === '302' || cStat === '303') categoria = 'denegada';
  else if (cStat === '217') categoria = 'consulta_vazia';

  const motivoLimpo = (xMotivoOriginal || '').trim();
  const mensagemAmigavel = motivoLimpo
    ? `Retorno SEFAZ (${cStat || 'N/A'}): ${motivoLimpo}`
    : `Retorno SEFAZ não catalogado (código ${cStat || 'desconhecido'}).`;

  const isDuplicidade = cStat === '204' || cStat === '539';

  return {
    cStat: cStat || '000',
    categoria,
    titulo:
      categoria === 'autorizada'
        ? 'NF-e autorizada'
        : categoria === 'denegada'
          ? 'Uso denegado pela SEFAZ'
          : categoria === 'indisponivel'
            ? 'SEFAZ indisponível'
            : categoria === 'em_processamento'
              ? 'NF-e em processamento na SEFAZ'
              : `Rejeição SEFAZ (${cStat || 'N/A'})`,
    mensagemAmigavel,
    acaoRecomendada:
      categoria === 'rejeitada'
        ? 'Revise os dados fiscais indicados no motivo da SEFAZ, regere o XML assinado e retransmita.'
        : categoria === 'indisponivel'
          ? 'Aguarde alguns instantes e tente consultar ou retransmitir novamente.'
          : categoria === 'em_processamento'
            ? 'Consulte a situação na SEFAZ antes de tentar um novo envio.'
            : 'Consulte o motivo oficial retornado pela SEFAZ.',
    permiteReenvioMesmoNumero: categoria === 'rejeitada' && !isDuplicidade,
    sugereAvancarNumero: isDuplicidade,
    xMotivoOriginal: xMotivoOriginal ?? null,
  };
}

