// Get both canvas elements
const canvasGps = document.getElementById('ecgCanvas-gps');
const canvasSat = document.getElementById('ecgCanvas-sat');

let ctxGps = null;
let ctxSat = null;
let xGps = 0;
let xSat = 0;

// Initialize canvases when available
function initCanvas(canvas, ctx) {
  if (!canvas) return null;
  
  if (!ctx) {
    ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  return ctx;
}

export function drawECG(samples) {
  if (!samples || samples.length === 0) return;
  
  // Initialize GPS canvas
  if (canvasGps) {
    ctxGps = initCanvas(canvasGps, ctxGps);
    
    if (ctxGps) {
      ctxGps.strokeStyle = "#22c55e";
      ctxGps.lineWidth = 2;

      samples.forEach(value => {
        const y = canvasGps.height / 2 - value * 40;

        ctxGps.beginPath();
        ctxGps.moveTo(xGps, y);
        xGps += 2;
        ctxGps.lineTo(xGps, y);
        ctxGps.stroke();

        if (xGps > canvasGps.width) {
          xGps = 0;
          ctxGps.clearRect(0, 0, canvasGps.width, canvasGps.height);
        }
      });
    }
  }
  
  // Initialize Satellite canvas
  if (canvasSat) {
    ctxSat = initCanvas(canvasSat, ctxSat);
    
    if (ctxSat) {
      ctxSat.strokeStyle = "#22c55e";
      ctxSat.lineWidth = 2;

      samples.forEach(value => {
        const y = canvasSat.height / 2 - value * 40;

        ctxSat.beginPath();
        ctxSat.moveTo(xSat, y);
        xSat += 2;
        ctxSat.lineTo(xSat, y);
        ctxSat.stroke();

        if (xSat > canvasSat.width) {
          xSat = 0;
          ctxSat.clearRect(0, 0, canvasSat.width, canvasSat.height);
        }
      });
    }
  }
}