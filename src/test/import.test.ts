import { describe, it, expect } from "vitest";
import {
  normalizeDriverName,
  parseAppDriverName,
  parseFileDriverName,
  lineToCategory,
  paymentToType,
} from "@/lib/import";

describe("normalizeDriverName", () => {
  it("met en majuscules et normalise les accents", () => {
    expect(normalizeDriverName("Préaux")).toBe("PREAUX");
    expect(normalizeDriverName("Stanghellini")).toBe("STANGHELLINI");
    expect(normalizeDriverName("Bénédicte")).toBe("BENEDICTE");
  });

  it("supprime les apostrophes sans laisser d'espace", () => {
    expect(normalizeDriverName("M'HAYA")).toBe("MHAYA");
    expect(normalizeDriverName("M’HAYA")).toBe("MHAYA");
    expect(normalizeDriverName("MʼHAYA")).toBe("MHAYA");
  });

  it("remplace les tirets par des espaces", () => {
    expect(normalizeDriverName("JEAN-LUC")).toBe("JEAN LUC");
  });

  it("supprime les points et caractères spéciaux", () => {
    expect(normalizeDriverName("Dupont.")).toBe("DUPONT");
    expect(normalizeDriverName("Jean-Pierre@")).toBe("JEAN PIERRE");
  });

  it("gère les chaînes vides", () => {
    expect(normalizeDriverName("")).toBe("");
    expect(normalizeDriverName(null as unknown as string)).toBe("");
    expect(normalizeDriverName(undefined as unknown as string)).toBe("");
  });

  it("gère les espaces multiples", () => {
    expect(normalizeDriverName("  JEAN   DUPONT  ")).toBe("JEAN DUPONT");
  });

  it("gère les noms composés", () => {
    expect(normalizeDriverName("El Badri")).toBe("EL BADRI");
    expect(normalizeDriverName("LE BIGOT")).toBe("LE BIGOT");
  });

  it("nettoie les chiffres résiduels", () => {
    expect(normalizeDriverName("Dupont123")).toBe("DUPONT");
  });
});

describe("parseAppDriverName", () => {
  it("parse PREAUX A -> last=PREAUX, initial=A", () => {
    const result = parseAppDriverName("PREAUX A");
    expect(result.lastName).toBe("PREAUX");
    expect(result.initial).toBe("A");
  });

  it("parse EL BADRI -> last=EL BADRI, initial=null", () => {
    const result = parseAppDriverName("EL BADRI");
    expect(result.lastName).toBe("EL BADRI");
    expect(result.initial).toBeNull();
  });

  it("parse ABBADI -> last=ABBADI, initial=null", () => {
    const result = parseAppDriverName("ABBADI");
    expect(result.lastName).toBe("ABBADI");
    expect(result.initial).toBeNull();
  });

  it("parse MHAYA M -> last=MHAYA, initial=M", () => {
    const result = parseAppDriverName("MHAYA M");
    expect(result.lastName).toBe("MHAYA");
    expect(result.initial).toBe("M");
  });

  it("gère les noms avec accents (BENRAHOU)", () => {
    const result = parseAppDriverName("BENRAHOU");
    expect(result.lastName).toBe("BENRAHOU");
  });

  it("chaîne vide retourne lastName vide", () => {
    const result = parseAppDriverName("");
    expect(result.lastName).toBe("");
    expect(result.initial).toBeNull();
  });
});

describe("parseFileDriverName", () => {
  it("parse 'Anthony PREAUX' -> last=PREAUX, initial=A", () => {
    const result = parseFileDriverName("Anthony PREAUX");
    expect(result.lastName).toBe("PREAUX");
    expect(result.initial).toBe("A");
  });

  it("parse 'Kamel HAJJI' -> last=HAJJI, initial=K", () => {
    const result = parseFileDriverName("Kamel HAJJI");
    expect(result.lastName).toBe("HAJJI");
    expect(result.initial).toBe("K");
  });

  it("parse 'Marcel EL BADRI' -> last=EL BADRI, initial=M", () => {
    const result = parseFileDriverName("Marcel EL BADRI");
    expect(result.lastName).toBe("EL BADRI");
    expect(result.initial).toBe("M");
  });

  it("parse 'Thomas LE BIGOT' -> last=LE BIGOT, initial=T", () => {
    const result = parseFileDriverName("Thomas LE BIGOT");
    expect(result.lastName).toBe("LE BIGOT");
    expect(result.initial).toBe("T");
  });

  it("parse 'ABBADI' seul -> last=ABBADI, initial=null", () => {
    const result = parseFileDriverName("ABBADI");
    expect(result.lastName).toBe("ABBADI");
    expect(result.initial).toBeNull();
  });

  it("gère les accents dans le prénom", () => {
    const result = parseFileDriverName("Jérôme BOREL");
    expect(result.lastName).toBe("BOREL");
    expect(result.initial).toBe("J");
  });

  it("chaîne vide retourne lastName vide", () => {
    const result = parseFileDriverName("");
    expect(result.lastName).toBe("");
    expect(result.initial).toBeNull();
  });

  it("gère les noms avec DE/DU préfixe comme 'Luc DU PUY' -> last=DU PUY, initial=L", () => {
    // Note: DU est dans COMPOUND_PREFIXES, donc le nom complet est "DU PUY"
    const result = parseFileDriverName("Luc DU PUY");
    expect(result.lastName).toBe("DU PUY");
    expect(result.initial).toBe("L");
  });
});

describe("lineToCategory", () => {
  it("reconnaît 704, 705, 707, 708, 915", () => {
    expect(lineToCategory("704")).toBe("704");
    expect(lineToCategory("705")).toBe("705");
    expect(lineToCategory("707")).toBe("707");
    expect(lineToCategory("708")).toBe("708");
    expect(lineToCategory("915")).toBe("915");
  });

  it("reconnaît les codes Scolaires (7400-7404, 7500-7507)", () => {
    expect(lineToCategory("7400")).toBe("Scolaires");
    expect(lineToCategory("7404")).toBe("Scolaires");
    expect(lineToCategory("7500")).toBe("Scolaires");
    expect(lineToCategory("7507")).toBe("Scolaires");
  });

  it("rejette les codes inconnus", () => {
    expect(lineToCategory("701")).toBeNull();
    expect(lineToCategory("800")).toBeNull();
    expect(lineToCategory("000")).toBeNull();
  });

  it("gère les lignes avec texte après le code", () => {
    expect(lineToCategory("704 - Ligne test")).toBe("704");
    expect(lineToCategory("7400 Scolaires")).toBe("Scolaires");
  });

  it("gère les valeurs null/undefined", () => {
    expect(lineToCategory(null)).toBeNull();
    expect(lineToCategory(undefined)).toBeNull();
  });

  it("gère les lignes vides", () => {
    expect(lineToCategory("")).toBeNull();
    expect(lineToCategory("   ")).toBeNull();
  });
});

describe("paymentToType", () => {
  it("reconnaît espèces", () => {
    expect(paymentToType("Espèce")).toBe("especes");
    expect(paymentToType("ESPÈCE")).toBe("especes");
    expect(paymentToType("espèce")).toBe("especes");
    expect(paymentToType("Espèces")).toBe("especes");
  });

  it("retourne cb par défaut", () => {
    expect(paymentToType("CB")).toBe("cb");
    expect(paymentToType("Carte")).toBe("cb");
    expect(paymentToType("")).toBe("cb");
    expect(paymentToType(null)).toBe("cb");
    expect(paymentToType("Autre")).toBe("cb");
  });
});