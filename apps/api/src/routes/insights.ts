import { Router, Request, Response, NextFunction } from 'express';
import { getRequestsSummary, getInsightsStats, listReports } from '@planner/db';
import { isTeacherEligible } from '../utils/identity';

export const insightsRouter = Router();

function requireTeacher(req: Request, res: Response, next: NextFunction): void {
  const email = (req.headers['x-user-email'] as string)?.trim() || '';
  const userEmail = email.toLowerCase();
  if (!userEmail || !isTeacherEligible(userEmail)) {
    res.status(403).json({ error: 'Teacher dashboard only. Access restricted.' });
    return;
  }
  next();
}

insightsRouter.use(requireTeacher);

insightsRouter.get('/requests-summary', (_req, res) => {
  const summary = getRequestsSummary();
  res.json(summary);
});

insightsRouter.get('/stats', (_req, res) => {
  const stats = getInsightsStats();
  res.json(stats);
});

insightsRouter.get('/reports', (_req, res) => {
  const { reports, countsByReportedEmail } = listReports();
  res.json({ reports, countsByReportedEmail });
});
