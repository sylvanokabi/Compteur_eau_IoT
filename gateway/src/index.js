const mqtt = require("mqtt");
const { ethers } = require("ethers");
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
app.use(cors());
app.use(express.json());

// Configuration Blockchain
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contractABI = [
  "function recordReading(address _meter, uint256 _volume) external",
  "function topUp(address _meter, uint256 _amount) external",
  "function creditBalance(address _meter) view returns (uint256)",
  "function serviceActive(address _meter) view returns (bool)"
];
const waterContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);

// Configuration MQTT
const mqttOptions = {
  host: process.env.MQTT_URL.split("://")[1].split(":")[0],
  port: 8883,
  protocol: "mqtts",
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
};

console.log("Connexion au broker MQTT HiveMQ...");
const client = mqtt.connect(mqttOptions);

let isProcessing = false; 
let readingsDB = [];
let alertsDB = [];

client.on("connect", () => {
  console.log("✅ Connecté au broker MQTT");
  const topic = `${process.env.MQTT_TOPIC_PREFIX}/+/reading`;
  client.subscribe(topic, (err) => {
    if (!err) console.log(`📡 En écoute sur le topic : ${topic}`);
  });
});

client.on("message", async (topic, message) => {
  if (isProcessing) return; 
  isProcessing = true;

  try {
    const payload = JSON.parse(message.toString());
    console.log(`\n📥 Relevé reçu [${payload.meterAddress}] : ${payload.volume} m³`);

    const meterAddress = ethers.getAddress(payload.meterAddress);

    // 1. Sauvegarde IMMÉDIATE pour le graphique
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    readingsDB.push({ time: timeString, volume: payload.volume });
    if (readingsDB.length > 20) readingsDB.shift(); 

    // 2. Appel IA avec Timeout (Sécurité)
    console.log(`🧠 Analyse de l'IA en cours...`);
    const aiUrl = process.env.AI_API_URL || "http://127.0.0.1:5000";
    let aiAnomaly = false;

    try {
      // On attend max 5 secondes pour éviter que le serveur ne bloque
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); 

      const aiResponse = await fetch(`${aiUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume: payload.volume }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      // On vérifie que la réponse est bien du JSON avant de la lire
      const contentType = aiResponse.headers.get("content-type");
      if (aiResponse.ok && contentType && contentType.includes("application/json")) {
        const aiData = await aiResponse.json();
        aiAnomaly = aiData.is_anomaly;
        
        if (aiAnomaly) {
          console.log(`🚨 ALERTE IA : ${aiData.status} (Volume : ${payload.volume} m³)`);
        } else {
          console.log(`✅ L'IA confirme que la consommation est normale.`);
        }
      } else {
        console.log(`⚠️ L'API IA a renvoyé du HTML (Réveil Render). Fallback activé.`);
        // Si l'IA est en train de se réveiller, on utilise la règle métier de secours
        if (payload.volume > 30) aiAnomaly = true; 
      }
    } catch (aiError) {
      console.log(`⚠️ L'IA est injoignable ou endormie. Fallback activé.`);
      // Si l'IA ne répond pas du tout, on déclenche l'alerte si le volume est anormal
      if (payload.volume > 30) aiAnomaly = true; 
    }

    // 3. Enregistrement de l'alerte si fuite
    if (aiAnomaly) {
      alertsDB.unshift({
        meter: meterAddress,
        volume: payload.volume,
        timestamp: Date.now()
      });
      if (alertsDB.length > 10) alertsDB.pop();
      console.log(`🚨 Alerte ajoutée à la liste (Taille actuelle: ${alertsDB.length})`);
    }

    // 4. Interactions Blockchain
    const balance = await waterContract.creditBalance(meterAddress);
    const active = await waterContract.serviceActive(meterAddress);

    if (balance < BigInt(payload.volume) || !active) {
      console.log(`⚠️ Crédit insuffisant. Rechargement automatique de 100 m³...`);
      const topUpTx = await waterContract.topUp(meterAddress, 100); 
      await topUpTx.wait();
    }

    console.log(`⏳ Enregistrement du relevé sur la blockchain...`);
    const tx = await waterContract.recordReading(meterAddress, payload.volume); 
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmée ! Bloc: ${receipt.blockNumber}`);

  } catch (error) {
    console.error("❌ Erreur bloquante :", error.reason || error.message);
  } finally {
    isProcessing = false; 
  }
});

// ==========================================
// ROUTES POUR LE TABLEAU DE BORD REACT
// ==========================================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Passerelle opérationnelle" });
});

app.get("/api/readings", (req, res) => {
  res.json(readingsDB);
});

app.get("/api/alerts", (req, res) => {
  res.json(alertsDB);
});

const PORT = process.env.GATEWAY_PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Passerelle en écoute sur le port ${PORT}`);
});