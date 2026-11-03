from flask import Flask, request, jsonify
import joblib
import os

app = Flask(__name__)

model_path = os.path.join("ai", "models", "isolation_forest.joblib")
if os.path.exists(model_path):
    model = joblib.load(model_path)
    print("✅ Modèle IA chargé avec succès.")
else:
    print("⚠️ Modèle introuvable. Lance d'abord 'python3 ai/train_model.py'")
    model = None

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({"error": "Modèle non chargé"}), 500
        
    data = request.get_json()
    volume = float(data.get('volume', 0))

    prediction = model.predict([[volume]])
    score = model.decision_function([[volume]])[0]
    
    # L'IA détecte l'anomalie
    is_anomaly = bool(prediction[0] == -1)
    
    # RÈGLE MÉTIER STRICTE : Tout volume > 30 m³ est une fuite
    if volume > 30:
        is_anomaly = True
        # On force un score négatif si l'IA ne l'a pas fait d'elle-même
        if score > 0: 
            score = -0.1 
    
    return jsonify({
        "volume": volume,
        "is_anomaly": is_anomaly,
        "score": score,
        "status": "🚨 FUITE DÉTECTÉE" if is_anomaly else "✅ Normal"
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)