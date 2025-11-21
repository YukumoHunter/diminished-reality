import { isIOS } from 'react-device-detect';

export const DIMINISH_EFFECT = {
    NONE: 0,
    BLUR: 1,
    OVERLAY: 2,
    DESATURATE: 3
};

export const DIMINISH_METHODS = {
    THRESHOLD: 0,
    DYNAMIC: 1
};

export const OUTLINE = {
    OFF: 0,
    HEALTHY: 1,
    ALL: 2
}

const getDiminishStrength = (nutri_score, effectType) => {
    const EFFECT_STRENGTH_MAP = {
        [DIMINISH_EFFECT.NONE]:        [0, 0, 0, 0, 0],
        [DIMINISH_EFFECT.BLUR]:        [0, 1, 5, 10, 20],
        [DIMINISH_EFFECT.OVERLAY]:     [0, 0.3, 0.5, 0.7, 1],
        [DIMINISH_EFFECT.DESATURATE]:  [0, 0.3, 0.6, 0.8, 1]
    };
    return EFFECT_STRENGTH_MAP[effectType][nutri_score];
};

const getOutlineColor = (nutri_score) => {
    const OUTLINE_COLOR_MAP = {
        0: 'green',
        1: 'lightgreen',
        2: 'yellow',
        3: 'orange',
        4: 'red'
    };
    return OUTLINE_COLOR_MAP[nutri_score];
};

// Blur function for IOS
const applyManualBlur = (imageData, radius) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const original = new Uint8ClampedArray(data);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0, count = 0;
            
            // Sample pixels in blur radius
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const idx = (ny * width + nx) * 4;
                        r += original[idx];
                        g += original[idx + 1];
                        b += original[idx + 2];
                        a += original[idx + 3];
                        count++;
                    }
                }
            }

            const idx = (y * width + x) * 4;
            data[idx] = r / count;
            data[idx + 1] = g / count;
            data[idx + 2] = b / count;
            data[idx + 3] = a / count;
        }
    }
};

// Desaturate function for IOS
const applyManualDesaturation = (imageData, desaturationStrength) => {
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Interpolate between original color and grayscale
        data[i] = r + (luminance - r) * desaturationStrength;
        data[i + 1] = g + (luminance - g) * desaturationStrength;
        data[i + 2] = b + (luminance - b) * desaturationStrength;
    }
};


const applyBlur = (bbox, ctx, video, blurStrength) => {
    if (blurStrength <= 0) return;

    const [x, y, w, h] = bbox;

    if (isIOS) {
        // Create offscreen canvas.
        const offscreen = new OffscreenCanvas(w, h);
        const offscreenCtx = offscreen.getContext('2d');
        offscreenCtx.drawImage(video, x, y, w, h, 0, 0, w, h);

        // Get the bounding box, blur it, and put it back.
        const imageData = offscreenCtx.getImageData(0, 0, w, h);
        applyManualBlur(imageData, blurStrength);
        offscreenCtx.putImageData(imageData, 0, 0);
        
        // Draw the blur on the overlay canvas.
        ctx.drawImage(offscreen, x, y);
    }
    else {
        // Target only the section of the canvas in the bbox.
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();

        // Draw the blur
        ctx.filter = `blur(${blurStrength}px)`;
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 
                    0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
    }
};

const applyOverlay = (bbox, ctx, opacity) => {
    if (opacity <= 0) return

    const [x, y, w, h] = bbox;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = 'white';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
};

const applyDesaturation = (bbox, ctx, video, desaturationStrength) => {
    if (desaturationStrength <= 0) return;

    const [x, y, w, h] = bbox;

    if (isIOS) {
        // Create offscreen canvas.
        const offscreen = new OffscreenCanvas(w, h);
        const offscreenCtx = offscreen.getContext('2d');
        offscreenCtx.drawImage(video, x, y, w, h, 0, 0, w, h);

        // Get the bounding box, desaturate it, and put it back.
        const imageData = offscreenCtx.getImageData(0, 0, w, h);
        applyManualDesaturation(imageData, desaturationStrength);
        offscreenCtx.putImageData(imageData, 0, 0);
        
        // Draw the desaturate on the overlay canvas.
        ctx.drawImage(offscreen, 0, 0, w, h, x, y, w, h);
    }
    else {
        // Target only the section of the canvas in the bbox.
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();

        // Draw the desaturate effect.
        ctx.filter = `saturate(${1 - desaturationStrength})`;
        ctx.drawImage(video, x, y, w, h, x, y, w, h);
        ctx.restore();
    }
};

const applyOutline = (bbox, ctx, outlineColor, nutri_score) => {
    let usedColor = outlineColor;
    if (outlineColor == 'nutri-score_based') {
        usedColor = getOutlineColor(nutri_score);
    }

    const [x, y, w, h] = bbox;
    ctx.strokeStyle = usedColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
};

export const diminishObject = (canvas, video, detections, diminishMethod,
                               diminishType, nutriScoreBaseline, useOutline,
                               outlineColor) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detections.forEach(det => {
        let nutri_score = det.nutri_score;

        // Apply outline.
        if (useOutline == OUTLINE.HEALTHY && nutri_score <= nutriScoreBaseline) {
            applyOutline(det.bbox, ctx, outlineColor, nutri_score);
        }
        else if (useOutline == OUTLINE.ALL) {
            applyOutline(det.bbox, ctx, outlineColor, nutri_score);
        }

        // Threshold method (Set nutri-score to either min or max).
        if (diminishMethod == DIMINISH_METHODS.THRESHOLD) {
            nutri_score = nutri_score > nutriScoreBaseline ? 4 : 0
        }
        const diminish_strength = getDiminishStrength(nutri_score, diminishType);

        switch(diminishType) {
            case DIMINISH_EFFECT.NONE:
                break;
            case DIMINISH_EFFECT.BLUR:
                applyBlur(det.bbox, ctx, video, diminish_strength);
                break;
            case DIMINISH_EFFECT.OVERLAY:
                applyOverlay(det.bbox, ctx, diminish_strength);
                break;
            case DIMINISH_EFFECT.DESATURATE:
                applyDesaturation(det.bbox, ctx, video, diminish_strength);
                break;
        }
    });
};
