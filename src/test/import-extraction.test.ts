import { describe, it, expect } from "vitest";
import {
  normalizeDriverName,
  lineToCategory,
  paymentToType,
  parseDateText,
  importExtractionFromBuffer,
} from "@/lib/import";
import * as XLSX from "xlsx";

// Tests unitaires (ne dépendent pas de File I/O)
describe("parseDateText", () => {
  it("parse le format ISO YYYY-MM-DD", () => {
    const r = parseDateText("2026-01-15");
    expect(r).not.toBeNull();
    expect(r!.y).toBe(2026); expect(r!.m).toBe(0); expect(r!.d).toBe(15);
  });
  it("parse le format français DD/MM/YYYY", () => {
    const r = parseDateText("15/01/2026");
    expect(r).not.toBeNull();
    expect(r!.y).toBe(2026); expect(r!.m).toBe(0); expect(r!.d).toBe(15);
  });
  it("retourne null pour date impossible", () => {
    expect(parseDateText("30/02/2026")).toBeNull();
  });
  it("retourne null pour chaîne vide", () => {
    expect(parseDateText("")).toBeNull();
  });
});

describe("lineToCategory", () => {
  it("reconnaît les lignes standards", () => {
    ["704", "705", "707", "708", "915"].forEach(c => expect(lineToCategory(c)).toBe(c));
  });
  it("reconnaît les codes Scolaires", () => {
    expect(lineToCategory("7400")).toBe("Scolaires");
    expect(lineToCategory("7507")).toBe("Scolaires");
  });
  it("rejette les codes inconnus", () => {
    expect(lineToCategory("999")).toBeNull();
    expect(lineToCategory("")).toBeNull();
  });
});

describe("paymentToType", () => {
  it("reconnaît espèces", () => {
    expect(paymentToType("Espèce")).toBe("especes");
    expect(paymentToType("Espèces")).toBe("especes");
  });
  it("retourne cb par défaut", () => {
    expect(paymentToType("CB")).toBe("cb");
    expect(paymentToType("Carte")).toBe("cb");
    expect(paymentToType("")).toBe("cb");
  });
});

describe("normalizeDriverName", () => {
  it("supprime accents et apostrophes", () => {
    expect(normalizeDriverName("M'HAYA")).toBe("MHAYA");
    expect(normalizeDriverName("Préaux")).toBe("PREAUX");
  });
  it("gère tirets et points", () => {
    expect(normalizeDriverName("JEAN-LUC")).toBe("JEAN LUC");
    expect(normalizeDriverName("M. PREAUX")).toBe("M PREAUX");
  });
});

// Tests d'intégration pour importExtractionFromBuffer
// Utilise base64 pour éviter les problèmes de typage ArrayBuffer
function makeXlsx(rows: { date: string; conducteur: string; ligne: string; prix: number; paiement: string; annulee?: string }[]): Uint8Array {
  const headerRow = ["Date", "Conducteur", "Ligne", "Prix TTC", "Paiement", "Annulé"];
  const data = rows.map(r => [r.date, r.conducteur, r.ligne, r.prix, r.paiement, r.annulee || ""]);
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const b64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return bytes;
}

describe("importExtractionFromBuffer", () => {
  // Ces tests utilisent des dates au format ISO via le champ text des cellules
  // La fonction parseRowDate lit d'abord cell.text, donc ça marche
  it("rejette les ventes annulées", async () => {
    const buf = makeXlsx([{ date: "2026-01-15", conducteur: "BOREL", ligne: "704", prix: 100, paiement: "Espèce", annulee: "Oui" }]);
    const result = await importExtractionFromBuffer(buf, "v_2026-01-15.xlsx");
    expect(result.rowCount).toBe(0);
    expect(result.skipped[0].reason).toBe("annulee");
  });

  it("rejette les lignes inconnues", async () => {
    const buf = makeXlsx([{ date: "2026-01-15", conducteur: "BOREL", ligne: "999", prix: 100, paiement: "CB" }]);
    const result = await importExtractionFromBuffer(buf, "v_2026-01-15.xlsx");
    expect(result.skipped[0].reason).toBe("ligne_inconnue");
  });

  it("rejette les prix invalides", async () => {
    const buf = makeXlsx([{ date: "2026-01-15", conducteur: "BOREL", ligne: "704", prix: 0, paiement: "CB" }]);
    const result = await importExtractionFromBuffer(buf, "v_2026-01-15.xlsx");
    expect(result.skipped[0].reason).toBe("prix_invalide");
  });

  it("rejette les conducteurs vides", async () => {
    const buf = makeXlsx([{ date: "2026-01-15", conducteur: "", ligne: "704", prix: 100, paiement: "CB" }]);
    const result = await importExtractionFromBuffer(buf, "v_2026-01-15.xlsx");
    expect(result.skipped[0].reason).toBe("conducteur_vide");
  });

  it("rejette les dates invalides", async () => {
    const buf = makeXlsx([{ date: "pas-une-date", conducteur: "BOREL", ligne: "704", prix: 100, paiement: "CB" }]);
    const result = await importExtractionFromBuffer(buf, "v_2026-01-15.xlsx");
    expect(result.skipped[0].reason).toBe("date_invalide");
  });

  it("rejette un fichier sans en-têtes", async () => {
    const ws = XLSX.utils.aoa_to_sheet([]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const b64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    await expect(importExtractionFromBuffer(bytes, "v_2026-01-15.xlsx")).rejects.toThrow("Aucune ligne");
  });

  // Test: l'extraction du mois/année depuis le nom de fichier fonctionne
  it("extrait le mois depuis le nom du fichier", async () => {
    const buf = makeXlsx([{ date: "2026-01-15", conducteur: "BOREL", ligne: "704", prix: 100, paiement: "Espèce", annulee: "Oui" }]);
    const result = await importExtractionFromBuffer(buf, "ventes_2026-01-15.xlsx");
    expect(result.year).toBe(2026);
    expect(result.month).toBe(0);
  });
});