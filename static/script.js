// UI View Management
function switchView(viewId) {
    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.remove('active');
        setTimeout(() => {
            if (!view.classList.contains('active')) {
                view.classList.add('hidden');
            }
        }, 500); 
    });

    const target = document.getElementById(viewId);
    target.classList.remove('hidden');
    setTimeout(() => target.classList.add('active'), 50);

    // Hide top navigation during loading and results
    const nav = document.querySelector('.app-nav');
    if (nav) {
        if (viewId === 'view-analyzing' || viewId === 'view-results') {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex';
        }
    }
}

function switchNav(viewId, btnElement) {
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    btnElement.classList.add('active');
    
    // Clear out output state if switching away from results
    if (viewId === 'view-input') {
        resetFlow(false);
    } else {
        switchView(viewId);
    }
}

function resetFlow(switchTab = true) {
    document.getElementById('contentInput').value = '';
    document.getElementById('imageInput').value = '';
    document.getElementById('fileNameDisplay').textContent = '';
    document.getElementById('errorMessage').style.display = 'none';
    
    if (switchTab) {
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector('.nav-tab').classList.add('active'); // Activate first tab
    }
    
    switchView('view-input');
}

function updateFileName(input) {
    const display = document.getElementById('fileNameDisplay');
    if (input.files && input.files.length > 0) {
        display.textContent = "Selected file: " + input.files[0].name;
    } else {
        display.textContent = "";
    }
}

function showError(message) {
    const errorMsg = document.getElementById('errorMessage');
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
}

async function startAnalysis() {
    const input = document.getElementById('contentInput').value;
    const fileInput = document.getElementById('imageInput');
    const errorMsg = document.getElementById('errorMessage');
    const outputContent = document.getElementById('outputContent');

    if (!input.trim() && (!fileInput.files || fileInput.files.length === 0)) {
        showError("Please enter text, a URL, or upload a screenshot to analyze.");
        return;
    }

    errorMsg.style.display = 'none';
    
    const hasImage = fileInput.files && fileInput.files.length > 0;
    const etaText = document.getElementById('etaText');
    
    // Give a realistic ETA based on whether they uploaded a heavy image or just text
    let timeLeft = hasImage ? 35 : 20;
    if (etaText) {
        etaText.textContent = `Estimated time: ~${timeLeft}s`;
        etaText.style.display = 'block';
    }

    const etaInterval = setInterval(() => {
        timeLeft--;
        if (etaText) {
            if (timeLeft > 0) {
                etaText.textContent = `Estimated time: ~${timeLeft}s`;
            } else {
                etaText.textContent = `Finalizing analysis... almost done!`;
            }
        }
    }, 1000);

    switchView('view-analyzing');

    try {
        const formData = new FormData();
        formData.append('content', input);
        if (fileInput.files && fileInput.files.length > 0) {
            formData.append('file', fileInput.files[0]);
        }

        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        clearInterval(etaInterval);

        if (!response.ok) {
            throw new Error(data.detail || 'An error occurred during communication with the server.');
        }

        outputContent.innerHTML = marked.parse(data.analysis);
        
        setTimeout(() => {
            switchView('view-results');
        }, 1500);

    } catch (error) {
        clearInterval(etaInterval);
        switchView('view-input');
        setTimeout(() => showError(error.message), 500);
    }
}

// Community Index logic
async function loadCommunityIndex() {
    const list = document.getElementById('communityList');
    list.innerHTML = '<div style="text-align: center; color: var(--text-muted);">Loading community submissions...</div>';
    
    try {
        const response = await fetch('/api/reports', { cache: 'no-store' });
        const data = await response.json();
        
        if (data.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: var(--text-muted);">No submissions yet. Be the first to scan one!</div>';
            return;
        }
        
        list.innerHTML = '';
        data.forEach((report, index) => {
            const card = document.createElement('div');
            card.className = 'community-card';
            card.style.position = 'relative';
            
            // Build image if exists
            let imgHtml = '';
            if (report.image_path) {
                imgHtml = `<img src="${report.image_path}" class="card-img" alt="Submitted Screenshot">`;
            }
            
            // Format date
            const date = new Date(report.created_at).toLocaleDateString();
            
            card.innerHTML = `
                <div style="position: absolute; top: -15px; left: -15px; background: var(--danger); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.1rem; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.4); border: 2px solid white; z-index: 10;">#${index + 1}</div>
                <div class="card-header">
                    <div>
                        <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.5rem;">Submitted: ${date}</div>
                        ${report.content_text ? `<div style="font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem;">Source Text / URL</div>` : ''}
                    </div>
                    <div class="card-score">Risk: ${report.risk_score}</div>
                </div>
                ${report.content_text ? `<div class="card-content" style="max-height: 80px; overflow: hidden; text-overflow: ellipsis;">${report.content_text.substring(0, 150)}${report.content_text.length > 150 ? '...' : ''}</div>` : ''}
                ${imgHtml}
                <div style="font-weight: 600; color: var(--text-main); margin-top: 0.5rem;">AI Analysis Summary</div>
                <div class="card-content">
                    ${marked.parse(report.analysis_summary)}
                </div>
                <div class="card-footer">
                    <div style="font-size: 0.9rem; font-weight: 600; color: var(--accent);">
                        <span id="vote-count-${report.id}">${report.votes}</span> Community Votes
                    </div>
                    <div style="display: flex; gap: 1rem; justify-content: center; align-items: center;">
                        <button class="vote-btn" onclick="upvote(${report.id})">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                            Upvote
                        </button>
                        <button class="delete-btn" onclick="deleteReport(${report.id})">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            Delete
                        </button>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        list.innerHTML = '<div style="text-align: center; color: var(--danger);">Failed to load community index.</div>';
    }
}

async function upvote(id) {
    try {
        const response = await fetch(`/api/reports/${id}/vote`, { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
            document.getElementById(`vote-count-${id}`).textContent = data.votes;
        }
    } catch (error) {
        console.error("Failed to upvote:", error);
    }
}

async function deleteReport(id) {
    if (!confirm("Are you sure you want to permanently delete this entry?")) return;
    
    try {
        const response = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadCommunityIndex();
        } else {
            const data = await response.json();
            alert("Failed to delete the report: " + data.detail);
        }
    } catch (error) {
        console.error("Failed to delete report:", error);
        alert("Failed to delete the report.");
    }
}

// --- Splash Screen Particle Animation ---
document.addEventListener('DOMContentLoaded', () => {
    const splashScreen = document.getElementById('splash-screen');
    const canvas = document.getElementById('particle-canvas');
    if (!splashScreen || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let width, height;
    let particles = [];
    let animationId;
    let isDragging = false;
    let startX = 0;
    let currentRotation = 0;
    let targetRotation = 0;
    let isShattered = false;

    // Config
    const TEXT = "Shield UI";
    const PARTICLE_SIZE = 1.5;
    const RESOLUTION = 5; 
    const SHATTER_THRESHOLD = Math.PI / 4; 

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        if (!isShattered) {
            initParticles();
        }
    }

    class Particle {
        constructor(x, y, color) {
            this.targetX = x;
            this.targetY = y;
            if (Math.random() > 0.5) {
                this.x = Math.random() > 0.5 ? 0 : width;
                this.y = Math.random() * height;
            } else {
                this.x = Math.random() * width;
                this.y = Math.random() > 0.5 ? 0 : height;
            }
            this.vx = (Math.random() - 0.5) * 15;
            this.vy = (Math.random() - 0.5) * 15;
            this.color = color;
            this.friction = 0.88; 
            this.ease = 0.05 + Math.random() * 0.05;
        }

        update() {
            if (isShattered) {
                this.x += this.vx;
                this.y += this.vy;
                this.vx *= 1.05; 
                this.vy *= 1.05;
                this.color = `rgba(37, 99, 235, ${Math.max(0, 1 - Math.abs(this.vx) / 100)})`;
                return;
            }

            let dx = this.targetX - this.x;
            let dy = this.targetY - this.y;
            this.vx += dx * this.ease;
            this.vy += dy * this.ease;
            this.vx *= this.friction;
            this.vy *= this.friction;
            this.x += this.vx;
            this.y += this.vy;
        }

        draw(ctx) {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, PARTICLE_SIZE, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initParticles() {
        particles = [];
        ctx.clearRect(0, 0, width, height);
        
        ctx.fillStyle = 'white';
        let fontSize = Math.min(width / 6, 150);
        ctx.font = `bold ${fontSize}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(TEXT, width / 2, height / 2);

        const imageData = ctx.getImageData(0, 0, width, height).data;
        ctx.clearRect(0, 0, width, height);

        for (let y = 0; y < height; y += RESOLUTION) {
            for (let x = 0; x < width; x += RESOLUTION) {
                const index = (y * width + x) * 4;
                const alpha = imageData[index + 3];
                if (alpha > 128) {
                    const gradientT = x / width;
                    const r = Math.floor(30 + gradientT * 37);
                    const g = Math.floor(64 + gradientT * 10);
                    const b = Math.floor(175 + gradientT * 50);
                    particles.push(new Particle(x, y, `rgb(${r},${g},${b})`));
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        currentRotation += (targetRotation - currentRotation) * 0.1;

        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(currentRotation);
        ctx.translate(-width / 2, -height / 2);

        for (let p of particles) {
            p.update();
            p.draw(ctx);
        }

        ctx.restore();
        animationId = requestAnimationFrame(animate);
    }

    canvas.addEventListener('pointerdown', (e) => {
        if (isShattered) return;
        isDragging = true;
        startX = e.clientX;
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDragging || isShattered) return;
        const dx = e.clientX - startX;
        targetRotation = dx * 0.01;
        
        if (Math.abs(targetRotation) > SHATTER_THRESHOLD && !isShattered) {
            triggerTransition();
        }
    });

    window.addEventListener('pointerup', () => {
        isDragging = false;
        if (!isShattered) {
            targetRotation = 0; 
        }
    });

    function triggerTransition() {
        isShattered = true;
        
        for (let p of particles) {
            const dx = p.x - width / 2;
            const dy = p.y - height / 2;
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            p.vx = (dx / dist) * (10 + Math.random() * 20);
            p.vy = (dy / dist) * (10 + Math.random() * 20);
        }
        
        setTimeout(() => {
            splashScreen.classList.add('hidden');
            document.body.classList.remove('splash-active');
            
            setTimeout(() => {
                cancelAnimationFrame(animationId);
            }, 1500);
        }, 300);
    }

    window.addEventListener('resize', resize);
    
    setTimeout(() => {
        resize();
        animate();
    }, 100);
});
