import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema } from 'zod';

type ValidateTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidateTarget = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(result.error);
      return;
    }
    // Replace with parsed (coerced/defaulted) values
    (req as Record<string, unknown>)[target] = result.data;
    next();
  };
}
