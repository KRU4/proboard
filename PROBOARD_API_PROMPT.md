Build a lightweight Node.js/Express backend for ProBoard that connects to the existing PostgreSQL database.

## Context
- Existing PostgreSQL container: evolution_db
- Host: 192.168.31.253 (accessed via host.docker.internal from within Docker)
- Port: 5432
- User: evolution_user
- Password: YourStrongPassword123
- Database: proboard
- Table already created: employees (id, name, score, department, avatar, created_at, updated_at)

## What to build

Create a new folder called `api/` in the project root with these files:

### api/server.js
Express server with these endpoints:
- GET  /api/employees        → return all employees ordered by score DESC
- POST /api/employees        → add new employee { name, score, department, avatar }
- PUT  /api/employees/:id    → update employee score/department/avatar by id
- DELETE /api/employees/:id  → delete employee by id

CORS enabled for all origins (the frontend is served from a different port).
Server listens on port 3001.

### api/package.json
Dependencies: express, pg, cors
No TypeScript. Plain CommonJS.

### api/Dockerfile
```
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

## Frontend changes

### js/config.js
Add a new field:
```js
apiUrl: 'http://192.168.31.253:3001',
```
Change mode to: 'api'

### js/data.js
Add a new branch for mode === 'api':
- fetch GET /api/employees
- parse the JSON response into the same normalized array format: [{ rank, name, score, department, avatar }]
- this runs on load and every refreshIntervalSeconds

### admin.html + js/admin.js
Replace all localStorage logic with API calls:
- On load: GET /api/employees → render table
- Add employee form: POST /api/employees
- Edit score: PUT /api/employees/:id
- Delete: DELETE /api/employees/:id
- Remove all localStorage references
- Remove the PIN system (not needed anymore, access is network-controlled)
- The image upload (base64) stays as-is — just store the base64 string in the avatar field via the API

## Docker setup

Create a docker-compose.yml in the project root that runs both services:

```yaml
services:
  api:
    build: ./api
    container_name: proboard_api
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - DB_HOST=host.docker.internal
      - DB_PORT=5432
      - DB_USER=evolution_user
      - DB_PASSWORD=YourStrongPassword123
      - DB_NAME=proboard
    extra_hosts:
      - "host.docker.internal:host-gateway"

  board:
    image: nginx:alpine
    container_name: proboard
    restart: unless-stopped
    ports:
      - "8090:80"
    volumes:
      - ./:/usr/share/nginx/html:ro
```

## Important notes
- Do NOT touch or reference the existing evolution_db container in docker-compose — it is already running separately, we just connect to it via host.docker.internal
- The frontend files (index.html, admin.html, css/, js/) stay in the project root — served by nginx
- After building, the existing proboard container should be stopped and replaced by the docker-compose stack
- Use volumes in the board service (not COPY) so frontend updates don't require rebuilding the image
