# BookNook Server

Express and MongoDB API for BookNook, a small online library.

**Live API:** https://booknook-server-zhqd.onrender.com/
**Client repo:** https://github.com/Miss-tea/booknook-client

## API Routes

| Method | Route | Access |
|---|---|---|
| GET | /books | Public |
| GET | /books/:id | JWT |
| POST | /books | JWT |
| PATCH | /books/:id | JWT, owner only |
| DELETE | /books/:id | JWT, owner only |
| POST | /borrows | JWT |
| GET | /borrows | JWT |
| DELETE | /borrows/:id | JWT, borrower only |

## Run Locally

1. `npm install`
2. Create `.env` with `PORT`, `MONGODB_URI`, `CLIENT_URL`, `JWT_SECRET`
3. `npm run dev`