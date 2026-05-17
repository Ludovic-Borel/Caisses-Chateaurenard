import { MonthData, DriverMonthData, getCellKey, CATEGORIES, PAYMENT_TYPES } from "./types";

/**
 * Merge existing month data with new data, keeping existing values (add only mode).
 * Only fills empty cells (cells with 0 or undefined value) with the new data.
 */
export function mergeAddOnly(existing: MonthData, incoming: MonthData): MonthData {
  const merged: MonthData = {
    year: existing.year,
    month: existing.month,
    drivers: { ...existing.drivers },
    days: { ...existing.days },
  };

  for (const [driverName, incomingDD] of Object.entries(incoming.drivers)) {
    const existingDD = merged.drivers[driverName];
    if (!existingDD) {
      // Driver doesn't exist yet, add entirely
      merged.drivers[driverName] = { 
        days: { ...incomingDD.days },
        ...(incomingDD.notReturned ? { notReturned: { ...incomingDD.notReturned } } : {}),
        ...(incomingDD.extracts ? { extracts: { ...incomingDD.extracts } } : {}),
      };
    } else {
      // Merge day by day, cell by cell
      const newDays: DriverMonthData['days'] = { ...existingDD.days };
      
      for (const [dayStr, incomingDay] of Object.entries(incomingDD.days)) {
        const day = Number(dayStr);
        const existingDay = newDays[day] || {};
        const mergedDay = { ...existingDay };
        
        // Only fill empty cells
        for (const [key, value] of Object.entries(incomingDay)) {
          if (!mergedDay[key] || mergedDay[key] === 0) {
            mergedDay[key] = value;
          }
        }
        newDays[day] = mergedDay;
      }
      
      // Merge notReturned (keep existing, add new)
      const newNR = { ...(existingDD.notReturned || {}) };
      if (incomingDD.notReturned) {
        for (const [key, value] of Object.entries(incomingDD.notReturned)) {
          if (!(key in newNR)) {
            newNR[key] = value;
          }
        }
      }
      
      // Merge extracts (keep existing, add new)
      const newExtracts = { ...(existingDD.extracts || {}) };
      if (incomingDD.extracts) {
        for (const [dayStr, incomingDay] of Object.entries(incomingDD.extracts)) {
          const day = Number(dayStr);
          const existingExtractDay = newExtracts[day] || {};
          const mergedExtractDay = { ...existingExtractDay };
          
          for (const [key, value] of Object.entries(incomingDay)) {
            if (!mergedExtractDay[key] || mergedExtractDay[key] === 0) {
              mergedExtractDay[key] = value;
            }
          }
          newExtracts[day] = mergedExtractDay;
        }
      }
      
      merged.drivers[driverName] = {
        days: newDays,
        ...(Object.keys(newNR).length > 0 ? { notReturned: newNR } : {}),
        ...(Object.keys(newExtracts).length > 0 ? { extracts: newExtracts } : {}),
      };
    }
  }

  // Merge global days (add only)
  for (const [dayStr, incomingDay] of Object.entries(incoming.days || {})) {
    const day = Number(dayStr);
    const existingDay = merged.days[day] || {};
    const mergedDay = { ...existingDay };
    
    for (const [key, value] of Object.entries(incomingDay)) {
      if (!mergedDay[key] || mergedDay[key] === 0) {
        mergedDay[key] = value;
      }
    }
    merged.days[day] = mergedDay;
  }

  return merged;
}

/**
 * Merge existing month data with new data, overwriting existing values (full replace mode).
 * Same as current behavior: new data replaces old data entirely for each driver.
 */
export function mergeFullReplace(existing: MonthData, incoming: MonthData): MonthData {
  return {
    ...existing,
    drivers: { ...existing.drivers, ...incoming.drivers },
    days: { ...existing.days, ...incoming.days },
  };
}