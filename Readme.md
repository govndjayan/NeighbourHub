# NeighbourHub 🏘️

A hyperlocal community super-app built for residential associations.

## Features
- 🔐 JWT Authentication with role-based access (Resident, Committee, Secretary, President)
- 📢 Community announcements with real-time updates
- 🍱 Food & item sharing with image uploads and real-time claiming
- 💼 Professional services directory with in-app chat
- ⚠️ Complaint portal with status tracking and resolution notes
- 👥 Resident directory with executive committee management
- 💬 Real-time chat powered by Socket.io
- 🔔 Push notifications via Expo

## Tech Stack

### Frontend
- React Native (Expo SDK 54)
- Expo Router (file-based navigation)
- Socket.io client
- Cloudinary (image storage)

### Backend
- Node.js + Express.js
- MongoDB + Mongoose
- Socket.io
- JWT Authentication
- Expo Push Notifications

## Project Structure
\`\`\`
NeighbourHub/
├── frontend/          # React Native Expo app
│   ├── app/           # Screens (file-based routing)
│   ├── components/    # Reusable components
│   ├── context/       # Auth context
│   ├── services/      # API calls
│   └── constants/     # Colors, config
├── backend/           # Node.js API
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── config/
│   └── server.js
└── database/          # Seed scripts
\`\`\`

## Environment Variables

### Backend `.env`
\`\`\`
PORT=5001
MONGO_URI=mongodb://localhost:27017/neighbourhub
JWT_SECRET=your_secret
JWT_EXPIRE=30d
\`\`\`

### Frontend `constants/config.js`
\`\`\`
BASE_URL=http://YOUR_IP:5000
CLOUDINARY_URL=https://api.cloudinary.com/v1_1/YOUR_CLOUD/image/upload
CLOUDINARY_PRESET=your_preset
\`\`\`

## Running with Docker

```bash
# Clone the repo
git clone https://github.com/govndjayan/NeighbourHub.git
cd NeighbourHub

# Start backend + MongoDB
docker-compose up

# Frontend (separate terminal)
cd frontend
npm install
npx expo start
```

## Running Locally

### Backend
\`\`\`bash
cd backend
npm install
npm run dev
\`\`\`

### Frontend
\`\`\`bash
cd frontend
npm install
npx expo start
\`\`\`

## Screenshots
Coming soon

## Author
Govind Jayan