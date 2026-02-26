import { randomUUID } from 'crypto';

import { Router } from 'express';
import { z } from 'zod';
import {
  listAvailabilityBlocks,
  createAvailabilityBlock,
  deleteAvailabilityBlock,
} from '@planner/db';

const createBodySchema = z.object({
  startMin: z.number().int().min(0),
  endMin: z.number().int().min(0),
});

export const availabilityRouter = Router();

availabilityRouter.get('/', (_req, res) => {
  const blocks = listAvailabilityBlocks();
  res.json(blocks);
});

availabilityRouter.post('/', (req, res, next) => {
  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    return next(err);
  }

  const { startMin, endMin } = parsed.data;
  if (endMin <= startMin) {
    const err = new Error('endMin must be greater than startMin') as Error & { statusCode?: number };
    err.statusCode = 400;
    return next(err);
  }

  const block = {
    id: randomUUID(),
    startMin,
    endMin,
  };

  createAvailabilityBlock(block);
  res.status(201).json(block);
});

availabilityRouter.delete('/:id', (req, res) => {
  deleteAvailabilityBlock(req.params.id);
  res.status(204).send();
});
