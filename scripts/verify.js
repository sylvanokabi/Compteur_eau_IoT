const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    throw new Error("Veuillez définir CONTRACT_ADDRESS dans le fichier .env");
  }

  console.log(`Vérification du contrat à l'adresse : ${contractAddress}...`);

  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [], // Notre contrat n'a pas d'arguments dans le constructeur
    });
    console.log("✅ Contrat vérifié avec succès sur Etherscan !");
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("ℹ️ Le contrat est déjà vérifié.");
    } else {
      console.error(error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});