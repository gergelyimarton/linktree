document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.getElementById("menu-toggle");
    const navbar = document.getElementById("navbar");
    // const menuLinks = document.querySelectorAll(".menu-link");
    const menuLinks = document.querySelectorAll('.navbar a'); // Kiválasztjuk a linkeket a menüből
    const dockItems = document.querySelectorAll('.dock-item');

    // Dock magnification effect
    const SCALE_RANGE = 1; // How many items on each side get scaled
    const BASE_SCALE = 1;
    const MAX_SCALE = 1.3;
    
    dockItems.forEach((item, index) => {
        item.addEventListener('mouseenter', () => {
            dockItems.forEach((otherItem, otherIndex) => {
                const distance = Math.abs(index - otherIndex);
                if (distance === 0) {
                    // The hovered item
                    otherItem.style.transform = `scale(${MAX_SCALE})`;
                } else if (distance <= SCALE_RANGE) {
                    // Adjacent items
                    const scale = BASE_SCALE + (MAX_SCALE - BASE_SCALE) * (1 - distance / (SCALE_RANGE + 1));
                    otherItem.style.transform = `scale(${scale})`;
                } else {
                    // Items far away
                    otherItem.style.transform = `scale(${BASE_SCALE})`;
                }
            });
        });
    });

    // Reset all items when mouse leaves the navbar
    navbar.addEventListener('mouseleave', () => {
        dockItems.forEach(item => {
            item.style.transform = `scale(${BASE_SCALE})`;
        });
    });

    // ASCII Text Animation
    const asciiText = document.getElementById("ascii-text");
    const finalText = "Marton";
    const chars = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let iteration = 0;

    const animateText = () => {
        asciiText.innerText = finalText
            .split("")
            .map((char, index) => {
                if (index < iteration) {
                    return finalText[index];
                }
                return chars[Math.floor(Math.random() * chars.length)];
            })
            .join("");

        if (iteration >= finalText.length) {
            clearInterval(interval);
        }

        iteration += 1 / 8;
    };

    const interval = setInterval(animateText, 50);


   

    
    let lastScrollPosition = 0; // Az előző görgetési pozíció

    window.addEventListener("scroll", () => {
        const currentScrollPosition = window.scrollY;
    
        if (currentScrollPosition > lastScrollPosition) {
            // Ha lefelé görget, elrejti a menüt
            navbar.classList.remove("visible");
        } else {
            // Ha felfelé görget, megjeleníti a menüt
            navbar.classList.add("visible");
        }
    
        lastScrollPosition = currentScrollPosition; // Frissíti az előző görgetési pozíciót
    });
    


    // Toggle navbar visibility when clicking the hamburger icon
    menuToggle.addEventListener("click", () => {
        navbar.classList.toggle("active");
    });

    // Close the menu and scroll smoothly when clicking any menu link
    menuLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault(); // Megakadályozza az alapértelmezett kattintási viselkedést
            
            const targetId = link.getAttribute("href").substring(1); // A hivatkozott szekció ID-ja
            const targetSection = document.getElementById(targetId);
            
            // Bezárja a menüt
            navbar.classList.remove("active");
            
            // Görgetés 100px eltolással
            window.scrollTo({
                top: targetSection.offsetTop - 100, // A tartalom a menü alatt 100px-el jelenjen meg
                behavior: 'smooth'
            });
        });
    });









    // When the user scrolls the page, execute myFunction 
    window.onscroll = function() {myFunction()};

    function myFunction() {
        var winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        var scrolled = (winScroll / height) * 100;
        document.getElementById("myBar").style.width = scrolled + "%";
    }
    






    // Minden <section> elemhez hozzáadjuk a "visible" osztályt, hogy elinduljon az animáció
    var sections = document.querySelectorAll('section');
    
    sections.forEach(function(section, index) {
        // Késleltetett animációk hozzáadása minden szekcióhoz
        setTimeout(function() {
            section.classList.add('visible');
        }, index * 300); // Minden szekció egy kis késleltetéssel jelenik meg
    });










});
