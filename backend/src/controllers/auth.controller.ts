import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, senha } = req.body;

      if (!email || !senha) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'E-mail e senha são obrigatórios.',
        });
      }

      const { usuario, token } = await authService.login(email, senha);

      // Define cookie HttpOnly seguro para a sessão
      res.cookie('rezfire_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
      });

      return res.json({
        sucesso: true,
        mensagem: 'Login realizado com sucesso.',
        usuario,
        token, // Enviado também no corpo caso o cliente opte por header Bearer
      });
    } catch (error: any) {
      return res.status(401).json({
        sucesso: false,
        mensagem: error.message || 'Erro ao realizar login.',
      });
    }
  }

  async logout(req: Request, res: Response) {
    res.clearCookie('rezfire_token');
    return res.json({
      sucesso: true,
      mensagem: 'Logout realizado com sucesso.',
    });
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.usuario) {
        return res.status(401).json({
          sucesso: false,
          mensagem: 'Não autenticado.',
        });
      }

      const usuario = await authService.getProfile(req.usuario.id_usuario);
      return res.json({
        sucesso: true,
        usuario,
      });
    } catch (error: any) {
      return res.status(404).json({
        sucesso: false,
        mensagem: error.message,
      });
    }
  }
}

