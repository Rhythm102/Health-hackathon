let currentMode = "gps"; // default

export function detectConnection() {
  // Check if browser is online
  if (!navigator.onLine) {
    return "satellite";
  }
  
  // Check for connection type if available
  if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    // If effective type is slow (slow-2g, 2g) or saveData is enabled, switch to satellite mode
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || connection.saveData) {
      return "satellite";
    }
    
    // Check downlink speed - if less than 1 Mbps, use satellite mode
    if (connection.downlink && connection.downlink < 1) {
      return "satellite";
    }
  }
  
  // Default to GPS mode for good connections
  return "gps";
}

export function getCurrentMode() {
  return currentMode;
}

export function setMode(mode) {
  currentMode = mode;
  console.log(`Mode switched to: ${mode}`);
}
