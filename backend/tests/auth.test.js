import request from 'supertest';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

describe('Auth & RBAC Middleware Tests', () => {
  it('GET /api/auth/me without token returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('GET /api/auth/me with malformed token returns 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.payload');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  it('GET /api/health returns ok: true', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
