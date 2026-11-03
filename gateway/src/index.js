const mqtt = require("mqtt");
const { ethers } = require("ethers");
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
app.use(cors());
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL, undefined, { staticNetwork: true });
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contractABI = [
  "function recordReading(address _meter, uint256 _volume) external",
  "function topUp(address _meter, uint256 _amount) external",
  "function creditBalance(address _meter) view returns (uint256)",
  "function serviceActive(address _meter) view returns (bool)"
];
const waterContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);

const mqttOptions = {
  host: process.env.MQTT_URL.split("://")[1].split(":")[0],
  port: 8883,
  protocol: "mqtts",
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
};

const client = mqtt.connect(mqttOptions);

let messageQueue = [];
let isProcessingQueue = false;
let recentAlerts = []; 
let recentReadings = []; // NOUVEAU: Stocke l'historique pour le graphique

async function processQueue() {
  if (isProcessingQueue || messageQueue.length === 0) return;
  isProcessingQueue = true;

  const payload = messageQueue.shift();

  try {
    console.log(`\n📥 Traitement du relevé [${payload.meterAddress}] : ${payload.volume} m³`);
    const meterAddress = ethers.getAddress(payload.meterAddress);

    console.log(`🧠 Analyse de l'IA en cours...`);
    const aiResponse = await fetch("http://127.0.0.1:5000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volume: payload.volume })
    });
    
    const aiData = await aiResponse.json();
    
    // NOUVEAU: Ajouter le relevé à l'historique pour le graphique
    recentReadings.push({
      time: new Date().toLocaleTimeString(),
      volume: payload.volume,
      isLeak: aiData.is_anomaly
    });
    if (recentReadings.length > 15) recentReadings.shift(); // Garde les 15 derniers

    if (aiData.is_anomaly) {
      console.log(`🚨 ALERTE IA : ${aiData.status} (Volume : ${payload.volume} m³)`);
      recentAlerts.unshift({
        meter: payload.meterAddress,
        volume: payload.volume,
        score: aiData.score,
        timestamp: new Date().toISOString()
      });
      if (recentAlerts.length > 10) recentAlerts.pop();
    } else {
      console.log(`✅ L'IA confirme que la consommation est normale.`);
    }

    const balance = await waterContract.creditBalance(meterAddress);
    const active = await waterContract.serviceActive(meterAddress);

    if (balance < BigInt(payload.volume) || !active) {
      console.log(`⚠️ Crédit insuffisant. Rechargement automatique de 100 m³...`);
      const topUpTx = await waterContract.topUp(meterAddress, 100); 
      await topUpTx.wait();
      console.log(`✅ Compteur rechargé.`);
    }

    console.log(`⏳ Enregistrement du relevé sur la blockchain...`);
    const tx = await waterContract.recordReading(meterAddress, payload.volume); 
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmée ! Bloc: ${receipt.blockNumber}`);

  } catch (error) {
    console.error("❌ Erreur lors du traitement :", error.reason || error.message);
  } finally {
    isProcessingQueue = false;
    processQueue();
  }
}

client.on("connect", () => {
  console.log("✅ Connecté au broker MQTT");
  const topic = `${process.env.MQTT_TOPIC_PREFIX}/+/reading`;
  client.subscribe(topic, (err) => {
    if (!err) console.log(`📡 En écoute sur le topic : ${topic}`);
  });
});

client.on("message", (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    messageQueue.push(payload);
    processQueue();
  } catch (error) {
    console.error("❌ Impossible de parser le message MQTT");
  }
});

// --- ROUTES API POUR LE TABLEAU DE BORD ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", queueSize: messageQueue.length });
});

app.get("/api/alerts", (req, res) => {
  res.json(recentAlerts);
});

// NOUVELLE ROUTE: pour le graphique
app.get("/api/readings", (req, res) => {
  res.json(recentReadings);
});

const PORT = process.env.GATEWAY_PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Passerelle en écoute sur le port ${PORT}`);
});