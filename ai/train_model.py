import numpy as np
from sklearn.ensemble import IsolationForest
import joblib
import os

os.makedirs("ai/models", exist_ok=True)

print("Génération des données d'entraînement (consommation normale)...")
np.random.seed(42)
# Loi normale : moyenne 5 m3, écart-type 2 m3. 
# On borne entre 0.5 et 15 m3 pour que ce soit réaliste.
normal_data = np.random.normal(loc=5.0, scale=2.0, size=(1000, 1))
normal_data = np.clip(normal_data, 0.5, 15.0)

print("Entraînement du modèle Isolation Forest...")
model = IsolationForest(contamination=0.01, random_state=42)
model.fit(normal_data)

model_path = "ai/models/isolation_forest.joblib"
joblib.dump(model, model_path)
print(f"✅ Modèle sauvegardé dans {model_path}")

print("\n--- Test de détection ---")
test_values = [[1.0], [5.0], [12.0], [30.0], [45.0]] 
for val in test_values:
    prediction = model.predict([val])
    score = model.decision_function([val])[0]
    is_anomaly = "🚨 FUITE DÉTECTÉE" if prediction[0] == -1 else "✅ Normal"
    print(f"Volume: {val[0]} m3 -> {is_anomaly} (Score: {score:.3f})")