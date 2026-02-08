#!/usr/bin/env python3
"""
RescueLink - MQTT Data Generator
Generates random patient vitals, ECG waveforms, and GPS coordinates
Publishes data to MQTT broker for testing the dashboard
"""

import paho.mqtt.client as mqtt
import json
import time
import random
import math

# ==================== MQTT CONFIGURATION ====================
MQTT_BROKER = "broker.hivemq.com"  # Free public broker
MQTT_PORT = 1883
MQTT_KEEPALIVE = 60

# Topics
TOPIC_VITALS = "patient/P-8492/vitals"
TOPIC_ECG = "patient/P-8492/ecg"
TOPIC_LOCATION = "ambulance/amb-42/location"
TOPIC_ETA = "rescue/eta"
TOPIC_TRAFFIC = "rescue/traffic"
TOPIC_PATIENT_PROFILE = "rescue/patient/profile"
TOPIC_PATIENT_VITALS = "rescue/patient/vitals"

# ==================== DATA GENERATION SETTINGS ====================
# Update intervals (seconds)
VITALS_INTERVAL = 2      # Update vitals every 2 seconds
ECG_INTERVAL = 0.1       # Update ECG every 100ms (10 Hz)
LOCATION_INTERVAL = 5    # Update location every 5 seconds

# Simulation parameters
SIMULATION_MODE = "moving"  # "stationary" or "moving"

# Starting coordinates (Bhopal, India - you can change these)
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
        print(f"📡 Publishing to:")
        print(f"   - {TOPIC_VITALS}")
        print(f"   - {TOPIC_ECG}")
        print(f"   - {TOPIC_LOCATION}")
        print(f"   - {TOPIC_ETA}")
        print(f"   - {TOPIC_TRAFFIC}")
        print(f"   - {TOPIC_PATIENT_PROFILE}")
        print(f"   - {TOPIC_PATIENT_VITALS}")
        print("\n🚑 Starting data simulation...")
        print("\n🚑 Starting data simulation...")
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        print("⚠️ Unexpected disconnection. Reconnecting...")

client.on_connect = on_connect
client.on_disconnect = on_disconnect

# ==================== DATA GENERATORS ====================

class VitalsGenerator:
    """Generates realistic patient vital signs"""
    
    def __init__(self):
        self.heart_rate = 75
        self.spo2 = 98
        self.systolic = 120
        self.diastolic = 80
        self.temperature = 37.0
        
    def generate(self):
        """Generate vital signs with small random variations"""
        # Heart rate: 60-100 bpm (normal range)
        self.heart_rate += random.uniform(-2, 2)
        self.heart_rate = max(60, min(100, self.heart_rate))
        
        # SpO2: 95-100% (normal range)
        self.spo2 += random.uniform(-0.5, 0.5)
        self.spo2 = max(95, min(100, self.spo2))
        
        # Blood pressure
        self.systolic += random.uniform(-3, 3)
        self.systolic = max(110, min(140, self.systolic))
        
        self.diastolic += random.uniform(-2, 2)
        self.diastolic = max(70, min(90, self.diastolic))
        
        # Temperature: 36.5-37.5°C (normal range)
        self.temperature += random.uniform(-0.1, 0.1)
        self.temperature = max(36.5, min(37.5, self.temperature))
        
        return {
            "hr": round(self.heart_rate),
            "spo2": round(self.spo2, 1),
            "sys": round(self.systolic),
            "dia": round(self.diastolic),
            "temp": round(self.temperature, 1),
            "gps": f"{current_location['lat']:.4f}° N, {current_location['lon']:.4f}° E",
            "heading": current_location['heading'],
            "timestamp": int(time.time())
        }


class ECGGenerator:
    """Generates realistic ECG waveform samples"""
    
    def __init__(self):
        self.phase = 0
        self.heart_rate = 75
        
    def generate(self, num_samples=10):
        """Generate ECG samples (simulated Lead II)"""
        samples = []
        
        for _ in range(num_samples):
            # Simulate ECG waveform components
            # P wave, QRS complex, T wave
            t = self.phase
            
            # QRS complex (sharp peak)
            qrs = 0
            if 0.1 < (t % 1.0) < 0.2:
                qrs = 5 * math.sin(((t % 1.0) - 0.1) * math.pi / 0.1)
            
            # P wave (smaller rounded)
            p_wave = 0
            if 0.0 < (t % 1.0) < 0.08:
                p_wave = 0.5 * math.sin((t % 1.0) * math.pi / 0.08)
            
            # T wave (rounded)
            t_wave = 0
            if 0.3 < (t % 1.0) < 0.5:
                t_wave = 1.2 * math.sin(((t % 1.0) - 0.3) * math.pi / 0.2)
            
            # Combine components with baseline noise
            sample = qrs + p_wave + t_wave + random.uniform(-0.05, 0.05)
            samples.append(round(sample, 2))
            
            # Advance phase based on heart rate
            self.phase += (self.heart_rate / 60.0) * 0.01
        
        return {
            "samples": samples,
            "timestamp": int(time.time())
        }


class LocationGenerator:
    """Generates GPS coordinates along a route"""
    
    def __init__(self):
        self.current_lat = START_LAT
        self.current_lon = START_LON
        self.dest_lat = DEST_LAT
        self.dest_lon = DEST_LON
        self.speed = 0.0002  # Degrees per update (simulates ~60 km/h)
        
    def calculate_distance(self):
        """Calculate distance to destination in km"""
        lat_diff = self.dest_lat - self.current_lat
        lon_diff = self.dest_lon - self.current_lon
        distance_deg = math.sqrt(lat_diff**2 + lon_diff**2)
        distance_km = distance_deg * 111  # Rough conversion
        return round(distance_km, 2)
    
    def calculate_eta(self):
        """Calculate ETA based on current speed"""
        distance = self.calculate_distance()
        # Assume average speed of 60 km/h
        hours = distance / 60
        minutes = int(hours * 60)
        return f"{minutes} min"
    
    def calculate_heading(self):
        """Calculate compass heading"""
        lat_diff = self.dest_lat - self.current_lat
        lon_diff = self.dest_lon - self.current_lon
        
        angle = math.atan2(lon_diff, lat_diff) * 180 / math.pi
        
        directions = ['North', 'Northeast', 'East', 'Southeast', 
                     'South', 'Southwest', 'West', 'Northwest']
        index = int((angle + 22.5) / 45) % 8
        return directions[index]
    
    def generate(self):
        """Generate location update"""
        if SIMULATION_MODE == "moving":
            # Move towards destination
            lat_diff = self.dest_lat - self.current_lat
            lon_diff = self.dest_lon - self.current_lon
            
            # Normalize and apply speed
            distance = math.sqrt(lat_diff**2 + lon_diff**2)
            if distance > self.speed:
                self.current_lat += (lat_diff / distance) * self.speed
                self.current_lon += (lon_diff / distance) * self.speed
            else:
                # Reached destination, reset
                self.current_lat = START_LAT
                self.current_lon = START_LON
        
        # Add small random variations (GPS jitter)
        lat_jitter = random.uniform(-0.00005, 0.00005)
        lon_jitter = random.uniform(-0.00005, 0.00005)
        
        return {
            "lat": round(self.current_lat + lat_jitter, 6),
            "lon": round(self.current_lon + lon_jitter, 6),
            "heading": self.calculate_heading(),
            "distance": self.calculate_distance(),
            "eta": self.calculate_eta(),
            "speed": 60,  # km/h
            "timestamp": int(time.time())
        }


# ==================== INITIALIZE GENERATORS ====================
vitals_gen = VitalsGenerator()
ecg_gen = ECGGenerator()
location_gen = LocationGenerator()

# Current location (shared between generators)
current_location = {
    "lat": START_LAT,
    "lon": START_LON,
    "heading": "Northeast"
}

# ==================== PUBLISHING FUNCTIONS ====================

def publish_vitals():
    """Publish patient vital signs"""
    data = vitals_gen.generate()
    payload = json.dumps(data)
    result = client.publish(TOPIC_VITALS, payload, qos=1)
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"📊 Vitals: HR={data['hr']} bpm, SpO2={data['spo2']}%, BP={data['sys']}/{data['dia']}")
    else:
        print(f"❌ Failed to publish vitals")


def publish_ecg():
    """Publish ECG waveform data"""
    data = ecg_gen.generate()
    payload = json.dumps(data)
    result = client.publish(TOPIC_ECG, payload, qos=0)
    
    # Only print occasionally (every 10th sample)
    if random.random() < 0.1:
        print(f"💓 ECG: {len(data['samples'])} samples")


def publish_location():
    """Publish ambulance location"""
    global current_location
    data = location_gen.generate()
    current_location = data  # Update shared location
    
    payload = json.dumps(data)
    result = client.publish(TOPIC_LOCATION, payload, qos=1)
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"📍 Location: {data['heading']}, ETA: {data['eta']}, Distance: {data['distance']} km")
    else:
        print(f"❌ Failed to publish location")


def publish_eta():
    """Publish ETA and route data for map page"""
    distance = location_gen.calculate_distance()
    eta_minutes = int((distance / 60) * 60)  # Assume 60 km/h
    
    # Calculate arrival window
    from datetime import datetime, timedelta
    now = datetime.now()
    arrival = now + timedelta(minutes=eta_minutes)
    arrival_end = arrival + timedelta(minutes=4)
    
    data = {
        "eta": eta_minutes,
        "distance": distance,
        "speed": random.randint(40, 65),
        "arrival": f"{arrival.strftime('%H:%M')} - {arrival_end.strftime('%H:%M')}",
        "timestamp": int(time.time())
    }
    
    payload = json.dumps(data)
    result = client.publish(TOPIC_ETA, payload, qos=1)
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"🚗 ETA: {data['eta']} min, Distance: {data['distance']} km")


def publish_traffic():
    """Publish traffic and weather conditions"""
    traffic_levels = ["Light", "Moderate", "Heavy", "Severe"]
    weather_conditions = ["Clear", "Cloudy", "Rainy", "Foggy", "Stormy"]
    route_statuses = ["Clear", "Minor Delays", "Congestion Ahead", "Accident Reported", "Road Work"]
    
    data = {
        "density": random.choice(traffic_levels),
        "weather": random.choice(weather_conditions),
        "route": random.choice(route_statuses),
        "timestamp": int(time.time())
    }
    
    payload = json.dumps(data)
    result = client.publish(TOPIC_TRAFFIC, payload, qos=1)
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"🚦 Traffic: {data['density']}, Weather: {data['weather']}")


def publish_patient_profile():
    """Publish patient profile information (once on startup)"""
    data = {
        "name": "Jane Doe",
        "age": 45,
        "sex": "Female",
        "blood": "O+",
        "conditions": ["Hypertension", "Type 2 Diabetes"],
        "medications": ["Metformin 500mg", "Lisinopril 10mg", "Aspirin 81mg"],
        "notes": "Monitor blood sugar closely. History of allergic reactions.",
        "allergy": "Penicillin, Latex",
        "emergency": {
            "name": "John Doe",
            "phone": "(555) 123-4567",
            "relationship": "Spouse"
        },
        "timestamp": int(time.time())
    }
    
    payload = json.dumps(data)
    result = client.publish(TOPIC_PATIENT_PROFILE, payload, qos=1, retain=True)
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"👤 Patient Profile: {data['name']}, Age {data['age']}")


def publish_patient_vitals():
    """Publish patient vitals snapshot for profile page"""
    # Use same data as main vitals but with simplified format
    data = {
        "hr": vitals_gen.heart_rate,
        "spo2": round(vitals_gen.spo2, 1),
        "bp": f"{round(vitals_gen.systolic)}/{round(vitals_gen.diastolic)}",
        "temp": round(vitals_gen.temperature, 1),
        "timestamp": int(time.time())
    }
    
    payload = json.dumps(data)
    result = client.publish(TOPIC_PATIENT_VITALS, payload, qos=1)
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"💉 Patient Vitals: HR={data['hr']}, SpO2={data['spo2']}%")


# ==================== MAIN SIMULATION LOOP ====================

def main():
    print("=" * 60)
    print("🚑 RescueLink MQTT Data Simulator")
    print("=" * 60)
    print(f"\n🔧 Configuration:")
    print(f"   Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"   Mode: {SIMULATION_MODE}")
    print(f"   Start: {START_LAT}, {START_LON}")
    print(f"   Destination: {DEST_LAT}, {DEST_LON}")
    print(f"\n⏱️  Update Intervals:")
    print(f"   Vitals: {VITALS_INTERVAL}s")
    print(f"   ECG: {ECG_INTERVAL}s")
    print(f"   Location: {LOCATION_INTERVAL}s")
    print(f"\n🔌 Connecting to broker...")
    
    # Connect to broker
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, MQTT_KEEPALIVE)
        client.loop_start()
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return
    
    # Wait for connection
    time.sleep(2)
    
    # Publish patient profile once (retained message)
    publish_patient_profile()
    
    # Timing trackers
    last_vitals = 0
    last_ecg = 0
    last_location = 0
    last_eta = 0
    last_traffic = 0
    last_patient_vitals = 0
    
    try:
        while True:
            current_time = time.time()
            
            # Publish vitals
            if current_time - last_vitals >= VITALS_INTERVAL:
                publish_vitals()
                last_vitals = current_time
            
            # Publish ECG
            if current_time - last_ecg >= ECG_INTERVAL:
                publish_ecg()
                last_ecg = current_time
            
            # Publish location
            if current_time - last_location >= LOCATION_INTERVAL:
                publish_location()
                last_location = current_time
            
            # Publish ETA (every 5 seconds)
            if current_time - last_eta >= 5:
                publish_eta()
                last_eta = current_time
            
            # Publish traffic (every 10 seconds)
            if current_time - last_traffic >= 10:
                publish_traffic()
                last_traffic = current_time
            
            # Publish patient vitals for profile page (every 3 seconds)
            if current_time - last_patient_vitals >= 3:
                publish_patient_vitals()
                last_patient_vitals = current_time
            
            # Small sleep to prevent CPU hogging
            time.sleep(0.05)
            
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping simulation...")
        client.loop_stop()
        client.disconnect()
        print("✅ Disconnected. Goodbye!")


if __name__ == "__main__":
    main()