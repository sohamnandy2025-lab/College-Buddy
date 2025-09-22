// College Buddy - Main JavaScript File

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the page
    initializePage();
    
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
    
    // Log welcome message for developers
    console.log('🎓 Welcome to College Buddy!');
    console.log('Connect, Learn, Grow with fellow students.');
    
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
 * Set up all event listeners for interactive elements
 */
function setupEventListeners() {
    // Get important elements
    const navSignupBtn = document.getElementById('navSignupBtn');
    const navLoginBtn = document.getElementById('navLoginBtn');
    const aboutBtn = document.getElementById('aboutBtn');
    const featuresBtn = document.getElementById('featuresBtn');
    const aboutSection = document.getElementById('about');
    
    // Navigation Sign Up button functionality
    if (navSignupBtn) {
        navSignupBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleSignupClick();
        });
    }
    
    // Navigation Login button functionality
    if (navLoginBtn) {
        navLoginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleLoginClick();
        });
    }
    
    // About button functionality
    if (aboutBtn) {
        aboutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            toggleAboutSection();
        });
    }
    
    // Features button functionality
    if (featuresBtn) {
        featuresBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleFeaturesClick();
        });
    }
    
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
 * Handle Sign Up button click
 */
function handleSignupClick() {
    showNotification('Join College Buddy! 🎓', 
        'Ready to connect with students nationwide? Sign up functionality coming soon in this demo!', 
        'info');
    
    // In a real application, you might redirect to a signup page:
    // window.location.href = 'signup.html';
}

/**
 * Handle Login button click
 */
function handleLoginClick() {
    showNotification('Welcome Back! 👋', 
        'Login functionality will redirect you to the sign-in page. This is currently a demo!', 
        'info');
    
    // In a real application, you might redirect to a login page:
    // window.location.href = 'login.html';
}

/**
 * Handle Features button click
 */
function handleFeaturesClick() {
    // Scroll to feature highlights in the hero section
    const featureList = document.querySelector('.feature-list');
    if (featureList) {
        featureList.scrollIntoView({ 
            behavior: 'smooth',
            block: 'center'
        });
        
        // Highlight the feature list temporarily
        featureList.style.background = 'rgba(0, 123, 255, 0.1)';
        featureList.style.borderRadius = '12px';
        featureList.style.padding = '1rem';
        featureList.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
            featureList.style.background = 'transparent';
            featureList.style.padding = '0';
        }, 3000);
    } else {
        showNotification('Features Overview 🌟', 
            'Discover all the amazing features College Buddy offers for student networking!', 
            'info');
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

// Export functions for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializePage,
        handleSignupClick,
        toggleAboutSection,
        showNotification,
        isMobileDevice
    };
}
