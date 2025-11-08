function goBack() {
    window.history.back();
}

// Interactive gradient background
document.addEventListener('mousemove', (e) => {
    document.body.style.setProperty('--posX', e.clientX);
    document.body.style.setProperty('--posY', e.clientY);
});

// Animated color shifting - Orange and Purple theme
let phase = 0;

function animateColors() {
    phase += 0.01;
    
    // Oscillate between orange and purple
    const mix = (Math.sin(phase) + 1) / 2; // 0 to 1
    
    // Orange colors (RGB) - balanced tones
    const orange1 = [220, 100, 30];   // Rich orange
    const orange2 = [200, 85, 20];    // Medium orange
    const orange3 = [180, 70, 15];    // Deep orange
    const orangeDark = [130, 45, 10]; // Dark orange
    
    // Purple colors (RGB) - balanced tones
    const purple1 = [150, 50, 180];   // Rich purple
    const purple2 = [130, 40, 160];   // Medium purple
    const purple3 = [110, 30, 140];   // Deep purple
    const purpleDark = [80, 20, 100]; // Dark purple
    
    // Interpolate between orange and purple
    const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    
    const [r1, g1, b1] = lerp(orange1, purple1, mix);
    const [r2, g2, b2] = lerp(orangeDark, purpleDark, mix);
    const [r3, g3, b3] = lerp(orange2, purple2, mix);
    const [r4, g4, b4] = lerp(purpleDark, orangeDark, mix);
    const [r5, g5, b5] = lerp(orange3, purple3, mix);
    const [r6, g6, b6] = lerp(orangeDark, purpleDark, 1 - mix);
    const [r7, g7, b7] = lerp(orange2, purple1, mix);
    const [r8, g8, b8] = lerp(purpleDark, orangeDark, 1 - mix);
    const [r9, g9, b9] = lerp(purple3, orange3, mix);
    const [r10, g10, b10] = lerp(purpleDark, orangeDark, mix);
    const [r11, g11, b11] = lerp(orange1, purple2, 1 - mix);
    const [r12, g12, b12] = lerp(purpleDark, orangeDark, mix);
    
    document.body.style.setProperty('--color1', `rgb(${r1}, ${g1}, ${b1})`);
    document.body.style.setProperty('--color2', `rgb(${r2}, ${g2}, ${b2})`);
    document.body.style.setProperty('--color3', `rgb(${r3}, ${g3}, ${b3})`);
    document.body.style.setProperty('--color4', `rgb(${r4}, ${g4}, ${b4})`);
    document.body.style.setProperty('--color5', `rgb(${r5}, ${g5}, ${b5})`);
    document.body.style.setProperty('--color6', `rgb(${r6}, ${g6}, ${b6})`);
    document.body.style.setProperty('--color7', `rgb(${r7}, ${g7}, ${b7})`);
    document.body.style.setProperty('--color8', `rgb(${r8}, ${g8}, ${b8})`);
    document.body.style.setProperty('--color9', `rgb(${r9}, ${g9}, ${b9})`);
    document.body.style.setProperty('--color10', `rgb(${r10}, ${g10}, ${b10})`);
    document.body.style.setProperty('--color11', `rgb(${r11}, ${g11}, ${b11})`);
    document.body.style.setProperty('--color12', `rgb(${r12}, ${g12}, ${b12})`);
    
    requestAnimationFrame(animateColors);
}
animateColors();




