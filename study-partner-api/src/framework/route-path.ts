/** Nest/Express 5 paths cannot contain inline regex. Domain dispatch retains
 * the original path; ContractParameterPipe enforces its parameter constraints.
 */
export function publicRoutePath(contractPath: string): string {
  return contractPath.replace(/:(\w+)\(([^)]+)\)/g, ':$1');
}
