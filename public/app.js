class PixelBoard {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.currentPage = 'landing';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
        this.setupDragAndDrop();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('loginBtn').addEventListener('click', () => this.showAuthModal('login'));
        document.getElementById('signupBtn').addEventListener('click', () => this.showAuthModal('signup'));
        document.getElementById('heroLoginBtn').addEventListener('click', () => this.showAuthModal('login'));
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Modal controls
        document.getElementById('closeAuthModal').addEventListener('click', () => this.hideModal('authModal'));
        document.getElementById('closeUploadModal').addEventListener('click', () => this.hideModal('uploadModal'));
        document.getElementById('closeCreateAlbumModal').addEventListener('click', () => this.hideModal('createAlbumModal'));

        // Auth form
        document.getElementById('authSwitchBtn').addEventListener('click', () => this.toggleAuthMode());
        document.getElementById('authForm').addEventListener('submit', (e) => this.handleAuth(e));

        // Upload
        document.getElementById('uploadBtn').addEventListener('click', () => this.showUploadModal());
        document.getElementById('dashboardUploadBtn').addEventListener('click', () => this.showUploadModal());
        document.getElementById('myPhotosUploadBtn').addEventListener('click', () => this.showUploadModal());
        document.getElementById('uploadFileBtn').addEventListener('click', () => document.getElementById('photoFile').click());
        document.getElementById('photoFile').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('uploadForm').addEventListener('submit', (e) => this.handleUpload(e));

        // Album creation
        document.getElementById('createAlbumBtn').addEventListener('click', () => this.showCreateAlbumModal());
        document.getElementById('cancelCreateAlbum').addEventListener('click', () => this.hideModal('createAlbumModal'));
        document.getElementById('createAlbumForm').addEventListener('submit', (e) => this.handleCreateAlbum(e));

        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.dataset.page;
                this.showPage(page);
            });
        });

        // User menu
        document.getElementById('userAvatar').addEventListener('click', () => this.toggleUserMenu());
        document.getElementById('myPhotosLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showPage('myPhotos');
            this.hideUserMenu();
        });
        document.getElementById('myAlbumsLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showPage('myAlbums');
            this.hideUserMenu();
        });

        // Close modals on outside click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal(e.target.id);
            }
        });

        // Close user menu on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-menu')) {
                this.hideUserMenu();
            }
        });
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                document.getElementById('photoFile').files = files;
                this.handleFileSelect({ target: { files } });
            }
        });
    }

    async checkAuth() {
        if (this.token) {
            try {
                const response = await fetch('/api/auth/me', {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.currentUser = data.user;
                    this.showAuthenticatedUI();
                    this.showPage('home');
                } else {
                    this.logout();
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                this.logout();
            }
        } else {
            this.showPage('landing');
        }
    }

    showAuthModal(mode) {
        const modal = document.getElementById('authModal');
        const title = document.getElementById('authTitle');
        const subtitle = document.getElementById('authSubtitle');
        const submitBtn = document.getElementById('authSubmitBtn');
        const switchText = document.getElementById('authSwitchText');
        const switchBtn = document.getElementById('authSwitchBtn');
        const usernameGroup = document.getElementById('usernameGroup');

        if (mode === 'login') {
            title.textContent = 'Welcome to PixelBoard';
            subtitle.textContent = 'Sign in or create an account to start sharing.';
            submitBtn.textContent = 'Log In';
            switchText.textContent = "Don't have an account?";
            switchBtn.textContent = 'Sign Up';
            usernameGroup.style.display = 'none';
            document.getElementById('email').placeholder = 'Username or Email';
        } else {
            title.textContent = 'Create Account';
            subtitle.textContent = 'Join PixelBoard to start sharing your photos.';
            submitBtn.textContent = 'Sign Up';
            switchText.textContent = 'Already have an account?';
            switchBtn.textContent = 'Log In';
            usernameGroup.style.display = 'block';
            document.getElementById('email').placeholder = 'Email';
        }

        modal.dataset.mode = mode;
        this.showModal('authModal');
    }

    toggleAuthMode() {
        const currentMode = document.getElementById('authModal').dataset.mode;
        const newMode = currentMode === 'login' ? 'signup' : 'login';
        this.showAuthModal(newMode);
    }

    async handleAuth(e) {
        e.preventDefault();
        
        const mode = document.getElementById('authModal').dataset.mode;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const username = document.getElementById('username').value;

        const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
        const body = mode === 'login' 
            ? { email, password }
            : { username, email, password };

        this.showLoading();

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.currentUser = data.user;
                localStorage.setItem('token', this.token);
                
                this.hideModal('authModal');
                this.showAuthenticatedUI();
                this.showPage('home');
                this.showToast('success', mode === 'login' ? 'Welcome back!' : 'Account created successfully!');
            } else {
                this.showToast('error', data.message || 'Authentication failed');
            }
        } catch (error) {
            console.error('Auth error:', error);
            this.showToast('error', 'Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    logout() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('token');
        this.showUnauthenticatedUI();
        this.showPage('landing');
        this.showToast('info', 'Logged out successfully');
    }

    showAuthenticatedUI() {
        document.getElementById('navAuth').style.display = 'none';
        document.getElementById('navUser').style.display = 'flex';
        document.getElementById('createLink').style.display = 'block';
    }

    showUnauthenticatedUI() {
        document.getElementById('navAuth').style.display = 'flex';
        document.getElementById('navUser').style.display = 'none';
        document.getElementById('createLink').style.display = 'none';
    }

    showUploadModal() {
        this.showModal('uploadModal');
        document.getElementById('uploadForm').reset();
        document.getElementById('uploadArea').classList.remove('dragover');
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            const uploadArea = document.getElementById('uploadArea');
            uploadArea.innerHTML = `
                <div class="upload-icon">
                    <i class="fas fa-check-circle" style="color: #34a853;"></i>
                </div>
                <p>File selected: ${file.name}</p>
                <small>Click upload to share your photo</small>
            `;
        }
    }

    async handleUpload(e) {
        e.preventDefault();

        // Check authentication first
        if (!this.token) {
            this.showToast('error', 'Please log in to upload photos');
            this.showAuthModal('login');
            return;
        }

        const fileInput = document.getElementById('photoFile');
        const title = document.getElementById('photoTitle').value;
        const description = document.getElementById('photoDescription').value;

        if (!fileInput) {
            this.showToast('error', 'File input not found');
            return;
        }

        if (!fileInput.files || !fileInput.files[0]) {
            this.showToast('error', 'Please select a file to upload');
            return;
        }

        const formData = new FormData();
        formData.append('photo', fileInput.files[0]);
        formData.append('title', title);
        formData.append('description', description);

        this.showLoading();

        try {
            const response = await fetch('/api/photos/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                this.hideModal('uploadModal');
                this.showToast('success', 'Photo uploaded successfully!');
                
                // Refresh current page if showing photos
                if (this.currentPage === 'home' || this.currentPage === 'myPhotos') {
                    this.loadPhotos();
                }
            } else {
                this.showToast('error', data.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('error', 'Upload failed. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async showCreateAlbumModal() {
        this.showModal('createAlbumModal');
        await this.loadUserPhotosForSelection();
    }

    async loadUserPhotosForSelection() {
        try {
            const response = await fetch('/api/photos/my-photos', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const photoSelection = document.getElementById('photoSelection');
                
                if (data.photos.length === 0) {
                    photoSelection.innerHTML = '<p style="text-align: center; color: #9aa0a6;">No photos available. Upload some photos first!</p>';
                    return;
                }

                photoSelection.innerHTML = data.photos.map(photo => `
                    <div class="photo-select-item" data-photo-id="${photo.id}">
                        <img src="${photo.thumbnailPath}" alt="${photo.title}">
                        <div class="select-overlay">
                            <i class="fas fa-check"></i>
                        </div>
                    </div>
                `).join('');

                // Add click handlers for photo selection
                photoSelection.querySelectorAll('.photo-select-item').forEach(item => {
                    item.addEventListener('click', () => {
                        item.classList.toggle('selected');
                    });
                });
            }
        } catch (error) {
            console.error('Error loading photos for selection:', error);
        }
    }

    async handleCreateAlbum(e) {
        e.preventDefault();

        const title = document.getElementById('albumTitle').value;
        const selectedPhotos = Array.from(document.querySelectorAll('.photo-select-item.selected'))
            .map(item => item.dataset.photoId);

        this.showLoading();

        try {
            const response = await fetch('/api/albums/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    title,
                    photoIds: selectedPhotos
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.hideModal('createAlbumModal');
                this.showToast('success', 'Album created successfully!');
                
                if (this.currentPage === 'myAlbums') {
                    this.loadMyAlbums();
                }
            } else {
                this.showToast('error', data.message || 'Failed to create album');
            }
        } catch (error) {
            console.error('Create album error:', error);
            this.showToast('error', 'Failed to create album. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    showPage(page) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        this.currentPage = page;

        switch (page) {
            case 'landing':
                document.getElementById('landingPage').style.display = 'block';
                break;
            case 'home':
                document.getElementById('dashboardPage').style.display = 'block';
                this.loadPhotos();
                break;
            case 'explore':
                document.getElementById('explorePage').style.display = 'block';
                this.loadExplorePhotos();
                document.querySelector('[data-page="explore"]').classList.add('active');
                break;
            case 'myPhotos':
                document.getElementById('myPhotosPage').style.display = 'block';
                this.loadMyPhotos();
                break;
            case 'myAlbums':
                document.getElementById('myAlbumsPage').style.display = 'block';
                this.loadMyAlbums();
                break;
            case 'create':
                this.showCreateAlbumModal();
                break;
        }
    }

    async loadPhotos() {
        try {
            const response = await fetch('/api/photos/all');
            const data = await response.json();
            
            const photoGrid = document.getElementById('photoGrid');
            photoGrid.innerHTML = this.renderPhotos(data.photos);
        } catch (error) {
            console.error('Error loading photos:', error);
            this.showToast('error', 'Failed to load photos');
        }
    }

    async loadExplorePhotos() {
        try {
            const response = await fetch('/api/photos/all');
            const data = await response.json();
            
            const photoGrid = document.getElementById('explorePhotoGrid');
            photoGrid.innerHTML = this.renderPhotos(data.photos);
        } catch (error) {
            console.error('Error loading explore photos:', error);
            this.showToast('error', 'Failed to load photos');
        }
    }

    async loadMyPhotos() {
        if (!this.token) return;

        try {
            const response = await fetch('/api/photos/my-photos', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            const data = await response.json();
            
            const photoGrid = document.getElementById('myPhotoGrid');
            if (data.photos.length === 0) {
                photoGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                        <i class="fas fa-camera" style="font-size: 48px; color: #9aa0a6; margin-bottom: 16px;"></i>
                        <h3 style="color: #5f6368; margin-bottom: 8px;">No photos yet</h3>
                        <p style="color: #9aa0a6;">Upload your first photo to get started!</p>
                    </div>
                `;
            } else {
                photoGrid.innerHTML = this.renderPhotos(data.photos);
            }
        } catch (error) {
            console.error('Error loading my photos:', error);
            this.showToast('error', 'Failed to load your photos');
        }
    }

    async loadMyAlbums() {
        if (!this.token) return;

        try {
            const response = await fetch('/api/albums/my-albums', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            const data = await response.json();
            
            const albumsGrid = document.getElementById('myAlbumsGrid');
            if (data.albums.length === 0) {
                albumsGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                        <i class="fas fa-folder" style="font-size: 48px; color: #9aa0a6; margin-bottom: 16px;"></i>
                        <h3 style="color: #5f6368; margin-bottom: 8px;">No albums yet</h3>
                        <p style="color: #9aa0a6;">Create your first album to organize your photos!</p>
                    </div>
                `;
            } else {
                albumsGrid.innerHTML = this.renderAlbums(data.albums);
            }
        } catch (error) {
            console.error('Error loading my albums:', error);
            this.showToast('error', 'Failed to load your albums');
        }
    }

    renderPhotos(photos) {
        return photos.map(photo => `
            <div class="photo-card" onclick="window.open('${photo.originalPath}', '_blank')">
                <img src="${photo.thumbnailPath}" alt="${photo.title}" loading="lazy">
                <div class="photo-card-content">
                    <h3>${this.escapeHtml(photo.title)}</h3>
                    <p>${this.escapeHtml(photo.description || '')}</p>
                    <div class="photo-card-meta">
                        <span>by ${this.escapeHtml(photo.uploadedBy)}</span>
                        <span>${this.formatDate(photo.createdAt)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderAlbums(albums) {
        return albums.map(album => `
            <div class="album-card">
                <div class="album-cover">
                    ${album.coverPhoto 
                        ? `<img src="${album.coverPhoto}" alt="${album.title}" loading="lazy">`
                        : '<i class="fas fa-folder"></i>'
                    }
                </div>
                <div class="album-card-content">
                    <h3>${this.escapeHtml(album.title)}</h3>
                    <p>${this.escapeHtml(album.description || '')}</p>
                    <div class="album-card-meta">
                        <span>${album.photoCount} photos</span>
                        <span>${this.formatDate(album.createdAt)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    toggleUserMenu() {
        const dropdown = document.getElementById('userDropdown');
        dropdown.classList.toggle('show');
    }

    hideUserMenu() {
        const dropdown = document.getElementById('userDropdown');
        dropdown.classList.remove('show');
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
        document.body.style.overflow = '';
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    showToast(type, message) {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-circle' : 'info-circle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new PixelBoard();
});
