import paho.mqtt.client as mqtt
import json
import time
import random
import os
from dotenv import load_dotenv

load_dotenv()
MQTT_URL = os.getenv("MQTT_URL")
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
TOPIC_PREFIX = os.getenv("MQTT_TOPIC_PREFIX", "water/meter")

# Adresse fictive du compteur
METER_ADDRESS = "0x3d5e768eda8669ce6c5e41435a1535ce690e2efd" 

def on_connect(client, userdata, flags, reason_code, properties):
    print(f"✅ Simulateur connecté au broker MQTT (Code: {reason_code})")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
client.tls_set()
client.on_connect = on_connect

host = MQTT_URL.split("://")[1].split(":")[0]
client.connect(host, 8883, 60)
client.loop_start()

print(f"🚰 Démarrage du compteur virtuel : {METER_ADDRESS}")
print("Envoi d'un relevé toutes les 10 secondes...")

try:
    while True:
        # 15% de chance d'avoir une fuite (volume entre 30 et 60 m³)
        if random.random() < 0.15:
            volume = random.randint(30, 60)
            print("⚠️ [SIMULATEUR] Génération d'une fuite !")
        else:
            # Consommation normale (entre 1 et 10 m³)
            volume = random.randint(1, 10)
        
        payload = {
            "meterAddress": METER_ADDRESS,
            "volume": volume,
            "timestamp": int(time.time())
        }
        
        topic = f"{TOPIC_PREFIX}/{METER_ADDRESS}/reading"
        client.publish(topic, json.dumps(payload))
        print(f"📤 Envoyé : {volume} m³ sur {topic}")
        
        time.sleep(10)
        
except KeyboardInterrupt:
    print("\n⏹️ Arrêt du simulateur.")
    client.loop_stop()
    client.disconnect()