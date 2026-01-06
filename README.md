# Blog Generator

A modern web application that simplifies blog generation using Google's Gemini API. Generate professional blog posts with just a few inputs.

## Features

- **User-friendly form** with all necessary inputs:
  - Venue Name
  - Target Month
  - Week of Month
  - Creator
  - Draft Topic/Title
  - Special Instructions
- **AI-powered blog generation** using Google Gemini API
- **Download functionality** to save generated drafts as text files 
- **Modern, responsive UI** with beautiful design

## Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Google Gemini API key

### Installation

1. Clone the repository and navigate to the project directory:
```bash
cd blog-generator
```

2. Install all dependencies:
```bash
npm run install-all
```

3. Set up environment variables:
```bash
cd server
cp .env.example .env
```

4. Edit `server/.env` and add your API keys:
```
GROQ_API_KEY=your_groq_api_key_here
PORT=3001

# Optional: Google Docs API (for creating Google Docs instead of downloading TXT)
GOOGLE_CLIENT_EMAIL=your-service-account-email@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Optional: Setting up Google Docs API**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google Docs API** and **Google Drive API**
4. Create a **Service Account**:
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Give it a name and click "Create"
   - Skip role assignment (optional)
   - Click "Done"
5. Create a key for the service account:
   - Click on the service account you just created
   - Go to "Keys" tab > "Add Key" > "Create new key"
   - Choose "JSON" format
   - Download the JSON file
6. Extract credentials from the JSON file:
   - `client_email` → `GOOGLE_CLIENT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (keep the quotes and \n characters)
7. Share a Google Drive folder with the service account email (so it can create docs)

### Running the Application

Start both the frontend and backend servers:
```bash
npm run dev
```

This will start:
- Frontend server on `http://localhost:3000`
- Backend server on `http://localhost:3001`

Alternatively, you can run them separately:
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run client
```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Fill in all the required fields:
   - Venue Name
   - Target Month
   - Week of Month (select from dropdown)
   - Creator
   - Draft Topic/Title
   - Special Instructions (optional)
3. Click "Generate Blog" to create your blog post
4. Once generated, you can click "Download TXT" to download as a text file

## Project Structure

```
blog-generator/
├── client/          # React frontend application
│   ├── src/
│   │   ├── App.jsx  # Main application component
│   │   └── ...
│   └── package.json
├── server/          # Node.js backend server
│   ├── index.js     # Express server with Gemini API integration
│   └── package.json
└── package.json     # Root package.json with scripts
```

## Technologies Used

- **Frontend**: React, Vite
- **Backend**: Node.js, Express
- **AI**: Google Gemini API
- **Styling**: CSS3 with modern design

## License

MIT
