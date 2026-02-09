// Get both canvas elements
const canvasGps = document.getElementById('ecgCanvas-gps');
const canvasSat = document.getElementById('ecgCanvas-sat');

let ctxGps = null;
let ctxSat = null;
let xGps = 20; // Start with padding
let xSat = 20;

// Waveform data buffer for smooth rolling
let waveformBufferGps = [];
let waveformBufferSat = [];

// Initialize canvas with proper DPR support
function initCanvas(canvas) {
  if (!canvas) return null;
  
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  // Set canvas properties
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Draw grid background
  drawGrid(ctx, rect.width, rect.height);
  
  return { ctx, width: rect.width, height: rect.height };
}

// Draw grid background
function drawGrid(ctx, width, height) {
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.1)';
  ctx.lineWidth = 0.5;
  
  // Vertical grid lines every 50px
  for (let x = 0; x < width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Horizontal grid lines every 30px
  for (let y = 0; y < height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

// Redraw canvas with current waveform
function redrawCanvas(canvas, ctx, width, height, buffer, x) {
  if (!ctx) return;
  
  // Clear canvas
  ctx.clearRect(-20, -20, width + 40, height + 40);
  
  // Redraw grid
  drawGrid(ctx, width, height);
  
  // Draw baseline
  const baseline = height / 2;
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, baseline);
  ctx.lineTo(width, baseline);
  ctx.stroke();
  
  // Draw waveform
  if (buffer && buffer.length > 0) {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    
    let firstPoint = true;
    for (let i = 0; i < buffer.length; i++) {
      const xPos = 20 + (i * 2);
      const yPos = baseline - (buffer[i] * 50);
      
      if (firstPoint) {
        ctx.moveTo(xPos, yPos);
        firstPoint = false;
      } else {
        ctx.lineTo(xPos, yPos);
      }
    }
    ctx.stroke();
  }
}

export function drawECG(samples) {
  if (!samples || samples.length === 0) return;
  
  // Initialize GPS canvas
  if (canvasGps && !ctxGps) {
    const init = initCanvas(canvasGps);
    ctxGps = init.ctx;
  }
  
  // Initialize Satellite canvas
  if (canvasSat && !ctxSat) {
    const init = initCanvas(canvasSat);
    ctxSat = init.ctx;
  }
  
  // Update GPS waveform buffer
  if (ctxGps) {
    const canvasInfo = canvasGps.getBoundingClientRect();
    waveformBufferGps.push(...samples);
    
    // Keep buffer size reasonable (max 150 points for smooth scrolling)
    const maxPoints = Math.floor((canvasInfo.width - 40) / 2);
    if (waveformBufferGps.length > maxPoints) {
      waveformBufferGps = waveformBufferGps.slice(-maxPoints);
    }
    
    redrawCanvas(canvasGps, ctxGps, canvasInfo.width, canvasInfo.height, waveformBufferGps, xGps);
  }
  
  // Update Satellite waveform buffer
  if (ctxSat) {
    const canvasInfo = canvasSat.getBoundingClientRect();
    waveformBufferSat.push(...samples);
    
    // Keep buffer size reasonable
    const maxPoints = Math.floor((canvasInfo.width - 40) / 2);
    if (waveformBufferSat.length > maxPoints) {
      waveformBufferSat = waveformBufferSat.slice(-maxPoints);
    }
    
    redrawCanvas(canvasSat, ctxSat, canvasInfo.width, canvasInfo.height, waveformBufferSat, xSat);
  }
}