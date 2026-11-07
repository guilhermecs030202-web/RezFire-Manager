import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database';
import { Usuario } from '../entities/Usuario';

export interface CriarUsuarioDTO {
  nome: string;
  email: string;
  senha: string;
  perfil?: 'GESTOR' | 'OPERADOR' | string;
  ativo?: boolean;
}

export interface AtualizarUsuarioDTO {
  nome?: string;
  email?: string;
  senha?: string;
  perfil?: 'GESTOR' | 'OPERADOR' | string;
  ativo?: boolean;
}

export class UsuarioService {
  private get usuarioRepo() {
    return AppDataSource.getRepository(Usuario);
  }

  /**
   * Lista todos os usuários cadastrados omitindo a senha_hash
   */
  async listar() {
    return this.usuarioRepo.find({
      select: ['id_usuario', 'nome', 'email', 'perfil', 'ativo', 'created_at'],
      order: { id_usuario: 'ASC' },
    });
  }

  /**
   * Obtém detalhes de um usuário específico
   */
  async obterPorId(id_usuario: number) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id_usuario },
      select: ['id_usuario', 'nome', 'email', 'perfil', 'ativo', 'created_at'],
    });

    if (!usuario) {
      throw new Error('Usuário não encontrado.');
    }

    return usuario;
  }

  /**
   * Cria um novo usuário com senha criptografada (bcrypt) e perfil definido
   */
  async criar(dados: CriarUsuarioDTO) {
    const { nome, email, senha, perfil = 'OPERADOR', ativo = true } = dados;

    if (!nome || !nome.trim()) {
      throw new Error('O nome do usuário é obrigatório.');
    }

    if (!email || !email.trim()) {
      throw new Error('O e-mail do usuário é obrigatório.');
    }

    if (!senha || senha.length < 6) {
      throw new Error('A senha deve ter no mínimo 6 caracteres.');
    }

    const emailLimpo = email.toLowerCase().trim();

    // Verifica se já existe usuário com o mesmo e-mail
    const existente = await this.usuarioRepo.findOne({
      where: { email: emailLimpo },
    });

    if (existente) {
      throw new Error('Já existe um usuário cadastrado com este e-mail.');
    }

    const perfilValido = (perfil.toUpperCase() === 'GESTOR') ? 'GESTOR' : 'OPERADOR';
    const saltRounds = 10;
    const senha_hash = await bcrypt.hash(senha, saltRounds);

    const novoUsuario = this.usuarioRepo.create({
      nome: nome.trim(),
      email: emailLimpo,
      senha_hash,
      perfil: perfilValido,
      ativo: Boolean(ativo),
    });

    const salvo = await this.usuarioRepo.save(novoUsuario);

    return {
      id_usuario: salvo.id_usuario,
      nome: salvo.nome,
      email: salvo.email,
      perfil: salvo.perfil,
      ativo: salvo.ativo,
      created_at: salvo.created_at,
    };
  }

  /**
   * Atualiza dados de um usuário existente
   */
  async atualizar(id_usuario: number, dados: AtualizarUsuarioDTO) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id_usuario },
    });

    if (!usuario) {
      throw new Error('Usuário não encontrado para atualização.');
    }

    if (dados.nome && dados.nome.trim()) {
      usuario.nome = dados.nome.trim();
    }

    if (dados.email && dados.email.trim()) {
      const emailLimpo = dados.email.toLowerCase().trim();
      if (emailLimpo !== usuario.email) {
        const existente = await this.usuarioRepo.findOne({
          where: { email: emailLimpo },
        });
        if (existente && existente.id_usuario !== id_usuario) {
          throw new Error('Este e-mail já está em uso por outro usuário.');
        }
        usuario.email = emailLimpo;
      }
    }

    if (dados.perfil) {
      usuario.perfil = (dados.perfil.toUpperCase() === 'GESTOR') ? 'GESTOR' : 'OPERADOR';
    }

    if (typeof dados.ativo === 'boolean') {
      usuario.ativo = dados.ativo;
    }

    if (dados.senha && dados.senha.trim()) {
      if (dados.senha.length < 6) {
        throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
      }
      usuario.senha_hash = await bcrypt.hash(dados.senha, 10);
    }

    const atualizado = await this.usuarioRepo.save(usuario);

    return {
      id_usuario: atualizado.id_usuario,
      nome: atualizado.nome,
      email: atualizado.email,
      perfil: atualizado.perfil,
      ativo: atualizado.ativo,
      created_at: atualizado.created_at,
    };
  }

  /**
   * Desativa ou ativa um usuário (soft delete).
   * Impede que o usuário logado desative a si próprio.
   */
  async alternarStatus(id_usuario: number, idUsuarioSolicitante?: number) {
    if (idUsuarioSolicitante && idUsuarioSolicitante === id_usuario) {
      throw new Error('Não é permitido desativar sua própria conta de gestor.');
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id_usuario },
    });

    if (!usuario) {
      throw new Error('Usuário não encontrado.');
    }

    usuario.ativo = !usuario.ativo;
    await this.usuarioRepo.save(usuario);

    return {
      id_usuario: usuario.id_usuario,
      nome: usuario.nome,
      ativo: usuario.ativo,
      mensagem: `Usuário ${usuario.ativo ? 'ativado' : 'desativado'} com sucesso.`,
    };
  }
}
