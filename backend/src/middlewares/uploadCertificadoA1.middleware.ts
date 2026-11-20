import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';

const ALLOWED_EXTENSIONS = ['.pfx', '.p12'];
const MAX_CERT_BYTES = 5 * 1024 * 1024; // 5 MB

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_CERT_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de certificado não permitido. Envie um arquivo A1 nos formatos .pfx ou .p12.'));
    }
  },
});

export function handleUploadCertificadoA1(
  req: Request,
  res: Response,
  next: NextFunction
) {
  uploadMemory.single('certificado')(req, res, (err: any) => {
    if (err) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Arquivo do certificado excede o limite máximo de 5 MB.'
          : err.message || 'Falha ao receber arquivo de certificado A1.';
      return res.status(400).json({ sucesso: false, mensagem: msg });
    }
    return next();
  });
}

