from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os
import numpy as np
from sklearn.ensemble import IsolationForest

app = Flask(__name__)
CORS(app)

model_path = "models/isolation_forest.joblib"

def get_or_train_model():
    os.makedirs("models", exist_ok=True)
    if os.path.exists(model_path):
        print("✅ Modèle IA chargé avec succès.")
        return joblib.load(model_path)
    else:
        print("⚠️ Modèle introuvable. Entraînement automatique en cours...")
        np.random.seed(42)
        # Entraîné sur des données normales (entre 1 et 15 m³)
        normal_data = np.random.uniform(low=1.0, high=15.0, size=(1000, 1))
        model = IsolationForest(contamination=0.01, random_state=42)
        model.fit(normal_data)
        joblib.dump(model, model_path)
        print("✅ Modèle entraîné et sauvegardé !")
        return model

model = get_or_train_model()

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "IA en ligne"})

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({"error": "Modèle non chargé"}), 500
        
    data = request.get_json()
    volume = float(data.get('volume', 0))

    # 1. L'IA fait sa prédiction
    prediction = model.predict([[volume]])
    score = model.decision_function([[volume]])[0]
    is_anomaly_ia = bool(prediction[0] == -1)
    
    # 2. Règle métier stricte : > 30 m³ = fuite (au cas où l'IA doute)
    is_anomaly = is_anomaly_ia or (volume > 30)
    
    return jsonify({
        "volume": volume,
        "is_anomaly": is_anomaly,
        "score": score,
        "status": "🚨 FUITE DÉTECTÉE" if is_anomaly else "✅ Normal"
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)