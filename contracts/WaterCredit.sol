// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title WaterCredit
 * @dev Gère le crédit prépayé (en m3) des compteurs d'eau.
 * Prototype M1 MSI - UNIKIN.
 */
contract WaterCredit is ReentrancyGuard {
    
    address public owner;
    address public gateway;

    // Solde de crédit en m3 par compteur (identifié par une adresse)
    mapping(address => uint256) public creditBalance;
    
    // État du service : true = actif, false = suspendu (crédit à zéro)
    mapping(address => bool) public serviceActive;

    // Événements pour la traçabilité (exigence du cahier des charges)
    event TopUp(address indexed meter, uint256 amount, uint256 newBalance);
    event ReadingRecorded(address indexed meter, uint256 volume, uint256 newBalance);
    event ServiceSuspended(address indexed meter);
    event GatewayUpdated(address indexed newGateway);

    // Modificateurs de sécurité
    modifier onlyOwner() {
        require(msg.sender == owner, "Seul le proprietaire peut faire ceci");
        _;
    }

    modifier onlyGateway() {
        require(msg.sender == gateway, "Seul le gateway peut enregistrer des releves");
        _;
    }

    constructor() {
        owner = msg.sender;
        gateway = msg.sender; // Initialement, le déployeur est le gateway
    }

    /**
     * @dev Permet de changer l'adresse de la passerelle.
     */
    function setGateway(address _newGateway) external onlyOwner {
        require(_newGateway != address(0), "Adresse invalide");
        gateway = _newGateway;
        emit GatewayUpdated(_newGateway);
    }

    /**
     * @dev Permet à un abonné de recharger son crédit.
     * Pour le prototype, on simule le rechargement sans vrai jeton ERC-20.
     */
    function topUp(address _meter, uint256 _amount) external nonReentrant {
        require(_meter != address(0), "Compteur invalide");
        require(_amount > 0, "Le montant doit etre superieur a 0");

        creditBalance[_meter] += _amount;
        
        // Si le crédit était à zéro, on réactive le service
        if (!serviceActive[_meter]) {
            serviceActive[_meter] = true;
        }

        emit TopUp(_meter, _amount, creditBalance[_meter]);
    }

    /**
     * @dev Enregistre un relevé de consommation. Appelé UNIQUEMENT par la passerelle.
     * Décompte le crédit et suspend le service si le crédit atteint zéro.
     */
    function recordReading(address _meter, uint256 _volume) external onlyGateway nonReentrant {
        require(_meter != address(0), "Compteur invalide");
        require(_volume > 0, "Le volume doit etre superieur a 0");
        require(serviceActive[_meter], "Service suspendu : credit epuise");
        require(creditBalance[_meter] >= _volume, "Credit insuffisant pour ce releve");

        // Décompte du crédit
        creditBalance[_meter] -= _volume;

        emit ReadingRecorded(_meter, _volume, creditBalance[_meter]);

        // Suspension virtuelle si le crédit tombe à zéro
        if (creditBalance[_meter] == 0) {
            serviceActive[_meter] = false;
            emit ServiceSuspended(_meter);
        }
    }
}