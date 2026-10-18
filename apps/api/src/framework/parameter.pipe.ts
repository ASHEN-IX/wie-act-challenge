import {
  Injectable,
  NotFoundException,
  PipeTransform,
  createParamDecorator,
  ExecutionContext
} from '@nestjs/common';
import type { DomainOperation, DomainRequest } from './contracts';
@Injectable()
export class ContractParameterPipe implements PipeTransform<DomainRequest> {
  constructor(private readonly operation: DomainOperation) {}
  transform(req: DomainRequest): DomainRequest {
    for (const match of this.operation.path.matchAll(/:(\w+)\(([^)]+)\)/g)) {
      if (!new RegExp('^(?:' + match[2] + ')$').test(String(req.params[match[1]])))
        throw new NotFoundException();
    }
    return req;
  }
}

export const ContractRequest = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  context.switchToHttp().getRequest<DomainRequest>()
);
