# SAM Contract Tracker - Deployment Guide

## Frontend/Backend Routing Configuration

The application supports two modes of operation:

### Development Mode
- Frontend API calls route to `http://localhost:3001`
- Automatic when `NODE_ENV=development` or not set

### Production Mode
- Frontend API calls route to `http://spicymini:3001`
- Automatic when `NODE_ENV=production`

### Custom API URL
You can override the API URL by setting the `REACT_APP_API_BASE_URL` environment variable:

```bash
# Frontend .env file
REACT_APP_API_BASE_URL=http://your-server:3001
```

## CORS Configuration for VPN Access

The backend is configured to handle CORS for VPN and cross-network access.

### Default Allowed Origins
- `http://localhost:3000` (dev frontend)
- `http://localhost:3001` (dev backend)
- `http://spicymini:4333` (prod frontend)
- `http://spicymini:3001` (prod backend)
- `http://localhost:4333` (local testing on prod port)

### VPN Access
The server automatically allows requests from common private network ranges:
- `192.168.x.x`
- `10.x.x.x`
- `172.16.x.x - 172.31.x.x`

### Adding Custom Origins
Add allowed origins via environment variable:

```bash
# Backend .env file
CORS_ALLOWED_ORIGINS=http://192.168.1.100:3000,http://client-machine:3000
```

## Deployment Steps

### 1. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
npm install
npm run build
npm start
```

### 2. Frontend Setup
```bash
cd frontend
cp .env.example .env
# Edit .env if needed
npm install
npm run build
npm start
```

### 3. Production Deployment
For production, build the frontend and serve it on port 4333:

```bash
cd frontend
NODE_ENV=production npm run build
# Serve the build folder on port 4333
# Example with serve:
npx serve -s build -l 4333
```

### 4. VPN Client Access
When accessing from a VPN client:

1. Ensure the client can resolve `spicymini` hostname
2. Or use IP address in `REACT_APP_API_BASE_URL`
3. The CORS configuration will automatically allow VPN subnet requests

Example client configuration:
```bash
# On client machine, set in frontend .env
REACT_APP_API_BASE_URL=http://192.168.1.50:3001
```

## Troubleshooting

### CORS Issues
1. Check browser console for CORS errors
2. Verify the origin is allowed in backend logs
3. Add the client origin to `CORS_ALLOWED_ORIGINS`

### Connection Issues
1. Verify firewall allows port 3001
2. Check VPN routing to the server
3. Test with curl: `curl http://spicymini:3001/api/health`

### Hostname Resolution
If `spicymini` doesn't resolve:
1. Add to `/etc/hosts`: `192.168.x.x spicymini`
2. Or use IP address directly in API configuration