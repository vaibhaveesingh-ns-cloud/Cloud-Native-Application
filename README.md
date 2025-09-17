# PixelBoard

A minimal image-sharing board where users can sign up, upload photos, create albums, and view auto-generated thumbnails.

## Features

- **User Authentication**: Secure signup and login with JWT tokens
- **Photo Upload**: Upload images with automatic thumbnail generation
- **Album Management**: Create and organize photos into albums
- **Responsive Design**: Modern, mobile-friendly interface
- **Auto Thumbnails**: Automatic thumbnail generation using Sharp
- **File Management**: Secure file storage and validation

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Image Processing**: Sharp for thumbnail generation
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Authentication**: JWT tokens with bcrypt password hashing
- **File Upload**: Multer for handling multipart/form-data

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pixelboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env` file and update the values:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: A secure secret key for JWT tokens
   - `PORT`: Server port (default: 3000)

4. Start MongoDB (if running locally):
```bash
mongod
```

5. Start the application:
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

6. Open your browser and navigate to `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info

### Photos
- `POST /api/photos/upload` - Upload a photo (requires auth)
- `GET /api/photos/all` - Get all photos (public)
- `GET /api/photos/my-photos` - Get user's photos (requires auth)
- `GET /api/photos/:id` - Get single photo
- `DELETE /api/photos/:id` - Delete photo (requires auth)

### Albums
- `POST /api/albums/create` - Create album (requires auth)
- `GET /api/albums/all` - Get all albums (public)
- `GET /api/albums/my-albums` - Get user's albums (requires auth)
- `GET /api/albums/:id` - Get album with photos
- `POST /api/albums/:id/add-photos` - Add photos to album (requires auth)
- `POST /api/albums/:id/remove-photos` - Remove photos from album (requires auth)
- `DELETE /api/albums/:id` - Delete album (requires auth)

## Project Structure

```
pixelboard/
├── models/           # Database models
│   ├── User.js
│   ├── Photo.js
│   └── Album.js
├── routes/           # API routes
│   ├── auth.js
│   ├── photos.js
│   └── albums.js
├── middleware/       # Custom middleware
│   └── auth.js
├── public/           # Frontend files
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── uploads/          # Uploaded files (created automatically)
│   └── thumbnails/   # Generated thumbnails
├── server.js         # Main server file
├── package.json
├── .env              # Environment variables
└── README.md
```

## Usage

1. **Sign Up**: Create a new account with username, email, and password
2. **Login**: Sign in to access your dashboard
3. **Upload Photos**: Click the upload button to share your images
4. **Create Albums**: Organize your photos into themed collections
5. **Explore**: Browse photos shared by other users
6. **Manage**: View and manage your photos and albums

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- File type validation for uploads
- File size limits (10MB max)
- Input validation and sanitization
- Protected routes requiring authentication

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support or questions, please open an issue in the repository.
