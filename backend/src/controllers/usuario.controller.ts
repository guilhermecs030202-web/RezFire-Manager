import { Request, Response, NextFunction } from 'express';
import { UsuarioService } from '../services/usuario.service';

const usuarioService = new UsuarioService();

export class UsuarioController {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarios = await usuarioService.listar();
      return res.json({
        sucesso: true,
        usuarios,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async obterPorId(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const usuario = await usuarioService.obterPorId(id);
      return res.json({
        sucesso: true,
        usuario,
      });
    } catch (error: any) {
      return res.status(404).json({
        sucesso: false,
        mensagem: error.message || 'Usuário não encontrado.',
      });
    }
  }

  async criar(req: Request, res: Response, next: NextFunction) {
    try {
      const { nome, email, senha, perfil, ativo } = req.body;
      const novoUsuario = await usuarioService.criar({
        nome,
        email,
        senha,
        perfil,
        ativo,
      });

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Usuário cadastrado com sucesso.',
        usuario: novoUsuario,
      });
    } catch (error: any) {
      return res.status(400).json({
        sucesso: false,
        mensagem: error.message || 'Erro ao cadastrar usuário.',
      });
    }
  }

  async atualizar(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const { nome, email, senha, perfil, ativo } = req.body;

      const usuarioAtualizado = await usuarioService.atualizar(id, {
        nome,
        email,
        senha,
        perfil,
        ativo,
      });

      return res.json({
        sucesso: true,
        mensagem: 'Usuário atualizado com sucesso.',
        usuario: usuarioAtualizado,
      });
    } catch (error: any) {
      return res.status(400).json({
        sucesso: false,
        mensagem: error.message || 'Erro ao atualizar usuário.',
      });
    }
  }

  async alternarStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const idSolicitante = req.usuario?.id_usuario;

      const resultado = await usuarioService.alternarStatus(id, idSolicitante);
      return res.json({
        sucesso: true,
        ...resultado,
      });
    } catch (error: any) {
      return res.status(400).json({
        sucesso: false,
        mensagem: error.message || 'Erro ao alterar status do usuário.',
      });
    }
  }
}

