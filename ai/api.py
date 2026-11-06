from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os
import numpy as np
from sklearn.ensemble import IsolationForest

app = Flask(__name__)
CORS(app) # Autoriser les requêtes cross-origin

model_path = "models/isolation_forest.joblib"

def get_or_train_model():
    os.makedirs("models", exist_ok=True)
    
    if os.path.exists(model_path):
        print("✅ Modèle IA chargé avec succès.")
        return joblib.load(model_path)
    else:
        print("⚠️ Modèle introuvable. Entraînement automatique en cours...")
        # On génère des données plus réalistes (moyenne de 5, écart-type de 2)
        np.random.seed(42)
        normal_data = np.random.normal(loc=5.0, scale=2.0, size=(1000, 1))
        normal_data = np.clip(normal_data, 0.5, 15.0) # On borne entre 0.5 et 15 m³
        
        # On rend le modèle un peu moins sensible
        model = IsolationForest(contamination=0.01, random_state=42)
        model.fit(normal_data)
        
        joblib.dump(model, model_path)
        print("✅ Modèle entraîné et sauvegardé !")
        return model

model = get_or_train_model()

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "IA en ligne et opérationnelle"})

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({"error": "Modèle non chargé"}), 500
        
    data = request.get_json()
    volume = float(data.get('volume', 0))

    prediction = model.predict([[volume]])
    score = model.decision_function([[volume]])[0]
    
    # On combine l'IA avec une règle métier simple : 
    # Une fuite doit être une anomalie ET un volume élevé (> 15 m³)
    is_anomaly = bool(prediction[0] == -1)
    
    if volume < 15:
        is_anomaly = False # Un petit volume n'est jamais une fuite
        
    return jsonify({
        "volume": volume,
        "is_anomaly": is_anomaly,
        "score": score,
        "status": "🚨 FUITE DÉTECTÉE" if is_anomaly else "✅ Normal"
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)