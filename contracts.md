Feature

Assigned To

Status

1 Event Creation

Gaurang Patil





2 Event Detail

Paul Thomson





3 Event Editing

Gaurang Patil





4 RSVP Toggle

Gabriel Rivera





5 Event Publishing and Cancellation

Paul Thomson





6 Category and Date Filter

Ananya Singh





7 My RSVPs Dashboard

Ananya Singh





8 Organizer Event Dashboard

Gauri Potdukhe





9 Waitlist Promotion

Gabriel Rivera





10 Event Search

Gauri Potdukhe





11 Past Event Archiving

Bonus Discuss Later





12 Attendee List

Bonus Discuss Later





13 Event Comments

Bonus Discuss Later





14 Save for Later

Bonus Discuss Later









Contracts.md





Event:

id: number (PK)

title: string

description: string

location: string

startDateTime: datetime

endDateTime: datetime

max-capacity: number | null

status: Status => {draft | published | cancelled | past}

EventCategory =>  { "academic"  | "social"  | "sports"  | "workshop"  | "other";}

organizerID: User\[]	

createdAt: datetime

updatedAt: datetime







RSVP:

Id: number (PK)

eventId: number (FK)

userId: number (FK)

status: RSVPStatus => {going | waitlisted | cancelled}

createdAt: dateTime



User:

id: number (PK)

email: string

displayName: string

Role: userRole

passwordHash: string



Role Permissions:

Admin: full access to everything. Can manage users and override any action in the system



Staff: can perform actions that regular users cannot, but does not have the ability to create new users or manage existing users. The exact permissions of this role-level are up to you and your team to define in Sprint 3, but it should be meaningfully more powerful than a regular user while still having some restrictions. You are likely to change the name of this role to something more descriptive (e.g., "Event Manager") once you decide what permissions it has.



User: can perform basic actions that would be typical for a regular user of the system. What those actions are is up to you and your team to define in Sprint 3, but this role should be meaningfully restricted compared to Staff. You are likely to change the name of this role to something more descriptive (e.g., "Member") once you decide what permissions it has.



Repository:



createEvent(event: Event)

editEvent(eventId: number, newEvent Event)



findEventById(id: string): Promise<Result<IEventRecord | null, EventError>>;

&#x20;updateEvent(id: string, changes: Partial<Omit<IEventRecord, "id" | "organizerId" | "createdAt">>): Promise<Result<IEventRecord, EventError>>;

listEvents(filters?: EventFilterOptions): Promise<Result<IEventRecord\[], EventError>>;











findRSVP(eventId: string, userId: string): Promise<Result<IRSVPRecord | null, RSVPError>>;

createRSVP(rsvp: Omit<IRSVPRecord, "id" | "createdAt" | "updatedAt">): Promise<Result<IRSVPRecord, RSVPError>>;

updateRSVP(id: string, status: IRSVPRecord\["status"]): Promise<Result<IRSVPRecord, RSVPError>>;

listRSVPsByUser(userId: string): Promise<Result<IRSVPRecord\[], RSVPError>>;

listRSVPsByEvent(eventId: string): Promise<Result<IRSVPRecord\[], RSVPError>>;

findNextWaitlisted(eventId: string): Promise<Result<IRSVPRecord | null, RSVPError>>;

cancelAndPromote(cancelId: string, promoteId: string): Promise<Result<void, RSVPError>>; #promote next rsvp in list









Service:

createEvent(event: Event);

editEvent(eventID: number);

updateEvent(userAuth: IAuthenticatedUser, eventID: number, title?: string, description?: string, location?: string): Promise<Result<IEventRecord, EventError>>;

publishEvent(userAuth: IAuthenticatedUser, eventID: number): Promise<Result<IEventRecord, EventError>>;

cancelEvent(userAuth: IAuthenticatedUser, eventId: string): Promise<Result<IEventRecord, EventError>>;

&#x20; listEvents(userAuth: IAuthenticatedUser, filters?: { category?: string; timeframe?: string;}): Promise<Result<IEventRecord\[], EventError>>;

getOrganizerDashboard(userAuth: IAuthenticatedUser): Promise<Result<OrganizerDashboardData, EventError>>;

searchEvents(userAuth: IAuthenticatedUser, query: string): Promise<Result<IEventRecord\[], EventError>>;}

toggleRSVP(userAuth: IAuthenticatedUser, eventId: string): Promise<Result<IRSVPRecord, RSVPError>>; #Feature 4 and 9

getMyRSVPs(userAuth: IAuthenticatedUser): Promise<Result<RSVPWithEvent\[], RSVPError>>;

getWaitlistPosition(actor: IAuthenticatedUser, eventId: string): Promise<Result<number | null, RSVPError>>;}

























Controller:



&#x20; showDetail(

&#x20;   res: Response,

&#x20;   store: AppSessionStore,

&#x20;   eventId: string,

&#x20; ): Promise<void>;

&#x20; publishFromForm(

&#x20;   res: Response,

&#x20;   store: AppSessionStore,

&#x20;   eventId: string,

&#x20; ): Promise<void>;

&#x20; cancelFromForm(

&#x20;   res: Response,

&#x20;   store: AppSessionStore,

&#x20;   eventId: string,

&#x20; ): Promise<void>;

&#x20; showCreateForm(

&#x20;   res: Response,

&#x20;   session: IAppBrowserSession,

&#x20;   pageError?: string | null,

&#x20;   values?: EventFormValues,

&#x20; ): Promise<void>;



&#x20; createEventFromForm(

&#x20;   res: Response,

&#x20;   actor: IAuthenticatedUser,

&#x20;   session: IAppBrowserSession,

&#x20;   values: EventFormValues,

&#x20; ): Promise<void>;



&#x20; showEditForm(

&#x20;   res: Response,

&#x20;   actor: IAuthenticatedUser,

&#x20;   session: IAppBrowserSession,

&#x20;   eventId: string,

&#x20;   pageError?: string | null,

&#x20;   values?: EventFormValues,

&#x20; ): Promise<void>;



&#x20; updateEventFromForm(

&#x20;   res: Response,

&#x20;   actor: IAuthenticatedUser,

&#x20;   session: IAppBrowserSession,

&#x20;   eventId: string,

&#x20;   values: EventFormValues,

&#x20; ): Promise<void>;



