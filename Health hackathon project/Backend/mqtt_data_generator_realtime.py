#!/usr/bin/env python3
"""
RescueLink - Real-Time Ambulance Route Simulation
Simulates ambulance movement from Rani Kamlapati to Hospital with live ETA updates
"""

import paho.mqtt.client as mqtt
import json
import time
import random
import math

# ==================== MQTT CONFIGURATION ====================
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
MQTT_KEEPALIVE = 60

TOPIC_VITALS = "patient/P-8492/vitals"
TOPIC_ECG = "patient/P-8492/ecg"
TOPIC_LOCATION = "ambulance/amb-42/location"
TOPIC_ETA = "rescue/eta"
TOPIC_TRAFFIC = "rescue/traffic"
TOPIC_PATIENT_PROFILE = "rescue/patient/profile"
TOPIC_PATIENT_VITALS = "rescue/patient/vitals"

# ==================== LOCATION & ROUTE CONFIGURATION ====================
# Hospital (Destination)
HOSPITAL_LAT = 23.2156
HOSPITAL_LON = 77.4304

# Pickup location - Rani Kamlapati area, Bhopal
PICKUP_LAT = 23.183
PICKUP_LON = 77.416

# Route waypoints for realistic path (Rani Kamlapati → Hospital)
ROUTE_WAYPOINTS = [
    {"lat": 23.183, "lon": 77.416},      # Start: Rani Kamlapati
    {"lat": 23.185, "lon": 77.414},      # Jyotiba Phule Road
    {"lat": 23.188, "lon": 77.410},      # Near Indraprastha
    {"lat": 23.192, "lon": 77.408},      # MP Nagar
    {"lat": 23.197, "lon": 77.412},      # Arera Colony
    {"lat": 23.202, "lon": 77.416},      # Habibganj
    {"lat": 23.206, "lon": 77.418},      # Hoshangabad Road
    {"lat": 23.210, "lon": 77.420},      # Near Hospital
    {"lat": HOSPITAL_LAT, "lon": HOSPITAL_LON},  # End: Hospital
]

# ==================== SIMULATION PARAMETERS ====================
VITALS_INTERVAL = 2          # Update vitals every 2 seconds
ECG_INTERVAL = 0.1           # Update ECG every 100ms
LOCATION_INTERVAL = 1        # Update location every 1 second
ETA_INTERVAL = 2             # Update ETA every 2 seconds
TRAFFIC_INTERVAL = 10        # Update traffic every 10 seconds

AMBULANCE_SPEED_KPH = 40     # Average speed in city
ROUTE_DISTANCE_KM = 5.28     # Total distance from pickup to hospital

# ==================== MQTT CLIENT ====================
client = mqtt.Client(client_id="rescuelink_simulator_realtime", protocol=mqtt.MQTTv311)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT Broker!")
        print(f"\n📍 ROUTE SIMULATION")
        print(f"   Pickup: {PICKUP_LAT}, {PICKUP_LON} (Rani Kamlapati)")
        print(f"   Hospital: {HOSPITAL_LAT}, {HOSPITAL_LON}")
        print(f"   Distance: {ROUTE_DISTANCE_KM} km")
        print(f"   Speed: {AMBULANCE_SPEED_KPH} km/h")
        print(f"   Estimated Time: {int(ROUTE_DISTANCE_KM / AMBULANCE_SPEED_KPH * 60)} minutes")
        print(f"\n🚑 Starting simulation...\n")
    else:
        print(f"❌ Connection failed: {rc}")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        print("⚠️ Unexpected disconnection. Reconnecting...")

client.on_connect = on_connect
client.on_disconnect = on_disconnect

# ==================== VITALS GENERATOR ====================
class VitalsGenerator:
    def __init__(self):
        self.heart_rate = 75
        self.spo2 = 98
        self.systolic = 120
        self.diastolic = 80
        self.temperature = 37.0
    
    def generate(self):
        self.heart_rate += random.uniform(-2, 2)
        self.heart_rate = max(60, min(100, self.heart_rate))
        
        self.spo2 += random.uniform(-0.5, 0.5)
        self.spo2 = max(95, min(100, self.spo2))
        
        self.systolic += random.uniform(-3, 3)
        self.systolic = max(110, min(140, self.systolic))
        
        self.diastolic += random.uniform(-2, 2)
        self.diastolic = max(70, min(90, self.diastolic))
        
        self.temperature += random.uniform(-0.1, 0.1)
        self.temperature = max(36.5, min(37.5, self.temperature))
        
        return {
            "hr": round(self.heart_rate),
            "spo2": round(self.spo2, 1),
            "systolic": round(self.systolic),
            "diastolic": round(self.diastolic),
            "temp": round(self.temperature, 1)
        }

# ==================== ECG GENERATOR ====================
class ECGGenerator:
    def __init__(self):
        self.phase = random.random() * 2 * math.pi
        self.heart_rate = 75
    
    def generate(self, num_samples=10):
        samples = []
        self.heart_rate += random.uniform(-2, 2)
        self.heart_rate = max(60, min(100, self.heart_rate))
        
        for _ in range(num_samples):
            t = (self.phase / (2 * math.pi)) % 1.0
            
            # QRS complex
            qrs = 0
            if 0.35 < t < 0.45:
                qrs = math.sin((t - 0.35) / 0.1 * math.pi) * 5.5
            
            # P wave
            p_wave = 0
            if 0.12 < t < 0.28:
                p_wave = math.sin((t - 0.15) / 0.16 * math.pi) * 0.6
            
            # T wave
            t_wave = 0
            if 0.50 < t < 0.75:
                t_wave = math.sin((t - 0.55) / 0.25 * math.pi) * 1.2
            
            noise = (random.random() - 0.5) * 0.25
            sample = qrs + p_wave + t_wave + noise
            samples.append(float(sample))
            
            self.phase += (self.heart_rate / 60) * (2 * math.pi) / 100
        
        return samples

# ==================== ROUTE SIMULATOR ====================
class RouteSimulator:
    def __init__(self, waypoints):
        self.waypoints = waypoints
        self.current_index = 0
        self.progress = 0.0  # 0 to 1
        self.total_distance = self.calculate_total_distance()
        self.distance_traveled = 0.0
        self.start_time = time.time()
    
    def calculate_total_distance(self):
        """Calculate total distance in km"""
        total = 0
        for i in range(len(self.waypoints) - 1):
            p1 = self.waypoints[i]
            p2 = self.waypoints[i + 1]
            total += self.haversine(p1["lat"], p1["lon"], p2["lat"], p2["lon"])
        return total
    
    def haversine(self, lat1, lon1, lat2, lon2):
        """Calculate distance in km between two coordinates"""
        R = 6371  # Earth radius in km
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c
    
    def get_current_position(self):
        """Get current position based on elapsed time and speed"""
        elapsed_time = time.time() - self.start_time
        elapsed_hours = elapsed_time / 3600
        distance_traveled = min(AMBULANCE_SPEED_KPH * elapsed_hours, ROUTE_DISTANCE_KM)
        
        # Find position along route
        distance_so_far = 0
        for i in range(len(self.waypoints) - 1):
            p1 = self.waypoints[i]
            p2 = self.waypoints[i + 1]
            segment_distance = self.haversine(p1["lat"], p1["lon"], p2["lat"], p2["lon"])
            
            if distance_so_far + segment_distance >= distance_traveled:
                # Interpolate within this segment
                progress_in_segment = (distance_traveled - distance_so_far) / segment_distance
                lat = p1["lat"] + (p2["lat"] - p1["lat"]) * progress_in_segment
                lon = p1["lon"] + (p2["lon"] - p1["lon"]) * progress_in_segment
                return lat, lon, distance_traveled
            
            distance_so_far += segment_distance
        
        # Reached destination
        return self.waypoints[-1]["lat"], self.waypoints[-1]["lon"], ROUTE_DISTANCE_KM
    
    def get_remaining_time_seconds(self):
        """Get remaining ETA in seconds"""
        elapsed_time = time.time() - self.start_time
        elapsed_hours = elapsed_time / 3600
        distance_traveled = AMBULANCE_SPEED_KPH * elapsed_hours
        remaining_distance = max(0, ROUTE_DISTANCE_KM - distance_traveled)
        
        if AMBULANCE_SPEED_KPH == 0:
            return 0
        
        remaining_hours = remaining_distance / AMBULANCE_SPEED_KPH
        return int(remaining_hours * 3600)

# ==================== PUBLISHERS ====================
def publish_vitals(vitals_gen):
    data = vitals_gen.generate()
    data["timestamp"] = int(time.time())
    payload = json.dumps(data)
    result = client.publish(TOPIC_VITALS, payload, qos=1)
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"💉 Vitals: HR={data['hr']} bpm, SpO2={data['spo2']}%, BP={data['systolic']}/{data['diastolic']}")

def publish_ecg(ecg_gen):
    samples = ecg_gen.generate(12)
    data = {
        "samples": samples,
        "timestamp": int(time.time())
    }
    payload = json.dumps(data)
    result = client.publish(TOPIC_ECG, payload, qos=0)

def publish_location(route_sim):
    lat, lon, distance = route_sim.get_current_position()
    data = {
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "distance_from_start": round(distance, 2),
        "timestamp": int(time.time())
    }
    payload = json.dumps(data)
    result = client.publish(TOPIC_LOCATION, payload, qos=1)
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"📍 Location: {lat:.4f}, {lon:.4f} | {distance:.2f} km traveled")

def publish_eta(route_sim):
    remaining_seconds = route_sim.get_remaining_time_seconds()
    minutes = remaining_seconds // 60
    seconds = remaining_seconds % 60
    
    data = {
        "eta_seconds": remaining_seconds,
        "eta_minutes": minutes,
        "remaining_km": max(0, ROUTE_DISTANCE_KM - (AMBULANCE_SPEED_KPH * ((time.time() - route_sim.start_time) / 3600))),
        "status": "arrived" if remaining_seconds == 0 else "en_route",
        "timestamp": int(time.time())
    }
    payload = json.dumps(data)
    result = client.publish(TOPIC_ETA, payload, qos=1)
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        if remaining_seconds > 0:
            print(f"🏥 ETA: {minutes}m {seconds}s | {data['remaining_km']:.2f} km remaining")
        else:
            print(f"✅ ARRIVED AT HOSPITAL!")

def publish_traffic():
    conditions = ["Light", "Moderate", "Heavy"]
    data = {
        "condition": random.choice(conditions),
        "congestion": random.randint(10, 80),
        "timestamp": int(time.time())
    }
    payload = json.dumps(data)
    result = client.publish(TOPIC_TRAFFIC, payload, qos=1)

def publish_patient_profile():
    data = {
        "id": "P-8492",
        "name": "Jane Doe",
        "age": 45,
        "condition": "Chest Pain (Suspected MI)",
        "blood_type": "O+",
        "allergies": "Penicillin",
        "timestamp": int(time.time())
    }
    payload = json.dumps(data)
    result = client.publish(TOPIC_PATIENT_PROFILE, payload, qos=1, retain=True)

# ==================== MAIN LOOP ====================
def main():
    print("=" * 70)
    print("🚑 RescueLink Real-Time Ambulance Route Simulator")
    print("=" * 70)
    
    try:
        print(f"\n🔌 Connecting to {MQTT_BROKER}:{MQTT_PORT}...")
        client.connect(MQTT_BROKER, MQTT_PORT, MQTT_KEEPALIVE)
        client.loop_start()
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return
    
    time.sleep(2)
    
    # Initialize generators
    vitals_gen = VitalsGenerator()
    ecg_gen = ECGGenerator()
    route_sim = RouteSimulator(ROUTE_WAYPOINTS)
    
    # Publish patient profile
    publish_patient_profile()
    
    # Timing trackers
    last_vitals = 0
    last_ecg = 0
    last_location = 0
    last_eta = 0
    last_traffic = 0
    
    print("\n" + "=" * 70 + "\n")
    
    try:
        while True:
            current_time = time.time()
            
            if current_time - last_vitals >= VITALS_INTERVAL:
                publish_vitals(vitals_gen)
                last_vitals = current_time
            
            if current_time - last_ecg >= ECG_INTERVAL:
                publish_ecg(ecg_gen)
                last_ecg = current_time
            
            if current_time - last_location >= LOCATION_INTERVAL:
                publish_location(route_sim)
                last_location = current_time
            
            if current_time - last_eta >= ETA_INTERVAL:
                publish_eta(route_sim)
                last_eta = current_time
            
            if current_time - last_traffic >= TRAFFIC_INTERVAL:
                publish_traffic()
                last_traffic = current_time
            
            time.sleep(0.1)
    
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping simulation...")
        client.loop_stop()
        client.disconnect()
        print("✅ Disconnected. Goodbye!")

if __name__ == "__main__":
    main()
