import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const validate = (schema: z.ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as { body?: any; query?: any; params?: any };

      // Use Object.assign instead of direct assignment
      if (parsed.body !== undefined) {
        // Clear existing body and assign new values
        Object.keys(req.body).forEach(key => delete req.body[key]);
        Object.assign(req.body, parsed.body);
      }
      
      if (parsed.query !== undefined) {
        Object.keys(req.query).forEach(key => delete req.query[key]);
        Object.assign(req.query, parsed.query);
      }
      
      if (parsed.params !== undefined) {
        Object.keys(req.params).forEach(key => delete req.params[key]);
        Object.assign(req.params, parsed.params);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};