import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';
import './App.css';

const contractABI = [
  "function creditBalance(address _meter) view returns (uint256)",
  "function serviceActive(address _meter) view returns (bool)",
  "function topUp(address _meter, uint256 _amount) external"
];

const CONTRACT_ADDRESS = "0x4016478B4Dd33f54622024B9E66E0A72C871e569"; 
const METER_ADDRESS = "0x3d5e768eda8669ce6c5e41435a1535ce690e2efd";

function App() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState("0");
  const [isActive, setIsActive] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [readings, setReadings] = useState([]); // Nouvel état pour le graphique
  const [isLoading, setIsLoading] = useState(false);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
      } catch (error) {
        console.error("Erreur de connexion", error);
      }
    } else {
      alert("Veuillez installer MetaMask !");
    }
  };

  const fetchContractData = async () => {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
      
      const bal = await contract.creditBalance(METER_ADDRESS);
      const active = await contract.serviceActive(METER_ADDRESS);
      
      setBalance(bal.toString());
      setIsActive(active);
    } catch (error) {
      console.error("Erreur de lecture du contrat", error);
    }
  };

  const handleTopUp = async () => {
    if (!window.ethereum) return;
    setIsLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
      
      const tx = await contract.topUp(METER_ADDRESS, 100);
      await tx.wait();
      
      alert("Compteur rechargé de 100 m³ avec succès !");
      fetchContractData();
    } catch (error) {
      console.error("Erreur lors du top-up", error);
      alert("Erreur lors de la transaction");
    }
    setIsLoading(false);
  };

  // Récupérer les données de la passerelle (alertes + relevés)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const alertsRes = await fetch('http://localhost:3001/api/alerts');
        const alertsData = await alertsRes.json();
        setAlerts(alertsData);

        const readingsRes = await fetch('http://localhost:3001/api/readings');
        const readingsData = await readingsRes.json();
        setReadings(readingsData);
      } catch (error) {
        // Silencieux si la passerelle n'est pas allumée
      }
    };

    const interval = setInterval(fetchData, 3000); // Rafraîchir toutes les 3 secondes
    fetchData();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (account) {
      fetchContractData();
      const interval = setInterval(fetchContractData, 10000);
      return () => clearInterval(interval);
    }
  }, [account]);

  return (
    <div className="dashboard">
      <header>
        <h1>💧 WaterCredit DApp</h1>
        {!account ? (
          <button onClick={connectWallet} className="btn-connect">Connecter MetaMask</button>
        ) : (
          <div className="account-info">Connecté : {account.slice(0, 6)}...{account.slice(-4)}</div>
        )}
      </header>

      <main>
        {/* Section Abonné */}
        <section className="card">
          <h2>Espace Abonné</h2>
          <p className="meter-address">Compteur : {METER_ADDRESS.slice(0, 10)}...</p>
          
          <div className="stats">
            <div className="stat-box">
              <span className="label">Crédit restant</span>
              <span className="value">{balance} m³</span>
            </div>
            <div className="stat-box">
              <span className="label">État du service</span>
              <span className={`value ${isActive ? 'status-active' : 'status-suspended'}`}>
                {isActive ? "Actif" : "Suspendu"}
              </span>
            </div>
          </div>

          <button 
            onClick={handleTopUp} 
            disabled={!account || isLoading} 
            className="btn-topup"
          >
            {isLoading ? "Transaction en cours..." : "Recharger 100 m³"}
          </button>
        </section>

        {/* Section Graphique */}
        <section className="card">
          <h2>Surveillance des débits</h2>
          <p className="subtitle">Seuil d'alerte fixé à 30 m³</p>
          
          <div className="chart-container">
            {readings.length === 0 ? (
              <p className="no-alerts">En attente de données...</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={readings} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{fontSize: 10}} />
                  <YAxis domain={[0, 50]} />
                  <Tooltip />
                  {/* Ligne rouge pointillée pour le seuil */}
                  <ReferenceLine y={30} stroke="red" strokeDasharray="3 3" label={{ position: 'top', value: 'Seuil (30)', fill: 'red', fontSize: 12 }} />
                  <Bar dataKey="volume" name="Volume (m³)">
                    {readings.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.volume > 30 ? '#ef4444' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Section Opérateur (Alertes IA) */}
        <section className="card" style={{ gridColumn: "1 / -1" }}>
          <h2>Alertes de Fuites (IA)</h2>
          <p className="subtitle">Détection en temps réel (Isolation Forest)</p>
          
          <div className="alerts-list">
            {alerts.length === 0 ? (
              <p className="no-alerts">Aucune fuite détectée pour le moment.</p>
            ) : (
              alerts.map((alert, index) => (
                <div key={index} className="alert-item">
                  <div className="alert-header">
                    <span className="alert-title">🚨 Fuite détectée</span>
                    <span className="alert-time">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p>Volume anormal : <strong>{alert.volume} m³</strong></p>
                  <p className="alert-meter">Compteur : {alert.meter.slice(0, 10)}...</p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;