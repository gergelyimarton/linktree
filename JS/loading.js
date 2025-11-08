// Loading Screen with Resource Tracking
(function() {
    const loadingScreen = document.getElementById('loading-screen');
    const mainContent = document.getElementById('all-content');
    const progressBar = document.getElementById('progress-bar');
    const loadingPercentage = document.getElementById('loading-percentage');
    
    // Exit if loading screen elements don't exist
    if (!loadingScreen || !progressBar || !loadingPercentage) return;
    
    let loadedResources = 0;
    let totalResources = 0;
    const minLoadingTime = 400; // Minimum loading time in ms
    const startTime = Date.now();
    
    // Get all resources to track
    function getAllResources() {
        const images = Array.from(document.images);
        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        return [...images, ...stylesheets];
    }
    
    // Update progress
    function updateProgress() {
        const percentage = totalResources > 0 ? Math.round((loadedResources / totalResources) * 100) : 0;
        progressBar.style.width = percentage + '%';
        loadingPercentage.textContent = percentage + '%';
        
        if (loadedResources >= totalResources) {
            finishLoading();
        }
    }
    
    // Finish loading with minimum time check
    function finishLoading() {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
        
        setTimeout(() => {
            // Ensure 100% is shown briefly
            progressBar.style.width = '100%';
            loadingPercentage.textContent = '100%';
            
            setTimeout(() => {
                // Blur és áttűnés a loading screen-nél
                loadingScreen.style.opacity = '0';
                loadingScreen.style.filter = 'blur(10px)';
                loadingScreen.style.visibility = 'hidden';

                // Fő tartalom megjelenítése
                if (mainContent) {
                    mainContent.style.display = 'flex';
                    setTimeout(() => {
                        mainContent.style.opacity = '1';
                    }, 50);
                }
            }, 300); // Show 100% for 300ms
        }, remainingTime);
    }
    
    // Track resource loading
    function trackResources() {
        const resources = getAllResources();
        totalResources = resources.length;
        
        if (totalResources === 0) {
            // No resources to track, finish immediately
            totalResources = 1;
            loadedResources = 1;
            updateProgress();
            return;
        }
        
        resources.forEach(resource => {
            if (resource.complete || resource.readyState === 'complete') {
                // Already loaded
                loadedResources++;
            } else {
                // Wait for load
                resource.addEventListener('load', () => {
                    loadedResources++;
                    updateProgress();
                });
                
                resource.addEventListener('error', () => {
                    // Count failed resources as loaded to continue
                    loadedResources++;
                    updateProgress();
                });
            }
        });
        
        updateProgress();
    }
    
    // Start tracking when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', trackResources);
    } else {
        trackResources();
    }
    
    // Fallback: if window.load fires, ensure we finish
    window.addEventListener('load', () => {
        if (loadedResources < totalResources) {
            loadedResources = totalResources;
            updateProgress();
        }
    });
})();
