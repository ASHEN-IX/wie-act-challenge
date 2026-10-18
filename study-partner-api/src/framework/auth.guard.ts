import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { DomainRequest } from './contracts';
@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<DomainRequest>();
    if (req.path === '/api/v1/auth/stripe/config' || req.path === '/api/v1/auth/stripe/webhook')
      return true;
    if (
      process.env.INTERNAL_API_SECRET &&
      req.headers['x-internal-secret'] === process.env.INTERNAL_API_SECRET
    )
      return true;
    const auth = await require('../../shared/sessionIdentity').resolveIdentity(req.headers);
    if (!auth) throw new UnauthorizedException('Authentication required');
    req.user = auth.identity;
    req.auth = auth;
    return true;
  }
}
