const hre = require("hardhat");

async function main() {
  console.log("Déploiement du contrat WaterCredit...");

  const WaterCredit = await hre.ethers.getContractFactory("WaterCredit");
  const waterCredit = await WaterCredit.deploy();

  await waterCredit.waitForDeployment();

  const address = await waterCredit.getAddress();
  console.log(`Contrat déployé avec succès à l'adresse : ${address}`);
  
  console.log("\nN'oublie pas de copier cette adresse dans ton fichier .env sous CONTRACT_ADDRESS.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});