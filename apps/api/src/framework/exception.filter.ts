import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import type { DomainRequest } from './contracts';
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    if (res.headersSent) return;
    if (error instanceof HttpException) {
      res.status(error.getStatus()).json({ error: error.message });
      return;
    }
    require('../../shared/middleware').errorHandler(
      error,
      http.getRequest<DomainRequest>(),
      res,
      () => {}
    );
  }
}
