import { Request, Response } from 'express';
import { z } from 'zod';
import { FreteCotacaoService } from '../services/freteCotacao.service';

const freteCotacaoService = new FreteCotacaoService();

const freteConfiguracaoSchema = z.object({
  freteTaxaPercentualPadrao: z
    .number({ invalid_type_error: 'A taxa percentual padrão deve ser numérica.' })
    .finite('Informe uma taxa percentual válida.')
    .min(0, 'A taxa percentual não pode ser negativa.')
    .refine((freteVal) => freteVal < 100, {
      message: 'A taxa percentual deve ser menor que 100%.',
    }),
  freteTransportadoraPadrao: z
    .string()
    .trim()
    .max(80, 'A transportadora padrão deve ter no máximo 80 caracteres.')
    .nullable()
    .optional(),
});

const freteSimulacaoSchema = z.object({
  freteCepDestino: z.string(),
  freteValorOriginal: z.number().finite().positive(),
  fretePrazoDiasUteis: z.number().int().positive(),
  freteTaxaPercentual: z
    .number()
    .finite()
    .min(0)
    .refine((freteVal) => freteVal < 100, {
      message: 'A taxa percentual deve ser menor que 100%.',
    })
    .optional(),
  freteCustoGasolina: z.number().finite().min(0).optional(),
  freteQuantidadeUnidades: z.number().int().positive().optional(),
  freteTransportadora: z.string().max(80).nullable().optional(),
  freteClienteNome: z.string().max(150).nullable().optional(),
  freteClienteEndereco: z.string().max(300).nullable().optional(),
  freteTipoMensagem: z.enum(['padrao', 'direta']),
});

export class FreteCotacaoController {
  async obterFreteConfiguracoes(req: Request, res: Response) {
    try {
      const freteConfiguracao = await freteCotacaoService.obterFreteConfiguracao();
      const fretePerfilUsuario = (req.usuario?.perfil || 'GESTOR').toUpperCase();

      return res.json({
        sucesso: true,
        freteConfiguracao,
        fretePodeEditarTaxa: fretePerfilUsuario === 'GESTOR',
      });
    } catch (error: any) {
      return res.status(500).json({
        sucesso: false,
        mensagem: error?.message || 'Não foi possível carregar as configurações de frete.',
      });
    }
  }

  async atualizarFreteConfiguracoes(req: Request, res: Response) {
    try {
      const freteParse = freteConfiguracaoSchema.safeParse(req.body);
      if (!freteParse.success) {
        const fretePrimeiraMensagem =
          freteParse.error.errors[0]?.message || 'Parâmetros inválidos para configuração de frete.';
        return res.status(400).json({
          sucesso: false,
          mensagem: fretePrimeiraMensagem,
          erros: freteParse.error.flatten().fieldErrors,
        });
      }

      const freteConfiguracao = await freteCotacaoService.atualizarFreteConfiguracao(
        {
          freteTaxaPercentualPadrao: freteParse.data.freteTaxaPercentualPadrao,
          freteTransportadoraPadrao: freteParse.data.freteTransportadoraPadrao,
        },
        req.usuario?.id_usuario ?? null
      );

      return res.json({
        sucesso: true,
        mensagem: 'Configuração padrão de frete atualizada com sucesso.',
        freteConfiguracao,
      });
    } catch (error: any) {
      return res.status(400).json({
        sucesso: false,
        mensagem: error?.message || 'Não foi possível atualizar a configuração padrão de frete.',
      });
    }
  }

  async calcularFreteStateless(req: Request, res: Response) {
    try {
      const freteParse = freteSimulacaoSchema.safeParse(req.body);
      if (!freteParse.success) {
        const fretePrimeiraMensagem =
          freteParse.error.errors[0]?.message || 'Dados inválidos para cálculo de frete.';
        return res.status(400).json({
          sucesso: false,
          mensagem: fretePrimeiraMensagem,
          erros: freteParse.error.flatten().fieldErrors,
        });
      }

      const fretePerfilUsuario = (req.usuario?.perfil || 'GESTOR').toUpperCase();
      const freteConfigAtual = await freteCotacaoService.obterFreteConfiguracao();

      // Apenas o perfil GESTOR pode sobrescrever a taxa percentual; OPERADOR sempre utiliza a taxa padrão configurada.
      const freteTaxaAplicada =
        fretePerfilUsuario === 'GESTOR' && freteParse.data.freteTaxaPercentual !== undefined
          ? freteParse.data.freteTaxaPercentual
          : freteConfigAtual.freteTaxaPercentualPadrao;

      const freteResultado = freteCotacaoService.simularFreteCotacao({
        ...freteParse.data,
        freteTaxaPercentual: freteTaxaAplicada,
      });

      return res.json({
        sucesso: true,
        ...freteResultado,
      });
    } catch (error: any) {
      return res.status(error?.statusCode || 400).json({
        sucesso: false,
        mensagem: error?.message || 'Não foi possível calcular o frete.',
        erros: error?.errors,
      });
    }
  }
}
