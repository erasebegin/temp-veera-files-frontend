# Exoscale File Access

A simple web application that provides easy access to files stored in your Exoscale Simple Object Storage (SOS) bucket.

## Features

- Browse all files in your Exoscale bucket
- View file details (name, size, last modified date)
- Generate secure download links for files
- Responsive design for desktop and mobile
- Built with React, TypeScript, and Vite

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your Exoscale credentials:

```bash
cp .env.example .env
```

Edit `.env` and add your Exoscale credentials:

```env
VITE_EXOSCALE_ACCESS_KEY=your_exoscale_access_key_here
VITE_EXOSCALE_SECRET_KEY=your_exoscale_secret_key_here
VITE_EXOSCALE_BUCKET_NAME=isha2
VITE_EXOSCALE_REGION=ch-dk-2
VITE_EXOSCALE_ENDPOINT=https://sos-ch-dk-2.exo.io
```

### 3. Get Exoscale Credentials

To get your Exoscale credentials:

1. Log in to the [Exoscale Console](https://portal.exoscale.com/)
2. Go to "IAM" → "API Keys"
3. Create a new API key with SOS permissions
4. Use the generated Access Key and Secret Key in your `.env` file

### 4. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Preview Production Build

```bash
npm run preview
```

## Important Notes

✅ **Current Solution**: This application uses **public bucket access** mode, which means:
- No authentication is required to download files
- Files are accessible via direct URLs
- No sensitive credentials are exposed in the frontend
- Works immediately without complex permission setup

🔧 **Alternative Solution Available**: If you need private bucket access with full authentication, check the `src/App.tsx` file which contains a more complex implementation using AWS SDK and signed URLs.

## Adding More Files

To add more files to the application:

1. Upload your files to the `isha2` bucket in Exoscale
2. Edit `src/AppPublic.tsx` and add entries to the `KNOWN_FILES` array:

```typescript
const KNOWN_FILES: FileInfo[] = [
  {
    name: 'cr-intro-to-sadhguru.mp4',
    url: 'https://sos-ch-dk-2.exo.io/isha2/cr-intro-to-sadhguru.mp4'
  },
  {
    name: 'your-new-file.pdf',
    url: 'https://sos-ch-dk-2.exo.io/isha2/your-new-file.pdf'
  }
  // Add more files here
]
```

3. Restart the development server

The app will automatically fetch file metadata (size, last modified date) for each file.

## Supported File Types

The application works with all file types stored in your Exoscale bucket. Files are accessed directly via public URLs.

## Troubleshooting

- **"Please configure your Exoscale credentials"**: Make sure your `.env` file exists and contains valid credentials
- **"Failed to load files"**: Check that your bucket name and region are correct, and that your API key has the necessary permissions
- **CORS errors**: Ensure your bucket has appropriate CORS settings if accessing from a different domain
