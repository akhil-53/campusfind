import request from 'supertest';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

describe('Report Validation Tests', () => {
  const studentToken = jwt.sign(
    { sub: '7', role: 'STUDENT', email: 'aarav.patel2023@vitstudent.ac.in', name: 'Aarav Patel' },
    env.JWT_SECRET
  );

  it('Creating a report with time window > 24 hours fails with 422', async () => {
    const from = new Date('2026-10-18T10:00:00Z');
    const to = new Date('2026-10-19T14:00:00Z'); // 28 hours later

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        categoryId: 1,
        locationId: 1,
        description: 'Black water bottle left on desk',
        identifyingMarks: 'Scratch on the cap',
        lostFrom: from.toISOString(),
        lostTo: to.toISOString()
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('WINDOW_TOO_LARGE');
  });

  it('Creating a report with future lostTo date fails with 422', async () => {
    const from = new Date(Date.now() + 60 * 60 * 1000);
    const to = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        categoryId: 1,
        locationId: 1,
        description: 'Black water bottle left on desk',
        identifyingMarks: 'Scratch on the cap',
        lostFrom: from.toISOString(),
        lostTo: to.toISOString()
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('FUTURE_DATE_NOT_ALLOWED');
  });
});
