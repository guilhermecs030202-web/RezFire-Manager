import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthenticatedUser {
  id_usuario: number;
  email: string;
  nome: string;
  perfil?: string;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: AuthenticatedUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Tenta obter o token via cookie seguro HttpOnly
  let token = req.cookies?.rezfire_token;

  // 2. Fallback para header Authorization Bearer se cookie não estiver presente
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      sucesso: false,
      mensagem: 'Acesso não autorizado. Faça login para continuar.',
    });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
    req.usuario = {
      id_usuario: payload.id_usuario,
      email: payload.email,
      nome: payload.nome,
      perfil: payload.perfil || 'GESTOR',
    };
    return next();
  } catch (error) {
    return res.status(401).json({
      sucesso: false,
      mensagem: 'Sessão inválida ou expirada. Faça login novamente.',
    });
  }
}

/**
 * Middleware de autorização baseado em perfis (RBAC - Role-Based Access Control)
 * Garante que apenas usuários com os perfis informados consigam acessar o endpoint.
 */
export function requerPerfil(perfisPermitidos: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) {
      return res.status(401).json({
        sucesso: false,
        mensagem: 'Não autenticado.',
      });
    }

    const perfilUsuario = req.usuario.perfil || 'GESTOR';
    if (!perfisPermitidos.includes(perfilUsuario)) {
      return res.status(403).json({
        sucesso: false,
        mensagem: `Acesso negado: o perfil '${perfilUsuario}' não tem permissão para acessar esta funcionalidade.`,
      });
    }

    return next();
  };
}

