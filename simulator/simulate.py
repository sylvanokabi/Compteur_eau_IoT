import paho.mqtt.client as mqtt
import json
import time
import random
import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()
MQTT_URL = os.getenv("MQTT_URL")
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
TOPIC_PREFIX = os.getenv("MQTT_TOPIC_PREFIX", "water/meter")

# Adresse fictive du compteur (en minuscules pour éviter les erreurs de checksum)
METER_ADDRESS = "0x3d5e768eda8669ce6c5e41435a1535ce690e2efd" 

def on_connect(client, userdata, flags, reason_code, properties):
    # reason_code est le nouveau nom de l'argument rc dans l'API V2
    print(f"✅ Simulateur connecté au broker MQTT (Code: {reason_code})")

# Utilisation de CallbackAPIVersion.VERSION2 pour éviter le DeprecationWarning
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
client.tls_set() # Sécuriser la connexion (TLS)
client.on_connect = on_connect

# Extraire l'hôte et le port de l'URL
host = MQTT_URL.split("://")[1].split(":")[0]
client.connect(host, 8883, 60)
client.loop_start()

print(f"🚰 Démarrage du compteur virtuel : {METER_ADDRESS}")
print("Envoi d'un relevé toutes les 10 secondes...")

try:
    while True:
        # Générer une consommation aléatoire entre 1 et 5 m³
        if random.random() < 0.1:
            volume = 45
        else:
            volume = random.randint(1, 5)
        
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