import request from 'supertest';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

describe('Role-Based Access Control Tests', () => {
  const studentToken = jwt.sign(
    { sub: '7', role: 'STUDENT', email: 'aarav.patel2023@vitstudent.ac.in', name: 'Aarav Patel' },
    env.JWT_SECRET
  );

  const staffToken = jwt.sign(
    { sub: '5', role: 'STAFF', email: 'staff@vit.ac.in', name: 'SJT LF Desk Staff' },
    env.JWT_SECRET
  );

  it('STUDENT accessing staff route /api/found-items receives 403', async () => {
    const res = await request(app)
      .get('/api/found-items')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('STAFF accessing admin route /api/admin/stats receives 403', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });
});
