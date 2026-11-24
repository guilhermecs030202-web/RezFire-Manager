import { Repository, QueryRunner } from 'typeorm';
import { z } from 'zod';
import { AppDataSource } from '../config/database';
import { Customer, CustomerSource } from '../entities/Customer';
import { Pedido } from '../entities/Pedido';

// ── Utilitários de Validação de Documentos Brasileiros ───────────────────
export function limparDocumento(doc?: string | null): string {
  if (!doc) return '';
  return doc.replace(/\D/g, '');
}

export function validarCpf(cpfRaw: string): boolean {
  const cpf = limparDocumento(cpfRaw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf.charAt(10), 10);
}

export function validarCnpj(cnpjRaw: string): boolean {
  const cnpj = limparDocumento(cnpjRaw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const b = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += parseInt(cnpj.charAt(i), 10) * b[i + 1];
  }
  let resto = soma % 11;
  const digito1 = resto < 2 ? 0 : 11 - resto;
  if (parseInt(cnpj.charAt(12), 10) !== digito1) return false;

  soma = 0;
  for (let i = 0; i < 13; i++) {
    soma += parseInt(cnpj.charAt(i), 10) * b[i];
  }
  resto = soma % 11;
  const digito2 = resto < 2 ? 0 : 11 - resto;
  return parseInt(cnpj.charAt(13), 10) === digito2;
}

export function validarCpfOuCnpj(doc?: string | null): boolean {
  if (!doc) return true; // campo opcional
  const limpo = limparDocumento(doc);
  if (limpo.length === 11) return validarCpf(limpo);
  if (limpo.length === 14) return validarCnpj(limpo);
  return false;
}

// ── Esquemas Zod ──────────────────────────────────────────────────────────
export const criarClientePresencialSchema = z.object({
  name: z.string().min(2, 'O nome deve ter no mínimo 2 caracteres').max(150),
  document: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((val) => !val || validarCpfOuCnpj(val), {
      message: 'CPF ou CNPJ inválido',
    }),
  email: z
    .string()
    .trim()
    .email('E-mail em formato inválido')
    .optional()
    .nullable()
    .or(z.literal('')),
  phone: z.string().trim().max(30).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(10).optional().nullable(),
  zipCode: z.string().trim().max(15).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const atualizarClienteSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  document: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((val) => !val || validarCpfOuCnpj(val), {
      message: 'CPF ou CNPJ inválido',
    }),
  email: z
    .string()
    .trim()
    .email('E-mail em formato inválido')
    .optional()
    .nullable()
    .or(z.literal('')),
  phone: z.string().trim().max(30).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(10).optional().nullable(),
  zipCode: z.string().trim().max(15).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export type CriarClientePresencialDTO = z.infer<typeof criarClientePresencialSchema>;
export type AtualizarClienteDTO = z.infer<typeof atualizarClienteSchema>;

export interface ListarClientesParams {
  page?: number;
  limit?: number;
  search?: string;
  source?: CustomerSource | 'ALL';
}

export interface CustomerListItem {
  id: number;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  notes: string | null;
  source: CustomerSource;
  externalId: string | null;
  createdAt: Date;
  updatedAt: Date;
  orderCount: number;
  lastOrderDate: Date | null;
}

export class CustomerService {
  private get customerRepo(): Repository<Customer> {
    return AppDataSource.getRepository(Customer);
  }

  private get pedidoRepo(): Repository<Pedido> {
    return AppDataSource.getRepository(Pedido);
  }

  /**
   * Lista clientes com paginação no servidor, busca e filtro de origem
   */
  async listar(params: ListarClientesParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const offset = (page - 1) * limit;

    const qb = this.customerRepo.createQueryBuilder('c');

    if (params.source && params.source !== 'ALL') {
      qb.andWhere('c.source = :source', { source: params.source });
    }

    if (params.search && params.search.trim()) {
      const termo = `%${params.search.trim()}%`;
      const docDigitos = limparDocumento(params.search);

      if (docDigitos.length > 0) {
        const termoNum = `%${docDigitos}%`;
        qb.andWhere(
          '(c.name LIKE :termo OR c.email LIKE :termo OR c.phone LIKE :termo OR c.document LIKE :termo OR REPLACE(REPLACE(REPLACE(c.document, ".", ""), "-", ""), "/", "") LIKE :termoNum)',
          { termo, termoNum }
        );
      } else {
        qb.andWhere(
          '(c.name LIKE :termo OR c.email LIKE :termo OR c.phone LIKE :termo OR c.document LIKE :termo)',
          { termo }
        );
      }
    }

    // Ordenação padrão: cliente mais recente primeiro
    qb.orderBy('c.createdAt', 'DESC');

    const total = await qb.getCount();
    const customers = await qb.skip(offset).take(limit).getMany();

    // Enriquecimento com contagem de pedidos e data do último pedido
    const customerIds = customers.map((c) => c.id);
    const orderStatsMap = new Map<number, { count: number; lastDate: Date | null }>();

    if (customerIds.length > 0) {
      const stats = await this.pedidoRepo
        .createQueryBuilder('p')
        .select('p.id_cliente', 'id_cliente')
        .addSelect('COUNT(p.id_pedido)', 'orderCount')
        .addSelect('MAX(p.data_pedido)', 'lastOrderDate')
        .where('p.id_cliente IN (:...ids)', { ids: customerIds })
        .groupBy('p.id_cliente')
        .getRawMany();

      for (const st of stats) {
        orderStatsMap.set(Number(st.id_cliente), {
          count: Number(st.orderCount) || 0,
          lastDate: st.lastOrderDate ? new Date(st.lastOrderDate) : null,
        });
      }
    }

    const data: CustomerListItem[] = customers.map((c) => {
      const st = orderStatsMap.get(c.id) || { count: 0, lastDate: null };
      return {
        id: c.id,
        name: c.name,
        document: c.document,
        email: c.email,
        phone: c.phone,
        city: c.city,
        state: c.state,
        zipCode: c.zipCode,
        notes: c.notes,
        source: c.source,
        externalId: c.externalId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        orderCount: st.count,
        lastOrderDate: st.lastDate,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      page,
      limit,
      total,
      totalPages,
    };
  }

  /**
   * Busca detalhes do cliente por ID com pedidos associados
   */
  async buscarPorId(id: number) {
    const customer = await this.customerRepo.findOne({
      where: { id },
      relations: ['pedidos'],
    });

    if (!customer) {
      return null;
    }

    // Ordena pedidos por data decrescente
    const pedidosOrdenados = (customer.pedidos || []).sort(
      (a, b) => new Date(b.data_pedido).getTime() - new Date(a.data_pedido).getTime()
    );

    return {
      ...customer,
      pedidos: pedidosOrdenados,
      orderCount: pedidosOrdenados.length,
      lastOrderDate: pedidosOrdenados.length > 0 ? pedidosOrdenados[0].data_pedido : null,
    };
  }

  /**
   * Cadastra cliente presencial com validação e checagem de duplicidade
   */
  async criarPresencial(dados: CriarClientePresencialDTO) {
    const validado = criarClientePresencialSchema.parse(dados);

    const docLimpo = validado.document ? limparDocumento(validado.document) : null;
    const emailLimpo = validado.email?.trim() || null;

    // Checagem de duplicidade por documento
    if (docLimpo) {
      const existenteDoc = await this.customerRepo
        .createQueryBuilder('c')
        .where('REPLACE(REPLACE(REPLACE(c.document, ".", ""), "-", ""), "/", "") = :doc', {
          doc: docLimpo,
        })
        .getOne();

      if (existenteDoc) {
        throw new Error(
          `Já existe um cliente cadastrado com este documento (${existenteDoc.name} - Origem: ${existenteDoc.source}).`
        );
      }
    }

    // Checagem de duplicidade por e-mail se informado
    if (emailLimpo) {
      const existenteEmail = await this.customerRepo.findOne({
        where: { email: emailLimpo },
      });

      if (existenteEmail) {
        throw new Error(
          `Já existe um cliente cadastrado com o e-mail "${emailLimpo}" (${existenteEmail.name}).`
        );
      }
    }

    const novo = this.customerRepo.create({
      name: validado.name.trim(),
      document: validado.document ? validado.document.trim() : null,
      email: emailLimpo,
      phone: validado.phone ? validado.phone.trim() : null,
      city: validado.city ? validado.city.trim() : null,
      state: validado.state ? validado.state.trim().toUpperCase() : null,
      zipCode: validado.zipCode ? validado.zipCode.trim() : null,
      notes: validado.notes ? validado.notes.trim() : null,
      source: 'PRESENCIAL',
      externalId: null,
    });

    return await this.customerRepo.save(novo);
  }

  /**
   * Atualiza cliente existente (para ML apenas observações são editáveis)
   */
  async atualizar(id: number, dados: AtualizarClienteDTO) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) {
      throw new Error('Cliente não encontrado.');
    }

    const validado = atualizarClienteSchema.parse(dados);

    // Clientes do Mercado Livre possuem dados sincronizados como somente leitura;
    // apenas observações internas podem ser editadas
    if (customer.source === 'MERCADO_LIVRE') {
      if (validado.notes !== undefined) {
        customer.notes = validado.notes ? validado.notes.trim() : null;
      }
      return await this.customerRepo.save(customer);
    }

    // Para clientes presenciais:
    if (validado.document !== undefined) {
      const docLimpo = validado.document ? limparDocumento(validado.document) : null;
      if (docLimpo) {
        const duplicado = await this.customerRepo
          .createQueryBuilder('c')
          .where('c.id != :id', { id })
          .andWhere(
            'REPLACE(REPLACE(REPLACE(c.document, ".", ""), "-", ""), "/", "") = :doc',
            { doc: docLimpo }
          )
          .getOne();

        if (duplicado) {
          throw new Error(
            `Já existe outro cliente cadastrado com este documento (${duplicado.name}).`
          );
        }
      }
      customer.document = validado.document ? validado.document.trim() : null;
    }

    if (validado.email !== undefined) {
      const emailLimpo = validado.email?.trim() || null;
      if (emailLimpo) {
        const duplicado = await this.customerRepo
          .createQueryBuilder('c')
          .where('c.id != :id', { id })
          .andWhere('c.email = :email', { email: emailLimpo })
          .getOne();

        if (duplicado) {
          throw new Error(`Já existe outro cliente com o e-mail "${emailLimpo}".`);
        }
      }
      customer.email = emailLimpo;
    }

    if (validado.name !== undefined) customer.name = validado.name.trim();
    if (validado.phone !== undefined) customer.phone = validado.phone ? validado.phone.trim() : null;
    if (validado.city !== undefined) customer.city = validado.city ? validado.city.trim() : null;
    if (validado.state !== undefined) customer.state = validado.state ? validado.state.trim().toUpperCase() : null;
    if (validado.zipCode !== undefined) customer.zipCode = validado.zipCode ? validado.zipCode.trim() : null;
    if (validado.notes !== undefined) customer.notes = validado.notes ? validado.notes.trim() : null;

    return await this.customerRepo.save(customer);
  }

  /**
   * Registro ou atualização automática de cliente oriundo de pedido do Mercado Livre (Upsert)
   * Idempotente: se já existir externalId, vincula e não duplica.
   */
  async upsertCustomerFromMercadoLivre(orderData: any, queryRunner?: QueryRunner): Promise<Customer> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(Customer)
      : this.customerRepo;

    const buyer = orderData.buyer || {};
    const shipping = orderData.shipping || {};
    const receiverAddress = shipping.receiver_address || {};

    const buyerId = String(buyer.id || buyer.nickname || orderData.id || '').trim();
    if (!buyerId) {
      throw new Error('Identificador do comprador no Mercado Livre não fornecido.');
    }

    // Extração do nome completo ou nickname
    let buyerName = 'Cliente Mercado Livre';
    if (buyer.first_name || buyer.last_name) {
      buyerName = `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim();
      if (buyer.nickname) {
        buyerName += ` (${buyer.nickname})`;
      }
    } else if (buyer.nickname) {
      buyerName = buyer.nickname;
    } else if (orderData.cliente_nome) {
      buyerName = orderData.cliente_nome;
    }

    const documentNumber = buyer.billing_info?.doc_number || null;
    const email = buyer.email || null;

    let phone: string | null = null;
    if (buyer.phone) {
      const area = buyer.phone.area_code ? `(${buyer.phone.area_code}) ` : '';
      const num = buyer.phone.number || '';
      phone = `${area}${num}`.trim() || null;
    }

    const city = receiverAddress.city?.name || receiverAddress.city || null;
    const state = receiverAddress.state?.id || receiverAddress.state?.name || receiverAddress.state || null;
    const zipCode = receiverAddress.zip_code || null;

    // 1. Procura por externalId (identificador único no ML)
    let customer = await repo.findOne({ where: { externalId: buyerId } });

    if (customer) {
      // Atualiza campos cadastrais sincronizados que porventura tenham chegado mais completos
      let mudou = false;
      if (!customer.phone && phone) {
        customer.phone = phone;
        mudou = true;
      }
      if (!customer.document && documentNumber) {
        customer.document = documentNumber;
        mudou = true;
      }
      if (!customer.city && city) {
        customer.city = city;
        mudou = true;
      }
      if (!customer.state && state) {
        customer.state = state;
        mudou = true;
      }
      if (!customer.zipCode && zipCode) {
        customer.zipCode = zipCode;
        mudou = true;
      }

      if (mudou) {
        await repo.save(customer);
      }

      return customer;
    }

    // 2. Se não encontrou por externalId, cria novo cliente com source = 'MERCADO_LIVRE'
    const novoCustomer = repo.create({
      name: buyerName,
      document: documentNumber,
      email: email,
      phone: phone,
      city: city,
      state: state,
      zipCode: zipCode,
      notes: `Importado automaticamente via pedido Mercado Livre [ID Pedido: ${orderData.id || ''}]`,
      source: 'MERCADO_LIVRE',
      externalId: buyerId,
    });

    return await repo.save(novoCustomer);
  }
}
