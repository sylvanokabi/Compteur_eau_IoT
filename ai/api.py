from flask import Flask, request, jsonify
import joblib
import os
import numpy as np
from sklearn.ensemble import IsolationForest

app = Flask(__name__)

# Le chemin est relatif au dossier 'ai' car on utilise --chdir ai sur Render
model_path = "models/isolation_forest.joblib"

def get_or_train_model():
    # Créer le dossier models s'il n'existe pas
    os.makedirs("models", exist_ok=True)
    
    if os.path.exists(model_path):
        print("✅ Modèle IA chargé avec succès.")
        return joblib.load(model_path)
    else:
        print("⚠️ Modèle introuvable. Entraînement automatique en cours...")
        np.random.seed(42)
        normal_data = np.random.uniform(low=1.0, high=15.0, size=(1000, 1))
        model = IsolationForest(contamination=0.01, random_state=42)
        model.fit(normal_data)
        joblib.dump(model, model_path)
        print("✅ Modèle entraîné et sauvegardé !")
        return model

model = get_or_train_model()

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({"error": "Modèle non chargé"}), 500
        
    data = request.get_json()
    volume = float(data.get('volume', 0))

    prediction = model.predict([[volume]])
    score = model.decision_function([[volume]])[0]
    is_anomaly = bool(prediction[0] == -1)
    
    return jsonify({
        "volume": volume,
        "is_anomaly": is_anomaly,
        "score": score,
        "status": "🚨 FUITE DÉTECTÉE" if is_anomaly else "✅ Normal"
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)