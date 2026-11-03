const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WaterCredit", function () {
  let WaterCredit;
  let waterCredit;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    WaterCredit = await ethers.getContractFactory("WaterCredit");
    waterCredit = await WaterCredit.deploy();
  });

  describe("Déploiement", function () {
    it("Doit définir le déployeur comme owner et gateway", async function () {
      expect(await waterCredit.owner()).to.equal(owner.address);
      expect(await waterCredit.gateway()).to.equal(owner.address);
    });
  });

  describe("Rechargement (TopUp)", function () {
    it("Doit ajouter du crédit et activer le service", async function () {
      await waterCredit.topUp(addr1.address, 100);
      expect(await waterCredit.creditBalance(addr1.address)).to.equal(100);
      expect(await waterCredit.serviceActive(addr1.address)).to.be.true;
    });
  });

  describe("Enregistrement des relevés (recordReading)", function () {
    beforeEach(async function () {
      await waterCredit.topUp(addr1.address, 50); // Ajoute 50 m3
    });

    it("Doit décompter le crédit", async function () {
      await waterCredit.recordReading(addr1.address, 20);
      expect(await waterCredit.creditBalance(addr1.address)).to.equal(30);
      expect(await waterCredit.serviceActive(addr1.address)).to.be.true;
    });

    it("Doit suspendre le service si le crédit atteint zéro", async function () {
      await waterCredit.recordReading(addr1.address, 50);
      expect(await waterCredit.creditBalance(addr1.address)).to.equal(0);
      expect(await waterCredit.serviceActive(addr1.address)).to.be.false;
    });

    it("Doit rejeter si le crédit est insuffisant", async function () {
      await expect(
        waterCredit.recordReading(addr1.address, 60)
      ).to.be.revertedWith("Credit insuffisant pour ce releve");
    });

    it("Doit rejeter si appelé par quelqu'un d'autre que le gateway", async function () {
      await expect(
        waterCredit.connect(addr1).recordReading(addr2.address, 10)
      ).to.be.revertedWith("Seul le gateway peut enregistrer des releves");
    });
  });
});