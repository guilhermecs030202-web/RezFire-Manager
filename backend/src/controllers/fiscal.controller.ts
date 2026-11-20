import { Request, Response } from 'express';
import { FiscalService } from '../services/fiscal.service';

const fiscalService = new FiscalService();

export class FiscalController {
  async obterEmitente(_req: Request, res: Response) {
    try {
      const emitente = await fiscalService.obterEmitente();
      return res.json({
        sucesso: true,
        configurado: Boolean(emitente),
        emitente,
      });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async salvarEmitente(req: Request, res: Response) {
    try {
      const idUsuario = req.usuario?.id_usuario;
      const emitente = await fiscalService.salvarEmitente(req.body, idUsuario);
      return res.json({
        sucesso: true,
        mensagem: 'Configuração do emitente fiscal salva com sucesso.',
        emitente,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async alterarAmbiente(req: Request, res: Response) {
    try {
      const { ambiente, confirmacao_producao, texto_confirmacao } = req.body;
      const idUsuario = req.usuario?.id_usuario;
      const emitente = await fiscalService.alterarAmbiente(
        ambiente,
        confirmacao_producao,
        texto_confirmacao,
        idUsuario
      );
      return res.json({
        sucesso: true,
        mensagem:
          ambiente === 'producao'
            ? 'Ambiente fiscal alterado para PRODUÇÃO mediante confirmação explícita.'
            : 'Ambiente fiscal configurado para HOMOLOGAÇÃO (testes SEFAZ).',
        emitente,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async uploadCertificadoA1(req: Request, res: Response) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'Nenhum arquivo de certificado (.pfx ou .p12) foi enviado.',
        });
      }

      const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
      const emitente = await fiscalService.instalarCertificadoA1(req.file.buffer, senha);

      // Limpa referências em memória imediatamente após processamento
      req.file.buffer.fill(0);
      if (req.body && 'senha' in req.body) {
        req.body.senha = '';
      }

      return res.json({
        sucesso: true,
        mensagem: 'Certificado digital A1 validado e armazenado com criptografia AES-256-GCM.',
        emitente,
      });
    } catch (error: any) {
      if (req.file?.buffer) {
        req.file.buffer.fill(0);
      }
      if (req.body && 'senha' in req.body) {
        req.body.senha = '';
      }
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async removerCertificadoA1(_req: Request, res: Response) {
    try {
      const emitente = await fiscalService.removerCertificadoA1();
      return res.json({
        sucesso: true,
        mensagem: 'Certificado digital A1 removido com segurança.',
        emitente,
      });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterReferencias(_req: Request, res: Response) {
    try {
      const referencias = fiscalService.obterReferenciasFiscais();
      return res.json({ sucesso: true, ...referencias });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async listarPendenciasProdutos(_req: Request, res: Response) {
    try {
      const relatorio = await fiscalService.listarPendenciasFiscaisProdutos();
      return res.json({ sucesso: true, ...relatorio });
    } catch (error: any) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }

  async validarEmissao(req: Request, res: Response) {
    try {
      const resultado = await fiscalService.validarProntidaoEmissao(req.body || {});
      const status = resultado.apto ? 200 : 422;
      return res.status(status).json({ sucesso: resultado.apto, ...resultado });
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async obterNFeDoPedido(req: Request, res: Response) {
    try {
      const idPedido = Number(req.params.id);
      const resultado = await fiscalService.obterNFeDoPedido(idPedido);
      return res.json({ sucesso: true, ...resultado });
    } catch (error: any) {
      return res.status(404).json({ sucesso: false, mensagem: error.message });
    }
  }

  async prepararNFePedido(req: Request, res: Response) {
    try {
      const idPedido = Number(req.params.id);
      const regerar = Boolean(req.body?.regerar);
      const avancarNumero = Boolean(req.body?.avancar_numero);
      const resultado = await fiscalService.prepararNFePedido(idPedido, {
        regerar,
        avancar_numero: avancarNumero,
      });

      if (resultado.bloqueado) {
        return res.status(422).json(resultado);
      }

      const status = resultado.criada ? 201 : 200;
      return res.status(status).json(resultado);
    } catch (error: any) {
      return res.status(400).json({ sucesso: false, mensagem: error.message });
    }
  }

  async baixarXmlNota(req: Request, res: Response) {
    try {
      const idNota = Number(req.params.id);
      const nota = await fiscalService.obterXmlAssinadoPorNota(idNota);
      const conteudoXml = nota.xml_autorizado || nota.xml_assinado;
      const sufixo = nota.xml_autorizado ? '-procNFe' : '';
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="NFe-${nota.chave_acesso || nota.numero}${sufixo}.xml"`
      );
      return res.send(conteudoXml);
    } catch (error: any) {
      return res.status(404).json({ sucesso: false, mensagem: error.message });
    }
  }

  async transmitirNFePedido(req: Request, res: Response) {
    try {
      const idPedido = Number(req.params.id);
      const idUsuario = req.usuario?.id_usuario;
      const resultado = await fiscalService.transmitirNFePedido(
        idPedido,
        {
          cenario_teste: req.body?.cenario_teste,
          cenario_consulta_previa: req.body?.cenario_consulta_previa,
          cstat_simulado: req.body?.cstat_simulado,
          xmotivo_simulado: req.body?.xmotivo_simulado,
          modo_transporte: req.body?.modo_transporte,
        },
        idUsuario
      );

      if (resultado.indisponivel) {
        return res.status(503).json(resultado);
      }

      return res.json(resultado);
    } catch (error: any) {
      const status = error.statusCode || 400;
      return res.status(status).json({ sucesso: false, mensagem: error.message });
    }
  }

  async consultarSituacaoNFePedido(req: Request, res: Response) {
    try {
      const idPedido = Number(req.params.id);
      const idUsuario = req.usuario?.id_usuario;
      const resultado = await fiscalService.consultarSituacaoNFePedido(
        idPedido,
        {
          cenario_teste: req.body?.cenario_teste,
          cstat_simulado: req.body?.cstat_simulado,
          xmotivo_simulado: req.body?.xmotivo_simulado,
          modo_transporte: req.body?.modo_transporte,
        },
        idUsuario
      );

      if (resultado.indisponivel) {
        return res.status(503).json(resultado);
      }

      return res.json(resultado);
    } catch (error: any) {
      const status = error.statusCode || 400;
      return res.status(status).json({ sucesso: false, mensagem: error.message });
    }
  }

  async listarTransmissoesDoPedido(req: Request, res: Response) {
    try {
      const idPedido = Number(req.params.id);
      const resultado = await fiscalService.listarTransmissoesDoPedido(idPedido);
      return res.json(resultado);
    } catch (error: any) {
      return res.status(404).json({ sucesso: false, mensagem: error.message });
    }
  }

  async verificarStatusServicoSefaz(req: Request, res: Response) {
    try {
      const cenarioTeste =
        typeof req.query?.cenario_teste === 'string'
          ? (req.query.cenario_teste as any)
          : undefined;
      const modoTransporte =
        typeof req.query?.modo_transporte === 'string'
          ? (req.query.modo_transporte as any)
          : undefined;
      const resultado = await fiscalService.verificarStatusServicoSefaz({
        cenario_teste: cenarioTeste,
        modo_transporte: modoTransporte,
      });

      if (resultado.indisponivel) {
        return res.status(503).json(resultado);
      }

      return res.json(resultado);
    } catch (error: any) {
      const status = error.statusCode || 400;
      return res.status(status).json({ sucesso: false, mensagem: error.message });
    }
  }
}

