document.addEventListener('DOMContentLoaded', () => {
    // Screen Elements
    const screenLanding = document.getElementById('screen-landing');
    const screenBooth = document.getElementById('screen-booth');
    const screenProcessing = document.getElementById('screen-processing');
    const screenPickup = document.getElementById('screen-pickup');

    const videoFeed = document.getElementById('video-feed');
    const btnTakePhoto = document.getElementById('btn-take-photo');
    const countdownDisplay = document.getElementById('countdown-display');
    const flashEffect = document.getElementById('flash');
    const captureCanvas = document.getElementById('capture-canvas');
    const ctx = captureCanvas.getContext('2d');
    
    // Result/Processing Elements
    const processTimer = document.getElementById('process-timer');
    const animatingStrip = document.getElementById('animating-strip');
    const printSlotImg = document.getElementById('print-slot-img');
    const finalImage = document.getElementById('final-image');
    
    // Final composite canvas
    const stripCanvas = document.getElementById('strip-canvas');
    const stripCtx = stripCanvas.getContext('2d');

    // Controls
    const btnEnter = document.getElementById('btn-enter');
    const btnDownload = document.getElementById('btn-download');
    const btnShareIg = document.getElementById('btn-share-ig');
    const btnShareSnap = document.getElementById('btn-share-snap');
    const btnPrint = document.getElementById('btn-print');
    const btnRetake = document.getElementById('btn-retake');
    
    // Single photos cut elements
    const btnCutPhotos = document.getElementById('btn-cut-photos');
    const modalSinglePhotos = document.getElementById('modal-single-photos');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const singlePhotosContainer = document.getElementById('single-photos-container');

    // Views inside camera frame
    const viewSelection = document.getElementById('view-selection');
    const viewCamera = document.getElementById('view-camera');
    const viewUpload = document.getElementById('view-upload');
    
    const instrSelection = document.getElementById('instructions-selection');
    const instrCamera = document.getElementById('instructions-camera');
    const instrUpload = document.getElementById('instructions-upload');

    const btnModeTake = document.getElementById('btn-mode-take');
    const btnModeUpload = document.getElementById('btn-mode-upload');
    const btnGenerateUpload = document.getElementById('btn-generate-upload');

    // State
    let photosTaken = 0;
    const MAX_PHOTOS = 4;
    const capturedImages = []; // Stores Base64 of captured images
    let stream = null;

    // Dimensions for photo capture (landscape ratio for desktop webcams to show full FOV)
    const capWidth = 800;
    const capHeight = 600;
    captureCanvas.width = capWidth;
    captureCanvas.height = capHeight;

    // Define dimensions for the final photostrip
    const padding = 40;
    const spacing = 30;
    // Strip will be width: capWidth + 2*padding
    // Strip will be height: (capHeight * MAX_PHOTOS) + (spacing * (MAX_PHOTOS-1)) + padding*2 + bottomSpace
    const bottomSpace = 160; 
    
    stripCanvas.width = capWidth + (padding * 2);
    stripCanvas.height = (capHeight * MAX_PHOTOS) + (spacing * (MAX_PHOTOS - 1)) + (padding * 2) + bottomSpace;

    // Navigation
    function showScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    btnEnter.addEventListener('click', () => {
        showScreen(screenBooth);
        viewSelection.classList.remove('hidden');
        viewCamera.classList.add('hidden');
        viewUpload.classList.add('hidden');

        instrSelection.classList.remove('hidden');
        instrCamera.classList.add('hidden');
        instrUpload.classList.add('hidden');
    });

    btnModeTake.addEventListener('click', async () => {
        viewSelection.classList.add('hidden');
        viewCamera.classList.remove('hidden');
        
        instrSelection.classList.add('hidden');
        instrCamera.classList.remove('hidden');

        await startCamera();
    });

    btnModeUpload.addEventListener('click', () => {
        viewSelection.classList.add('hidden');
        viewUpload.classList.remove('hidden');
        
        instrSelection.classList.add('hidden');
        instrUpload.classList.remove('hidden');
        
        // Reset upload slots
        uploadedImages = [null, null, null, null];
        for (let i = 1; i <= 4; i++) {
            const previewEl = document.getElementById(`up-preview-${i}`);
            if (previewEl) previewEl.style.backgroundImage = 'none';
        }
        updateGenerateButton();
    });

    // Camera Init
    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: "user",
                    width: { ideal: 720 },
                    height: { ideal: 960 }
                }, 
                audio: false 
            });
            videoFeed.srcObject = stream;
        } catch (err) {
            console.error("Error accessing camera: ", err);
            alert("Please allow camera access to use the photobooth!");
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    }

    // Filter Presets Selection
    const filterBtns = document.querySelectorAll('.filter-btn');
    let currentFilter = 'none';

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // UI Update
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // State Update
            currentFilter = btn.dataset.filter;
            
            // Live Preview Update (removes previous string of classes, keeps nothing, then adds if needed)
            videoFeed.className = ''; 
            if (currentFilter !== 'none') {
                videoFeed.classList.add(`filtered-${currentFilter}`);
            }
        });
    });

    // Capture sequence
    btnTakePhoto.addEventListener('click', () => {
        if (photosTaken > 0) return; // Prevent multiple clicks if already started
        btnTakePhoto.disabled = true;
        capturedImages.length = 0; // Clear previous
        
        // Clear slots UI
        for (let i=1; i<=4; i++) {
            const slot = document.getElementById(`slot-${i}`);
            slot.style.backgroundImage = 'none';
            slot.classList.remove('captured');
        }

        takeNextPhoto(1);
    });

    function takeNextPhoto(photoNum) {
        if (photoNum > MAX_PHOTOS) {
            finishCaptureStage();
            return;
        }

        // Countdown
        let count = 3;
        countdownDisplay.innerText = count;
        countdownDisplay.classList.remove('hidden');

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownDisplay.innerText = count;
            } else {
                clearInterval(interval);
                countdownDisplay.classList.add('hidden');
                snapPhoto(photoNum);
                
                setTimeout(() => {
                    takeNextPhoto(photoNum + 1);
                }, 1000); // Wait 1 second before next countdown starts
            }
        }, 1000);
    }

    function snapPhoto(photoNum) {
        // Flash Effect
        flashEffect.classList.remove('hidden');
        flashEffect.classList.add('flash-anim');
        setTimeout(() => {
            flashEffect.classList.remove('flash-anim');
            flashEffect.classList.add('hidden');
        }, 500);

        // Draw video feed to canvas
        ctx.save();
        // Handle mirroring correctly so it saves how it looks on screen
        ctx.translate(capWidth, 0);
        ctx.scale(-1, 1);

        // Apply filters if needed
        switch(currentFilter) {
            case 'bw': ctx.filter = "grayscale(100%) contrast(1.2)"; break;
            case 'sepia': ctx.filter = "sepia(100%)"; break;
            case 'vintage': ctx.filter = "sepia(40%) contrast(1.5) brightness(0.9) saturate(1.2)"; break;
            case 'blush': ctx.filter = "sepia(50%) hue-rotate(-50deg) saturate(2) brightness(1.1)"; break;
            default: ctx.filter = "none";
        }

        // Video might not have same aspect ratio as capWidth/capHeight, so we draw it to cover the canvas
        // We'll crop from center
        const vW = videoFeed.videoWidth;
        const vH = videoFeed.videoHeight;
        const scale = Math.max(capWidth/vW, capHeight/vH);
        const dW = vW * scale;
        const dH = vH * scale;
        const dx = (capWidth - dW) / 2;
        const dy = (capHeight - dH) / 2;

        ctx.drawImage(videoFeed, dx, dy, dW, dH);
        ctx.restore();

        const imgDataUrl = captureCanvas.toDataURL('image/png');
        capturedImages.push(imgDataUrl);

        // Update UI slot
        const slot = document.getElementById(`slot-${photoNum}`);
        // Background image isn't mirrored via CSS, but DataURL is cleanly mirrored in canvas above
        slot.style.backgroundImage = `url(${imgDataUrl})`;
        slot.classList.add('captured');
        photosTaken++;
    }

    function finishCaptureStage() {
        // Process images into a single strip
        generateStrip();
        
        // Stop camera
        stopCamera();

        // Show Processing Screen
        showScreen(screenProcessing);
        photosTaken = 0;
        btnTakePhoto.disabled = false;

        // Start processing countdown
        let count = 3;
        processTimer.innerText = count;
        animatingStrip.classList.remove('animate-drop');

        const pInterval = setInterval(() => {
            count--;
            processTimer.innerText = count;
            if (count <= 0) {
                clearInterval(pInterval);
                animatingStrip.classList.add('animate-drop');
                setTimeout(() => {
                    // Transition to final page
                    showScreen(screenPickup);
                }, 2000); // time for strip to drop
            }
        }, 1000);
    }

    const btnPrevFrame = document.getElementById('btn-prev-frame');
    const btnNextFrame = document.getElementById('btn-next-frame');

    const frames = ['classic', 'hearts', 'valentines_gray', 'bemyval_pink', 'solid_black', 'stars_yellow', 'red_doodles'];
    let currentFrameIdx = 0;

    if (btnPrevFrame) {
        btnPrevFrame.addEventListener('click', () => {
            currentFrameIdx = (currentFrameIdx - 1 + frames.length) % frames.length;
            generateStrip();
        });
    }
    
    if (btnNextFrame) {
        btnNextFrame.addEventListener('click', () => {
            currentFrameIdx = (currentFrameIdx + 1) % frames.length;
            generateStrip();
        });
    }

    function generateStrip() {
        const frameType = frames[currentFrameIdx];

        // Background base
        let bgColor = "#ffffff";
        if (frameType === 'hearts') bgColor = "#ffd1dc"; 
        else if (frameType === 'valentines_gray') bgColor = "#9c9698"; 
        else if (frameType === 'bemyval_pink') bgColor = "#fcd4da";
        else if (frameType === 'solid_black' || frameType === 'stars_yellow' || frameType === 'red_doodles') bgColor = "#8a8587";

        stripCtx.fillStyle = bgColor;
        stripCtx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);

        // Load images first
        const loadPromises = capturedImages.map((imgData, idx) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve({img, idx});
                img.src = imgData;
            });
        });

        Promise.all(loadPromises).then((results) => {
            // Sort to ensure correct order
            results.sort((a,b) => a.idx - b.idx);
            
            results.forEach(({img, idx}) => {
                const yOffset = padding + (idx * (capHeight + spacing));
                
                stripCtx.save();
                if (frameType === 'hearts') {
                    const w = capWidth; const h = capHeight; const x = padding; const y = yOffset;
                    stripCtx.beginPath();
                    stripCtx.moveTo(x + w / 2, y + h * 0.2);
                    stripCtx.bezierCurveTo(x + w * 0.9, y - h * 0.1, x + w * 1.2, y + h * 0.4, x + w / 2, y + h * 0.9);
                    stripCtx.bezierCurveTo(x - w * 0.2, y + h * 0.4, x + w * 0.1, y - h * 0.1, x + w / 2, y + h * 0.2);
                    stripCtx.clip();
                }
                
                stripCtx.drawImage(img, padding, yOffset, capWidth, capHeight);
                stripCtx.restore();

                // Borders & Texts
                if (frameType === 'hearts') {
                    const w = capWidth; const h = capHeight; const x = padding; const y = yOffset;
                    stripCtx.beginPath();
                    stripCtx.moveTo(x + w / 2, y + h * 0.2);
                    stripCtx.bezierCurveTo(x + w * 0.9, y - h * 0.1, x + w * 1.2, y + h * 0.4, x + w / 2, y + h * 0.9);
                    stripCtx.bezierCurveTo(x - w * 0.2, y + h * 0.4, x + w * 0.1, y - h * 0.1, x + w / 2, y + h * 0.2);
                    stripCtx.strokeStyle = "#A32A33";
                    stripCtx.lineWidth = 12;
                    stripCtx.stroke();
                } else if (frameType === 'valentines_gray' || frameType === 'bemyval_pink') {
                    stripCtx.strokeStyle = "#ffffff";
                    stripCtx.lineWidth = 6;
                    stripCtx.strokeRect(padding, yOffset, capWidth, capHeight);
                    
                    stripCtx.fillStyle = "#A32A33";
                    stripCtx.font = "bold 25px Inter";
                    stripCtx.textAlign = "center";
                    let msg = "";
                    if(frameType === 'bemyval_pink') msg = "be my valentine? ♥";
                    if (msg) {
                        stripCtx.fillText(msg, stripCanvas.width / 2, yOffset - 8);
                    }
                } else if (frameType === 'solid_black') {
                    stripCtx.strokeStyle = "#1a1a1a";
                    stripCtx.lineWidth = 10;
                    stripCtx.strokeRect(padding, yOffset, capWidth, capHeight);
                } else if (frameType === 'stars_yellow') {
                    stripCtx.strokeStyle = "#1a1a1a";
                    stripCtx.lineWidth = 4;
                    stripCtx.strokeRect(padding, yOffset, capWidth, capHeight);
                } else if (frameType === 'red_doodles') {
                    stripCtx.strokeStyle = "#ffffff";
                    stripCtx.lineWidth = 3;
                    stripCtx.strokeRect(padding, yOffset, capWidth, capHeight);
                    
                    if (idx === 2) {
                        stripCtx.strokeStyle = "#A32A33";
                        stripCtx.lineWidth = 6;
                        stripCtx.strokeRect(padding - 6, yOffset - 6, capWidth + 12, capHeight + 12);
                        stripCtx.lineWidth = 3;
                        stripCtx.strokeRect(padding - 2, yOffset - 2, capWidth + 4, capHeight + 4);
                    }
                }
            });

            // Decorations on top
            if (frameType === 'hearts') {
                stripCtx.fillStyle = "#A32A33";
                stripCtx.font = "50px Arial";
                const decos = ["♥", "♡", "🎀", "🍒", "💌", "✧"];
                for (let i=0; i<25; i++) {
                    let dx = Math.abs(Math.sin(i*123)) * stripCanvas.width;
                    let dy = Math.abs(Math.cos(i*321)) * stripCanvas.height;
                    let char = decos[i % decos.length];
                    stripCtx.save();
                    stripCtx.translate(dx, dy);
                    stripCtx.rotate(i*0.5);
                    stripCtx.fillText(char, 0, 0);
                    stripCtx.restore();
                }
            } else if (frameType === 'valentines_gray') {
                stripCtx.fillStyle = "#e84a5f";
                stripCtx.font = "40px Arial";
                const decos = ["♥", "🎀", "⭐"];
                for (let i=0; i<15; i++) {
                    let dx = Math.abs(Math.sin(i*555)) * stripCanvas.width;
                    let dy = Math.abs(Math.cos(i*777)) * stripCanvas.height;
                    let char = decos[i % decos.length];
                    stripCtx.save();
                    stripCtx.translate(dx, dy);
                    stripCtx.rotate(i*0.8);
                    stripCtx.fillText(char, 0, 0);
                    stripCtx.restore();
                }
            } else if (frameType === 'stars_yellow') {
                stripCtx.fillStyle = "#eeb902";
                stripCtx.font = "35px Arial";
                for (let i=0; i<20; i++) {
                    let dx = Math.abs(Math.sin(i*111)) * stripCanvas.width;
                    let dy = Math.abs(Math.cos(i*222)) * stripCanvas.height;
                    stripCtx.save();
                    stripCtx.translate(dx, dy);
                    stripCtx.rotate(i*0.8);
                    stripCtx.fillText("★", 0, 0);
                    stripCtx.restore();
                }
            } else if (frameType === 'red_doodles') {
                stripCtx.fillStyle = "#A32A33";
                stripCtx.font = "bold 35px Inter";
                stripCtx.textAlign = "left";
                stripCtx.fillText("♡♡♡", padding + 5, padding + 35);
                
                stripCtx.font = "bold 60px Inter";
                stripCtx.fillText("✧", padding + capWidth - 45, padding + (capHeight + spacing) * 1 + capHeight - 10);
                stripCtx.fillText("✧", padding + 5, padding + (capHeight + spacing) * 3 + capHeight - 10);
            }

            // Branding text
            if (frameType === 'classic') {
                stripCtx.fillStyle = "#000000";
                stripCtx.font = "bold 60px Inter";
                stripCtx.textAlign = "center";
                const textY = stripCanvas.height - (bottomSpace / 2) + 20;
                stripCtx.fillText("PHOTOBOOTH", stripCanvas.width / 2, textY);
                stripCtx.font = "30px Inter";
                stripCtx.fillText(new Date().toLocaleDateString(), stripCanvas.width / 2, textY + 45);
            } else {
                stripCtx.fillStyle = (frameType === 'hearts') ? "#A32A33" : "#fff";
                stripCtx.font = "bold 30px Inter";
                stripCtx.textAlign = "center";
                const textY = stripCanvas.height - 40;
                stripCtx.fillText(new Date().toLocaleDateString(), stripCanvas.width / 2, textY);
            }

            const finalDataUrl = stripCanvas.toDataURL('image/png');
            finalImage.src = finalDataUrl;
            printSlotImg.src = finalDataUrl;
            
            // Only fire upload if it's the classic generated or first generated time
            // to avoid spamming the local endpoint, but we can just let it hit the API.
            fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: finalDataUrl })
            }).catch(e => console.error(e));
        });
    }

    // Actions
    btnDownload.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `photobooth_strip_${Date.now()}.png`;
        link.href = finalImage.src;
        link.click();
    });

    async function shareImage(platformText) {
        if (navigator.share) {
            try {
                // Convert base64 to File object
                const res = await fetch(finalImage.src);
                const blob = await res.blob();
                const file = new File([blob], 'photostrip.png', { type: 'image/png' });

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'My Photostrip',
                        text: `Check out my new photostrip! Sharing to ${platformText}`,
                        files: [file]
                    });
                } else {
                    alert(`Your browser doesn't support file sharing. Please download it to share on ${platformText}.`);
                }
            } catch (err) {
                console.log('Share failed or was cancelled', err);
            }
        } else {
            alert(`Web Share API is not supported in your browser. Please download the image to share on ${platformText}.`);
        }
    }

    btnShareIg.addEventListener('click', () => {
        shareImage('Instagram');
    });

    btnShareSnap.addEventListener('click', () => {
        shareImage('Snapchat');
    });

    btnPrint.addEventListener('click', () => {
        // Opens the print window containing just the final image
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head><title>Print Photo Strip</title></head>
                <body style="margin:0; padding:0; display:flex; justify-content:center; align-items:flex-start;">
                    <img src="${finalImage.src}" style="max-width:100%;" onload="window.print(); window.close();" />
                </body>
            </html>
        `);
        printWindow.document.close();
    });

    btnRetake.addEventListener('click', () => {
        // Go back to landing or booth
        showScreen(screenBooth);
        
        for (let i=1; i<=4; i++) {
            const slot = document.getElementById(`slot-${i}`);
            if(slot) {
                slot.style.backgroundImage = 'none';
                slot.classList.remove('captured');
            }
        }
        
        uploadedImages = [null, null, null, null];
        for (let i=1; i<=4; i++) {
            const previewId = document.getElementById(`up-preview-${i}`);
            if(previewId) previewId.style.backgroundImage = 'none';
        }
        updateGenerateButton();

        viewSelection.classList.remove('hidden');
        viewCamera.classList.add('hidden');
        viewUpload.classList.add('hidden');

        instrSelection.classList.remove('hidden');
        instrCamera.classList.add('hidden');
        instrUpload.classList.add('hidden');
        
        stopCamera();
    });

    // Single photos modal logic
    btnCutPhotos.addEventListener('click', () => {
        singlePhotosContainer.innerHTML = ''; // Clear prior contents
        capturedImages.forEach((imgData, index) => {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.alignItems = 'center';
            wrapper.style.gap = '10px';

            const img = document.createElement('img');
            img.src = imgData;
            img.style.width = '100%';
            img.style.border = '2px solid #1a1a1a';
            img.style.borderRadius = '4px';

            const dBtn = document.createElement('button');
            dBtn.className = 'btn-handdrawn outline';
            dBtn.style.padding = '8px 16px';
            dBtn.style.fontSize = '1rem';
            dBtn.innerHTML = 'Download &downarrow;';
            dBtn.onclick = () => {
                const link = document.createElement('a');
                link.download = `single_photo_${index+1}_${Date.now()}.png`;
                link.href = imgData;
                link.click();
            };

            wrapper.appendChild(img);
            wrapper.appendChild(dBtn);
            singlePhotosContainer.appendChild(wrapper);
        });

        modalSinglePhotos.classList.remove('hidden');
    });

    btnCloseModal.addEventListener('click', () => {
        modalSinglePhotos.classList.add('hidden');
    });

    // Upload & Crop Logic
    let uploadedImages = [null, null, null, null];
    let cropper = null;
    let currentSlotIndex = -1;
    const modalCrop = document.getElementById('modal-crop');
    const imageToCrop = document.getElementById('image-to-crop');
    const btnCloseCrop = document.getElementById('btn-close-crop');
    const btnCancelCrop = document.getElementById('btn-cancel-crop');
    const btnSaveCrop = document.getElementById('btn-save-crop');

    for (let i = 1; i <= 4; i++) {
        const input = document.getElementById(`upload-${i}`);
        if(input) {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    imageToCrop.src = event.target.result;
                    currentSlotIndex = i - 1;
                    modalCrop.classList.remove('hidden');
                    
                    if (cropper) {
                        cropper.destroy();
                    }
                    cropper = new Cropper(imageToCrop, {
                        aspectRatio: capWidth / capHeight,
                        viewMode: 1,
                        background: false,
                        autoCropArea: 1,
                    });
                };
                reader.readAsDataURL(file);
                e.target.value = ''; // allow replacing same file
            });
        }
    }

    function closeCropArea() {
        modalCrop.classList.add('hidden');
        if (cropper) cropper.destroy();
        cropper = null;
    }

    btnCloseCrop.addEventListener('click', closeCropArea);
    btnCancelCrop.addEventListener('click', closeCropArea);

    btnSaveCrop.addEventListener('click', () => {
        if (!cropper) return;
        const canvas = cropper.getCroppedCanvas({
            width: capWidth,
            height: capHeight
        });
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = capWidth;
        tempCanvas.height = capHeight;
        const tCtx = tempCanvas.getContext('2d');
        
        switch(currentFilter) {
            case 'bw': tCtx.filter = "grayscale(100%) contrast(1.2)"; break;
            case 'sepia': tCtx.filter = "sepia(100%)"; break;
            case 'vintage': tCtx.filter = "sepia(40%) contrast(1.5) brightness(0.9) saturate(1.2)"; break;
            case 'blush': tCtx.filter = "sepia(50%) hue-rotate(-50deg) saturate(2) brightness(1.1)"; break;
            default: tCtx.filter = "none";
        }
        
        tCtx.drawImage(canvas, 0, 0, capWidth, capHeight);
        const dataUrl = tempCanvas.toDataURL('image/png');
        
        uploadedImages[currentSlotIndex] = dataUrl;
        
        const previewEl = document.getElementById(`up-preview-${currentSlotIndex + 1}`);
        if(previewEl) previewEl.style.backgroundImage = `url(${dataUrl})`;
        
        closeCropArea();
        updateGenerateButton();
    });

    function updateGenerateButton() {
        const count = uploadedImages.filter(img => img !== null).length;
        if (count === 4) {
            btnGenerateUpload.disabled = false;
            btnGenerateUpload.style.opacity = '1';
        } else {
            btnGenerateUpload.disabled = true;
            btnGenerateUpload.style.opacity = '0.5';
        }
    }

    btnGenerateUpload.addEventListener('click', () => {
        if (btnGenerateUpload.disabled) return;
        capturedImages.length = 0;
        uploadedImages.forEach(img => {
            if (img) capturedImages.push(img);
        });
        finishCaptureStage();
    });

    // Info Modals Logic
    const modalInfo = document.getElementById('modal-info');
    const modalInfoTitle = document.getElementById('modal-info-title');
    const modalInfoBody = document.getElementById('modal-info-body');
    const btnCloseInfo = document.querySelectorAll('.btn-close-info');
    const footerLinks = document.querySelectorAll('.footer-link');

    const modalData = {
        'modal-privacy': {
            title: 'Privacy Policy',
            content: 'Your privacy is important to us! All photo processing happens locally on your device. We do not store, upload, or share your photos to any external servers without your explicit action (like hitting the share button). Have fun and stay safe!'
        },
        'modal-faq': {
            title: 'FAQs',
            content: `
                <strong>Is this free?</strong><br>Yes, totally free to use!<br><br>
                <strong>Can I print the photos?</strong><br>Yes! Once your strip is generated, just click the "Print" button.<br><br>
                <strong>Where are my photos saved?</strong><br>They are temporarily kept in your browser. If you don't download or share them, they disappear when you refresh the page.
            `
        },
        'modal-about': {
            title: 'About Me',
            content: 'Hi, I am Naman! I created this aesthetic photobooth project to blend nostalgia with modern web technology. I love building fun, interactive web experiences.'
        },
        'modal-contact': {
            title: 'Contact Me',
            content: `
                Feel free to reach out to me for collaborations, questions, or just to say hi!<br><br>
                📧 <strong>Email:</strong> <a href="mailto:namansinghh02@gmail.com" style="color:#E1306C; text-decoration:none;">namansinghh02@gmail.com</a><br><br>
                📸 <strong>Instagram:</strong> <a href="https://instagram.com/naman.singh01" target="_blank" style="color:#C13584; text-decoration:none;">@naman.singh01</a>
            `
        }
    };

    footerLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const modalId = link.getAttribute('data-modal');
            const data = modalData[modalId];
            if (data) {
                modalInfoTitle.innerHTML = data.title;
                modalInfoBody.innerHTML = data.content;
                modalInfo.classList.remove('hidden');
            }
        });
    });

    btnCloseInfo.forEach(btn => {
        btn.addEventListener('click', () => {
            modalInfo.classList.add('hidden');
        });
    });

    // Close modal on outside click
    modalInfo.addEventListener('click', (e) => {
        if (e.target === modalInfo) {
            modalInfo.classList.add('hidden');
        }
    });
});
