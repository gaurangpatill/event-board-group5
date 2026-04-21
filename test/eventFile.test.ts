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
  }

  // Helper function - login as organizer
  async function loginAsStaff(): Promise<void> {
    const login = await agent
      .post('/login').type('form')
      .send({ email: 'staff@app.test', password: 'password123' });
  }

  // Helper function - login as user
  async function loginAsUser(): Promise<void> {
    const login = await agent
      .post('/login').type('form')
      .send({ email: 'user@app.test', password: 'password123' });
  }

  // Helper function - logout
  async function logout(): Promise<void>{
    const logout = await agent.post('/logout')
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

    it('should show event details to staff member that created it', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
      const response = await agent.get(`/events/${eventId}`);
      expect(response.status).toBe(200);
      expect(response.text).toContain('testing title');
      expect(response.text).toContain('test desc');
      expect(response.text).toContain('test area');
    })

    it('should return 404 for a non-existent event', async () => {
      await loginAsStaff();
      const response = await agent.get('/events/891739813791873');
      expect(response.status).toBe(404);
    });

    it('should return 404 when a regular user tries to view a draft event', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
      await logout();
 
      await loginAsUser();
      const response = await agent.get(`/events/${eventId}`);
      expect(response.status).toBe(404);
    });

    it('should redirect unauthenticated users away from event detail', async () => {
      const response = await agent.get('/events/some-event-id');
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/login');
    });

    // Edge case: event detail page shows all key fields
    it('should display all event metadata on the detail page', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent(

      );
      const response = await agent.get(`/events/${eventId}`);
      expect(response.status).toBe(200);
      expect(response.text).toContain('testing title');
      expect(response.text).toContain('test desc');
      expect(response.text).toContain('test area');
      expect(response.text).toContain('Academic');
      expect(response.text).toContain('4/12/2026, 12:12:00 PM')
      expect(response.text).toContain('12/1/2026, 12:00:00 PM')

    });

describe('Feature 5: Event Publishing and Cancellation', () => {
    it('should publish a draft event', async () => {
      await loginAsStaff();

      const eventId = await createTestEvent();

      const publish = await agent
        .post(`/events/${eventId}/publish`);
      expect(publish.status).toBe(302);

      const dashboardResponse = await agent
        .get('/dashboard/events');
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.text).toContain('Published');
    });

    it('should cancel a published event', async () => {
      await loginAsStaff();

      const eventId = await createTestEvent();

      const publish = await agent
        .post(`/events/${eventId}/publish`);
      expect(publish.status).toBe(302);

      const cancel = await agent
        .post(`/events/${eventId}/cancel`);
      expect(cancel.status).toBe(302);

      const dashboardResponse = await agent
        .get('/dashboard/events');
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.text).toContain('Cancelled');
    });

    it('should allow cancelling a draft event', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
 
      const cancel = await agent.post(`/events/${eventId}/cancel`);
      expect(cancel.status).toBe(302);
 
      const dashboard = await agent.get('/dashboard/events');
      expect(dashboard.status).toBe(200);
      expect(dashboard.text).toContain('Cancelled');
    });

    it('should not allow publishing an already published event', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
 
      await agent.post(`/events/${eventId}/publish`);
 
      const publish2 = await agent.post(`/events/${eventId}/publish`);
      expect(publish2.status).toBe(400);
    });


    it('should not allow cancelling already cancelled events', async () => {
      await loginAsStaff();

      const eventId = await createTestEvent();

      const cancel1 = await agent
        .post(`/events/${eventId}/cancel`);
      expect(cancel1.status).toBe(302);

      const cancel2 = await agent
        .post(`/events/${eventId}/cancel`);
      expect(cancel2.status).toBe(400); 
    });


    it('should not allow publishing a cancelled event', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
 
      await agent.post(`/events/${eventId}/cancel`);
 
      const publish = await agent.post(`/events/${eventId}/publish`);
      expect(publish.status).toBe(400);
    });

    it('should not allow a regular user to publish an event', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
      await logout();
 
      await loginAsUser();
      const publish = await agent.post(`/events/${eventId}/publish`);
      expect(publish.status).toBe(403);
    });

    // Edge case - unauthorized attempts 
    it('should block and redirect unauthenticated publish attempts', async () => {
      await loginAsStaff();
      const eventId = await createTestEvent();
      await logout();
 
      const publish = await agent.post(`/events/${eventId}/publish`);
      expect(publish.status).toBe(401);
    });

    // Edge case - publish/cancel a non-existent event 
    it('should return 404 when publishing a non-existent event', async () => {
      await loginAsStaff();
      const publish = await agent.post('/events/non-existent-id-99912121299/publish');
      expect(publish.status).toBe(404);
    });
 
    it('should return 404 when cancelling a non-existent event', async () => {
      await loginAsStaff();
      const cancel = await agent.post('/events/non-existent-id-9912121999/cancel');
      expect(cancel.status).toBe(404);
    });

    // Edge case - dashboard separates published, draft, and cancelled events properly
    it('should show correct counts of event states on the dashboard', async () => {
      await loginAsStaff();
 
      await createTestEvent({ title: 'Draft Event' });
      const pubId = await createTestEvent({ title: 'Published Event' });
      const cancelId = await createTestEvent({ title: 'Cancelled Event' });
 
      await agent.post(`/events/${pubId}/publish`);
      await agent.post(`/events/${cancelId}/cancel`);
 
      const dashboard = await agent.get('/dashboard/events');
      expect(dashboard.status).toBe(200);
      expect(dashboard.text).toContain('Draft Event');
      expect(dashboard.text).toContain('Published Event');
      expect(dashboard.text).toContain('Cancelled Event');
    });



  });

  
})
})