import re

PARAMETER_RULES = {
    "Fasting Glucose": [r"\bfasting\s*plasma\s*glucose\b", r"\bfasting\s*blood\s*sugar\b", r"\bfbs\b", r"\bfasting\s*blood\s*glucose\b"],
    "Plasma Glucose 2hrs PP": [r"\bplasma\s*glucose\s*2hrs\s*pp\b", r"\bppbs\b", r"\bpost\s*prandial\b", r"\b2hrs\s*pp\b", r"\bpost\s*meal\b"],
    "HbA1c": [r"\bglycated\s*haemoglobin\s*\(?hba1c\)?", r"\bhba1c\b"],
    "Serum Creatinine": [r"\bserum\s*creatinine\b", r"\bcreatinine\b"],
    "ALT": [r"\balt\s*\(?sgpt\)?", r"\balt\b", r"\bsgpt\b"],
    "AST": [r"\bast\s*\(?sgot\)?", r"\bast\b", r"\bsgot\b"],
    "Serum Calcium": [r"\bserum\s*calcium\b", r"\bcalcium\b"],
    "Serum Phosphorus": [r"\bserum\s*phosphorus\b", r"\bphosphorus\b"],
    "Sodium": [r"\bsodium\b", r"\bna\b", r"\bsodium\s*\(na\)\b"],
    "Total Cholesterol": [r"\btotal\s*cholesterol\b", r"\bcholesterol\s*total\b"],
    "HDL Cholesterol": [r"\bhdl\s*cholesterol\b", r"\bhdl\b"],
    "LDL Cholesterol": [r"\bldl\s*cholesterol\b", r"\bldl\b"],
    "Triglycerides": [r"\btriglycerides\b", r"\btriglyceride\b"]
}

def extract_parameters(raw_text: str) -> list:
    results = []
    lines = raw_text.split('\n')
    
    found_params = set()
    
    for line in lines:
        line_lower = line.lower()
        
        for std_name, aliases in PARAMETER_RULES.items():
            if std_name in found_params:
                continue
                
            for alias in aliases:
                match = re.search(alias, line_lower)
                if match:
                    # Look for value, unit, and the rest of the line
                    remainder = line[match.end():].strip()
                    # Try to parse remaining string
                    # value: (\d+\.?\d*)
                    # unit: ([a-zA-Z/%]+)
                    val_match = re.search(r'^.*?(\d+\.?\d*)\s*([a-zA-Z/%]+)\s*(.*)$', remainder)
                    
                    if val_match:
                        value_str = val_match.group(1)
                        unit = val_match.group(2)
                        rest = val_match.group(3).strip()
                        
                        # Fix common OCR unit issues
                        if unit.upper() == "UIL":
                            unit = "U/L"
                        
                        # Extract reference range
                        ref_range_match = re.search(r'([\d\.\-]+\s*-\s*[\d\.\-]+|<[ \d\.]+|>[ \d\.]+)', rest)
                        if ref_range_match:
                            ref_range = ref_range_match.group(1).strip()
                            status = "available"
                        else:
                            # fallback
                            ref_match_fallback = re.match(r'([\d\.\-\<\>\s]+)', rest)
                            if ref_match_fallback and ref_match_fallback.group(1).strip():
                                ref_range = ref_match_fallback.group(1).strip()
                                status = "uncertain" if len(ref_range) < 3 else "available"
                            else:
                                ref_range = ""
                                status = "unavailable"
                                
                        try:
                            value = float(value_str)
                            original_name = line[:match.end()].strip()
                            original_name = re.sub(r'[\.\-\:]$', '', original_name).strip()
                            
                            results.append({
                                "name": std_name,
                                "original_name": original_name,
                                "value": value,
                                "unit": unit,
                                "reference_range": ref_range,
                                "extraction_status": status
                            })
                            found_params.add(std_name)
                            break
                        except ValueError:
                            pass
    
    return results
