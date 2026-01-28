const canvas = document.getElementById('ecgCanvas');
let ctx = null;
let x = 0;

// Initialize canvas when it's available
function initCanvas() {
  if (!canvas) return false;
  
  if (!ctx) {
    ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  return true;
}

export function drawECG(samples) {
  if (!initCanvas() || !samples || samples.length === 0) return;
  
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2;

  samples.forEach(value => {
    const y = canvas.height / 2 - value * 40;

    ctx.beginPath();
    ctx.moveTo(x, y);
    x += 2;
    ctx.lineTo(x, y);
    ctx.stroke();

    if (x > canvas.width) {
      x = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });
}