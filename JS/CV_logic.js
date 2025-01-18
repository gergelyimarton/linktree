document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.getElementById("menu-toggle");
    const navbar = document.getElementById("navbar");
    // const menuLinks = document.querySelectorAll(".menu-link");
    const menuLinks = document.querySelectorAll('.navbar a'); // Kiválasztjuk a linkeket a menüből


   

    
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
