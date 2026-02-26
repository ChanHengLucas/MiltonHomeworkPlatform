import { Router, Request } from 'express';
import { listCourseAssignmentsForStudent } from '@planner/db';
import { requireAuth } from '../middleware/identity';

export const studentRouter = Router();

studentRouter.use(requireAuth);

studentRouter.get('/assignments', (req: Request, res) => {
  const assignments = listCourseAssignmentsForStudent(req.user!.email);
  res.json(assignments);
});
