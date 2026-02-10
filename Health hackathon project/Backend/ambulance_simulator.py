#!/usr/bin/env python3
"""
RescueLink - Ambulance Movement Simulator
Simulates realistic ambulance movement from pickup to hospital in Bhopal
"""

import paho.mqtt.client as mqtt
import json
import time
import math
from datetime import datetime

# MQTT Configuration
BROKER = "broker.hivemq.com"
PORT = 1883
TOPIC_LOCATION = "ambulance/amb-42/location"
TOPIC_ETA = "rescue/eta"
TOPIC_VITALS = "patient/P-8492/vitals"

# Bhopal Coordinates
# Hospital: AIIMS Bhopal (23.2156, 77.4304)
# Pickup Location: Rani Kamlapati Railway Station (23.2599, 77.4126)

HOSPITAL_LAT = 23.2156
HOSPITAL_LON = 77.4304

# Define realistic route waypoints from Rani Kamlapati to AIIMS Bhopal
ROUTE_WAYPOINTS = [
    {"lat": 23.2599, "lon": 77.4126, "location": "Rani Kamlapati Railway Station (Pickup)"},
    {"lat": 23.2580, "lon": 77.4140, "location": "Station Road"},
    {"lat": 23.2550, "lon": 77.4165, "location": "Platform Road Junction"},
    {"lat": 23.2510, "lon": 77.4190, "location": "Hamidia Road"},
    {"lat": 23.2470, "lon": 77.4220, "location": "MP Nagar Zone 1"},
    {"lat": 23.2420, "lon": 77.4250, "location": "DB City Mall Area"},
    {"lat": 23.2360, "lon": 77.4275, "location": "Bittan Market"},
    {"lat": 23.2300, "lon": 77.4290, "location": "Karond Circle"},
    {"lat": 23.2240, "lon": 77.4300, "location": "Danish Kunj"},
    {"lat": 23.2190, "lon": 77.4305, "location": "Saket Nagar"},
    {"lat": 23.2156, "lon": 77.4304, "location": "AIIMS Bhopal (Hospital)"},
]

# Simulation parameters
SPEED_KMH = 50  # Average ambulance speed in km/h
UPDATE_INTERVAL = 2  # Send updates every 2 seconds
POINTS_PER_SEGMENT = 20  # Number of interpolation points between waypoints

# Calculate total distance
def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in kilometers using Haversine formula"""
    R = 6371  # Earth's radius in kilometers
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat/2) ** 2 + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
         math.sin(dlon/2) ** 2)
    
    c = 2 * math.asin(math.sqrt(a))
    distance = R * c
    
    return distance

def interpolate_points(start_lat, start_lon, end_lat, end_lon, num_points):
    """Generate intermediate points between two coordinates"""
    points = []
    for i in range(num_points + 1):
        t = i / num_points
        lat = start_lat + (end_lat - start_lat) * t
        lon = start_lon + (end_lon - start_lon) * t
        points.append((lat, lon))
    return points

def calculate_total_distance():
    """Calculate total route distance"""
    total = 0
    for i in range(len(ROUTE_WAYPOINTS) - 1):
        dist = haversine_distance(
            ROUTE_WAYPOINTS[i]["lat"], ROUTE_WAYPOINTS[i]["lon"],
            ROUTE_WAYPOINTS[i + 1]["lat"], ROUTE_WAYPOINTS[i + 1]["lon"]
        )
        total += dist
    return total

def generate_route_points():
    """Generate all interpolated points for the entire route"""
    all_points = []
    
    for i in range(len(ROUTE_WAYPOINTS) - 1):
        start = ROUTE_WAYPOINTS[i]
        end = ROUTE_WAYPOINTS[i + 1]
        
        points = interpolate_points(
            start["lat"], start["lon"],
            end["lat"], end["lon"],
            POINTS_PER_SEGMENT
        )
        
        # Add points with location info
        for lat, lon in points:
            all_points.append({
                "lat": lat,
                "lon": lon,
                "segment": i,
                "location": start["location"]
            })
    
    return all_points

def calculate_eta(current_distance_km, speed_kmh):
    """Calculate ETA in minutes and seconds"""
    hours = current_distance_km / speed_kmh
    minutes = int(hours * 60)
    seconds = int((hours * 3600) % 60)
    return minutes, seconds

def generate_vitals():
    """Generate realistic patient vitals with slight variations"""
    import random
    
    base_hr = 77
    base_spo2 = 95.2
    
    return {
        "hr": base_hr + random.randint(-3, 5),
        "spo2": round(base_spo2 + random.uniform(-1, 0.8), 1),
        "sys": 138 + random.randint(-5, 5),
        "dia": 88 + random.randint(-3, 3),
        "temp": round(37.1 + random.uniform(-0.2, 0.2), 1),
        "timestamp": datetime.now().isoformat()
    }

def on_connect(client, userdata, flags, rc):
    """Callback when connected to MQTT broker"""
    if rc == 0:
        print("✅ Connected to MQTT broker successfully")
    else:
        print(f"❌ Connection failed with code {rc}")

def main():
    """Main simulation loop"""
    print("🚑 RescueLink Ambulance Movement Simulator")
    print("=" * 60)
    
    # Calculate route info
    total_distance = calculate_total_distance()
    route_points = generate_route_points()
    
    print(f"📍 Route: Rani Kamlapati → AIIMS Bhopal")
    print(f"📏 Total Distance: {total_distance:.2f} km")
    print(f"🗺️  Total Waypoints: {len(ROUTE_WAYPOINTS)}")
    print(f"📊 Interpolated Points: {len(route_points)}")
    print(f"⚡ Average Speed: {SPEED_KMH} km/h")
    print(f"⏱️  Update Interval: {UPDATE_INTERVAL}s")
    print("=" * 60)
    
    # Setup MQTT client
    client = mqtt.Client(client_id="ambulance_simulator")
    client.on_connect = on_connect
    
    print(f"🔌 Connecting to MQTT broker: {BROKER}:{PORT}")
    try:
        client.connect(BROKER, PORT, 60)
        client.loop_start()
        time.sleep(2)  # Wait for connection
    except Exception as e:
        print(f"❌ Failed to connect to MQTT broker: {e}")
        return
    
    print("🚀 Starting ambulance simulation...\n")
    
    current_point_index = 0
    total_points = len(route_points)
    
    try:
        while current_point_index < total_points:
            point = route_points[current_point_index]
            
            # Calculate remaining distance
            remaining_distance = 0
            for i in range(current_point_index, total_points - 1):
                p1 = route_points[i]
                p2 = route_points[i + 1]
                remaining_distance += haversine_distance(
                    p1["lat"], p1["lon"],
                    p2["lat"], p2["lon"]
                )
            
            # Calculate ETA
            eta_minutes, eta_seconds = calculate_eta(remaining_distance, SPEED_KMH)
            
            # Status
            if current_point_index == 0:
                status = "pickup"
            elif current_point_index >= total_points - 1:
                status = "arrived"
            else:
                status = "en_route"
            
            # Prepare location update
            location_data = {
                "lat": point["lat"],
                "lon": point["lon"],
                "speed_kmh": SPEED_KMH,
                "heading": 180,  # Approximate heading south
                "status": status,
                "location_name": point["location"],
                "timestamp": datetime.now().isoformat()
            }
            
            # Prepare ETA update
            eta_data = {
                "eta_minutes": eta_minutes,
                "eta_seconds": eta_seconds,
                "remaining_km": round(remaining_distance, 2),
                "distance": f"{remaining_distance:.2f}",
                "eta": f"{eta_minutes}",
                "speed": f"{SPEED_KMH}",
                "arrival": datetime.now().strftime("%H:%M"),
                "status": status,
                "timestamp": datetime.now().isoformat()
            }
            
            # Publish location
            client.publish(TOPIC_LOCATION, json.dumps(location_data))
            
            # Publish ETA
            client.publish(TOPIC_ETA, json.dumps(eta_data))
            
            # Publish vitals every 5th update
            if current_point_index % 5 == 0:
                vitals = generate_vitals()
                client.publish(TOPIC_VITALS, json.dumps(vitals))
            
            # Progress display
            progress = (current_point_index + 1) / total_points * 100
            bar_length = 40
            filled = int(bar_length * progress / 100)
            bar = "█" * filled + "░" * (bar_length - filled)
            
            print(f"\r[{bar}] {progress:.1f}% | "
                  f"📍 {point['location'][:30]:30s} | "
                  f"🏥 ETA: {eta_minutes:2d}m {eta_seconds:2d}s | "
                  f"📏 {remaining_distance:.2f}km", 
                  end="", flush=True)
            
            # Check if arrived
            if status == "arrived":
                print("\n\n✅ Ambulance arrived at AIIMS Bhopal!")
                print("🏥 Simulation complete!")
                break
            
            # Move to next point
            current_point_index += 1
            time.sleep(UPDATE_INTERVAL)
            
    except KeyboardInterrupt:
        print("\n\n⚠️  Simulation stopped by user")
    finally:
        client.loop_stop()
        client.disconnect()
        print("🔌 Disconnected from MQTT broker")
        print("\n" + "=" * 60)
        print("📊 Simulation Summary:")
        print(f"   Points traveled: {current_point_index}/{total_points}")
        print(f"   Distance covered: {total_distance - remaining_distance:.2f}/{total_distance:.2f} km")
        print("=" * 60)

if __name__ == "__main__":
    main()