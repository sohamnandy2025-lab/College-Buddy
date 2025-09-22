// College Buddy - Main JavaScript File with Firebase Auth integration

let fbApp = null;
let auth = null;
let db = null;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the page
    initializePage();
    
    // Initialize Firebase (if configured)
    initializeFirebase();

    // Set up event listeners
    setupEventListeners();
    
    // Initialize animations
    initializeAnimations();
});

/**
 * Initialize the page with loading animation and setup
 */
function initializePage() {
    // Add loading animation to body
    document.body.classList.add('page-loader');
    
    // Initialize theme from localStorage
    initializeTheme();
    
    // Log welcome message for developers
    console.log('🎓 Welcome to College Buddy!');
    console.log('Connect, Learn, Grow with fellow students.');
    console.log('Features: Smart Search, Student Discovery, Real-time Chat');
    
    // Initialize tooltips if Bootstrap is loaded
    if (typeof bootstrap !== 'undefined') {
        // Initialize Bootstrap tooltips
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
}

/**
 * Initialize theme from localStorage or set default
 */
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    const themeIcon = document.getElementById('themeIcon');
    
    document.documentElement.setAttribute('data-theme', theme);
    
    if (themeIcon) {
        themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

/**
 * Set up all event listeners for interactive elements
 */
function setupEventListeners() {
    // Get important elements
    const navSignupBtn = document.getElementById('navSignupBtn');
    const aboutBtn = document.getElementById('aboutBtn');
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const showLogin = document.getElementById('showLogin');
    const showSignup = document.getElementById('showSignup');
    const aboutSection = document.getElementById('about');
    
    // Theme toggle functionality
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Modal switching functionality
    if (showLogin) {
        showLogin.addEventListener('click', function(e) {
            e.preventDefault();
            switchToLogin();
        });
    }
    
    if (showSignup) {
        showSignup.addEventListener('click', function(e) {
            e.preventDefault();
            switchToSignup();
        });
    }
    
    // About button functionality
    if (aboutBtn) {
        aboutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            toggleAboutSection();
        });
    }
    
    // Social authentication handlers
    setupSocialAuthHandlers();
    
    // Form submission handlers
    setupFormHandlers();
    
    // Navigation smooth scrolling
    setupSmoothScrolling();
    
    // Placeholder page links handling
    setupPlaceholderLinks();
    
    // Hero buttons interaction effects
    setupButtonEffects();
    
    // Navbar scroll effect
    setupNavbarScrollEffect();
    
    // Social links interaction
    setupSocialLinks();
}

/**
 * Toggle between dark and light theme
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    const themeIcon = document.getElementById('themeIcon');
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    if (newTheme === 'dark') {
        themeIcon.className = 'fas fa-sun';
        showNotification('Dark Mode Enabled 🌙', 'Switched to dark mode for better night viewing!', 'info');
    } else {
        themeIcon.className = 'fas fa-moon';
        showNotification('Light Mode Enabled ☀️', 'Switched to light mode for daytime viewing!', 'info');
    }
}

/**
 * Switch from signup modal to login modal
 */
function switchToLogin() {
    const signupModal = bootstrap.Modal.getInstance(document.getElementById('signupModal'));
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    
    if (signupModal) {
        signupModal.hide();
    }
    
    setTimeout(() => {
        loginModal.show();
    }, 300);
}

/**
 * Switch from login modal to signup modal
 */
function switchToSignup() {
    const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
    const signupModal = new bootstrap.Modal(document.getElementById('signupModal'));
    
    if (loginModal) {
        loginModal.hide();
    }
    
    setTimeout(() => {
        signupModal.show();
    }, 300);
}

/**
 * Setup social authentication handlers
 */
function setupSocialAuthHandlers() {
    // Google auth handlers
    const googleButtons = document.querySelectorAll('#googleSignup, #googleLogin');
    googleButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!auth) {
                showNotification('Configure Firebase', 'Please set up firebase-config.js to enable Google sign-in.', 'warning');
                return;
            }
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                const result = await auth.signInWithPopup(provider);
                const user = result.user;
                await ensureUserProfile(user, { provider: 'google' });
                showNotification('Signed in ✅', `Welcome ${user.displayName || user.email}!`, 'success');
                const signupModalEl = document.getElementById('signupModal');
                const loginModalEl = document.getElementById('loginModal');
                if (signupModalEl) bootstrap.Modal.getInstance(signupModalEl)?.hide();
                if (loginModalEl) bootstrap.Modal.getInstance(loginModalEl)?.hide();
            } catch (e) {
                console.error('Google sign-in error', e);
                showNotification('Sign-in failed', e.message || 'Could not sign in with Google.', 'danger');
            }
        });
    });
    
    // Facebook/GitHub remain disabled until configured
    const facebookButtons = document.querySelectorAll('#facebookSignup, #facebookLogin');
    facebookButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            showNotification('Facebook Authentication', 'Enable Facebook in Firebase Auth to use this.', 'info');
        });
    });
    
    const githubButton = document.getElementById('githubSignup');
    if (githubButton) {
        githubButton.addEventListener('click', () => {
            showNotification('GitHub Authentication', 'Enable GitHub in Firebase Auth to use this.', 'info');
        });
    }
}

/**
 * Setup form submission handlers
 */
function setupFormHandlers() {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignupSubmission);
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmission);
    }
}

/**
 * Handle signup form submission
 */
async function handleSignupSubmission(e) {
    e.preventDefault();
    if (!auth || !db) {
        showNotification('Configure Firebase', 'Please set up firebase-config.js to enable sign up.', 'warning');
        return;
    }

    try {
        const form = e.target;
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const college = document.getElementById('college').value.trim();
        const major = document.getElementById('major').value.trim();
        const password = document.getElementById('password').value;

        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const user = cred.user;
        try { await user.updateProfile({ displayName: `${firstName} ${lastName}`.trim() }); } catch (_) {}
        try { await user.sendEmailVerification(); } catch (_) {}

        await ensureUserProfile(user, {
            firstName, lastName, college, branch: major
        });

        showNotification('Welcome to College Buddy! 🎉', `Hi ${firstName}! We created your account. Please verify your email.`, 'success');

        const modal = bootstrap.Modal.getInstance(document.getElementById('signupModal'));
        if (modal) modal.hide();
    } catch (e2) {
        console.error('Signup error', e2);
        showNotification('Signup failed', e2.message || 'Could not create your account.', 'danger');
    }
}

/**
 * Handle login form submission
 */
async function handleLoginSubmission(e) {
    e.preventDefault();
    if (!auth) {
        showNotification('Configure Firebase', 'Please set up firebase-config.js to enable sign in.', 'warning');
        return;
    }

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        const user = cred.user;
        showNotification('Welcome Back! 👋', `Signed in as ${user.email}.`, 'success');
        const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (modal) modal.hide();
    } catch (e2) {
        console.error('Login error', e2);
        showNotification('Login failed', e2.message || 'Could not sign you in.', 'danger');
    }
}

/**
 * Toggle About section visibility
 */
function toggleAboutSection() {
    const aboutSection = document.getElementById('about');
    
    if (aboutSection.classList.contains('d-none')) {
        // Show about section
        aboutSection.classList.remove('d-none');
        aboutSection.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
        
        // Animate the content
        setTimeout(() => {
            aboutSection.style.opacity = '0';
            aboutSection.style.transform = 'translateY(20px)';
            aboutSection.style.transition = 'all 0.5s ease';
            
            setTimeout(() => {
                aboutSection.style.opacity = '1';
                aboutSection.style.transform = 'translateY(0)';
            }, 50);
        }, 100);
        
    } else {
        // Hide about section
        aboutSection.style.opacity = '0';
        aboutSection.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
            aboutSection.classList.add('d-none');
            // Scroll back to hero section
            document.getElementById('home').scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        }, 500);
    }
}

/**
 * Set up smooth scrolling for navigation links
 */
function setupSmoothScrolling() {
    // Get all anchor links that start with #
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Skip if it's just # or #signup (handled elsewhere)
            if (href === '#' || href === '#signup') {
                return;
            }
            
            const targetElement = document.querySelector(href);
            
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

/**
 * Set up placeholder links for pages that don't exist yet
 */
function setupPlaceholderLinks() {
    const placeholderLinks = document.querySelectorAll('a[href$=".html"]');
    
    placeholderLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const pageName = this.textContent.trim();
            const href = this.getAttribute('href');
            
            showNotification(`${pageName} Page`, 
                `The ${pageName.toLowerCase()} page (${href}) is coming soon! This is currently a demo.`, 
                'info');
        });
    });
}

/**
 * Set up button hover and click effects
 */
function setupButtonEffects() {
    const buttons = document.querySelectorAll('.btn');
    
    buttons.forEach(button => {
        // Add ripple effect on click
        button.addEventListener('click', function(e) {
            createRippleEffect(e, this);
        });
        
        // Add subtle animation on hover
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px) scale(1.02)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

/**
 * Create ripple effect on button click
 */
function createRippleEffect(event, element) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');
    
    // Add ripple styles
    ripple.style.position = 'absolute';
    ripple.style.borderRadius = '50%';
    ripple.style.background = 'rgba(255, 255, 255, 0.6)';
    ripple.style.transform = 'scale(0)';
    ripple.style.animation = 'ripple 0.6s linear';
    ripple.style.pointerEvents = 'none';
    
    // Ensure button has relative positioning
    if (getComputedStyle(element).position === 'static') {
        element.style.position = 'relative';
    }
    
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    // Remove ripple after animation
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

/**
 * Set up navbar scroll effect
 */
function setupNavbarScrollEffect() {
    const navbar = document.querySelector('.navbar');
    
    if (navbar) {
        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > 50) {
                navbar.classList.add('navbar-scrolled');
                navbar.style.background = 'rgba(0, 123, 255, 0.98)';
                navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
            } else {
                navbar.classList.remove('navbar-scrolled');
                navbar.style.background = 'rgba(0, 123, 255, 0.95)';
                navbar.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            }
        });
    }
}

/**
 * Set up social links interaction
 */
function setupSocialLinks() {
    const socialLinks = document.querySelectorAll('.social-links a');
    
    socialLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const platform = this.querySelector('i').className.includes('facebook') ? 'Facebook' :
                           this.querySelector('i').className.includes('twitter') ? 'Twitter' :
                           this.querySelector('i').className.includes('instagram') ? 'Instagram' :
                           this.querySelector('i').className.includes('linkedin') ? 'LinkedIn' : 'Social';
            
            showNotification(`${platform} Link`, 
                `${platform} integration coming soon! Follow us for updates.`, 
                'info');
        });
    });
}

/**
 * Initialize animations and intersection observers
 */
function initializeAnimations() {
    // Create intersection observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observe feature boxes
    const featureBoxes = document.querySelectorAll('.feature-box');
    featureBoxes.forEach(box => {
        observer.observe(box);
    });
    
    // Add CSS for animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
        
        .animate-in {
            animation: fadeInUp 0.6s ease-out forwards;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Show notification to user
 */
function showNotification(title, message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'info' ? 'primary' : type} alert-dismissible fade show`;
    notification.style.position = 'fixed';
    notification.style.top = '100px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    notification.style.maxWidth = '400px';
    notification.style.borderRadius = '12px';
    notification.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.15)';
    
    notification.innerHTML = `
        <div class="d-flex align-items-start">
            <div class="me-3">
                <i class="fas fa-info-circle fa-lg"></i>
            </div>
            <div>
                <strong>${title}</strong><br>
                <small>${message}</small>
            </div>
            <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

/**
 * Utility function to detect mobile devices
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Handle form submissions (future use)
 */
function handleFormSubmission(formData) {
    // This would be used for actual form submissions
    console.log('Form submission:', formData);
    
    // Show success message
    showNotification('Success!', 'Your information has been submitted successfully.', 'success');
}

// Firebase initialization and helpers
function initializeFirebase() {
    try {
        const cfg = window.COLLEGE_BUDDY_FIREBASE_CONFIG;
        if (!cfg) { console.warn('firebase-config.js not found or empty'); return; }
        if (!window.firebase || !window.firebase.initializeApp) { console.warn('Firebase SDK not loaded'); return; }
        if (!fbApp) fbApp = firebase.initializeApp(cfg);
        auth = firebase.auth();
        db = firebase.firestore();
        // Optional: auth state listener
        auth.onAuthStateChanged((u) => {
            if (u) console.log('Signed in as', u.email || u.uid);
            else console.log('Signed out');
        });
    } catch (e) {
        console.warn('Firebase init error', e);
    }
}

async function ensureUserProfile(user, extra = {}) {
    if (!db || !user) return;
    const ref = db.collection('users').doc(user.uid);
    const snap = await ref.get();
    const now = firebase.firestore.FieldValue.serverTimestamp();
    if (!snap.exists) {
        const displayName = user.displayName || '';
        const [firstName, ...rest] = displayName.split(' ');
        const lastName = rest.join(' ');
        const base = {
            uid: user.uid,
            name: displayName || extra.firstName ? `${extra.firstName || ''} ${extra.lastName || ''}`.trim() : (user.email || ''),
            firstName: extra.firstName || firstName || '',
            lastName: extra.lastName || lastName || '',
            email: user.email || '',
            college: extra.college || '',
            branch: extra.branch || '',
            friends: [],
            createdAt: now,
            updatedAt: now,
        };
        const tokens = buildSearchTokens(base);
        await ref.set({ ...base, searchIndex: tokens }, { merge: true });
    } else {
        await ref.set({ updatedAt: now }, { merge: true });
    }
}

function buildSearchTokens(u) {
    const src = [u.name, u.firstName, u.lastName, u.email, u.college, u.branch]
        .filter(Boolean)
        .join(' ') // join fields
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ');
    const parts = src.split(/\s+/).filter(Boolean);
    const uniq = Array.from(new Set(parts));
    return uniq.slice(0, 100);
}
