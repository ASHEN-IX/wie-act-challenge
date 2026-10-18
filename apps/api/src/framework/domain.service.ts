import { Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { ContractParameterPipe } from './parameter.pipe';
import type { DomainDefinition, DomainRequest, DomainExecutor } from './contracts';
const { executeHandlers } = require('../../shared/domainContracts');
const { requestContext } = require('../../shared/requestContext');
@Injectable()
export class DomainService implements DomainExecutor {
  constructor(private readonly definition: DomainDefinition) {}
  async execute(key: string, req: DomainRequest, res: Response): Promise<void> {
    const operation = this.definition.operations.find((entry) => `${entry.method.toUpperCase()} ${entry.path}` === key);
    if (!operation) throw new NotFoundException();
    new ContractParameterPipe(operation).transform(req);
    await requestContext.run({ cookie: req.headers.cookie, identity: req.user }, () =>
      executeHandlers(
        [require('../../shared/operationPolicy').operationPolicy, ...operation.handlers],
        req,
        res
      )
    );
  }
}
