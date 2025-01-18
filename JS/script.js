function goBack() {
    window.history.back();
}


// script.js
window.addEventListener('load', () => {
    const loadingScreen = document.getElementById('loading-screen');
    const mainContent = document.getElementById('all-content');

    setTimeout(() => {
        // Blur és áttűnés a loading screen-nél
        loadingScreen.style.opacity = '0';
        loadingScreen.style.filter = 'blur(10px)';
        loadingScreen.style.visibility = 'hidden';

        // Fő tartalom megjelenítése
        mainContent.style.display = 'flex';
        setTimeout(() => {
            mainContent.style.opacity = '1';
        }, 50); // Kis késleltetés a sima megjelenéshez
    }, 1000); // Legalább 1 másodpercig legyen látható a loading képernyő
});


