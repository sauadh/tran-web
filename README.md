# WebSocket Server Backend

## Setup

1. Clone this repository
2. Install dependencies:
```bash
   npm install
```

3. Create `.env` file:
```bash
   cp .env.example .env
   # Edit .env with your actual credentials
```

4. Set up PostgreSQL database and run migrations:
```bash
   psql -U your_user -d your_database -f src/db/schema.sql
   psql -U your_user -d your_database -f src/db/notifications_schema.sql
```

5. Start the server:
```bash
   # Development
   npm run dev

   # Production
   npm start
```

## Documentation

- See `BACKEND_DOCUMENTATION.md` for API reference
- See `FRONTEND_INTEGRATION_GUIDE.md` for frontend integration

## Support

Contact: [Your Name/Email]
