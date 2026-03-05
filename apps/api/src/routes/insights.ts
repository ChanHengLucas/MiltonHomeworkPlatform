import { Router } from 'express';
import { getRequestsSummary, getInsightsStats, listReports } from '@planner/db';
import { requireTeacher } from '../middleware/identity';

export const insightsRouter = Router();

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
