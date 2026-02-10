#!/usr/bin/env python3
"""
RescueLink - MQTT Data Generator (OPTIMIZED FOR LOW LATENCY)
Generates random patient vitals, ECG waveforms, and GPS coordinates
Publishes data to MQTT broker for testing the dashboard

OPTIMIZATIONS:
- QoS 0 (fire and forget) for lowest latency
- Configurable broker (use private broker for best performance)
- Optimized intervals for real-time updates
"""

import paho.mqtt.client as mqtt
import json
import time
import random
import math
import os

# ==================== MQTT CONFIGURATION ====================
# IMPORTANT: Change this to your own MQTT broker for low latency!
# Default: Public HiveMQ broker (200-800ms latency)
# Recommended: Private Mosquitto on same server (50-100ms latency)

MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.hivemq.com")  # Use env variable or default
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_KEEPALIVE = 60

# For local/private broker, use:
# MQTT_BROKER = "localhost"  # or your server IP
# MQTT_PORT = 1883


print(f"🔧 Configuration: MQTT Broker = {MQTT_BROKER}:{MQTT_PORT}")

# Topics
TOPIC_VITALS = "patient/P-8492/vitals"
TOPIC_ECG = "patient/P-8492/ecg"
TOPIC_LOCATION = "ambulance/amb-42/location"
TOPIC_ETA = "rescue/eta"
TOPIC_TRAFFIC = "rescue/traffic"
TOPIC_PATIENT_PROFILE = "rescue/patient/profile"
TOPIC_PATIENT_VITALS = "rescue/patient/vitals"

# ==================== DATA GENERATION SETTINGS ====================
# Update intervals (seconds) - OPTIMIZED FOR LOW LATENCY
VITALS_INTERVAL = 2      # Update vitals every 2 seconds (good balance)
ECG_INTERVAL = 0.1       # Update ECG every 100ms (10 Hz - smooth waveform)
LOCATION_INTERVAL = 5    # Update location every 5 seconds (GPS updates)

# QoS Settings - USE QoS 0 FOR LOWEST LATENCY
# QoS 0 = At most once delivery (fire and forget, lowest latency)
# QoS 1 = At least once delivery (acknowledged, higher latency)
# QoS 2 = Exactly once delivery (highest latency)
MQTT_QOS = 0  # OPTIMIZED: QoS 0 for minimal latency

# Simulation parameters
SIMULATION_MODE = "moving"  # "stationary" or "moving"

# Starting coordinates (Bhopal, India)
START_LAT = 23.2599
START_LON = 77.4126

# Destination coordinates (Hospital)
DEST_LAT = 23.2156
DEST_LON = 77.4304

# ==================== MQTT CLIENT SETUP ====================
client = mqtt.Client(client_id="rescuelink_simulator", protocol=mqtt.MQTTv311)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT Broker!")
        print(f"📡 Publishing to topics with QoS {MQTT_QOS} (LOW LATENCY MODE)")
        print(f"   - {TOPIC_VITALS} (every {VITALS_INTERVAL}s)")
        print(f"   - {TOPIC_ECG} (every {ECG_INTERVAL}s)")
        print(f"   - {TOPIC_LOCATION} (every {LOCATION_INTERVAL}s)")
        print(f"   - {TOPIC_ETA} (every {LOCATION_INTERVAL}s)")
        print(f"   - {TOPIC_TRAFFIC} (every 10s)")
        print(f"   - {TOPIC_PATIENT_PROFILE} (once, retained)")
        print(f"   - {TOPIC_PATIENT_VITALS} (every 3s)")
        
        # Publish patient profile once (retained message)
        publish_patient_profile()
    else:
        print(f"❌ Connection failed with code {rc}")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        print("⚠️  Unexpected disconnection. Attempting to reconnect...")

client.on_connect = on_connect
client.on_disconnect = on_disconnect

# ==================== GLOBAL STATE ====================
current_lat = START_LAT
current_lon = START_LON
current_distance = 0
ecg_time = 0
last_vitals_time = 0
last_ecg_time = 0
last_location_time = 0
last_eta_time = 0
last_traffic_time = 0
last_patient_vitals_time = 0

# Vitals state (smooth transitions)
current_hr = 75
current_spo2 = 98.0
current_temp = 98.2
current_bp_sys = 120
current_bp_dia = 80
current_resp = 16

# ==================== PATIENT PROFILE (STATIC DATA) ====================
def publish_patient_profile():
    """Publish patient profile once with retained flag"""
    profile = {
        "patientId": "P-8492",
        "name": "John Anderson",
        "age": 45,
        "gender": "Male",
        "bloodType": "A+",
        "allergies": ["Penicillin", "Latex"],
        "conditions": ["Hypertension", "Type 2 Diabetes"],
        "medications": [
            {"name": "Metformin", "dose": "500mg", "frequency": "2x daily"},
            {"name": "Lisinopril", "dose": "10mg", "frequency": "1x daily"}
        ],
        "emergencyContact": {
            "name": "Sarah Anderson",
            "relationship": "Wife",
            "phone": "+91-98765-43210"
        },
        "insurance": {
            "provider": "HealthCare India",
            "policyNumber": "HC-2024-8492"
        }
    }
    
    # OPTIMIZED: Use QoS 0 with retained flag
    client.publish(TOPIC_PATIENT_PROFILE, json.dumps(profile), qos=MQTT_QOS, retain=True)
    print(f"📋 Published patient profile (retained)")

# ==================== VITALS GENERATION ====================
def generate_vitals():
    """Generate realistic vital signs with smooth transitions"""
    global current_hr, current_spo2, current_temp, current_bp_sys, current_bp_dia, current_resp
    
    # Smooth random walk for realistic changes
    current_hr += random.uniform(-2, 2)
    current_hr = max(60, min(100, current_hr))  # Clamp to realistic range
    
    current_spo2 += random.uniform(-0.5, 0.5)
    current_spo2 = max(94, min(100, current_spo2))
    
    current_temp += random.uniform(-0.1, 0.1)
    current_temp = max(97.5, min(99.5, current_temp))
    
    current_bp_sys += random.uniform(-3, 3)
    current_bp_sys = max(110, min(140, current_bp_sys))
    
    current_bp_dia += random.uniform(-2, 2)
    current_bp_dia = max(70, min(90, current_bp_dia))
    
    current_resp += random.uniform(-1, 1)
    current_resp = max(12, min(20, current_resp))
    
    vitals = {
        "heartRate": round(current_hr),
        "spo2": round(current_spo2, 1),
        "temperature": round(current_temp, 1),
        "bloodPressure": f"{round(current_bp_sys)}/{round(current_bp_dia)}",
        "respiratoryRate": round(current_resp),
        "timestamp": int(time.time() * 1000)
    }
    
    return vitals

def publish_vitals():
    """Publish vitals data with QoS 0 for lowest latency"""
    vitals = generate_vitals()
    # OPTIMIZED: QoS 0 for fire-and-forget, lowest latency
    client.publish(TOPIC_VITALS, json.dumps(vitals), qos=MQTT_QOS)
    print(f"📊 Vitals: HR={vitals['heartRate']} bpm, SpO2={vitals['spo2']}%, BP={vitals['bloodPressure']}, Temp={vitals['temperature']}°F, RR={vitals['respiratoryRate']}")

# ==================== ECG GENERATION ====================
def generate_ecg_point():
    """Generate realistic ECG waveform point"""
    global ecg_time
    
    # Generate PQRST complex using sine waves
    t = ecg_time % 1.0  # Normalize to 0-1 for one heartbeat
    
    # P wave
    p_wave = 0.3 * math.exp(-((t - 0.1) ** 2) / 0.005) if 0.05 < t < 0.15 else 0
    
    # QRS complex
    q_wave = -0.2 * math.exp(-((t - 0.32) ** 2) / 0.001) if 0.3 < t < 0.34 else 0
    r_wave = 1.5 * math.exp(-((t - 0.35) ** 2) / 0.001) if 0.33 < t < 0.37 else 0
    s_wave = -0.3 * math.exp(-((t - 0.38) ** 2) / 0.001) if 0.36 < t < 0.4 else 0
    
    # T wave
    t_wave = 0.4 * math.exp(-((t - 0.6) ** 2) / 0.01) if 0.5 < t < 0.7 else 0
    
    # Combine all components
    ecg_value = p_wave + q_wave + r_wave + s_wave + t_wave
    
    # Add small noise
    ecg_value += random.uniform(-0.02, 0.02)
    
    ecg_point = {
        "value": round(ecg_value, 3),
        "timestamp": int(time.time() * 1000)
    }
    
    ecg_time += ECG_INTERVAL * (current_hr / 75.0)  # Scale with heart rate
    
    return ecg_point

def publish_ecg():
    """Publish ECG point with QoS 0 for lowest latency"""
    ecg_point = generate_ecg_point()
    # OPTIMIZED: QoS 0 for continuous waveform, lowest latency
    client.publish(TOPIC_ECG, json.dumps(ecg_point), qos=MQTT_QOS)

# ==================== GPS LOCATION GENERATION ====================
def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two GPS coordinates in km"""
    R = 6371  # Earth's radius in km
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

def move_towards_destination():
    """Move ambulance towards hospital"""
    global current_lat, current_lon, current_distance
    
    # Calculate remaining distance
    remaining = calculate_distance(current_lat, current_lon, DEST_LAT, DEST_LON)
    
    if remaining < 0.05:  # Within 50 meters
        return
    
    # Move at approximately 40 km/h
    speed_km_per_sec = 40.0 / 3600.0  # km per second
    step_distance = speed_km_per_sec * LOCATION_INTERVAL
    
    # Calculate bearing
    lat_diff = DEST_LAT - current_lat
    lon_diff = DEST_LON - current_lon
    
    # Normalize and scale
    magnitude = math.sqrt(lat_diff**2 + lon_diff**2)
    if magnitude > 0:
        current_lat += (lat_diff / magnitude) * (step_distance / 111.0)  # Roughly 111 km per degree
        current_lon += (lon_diff / magnitude) * (step_distance / (111.0 * math.cos(math.radians(current_lat))))
    
    # Add small random deviation for realism
    current_lat += random.uniform(-0.0001, 0.0001)
    current_lon += random.uniform(-0.0001, 0.0001)
    
    current_distance = calculate_distance(START_LAT, START_LON, current_lat, current_lon)

def publish_location():
    """Publish GPS location with QoS 0 for lowest latency"""
    global current_lat, current_lon
    
    if SIMULATION_MODE == "moving":
        move_towards_destination()
    
    location_data = {
        "lat": round(current_lat, 6),
        "lon": round(current_lon, 6),
        "speed": round(random.uniform(35, 45), 1),  # km/h
        "heading": round(random.uniform(0, 360), 1),
        "accuracy": round(random.uniform(5, 15), 1),  # meters
        "timestamp": int(time.time() * 1000)
    }
    
    # OPTIMIZED: QoS 0 for location updates
    client.publish(TOPIC_LOCATION, json.dumps(location_data), qos=MQTT_QOS)
    print(f"🗺️  Location: ({location_data['lat']}, {location_data['lon']}) @ {location_data['speed']} km/h")

# ==================== ETA CALCULATION ====================
def publish_eta():
    """Publish estimated time of arrival with QoS 0"""
    distance = calculate_distance(current_lat, current_lon, DEST_LAT, DEST_LON)
    avg_speed = 40  # km/h
    
    eta_minutes = (distance / avg_speed) * 60
    eta_minutes = max(1, round(eta_minutes))  # At least 1 minute
    
    eta_data = {
        "eta": eta_minutes,
        "distance": round(distance, 2),
        "unit": "km",
        "timestamp": int(time.time() * 1000)
    }
    
    # OPTIMIZED: QoS 0 for ETA updates
    client.publish(TOPIC_ETA, json.dumps(eta_data), qos=MQTT_QOS)
    print(f"⏱️  ETA: {eta_minutes} min ({eta_data['distance']} km)")

# ==================== TRAFFIC DATA ====================
def publish_traffic():
    """Publish traffic conditions with QoS 0"""
    conditions = ["Light", "Moderate", "Heavy"]
    
    traffic_data = {
        "condition": random.choice(conditions),
        "delay": random.randint(0, 5),  # minutes
        "timestamp": int(time.time() * 1000)
    }
    
    # OPTIMIZED: QoS 0 for traffic updates
    client.publish(TOPIC_TRAFFIC, json.dumps(traffic_data), qos=MQTT_QOS)

# ==================== PATIENT VITALS (Detailed) ====================
def publish_patient_vitals():
    """Publish detailed patient vitals with QoS 0"""
    vitals = generate_vitals()
    
    detailed_vitals = {
        **vitals,
        "ecgRhythm": "Sinus Rhythm",
        "consciousness": "Alert",
        "painLevel": random.randint(4, 7),
        "timestamp": int(time.time() * 1000)
    }
    
    # OPTIMIZED: QoS 0 for vitals
    client.publish(TOPIC_PATIENT_VITALS, json.dumps(detailed_vitals), qos=MQTT_QOS)

# ==================== MAIN LOOP ====================
def main():
    global last_vitals_time, last_ecg_time, last_location_time, last_eta_time, last_traffic_time, last_patient_vitals_time
    
    print("\n🚑 RescueLink MQTT Data Simulator")
    print("=" * 50)
    print(f"📡 Connecting to MQTT broker: {MQTT_BROKER}:{MQTT_PORT}")
    
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, MQTT_KEEPALIVE)
    except Exception as e:
        print(f"❌ Failed to connect to MQTT broker: {e}")
        print(f"💡 Tip: Make sure broker is running at {MQTT_BROKER}:{MQTT_PORT}")
        return
    
    client.loop_start()
    
    print("\n🔄 Starting data generation...")
    print("⚡ OPTIMIZED FOR LOW LATENCY (QoS 0)")
    print("Press Ctrl+C to stop\n")
    
    try:
        while True:
            current_time = time.time()
            
            # Publish vitals every VITALS_INTERVAL seconds
            if current_time - last_vitals_time >= VITALS_INTERVAL:
                publish_vitals()
                last_vitals_time = current_time
            
            # Publish ECG every ECG_INTERVAL seconds
            if current_time - last_ecg_time >= ECG_INTERVAL:
                publish_ecg()
                last_ecg_time = current_time
            
            # Publish location every LOCATION_INTERVAL seconds
            if current_time - last_location_time >= LOCATION_INTERVAL:
                publish_location()
                last_location_time = current_time
            
            # Publish ETA every LOCATION_INTERVAL seconds
            if current_time - last_eta_time >= LOCATION_INTERVAL:
                publish_eta()
                last_eta_time = current_time
            
            # Publish traffic every 10 seconds
            if current_time - last_traffic_time >= 10:
                publish_traffic()
                last_traffic_time = current_time
            
            # Publish patient vitals every 3 seconds
            if current_time - last_patient_vitals_time >= 3:
                publish_patient_vitals()
                last_patient_vitals_time = current_time
            
            # Small sleep to prevent CPU overload
            time.sleep(0.01)
            
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping data generator...")
        client.loop_stop()
        client.disconnect()
        print("✅ Disconnected from MQTT broker")
        print("👋 Goodbye!\n")

if __name__ == "__main__":
    main()