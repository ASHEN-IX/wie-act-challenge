export function trustedOrigins(): string[];
export function getAuth(): Promise<any>;
export function closeAuth(): Promise<void>;
export function createExpressHandler(options?: any): any;
export function getBetterAuthSession(req: any): Promise<any>;
