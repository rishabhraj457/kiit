const multer = require('multer');
const path = require('path');

// Configure multer for memory storage (no disk saving)
const storage = multer.memoryStorage();

// Enhanced file filter with showcase-specific validation
const fileFilter = (req, file, cb) => {
    // Check file types for images
    const allowedMimeTypes = [
        'image/jpeg', 
        'image/jpg', 
        'image/png', 
        'image/webp',
        'image/gif',
        'image/svg+xml'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, WebP, GIF, and SVG files are allowed.`), false);
    }
};

// Configure multer with additional options
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 5, // Maximum 5 files per request
        fields: 10 // Maximum 10 non-file fields
    }
});

// Specific upload configurations for different use cases
const uploadConfigs = {
    // For single avatar uploads
    singleAvatar: upload.single('avatar'),
    
    // For showcase logo uploads (square aspect ratio preferred)
    singleLogo: upload.single('logo'),
    
    // For showcase banner uploads (wide aspect ratio preferred)  
    singleBanner: upload.single('banner'),
    
    // For multiple images (events, posts, etc.)
    multipleImages: upload.array('images', 5), // max 5 images
    
    // For mixed fields (common in forms)
    mixedFields: upload.fields([
        { name: 'avatar', maxCount: 1 },
        { name: 'logo', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
        { name: 'images', maxCount: 5 },
        { name: 'paymentScreenshot', maxCount: 1 }
    ]),
    
    // For payment screenshot uploads
    paymentScreenshot: upload.single('paymentScreenshot'),
    
    // For showcase submission (logo + banner)
    showcaseSubmission: upload.fields([
        { name: 'logo', maxCount: 1 },
        { name: 'banner', maxCount: 1 }
    ]),
    
    // For user profile updates
    profileUpdate: upload.fields([
        { name: 'avatar', maxCount: 1 },
        { name: 'coverPhoto', maxCount: 1 }
    ]),
    
    // For QR code uploads
    qrCode: upload.single('qrCode')
};

// Enhanced error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        // Multer-specific errors
        let message = 'File upload error';
        let details = error.message;
        
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                message = 'File too large';
                details = 'Maximum file size is 5MB';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files';
                details = 'Maximum 5 files allowed per request';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Unexpected field';
                details = 'Check field names in your form';
                break;
            case 'LIMIT_PART_COUNT':
                message = 'Too many form parts';
                details = 'Too many fields in the form';
                break;
            case 'LIMIT_FIELD_KEY':
                message = 'Field name too long';
                details = 'Field name exceeds maximum length';
                break;
            case 'LIMIT_FIELD_VALUE':
                message = 'Field value too long';
                details = 'Field value exceeds maximum length';
                break;
            case 'LIMIT_FIELD_COUNT':
                message = 'Too many fields';
                details = 'Maximum 10 non-file fields allowed';
                break;
            default:
                message = 'Upload error';
                details = `Multer error: ${error.code}`;
        }
        
        return res.status(400).json({
            success: false,
            message,
            details,
            code: error.code
        });
    } else if (error) {
        // Other errors (like fileFilter errors)
        return res.status(400).json({
            success: false,
            message: 'File validation failed',
            details: error.message,
            code: 'FILE_VALIDATION_ERROR'
        });
    }
    next();
};

// Helper function to validate file types
const validateFileType = (file, allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']) => {
    return file && allowedTypes.includes(file.mimetype);
};

// Helper function to get file extension
const getFileExtension = (filename) => {
    return path.extname(filename || '').toLowerCase();
};

// Helper function to generate unique filename
const generateUniqueFilename = (originalname, prefix = 'file') => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = getFileExtension(originalname) || '.jpg';
    return `${prefix}_${timestamp}_${randomString}${extension}`;
};

// Helper function to validate image dimensions (for showcase assets)
const validateImageDimensions = (buffer, minWidth = null, minHeight = null, maxWidth = null, maxHeight = null) => {
    return new Promise((resolve, reject) => {
        // This would typically use a library like sharp or jimp
        // For now, we'll return a resolved promise as a placeholder
        // In production, you'd want to actually check dimensions
        
        // Example implementation with sharp:
        /*
        const sharp = require('sharp');
        sharp(buffer)
            .metadata()
            .then(metadata => {
                const { width, height } = metadata;
                let isValid = true;
                let message = '';
                
                if (minWidth && width < minWidth) {
                    isValid = false;
                    message = `Image width must be at least ${minWidth}px`;
                } else if (minHeight && height < minHeight) {
                    isValid = false;
                    message = `Image height must be at least ${minHeight}px`;
                } else if (maxWidth && width > maxWidth) {
                    isValid = false;
                    message = `Image width must be at most ${maxWidth}px`;
                } else if (maxHeight && height > maxHeight) {
                    isValid = false;
                    message = `Image height must be at most ${maxHeight}px`;
                }
                
                if (isValid) {
                    resolve({ width, height });
                } else {
                    reject(new Error(message));
                }
            })
            .catch(reject);
        */
        
        // Placeholder - always resolve for now
        resolve({ width: null, height: null, message: 'Dimension validation not implemented' });
    });
};

// Showcase-specific validation helpers
const showcaseValidators = {
    // Validate logo (should be square-ish)
    validateLogo: (buffer) => {
        return validateImageDimensions(buffer, 100, 100, 500, 500); // min 100x100, max 500x500
    },
    
    // Validate banner (should be wide)
    validateBanner: (buffer) => {
        return validateImageDimensions(buffer, 800, 300, 2000, 800); // min 800x300, max 2000x800
    },
    
    // Validate avatar (square)
    validateAvatar: (buffer) => {
        return validateImageDimensions(buffer, 50, 50, 500, 500); // min 50x50, max 500x500
    }
};

// Helper to process uploaded files for Cloudinary
const processUploadedFiles = (req) => {
    const files = {};
    
    if (req.file) {
        // Single file upload
        files[req.file.fieldname] = {
            buffer: req.file.buffer,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            fieldname: req.file.fieldname
        };
    } else if (req.files) {
        // Multiple files or fields
        if (Array.isArray(req.files)) {
            // Array of files
            req.files.forEach(file => {
                files[file.fieldname] = files[file.fieldname] || [];
                files[file.fieldname].push({
                    buffer: file.buffer,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    fieldname: file.fieldname
                });
            });
        } else {
            // Object with fields
            Object.keys(req.files).forEach(fieldname => {
                files[fieldname] = req.files[fieldname].map(file => ({
                    buffer: file.buffer,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    fieldname: file.fieldname
                }));
            });
        }
    }
    
    return files;
};

// Middleware to clean up uploaded files from memory
const cleanupUploadedFiles = (req, res, next) => {
    // Since we're using memory storage, we don't need to clean up disk files
    // But we can clear the buffers to free memory after processing
    const originalSend = res.send;
    
    res.send = function(data) {
        // Clear file buffers after response is sent
        if (req.file) {
            req.file.buffer = null;
        }
        if (req.files) {
            if (Array.isArray(req.files)) {
                req.files.forEach(file => file.buffer = null);
            } else {
                Object.values(req.files).forEach(files => {
                    files.forEach(file => file.buffer = null);
                });
            }
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

// Utility to check if request has files
const hasFiles = (req) => {
    return !!(req.file || (req.files && Object.keys(req.files).length > 0));
};

// Utility to get first file (useful for single file endpoints)
const getFirstFile = (req) => {
    if (req.file) {
        return req.file;
    }
    if (req.files) {
        const firstField = Object.keys(req.files)[0];
        return req.files[firstField]?.[0] || null;
    }
    return null;
};

module.exports = {
    upload,
    ...uploadConfigs,
    handleMulterError,
    validateFileType,
    getFileExtension,
    generateUniqueFilename,
    validateImageDimensions,
    showcaseValidators,
    processUploadedFiles,
    cleanupUploadedFiles,
    hasFiles,
    getFirstFile
};