import request from 'supertest';
import { createComposedApp } from '../src/composition';
import { CreateLoggingService } from '../src/service/LoggingService';
import type { IApp } from '../src/contracts';


describe('Feature 2 and 5 Tests', () => {
  let app: IApp;
  let agent: ReturnType<typeof request.agent>
  

  beforeEach(() => {
    app = createComposedApp(CreateLoggingService());
    agent = request.agent(app.getExpressApp());
  });

  // Helper function - login as admin
  async function loginAsAdmin(): Promise<void> {
    const login = await agent
      .post('/login').type('form')
      .send({ email: 'admin@app.test', password: 'password123' });
    expect(login.status).toBe(302);
  }

  // Helper function - login as organizer
  async function loginAsStaff(): Promise<void> {
    const login = await agent
      .post('/login').type('form')
      .send({ email: 'staff@app.test', password: 'password123' });
    expect(login.status).toBe(302);
  }

  // Helper function - login as user
  async function loginAsUser(): Promise<void> {
    const login = await agent
      .post('/login').type('form')
      .send({ email: 'user@app.test', password: 'password123' });
    expect(login.status).toBe(302);
  }

  const createTestEvent = async (eventData: any = {}) => {
    const testEvent = {
      title: 'testing title',
      description: 'test desc',
      location: 'test area',
      category: 'academic',
      startDateTime: '2026-04-12T12:12:00',
      endDateTime: '2026-12-01T12:00:00',
      maxCapacity: '1',
      ...eventData
    };

    const response = await agent
      .post('/events').type('form')
      .send(testEvent);
    expect(response.status).toBe(302);

    // Extract event ID from redirect URL
    const redirectUrl = response.headers.location;
    const eventId = redirectUrl.split('/').pop();
    return eventId;
  };

  describe('Feature 2: Event Detail Page', () => {
    it('should show event details', async () => {
      await loginAsStaff();

      const eventId = await createTestEvent()
      const response = await agent
        .get(`/events/${eventId}`).type('form');
      expect(response.status).toBe(200);
      expect(response.text).toContain('testing title');
      expect(response.text).toContain('test desc');
      expect(response.text).toContain('test area');
    });

    it('should show RSVP status for authenticated users', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();

      const publish = await agent.post(`/events/${eventId}/publish`);
      expect(publish.status).toBe(302);

      const logout = await agent.post('/logout');
      expect(logout.status).toBe(302);

      await loginAsUser();

      const response = await agent
        .get(`/events/${eventId}`);
      expect(response.status).toBe(200);
      expect(response.text).toContain('rsvp');
    });

    it('should show event details to staff member that created it'), async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
 
      const response = await agent.get(`/events/${eventId}`);
      expect(response.status).toBe(200);
      expect(response.text).toContain('testing title');
      expect(response.text).toContain('test desc');
      expect(response.text).toContain('test area');
    }

    
  });

});