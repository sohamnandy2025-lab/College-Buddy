// College Buddy - Main JavaScript File with Firebase Auth integration

let fbApp = null;
let auth = null;
let db = null;
let demoMode = false;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the page
    initializePage();
    
    // Initialize Firebase (if configured)
    initializeFirebase();

    // Set up event listeners
    setupEventListeners();

    // Wire config modal actions
    setupFirebaseConfigModal();
    
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
    
    // Load user profile picture
    loadUserProfilePicture();
    
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
    
    // Auth modal functionality
    setupAuthModalHandlers();
    
    // Logo click functionality
    const logo = document.querySelector('.college-buddy-logo');
    if (logo) {
        logo.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
 * Setup auth modal handlers
 */
function setupAuthModalHandlers() {
    // Get elements
    const signupView = document.getElementById('signupView');
    const signinView = document.getElementById('signinView');
    const emailFormView = document.getElementById('emailFormView');
    const emailSignupForm = document.getElementById('emailSignupForm');
    const emailLoginForm = document.getElementById('emailLoginForm');
    const emailFormTitle = document.getElementById('emailFormTitle');
    
    // Switch between signup and signin views
    const switchToLogin = document.getElementById('switchToLogin');
    const switchToSignup = document.getElementById('switchToSignup');
    
    if (switchToLogin) {
        switchToLogin.addEventListener('click', function(e) {
            e.preventDefault();
            showAuthView('signin');
        });
    }
    
    if (switchToSignup) {
        switchToSignup.addEventListener('click', function(e) {
            e.preventDefault();
            showAuthView('signup');
        });
    }
    
    // Email signup/login buttons
    const emailSignup = document.getElementById('emailSignup');
    const emailLogin = document.getElementById('emailLogin');
    const backToOptions = document.getElementById('backToOptions');
    
    if (emailSignup) {
        emailSignup.addEventListener('click', function(e) {
            e.preventDefault();
            showEmailForm('signup');
        });
    }
    
    if (emailLogin) {
        emailLogin.addEventListener('click', function(e) {
            e.preventDefault();
            showEmailForm('login');
        });
    }
    
    if (backToOptions) {
        backToOptions.addEventListener('click', function(e) {
            e.preventDefault();
            showAuthView('signup');
        });
    }
    
    // Form submissions
    if (emailSignupForm) {
        emailSignupForm.addEventListener('submit', handleEmailSignup);
    }
    
    if (emailLoginForm) {
        emailLoginForm.addEventListener('submit', handleEmailLogin);
    }
    
    // Social auth handlers
    const googleSignup = document.getElementById('googleSignup');
    const googleLogin = document.getElementById('googleLogin');
    
    if (googleSignup) {
        googleSignup.addEventListener('click', function(e) {
            e.preventDefault();
            handleGoogleAuth('signup');
        });
    }
    
    if (googleLogin) {
        googleLogin.addEventListener('click', function(e) {
            e.preventDefault();
            handleGoogleAuth('login');
        });
    }
    
    // Reset modal to signup view when opened
    const authModal = document.getElementById('authModal');
    if (authModal) {
        authModal.addEventListener('show.bs.modal', function() {
            showAuthView('signup');
        });
    }
}

/**
 * Show specific auth view with smooth transition
 */
function showAuthView(view) {
    const signupView = document.getElementById('signupView');
    const signinView = document.getElementById('signinView');
    const emailFormView = document.getElementById('emailFormView');
    
    // Hide all views
    [signupView, signinView, emailFormView].forEach(v => {
        if (v) v.classList.add('d-none');
    });
    
    // Show selected view
    if (view === 'signup' && signupView) {
        signupView.classList.remove('d-none');
    } else if (view === 'signin' && signinView) {
        signinView.classList.remove('d-none');
    } else if (view === 'emailForm' && emailFormView) {
        emailFormView.classList.remove('d-none');
    }
}

/**
 * Show email form for signup or login
 */
function showEmailForm(type) {
    const emailFormTitle = document.getElementById('emailFormTitle');
    const emailSignupForm = document.getElementById('emailSignupForm');
    const emailLoginForm = document.getElementById('emailLoginForm');
    
    if (type === 'signup') {
        if (emailFormTitle) emailFormTitle.innerHTML = '<i class="fas fa-envelope me-2"></i>Sign up with Email';
        if (emailSignupForm) emailSignupForm.classList.remove('d-none');
        if (emailLoginForm) emailLoginForm.classList.add('d-none');
    } else {
        if (emailFormTitle) emailFormTitle.innerHTML = '<i class="fas fa-envelope me-2"></i>Sign in with Email';
        if (emailSignupForm) emailSignupForm.classList.add('d-none');
        if (emailLoginForm) emailLoginForm.classList.remove('d-none');
    }
    
    showAuthView('emailForm');
}

/**
 * Handle email signup
 */
function handleEmailSignup(e) {
    e.preventDefault();
    const firstName = document.getElementById('firstName').value;
    const email = document.getElementById('signupEmail').value;
    
    showNotification('Welcome to College Buddy! 🎉', 
        `Hi ${firstName}! Your account creation is in progress. You'll receive a verification email at ${email}.`, 
        'success');
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
    if (modal) modal.hide();
}

/**
 * Handle email login
 */
function handleEmailLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    
    showNotification('Welcome Back! 👋', 
        `Logging you in with ${email}... This is a demo, but you'd be redirected to your dashboard!`, 
        'success');
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
    if (modal) modal.hide();
}

/**
 * Handle Google authentication
 */
function handleGoogleAuth(type) {
    const message = type === 'signup' ? 
        'Google Sign Up coming soon! This will allow instant account creation with your Google account.' :
        'Google Sign In coming soon! Quick access with your Google account.';
    
    showNotification('Google Authentication 🔐', message, 'info');
}

/**
 * Setup social authentication handlers
 */
function setupSocialAuthHandlers() {
    // Google auth handlers
    const googleButtons = document.querySelectorAll('#googleSignup, #googleLogin');
    googleButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!auth && !demoMode) {
                // If Firebase not initialized, open config modal for quick setup
                const modalEl = document.getElementById('firebaseConfigModal');
                if (modalEl && typeof bootstrap !== 'undefined') {
                    new bootstrap.Modal(modalEl).show();
                }
                showNotification('Configure Firebase', 'Paste your Firebase config JSON (Project settings → General → Your apps) and enable Google provider in Firebase Console. Or use Local Demo Mode.', 'warning');
                return;
            }
            try {
                let user;
                if (demoMode) {
                    user = await demoSignInWithGoogle();
                } else {
                    const provider = new firebase.auth.GoogleAuthProvider();
                    // Always show account chooser
                    provider.setCustomParameters({ prompt: 'select_account' });
                    let result;
                    try {
                        result = await auth.signInWithPopup(provider);
                    } catch (e) {
                        if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/popup-closed-by-user') {
                            // Fallback to redirect flow
                            await auth.signInWithRedirect(provider);
                            return; // redirecting
                        }
                        throw e;
                    }
                    user = result.user;
                }
                await ensureUserProfile(user, { provider: 'google' });
                showNotification('Signed in ✅', `Welcome ${user.displayName || user.email}! Redirecting to discover page...`, 'success');
                const signupModalEl = document.getElementById('authModal');
                if (signupModalEl) bootstrap.Modal.getInstance(signupModalEl)?.hide();
                // Redirect to discover page after successful sign-in
                setTimeout(() => {
                    window.location.href = '../frontend-profile/discover.html';
                }, 1500);
            } catch (e) {
                console.error('Google sign-in error', e);
                // Common provider misconfig error
                if (e?.code === 'auth/operation-not-allowed') {
                    showNotification('Enable Google provider', 'In Firebase Console → Authentication → Sign-in method, enable Google. Also add this domain to Authorized domains.', 'danger');
                } else if (e?.code === 'auth/popup-blocked') {
                    showNotification('Popup blocked', 'Allow popups for this site or try again.', 'warning');
                } else if (e?.code === 'auth/cancelled-popup-request') {
                    // ignore minor UX case
                } else {
                    showNotification('Sign-in failed', e.message || 'Could not sign in with Google.', 'danger');
                }
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
    if ((!auth || !db) && !demoMode) {
        showNotification('Configure Firebase', 'Add your Firebase config (Config button) and enable Email/Password provider. Or use Local Demo Mode. Open via http://localhost and add localhost to Authorized domains.', 'warning');
        return;
    }

    try {
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const college = document.getElementById('college').value.trim();
        const major = document.getElementById('major').value.trim();
        const password = document.getElementById('password').value;

        let user;
        if (demoMode) {
            user = await demoCreateUser(email, password, `${firstName} ${lastName}`.trim());
        } else {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            user = cred.user;
            try { await user.updateProfile({ displayName: `${firstName} ${lastName}`.trim() }); } catch (_) {}
            // Send verification email with a safe continue URL if running on http(s)
            try {
                const actionCodeSettings = (location.protocol === 'http:' || location.protocol === 'https:') ? {
                    url: location.origin + '/?verified=1',
                    handleCodeInApp: false
                } : undefined;
                await user.sendEmailVerification(actionCodeSettings);
            } catch (_) {}
        }

        await ensureUserProfile(user, {
            firstName, lastName, college, branch: major
        });

<<<<<<< HEAD
        showNotification('Welcome to College Buddy! 🎉', `Hi ${firstName}! Your account is ready${demoMode ? ' (demo mode)' : ''}. Redirecting to discover page...`, 'success');
>>>>>>> ad86dff3ae4f2f8492f8656acf0cc148c1b73b69

        const modal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
        if (modal) modal.hide();
        // Redirect to discover page after successful signup
        setTimeout(() => {
            window.location.href = '../frontend-profile/discover.html';
        }, 1500);
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
    if (!auth && !demoMode) {
        showNotification('Configure Firebase', 'Add your Firebase config (Config button). Make sure Email/Password provider is enabled and this domain is in Authorized domains. Or use Local Demo Mode.', 'warning');
        return;
    }

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
<<<<<<< HEAD
        let user;
        if (demoMode) {
            user = await demoSignIn(email, password);
        } else {
            const cred = await auth.signInWithEmailAndPassword(email, password);
            user = cred.user;
        }
        showNotification('Welcome Back! 👋', `Signed in as ${user.email || user.displayName}. Redirecting to discover page...`, 'success');
        const modal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
>>>>>>> ad86dff3ae4f2f8492f8656acf0cc148c1b73b69
        if (modal) modal.hide();
        // Redirect to discover page after successful email sign-in
        setTimeout(() => {
            window.location.href = '../frontend-profile/discover.html';
        }, 1500);
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
 * Load user profile picture (simulated)
 */
function loadUserProfilePicture() {
    // In a real app, this would load the user's actual profile picture
    // For now, we'll use a placeholder
    const profileImg = document.getElementById('profileImage');
    if (profileImg) {
        // You can replace this with actual user profile picture URL
        profileImg.src = 'https://via.placeholder.com/40x40/667eea/ffffff?text=' + 
            (localStorage.getItem('userInitials') || 'U');
    }
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
        if (!window.firebase || !window.firebase.initializeApp) { console.warn('Firebase SDK not loaded'); return; }
        let cfg = window.COLLEGE_BUDDY_FIREBASE_CONFIG;
        if (!cfg) {
            // Try reading inline JSON from <script id="firebase-config" type="application/json">
            const el = document.getElementById('firebase-config');
            if (el && el.textContent) {
                try { const parsed = JSON.parse(el.textContent.trim() || '{}'); if (Object.keys(parsed).length) cfg = parsed; } catch(_) {}
            }
        }
        if (!cfg) {
            // Try localStorage
            try {
                const stored = localStorage.getItem('collegeBuddyFirebaseConfig');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && parsed.apiKey) cfg = parsed;
                }
            } catch (_) {}
        }
        if (!cfg || !cfg.apiKey) {
            console.warn('Firebase config missing (inline/localStorage).');
            return; // leave auth/db null; UI will show helpful notifications & config modal
        }
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
    if (!user) return;
    const displayName = user.displayName || '';
    const [firstNameGuess, ...rest] = displayName.split(' ');
    const lastNameGuess = rest.join(' ');
    const base = {
        uid: user.uid,
        name: displayName || (extra.firstName || '') + ' ' + (extra.lastName || ''),
        firstName: extra.firstName || firstNameGuess || '',
        lastName: extra.lastName || lastNameGuess || '',
        email: user.email || '',
        college: extra.college || '',
        branch: extra.branch || '',
        friends: [],
    };
    if (db) {
        const ref = db.collection('users').doc(user.uid);
        const snap = await ref.get();
        const now = firebase.firestore.FieldValue.serverTimestamp();
        if (!snap.exists) {
            const tokens = buildSearchTokens(base);
            await ref.set({ ...base, searchIndex: tokens, createdAt: now, updatedAt: now }, { merge: true });
        } else {
            await ref.set({ updatedAt: now }, { merge: true });
        }
    } else if (demoMode) {
        // Store locally
        const key = 'collegeBuddyDemoProfiles';
        const all = JSON.parse(localStorage.getItem(key) || '{}');
        all[user.uid] = { ...base, createdAt: Date.now(), updatedAt: Date.now() };
        localStorage.setItem(key, JSON.stringify(all));
    }
}

function setupFirebaseConfigModal() {
    const saveBtn = document.getElementById('saveFirebaseConfigBtn');
    const demoBtn = document.getElementById('useDemoModeBtn');
    const textarea = document.getElementById('firebaseConfigTextarea');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            try {
                const text = (textarea?.value || '').trim();
                const cfg = JSON.parse(text);
                const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
                for (const k of required) {
                    if (!cfg[k]) throw new Error(`Missing ${k}`);
                }
                // Save to localStorage so it persists without committing to Git
                localStorage.setItem('collegeBuddyFirebaseConfig', JSON.stringify(cfg));
                // Also reflect into inline script tag for immediate use
                const el = document.getElementById('firebase-config');
                if (el) el.textContent = JSON.stringify(cfg);
                // Re-initialize Firebase
                initializeFirebase();
                // Close modal
                const modalEl = document.getElementById('firebaseConfigModal');
                if (modalEl && typeof bootstrap !== 'undefined') {
                    bootstrap.Modal.getInstance(modalEl)?.hide();
                }
                showNotification('Firebase configured', 'Your Firebase config has been saved locally. You can now sign in.', 'success');
            } catch (e) {
                console.error('Invalid Firebase config', e);
                showNotification('Invalid config', e.message || 'Please paste a valid Firebase Web App config JSON.', 'danger');
            }
        });
    }
    if (demoBtn) {
        demoBtn.addEventListener('click', () => {
            demoMode = true;
            // Close modal
            const modalEl = document.getElementById('firebaseConfigModal');
            if (modalEl && typeof bootstrap !== 'undefined') {
                bootstrap.Modal.getInstance(modalEl)?.hide();
            }
            showNotification('Demo mode enabled', 'Running locally without Firebase. Sign-up/sign-in will be stored only in your browser.', 'info');
        });
    }
}

// Demo-mode helpers
function demoUsers() {
    return JSON.parse(localStorage.getItem('collegeBuddyDemoUsers') || '{}');
}
function saveDemoUsers(map) {
    localStorage.setItem('collegeBuddyDemoUsers', JSON.stringify(map));
}
function makeDemoUser(email, displayName) {
    return { uid: 'demo_' + btoa(email).replace(/=+$/,''), email, displayName };
}
async function demoCreateUser(email, password, displayName) {
    const users = demoUsers();
    if (users[email]) throw new Error('Account already exists');
    users[email] = { password, displayName };
    saveDemoUsers(users);
    return makeDemoUser(email, displayName);
}
async function demoSignIn(email, password) {
    const users = demoUsers();
    if (!users[email] || users[email].password !== password) throw new Error('Invalid email or password');
    return makeDemoUser(email, users[email].displayName);
}
async function demoSignInWithGoogle() {
    // Create a demo Google account
    const email = 'demo.google.user@example.com';
    const users = demoUsers();
    if (!users[email]) {
        users[email] = { password: null, displayName: 'Demo Google User' };
        saveDemoUsers(users);
    }
    return makeDemoUser(email, users[email].displayName);
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
