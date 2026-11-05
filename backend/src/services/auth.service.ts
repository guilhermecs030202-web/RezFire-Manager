import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { Usuario } from '../entities/Usuario';
import { env } from '../config/env';

export class AuthService {
  private get usuarioRepo() {
    return AppDataSource.getRepository(Usuario);
  }

  async login(email: string, senhaPlana: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { email: email.toLowerCase().trim() },
    });

    if (!usuario) {
      throw new Error('Credenciais inválidas. Verifique seu e-mail e senha.');
    }

    if (!usuario.ativo) {
      throw new Error('Usuário inativo. Entre em contato com o suporte.');
    }

    const senhaCorreta = await bcrypt.compare(senhaPlana, usuario.senha_hash);
    if (!senhaCorreta) {
      throw new Error('Credenciais inválidas. Verifique seu e-mail e senha.');
    }

    const payload = {
      id_usuario: usuario.id_usuario,
      email: usuario.email,
      nome: usuario.nome,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '7d', // Sessão de 7 dias para o gestor
    });

    return { usuario: payload, token };
  }

  async getProfile(id_usuario: number) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id_usuario },
      select: ['id_usuario', 'nome', 'email', 'ativo', 'created_at'],
    });

    if (!usuario) {
      throw new Error('Usuário não encontrado.');
    }

    return usuario;
  }
}

