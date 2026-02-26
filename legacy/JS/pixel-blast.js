class PixelBlast {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'pixel-blast-canvas';
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.particleCount = 30;
        this.colors = [
            '#FFFFFF', '#FFFFFF', '#FFFFFF'  // White
        ];
        this.mouse = {
            x: null,
            y: null,
            radius: 150
        };
        
        this.init();
    }
    
    init() {
        document.body.insertBefore(this.canvas, document.body.firstChild);
        this.resize();
        this.createParticles();
        this.animate();
        
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseleave', () => this.handleMouseLeave());
    }
    
    handleMouseMove(e) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
    }
    
    handleMouseLeave() {
        this.mouse.x = null;
        this.mouse.y = null;
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 6 + 3,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.5,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                opacity: Math.random() * 0.5 + 0.3,
                pulseSpeed: Math.random() * 0.02 + 0.01,
                pulsePhase: Math.random() * Math.PI * 2
            });
        }
    }
    
    drawParticle(particle) {
        this.ctx.save();
        
        // Pulsing effect
        particle.pulsePhase += particle.pulseSpeed;
        const pulse = Math.sin(particle.pulsePhase) * 0.3 + 0.7;
        const currentSize = particle.size * pulse;
        
        // Draw pixel (square)
        this.ctx.fillStyle = particle.color;
        this.ctx.globalAlpha = particle.opacity * pulse;
        this.ctx.fillRect(
            particle.x - currentSize / 2,
            particle.y - currentSize / 2,
            currentSize,
            currentSize
        );
        
        // Add glow effect
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = particle.color;
        this.ctx.fillRect(
            particle.x - currentSize / 2,
            particle.y - currentSize / 2,
            currentSize,
            currentSize
        );
        
        this.ctx.restore();
    }
    
    updateParticle(particle) {
        // Mouse interaction
        if (this.mouse.x !== null && this.mouse.y !== null) {
            const dx = this.mouse.x - particle.x;
            const dy = this.mouse.y - particle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.mouse.radius) {
                const force = (this.mouse.radius - distance) / this.mouse.radius;
                const angle = Math.atan2(dy, dx);
                particle.x -= Math.cos(angle) * force * 2;
                particle.y -= Math.sin(angle) * force * 2;
            }
        }
        
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        // Wrap around edges
        if (particle.x < 0) particle.x = this.canvas.width;
        if (particle.x > this.canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = this.canvas.height;
        if (particle.y > this.canvas.height) particle.y = 0;
    }
    
    drawConnections() {
        const maxDistance = 150;
        
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < maxDistance) {
                    this.ctx.save();
                    this.ctx.strokeStyle = this.particles[i].color;
                    this.ctx.globalAlpha = (1 - distance / maxDistance) * 0.15;
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                    this.ctx.restore();
                }
            }
        }
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw connections first (behind particles)
        this.drawConnections();
        
        // Update and draw particles
        this.particles.forEach(particle => {
            this.updateParticle(particle);
            this.drawParticle(particle);
        });
        
        requestAnimationFrame(() => this.animate());
    }
}

function initPixelBlast() {
    if (window.matchMedia('(max-width: 550px)').matches) {
        return; // Disable pixel blast effect on phones for performance
    }
    new PixelBlast();
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPixelBlast);
} else {
    initPixelBlast();
}
