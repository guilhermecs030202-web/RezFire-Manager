import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[ERRO INTERNO]:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno no servidor RezFire.';

  return res.status(statusCode).json({
    sucesso: false,
    mensagem: message,
    erros: err.errors || undefined,
  });
}

