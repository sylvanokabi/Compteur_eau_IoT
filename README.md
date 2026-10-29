# Compteurs d'eau intelligents et facturation prépayée sur blockchain

Prototype fonctionnel développé dans le cadre du cours **Blockchain et cryptomonnaies**
(Master 1, mention Mathématiques, Statistiques et Informatique, Faculté des Sciences
et Technologies, Université de Kinshasa).

## Membres du groupe

| Nom | Rôle | Contact |
|---|---|---|
| _à compléter_ | Chef de projet | _à compléter_ |
| _à compléter_ | Développeur contrats | _à compléter_ |
| _à compléter_ | Développeur passerelle / IoT | _à compléter_ |
| _à compléter_ | Data / IA | _à compléter_ |
| _à compléter_ | Frontend / DApp | _à compléter_ |

## Objectif

Simuler un parc de compteurs d'eau IoT qui publient des relevés signés via MQTT.
Une passerelle ancre ces relevés sur la blockchain Polygon Amoy. Un contrat de
crédit prépayé (jeton interne en m³) décompte la consommation et suspend
virtuellement le service lorsque le crédit atteint zéro. Un modèle Isolation Forest
détecte les fuites par analyse des débits nocturnes anormaux. Un tableau de bord
permet à l'abonné et à l'opérateur de suivre l'état du service.

## Architecture

Voir [`docs/architecture.md`](docs/architecture.md).

- **On-chain** (Polygon Amoy) : contrat `WaterCredit.sol`, crédit prépayé, événements de relevé, suspension.
- **Off-chain** : simulateur IoT, broker MQTT (HiveMQ Cloud), passerelle Node.js, modèle Isolation Forest (Python), tableau de bord React.

## Adresses des contrats

| Réseau | Contrat | Adresse | Explorateur |
|---|---|---|---|
| Polygon Amoy (80002) | WaterCredit | _à remplir après déploiement_ | _lien OKLink/Polygonscan_ |

## Installation

### Prérequis
- Node.js 20 LTS
- Python 3.10+
- Git

### Étapes

```bash
git clone https://github.com/<votre-org>/water-credit-blockchain.git
cd water-credit-blockchain
cp .env.example .env
# éditer .env avec vos valeurs
npm install