import re

PARAMETER_RULES = {
    "Fasting Glucose": [
        r"\bfasting\s*plasma\s*glucose\b",
        r"\bfasting\s*blood\s*sugar\b",
        r"\bfbs\b",
        r"\bfasting\s*blood\s*glucose\b",
        r"\bglucose[,\s]+fasting\b",
        r"\bfasting\s*glucose\b"
    ],
    "Plasma Glucose 2hrs PP": [
        r"\bplasma\s*glucose\s*2hrs\s*pp\b",
        r"\bppbs\b",
        r"\bpost\s*prandial\b",
        r"\b2hrs\s*pp\b",
        r"\bpost\s*meal\b",
        r"\bglucose\s*\(?pp\)?\b",
        r"\bpp\s*glucose\b",
        r"\bpost\s*prandial\s*glucose\b"
    ],
    "HbA1c": [r"\bglycated\s*haemoglobin\s*\(?hba1c\)?", r"\bhba1c\b"],
    "Serum Creatinine": [r"\bserum\s*creatinine\b", r"\bcreatinine\b"],
    "ALT": [r"\balt\s*\(?sgpt\)?", r"\balt\b", r"\bsgpt\b"],
    "AST": [r"\bast\s*\(?sgot\)?", r"\bast\b", r"\bsgot\b"],
    "Serum Calcium": [r"\bserum\s*calcium\b", r"\bcalcium\b"],
    "Serum Phosphorus": [r"\bserum\s*phosphorus\b", r"\bphosphorus\b"],
    "Sodium": [r"\bsodium\b", r"\bna\b", r"\bsodium\s*\(na\)\b"],
    "Total Cholesterol": [
        r"\btotal\s*cholesterol\b",
        r"\bcholesterol\s*total\b",
        r"\bcholesterol[,\s]+total\b",
        r"\bserum\s*cholesterol\b"
    ],
    "HDL Cholesterol": [r"\bhdl\s*cholesterol\b", r"\bhdl\b"],
    "LDL Cholesterol": [r"\bldl\s*cholesterol\b", r"\bldl\b"],
    "Triglycerides": [r"\btriglycerides\b", r"\btriglyceride\b"]
}

def extract_parameters(raw_text: str) -> list:
    results = []
    lines = raw_text.split('\n')

    found_params = set()

    for raw_line in lines:
        # Separate glued digits and letters (e.g. "120.00Glucose" -> "120.00 Glucose")
        cleaned_line = re.sub(r'(\d)([a-zA-Z])', r'\1 \2', raw_line)
        line_lower = cleaned_line.lower()

        for std_name, aliases in PARAMETER_RULES.items():
            if std_name in found_params:
                continue

            matched = False
            for alias in aliases:
                match = re.search(alias, line_lower)
                if match:
                    prefix = cleaned_line[:match.start()].strip()
                    remainder = cleaned_line[match.end():].strip()

                    # Case 1: Result value is in prefix before test name (e.g. "120.00 Glucose Fasting 70 - 100 mg/dL")
                    prefix_val_match = re.search(r'(\d+\.?\d*)\s*$', prefix)
                    is_remainder_range = bool(re.search(r'^[\d\.\s]+-[\d\.\s]+', remainder) or remainder.startswith(('<', '>')))

                    if prefix_val_match and (is_remainder_range or not re.search(r'^\s*[:\-=]?\s*(\d+\.?\d*)\s*([a-zA-Z/%]+)', remainder)):
                        value_str = prefix_val_match.group(1)
                        ref_match = re.search(r'([\d\.\-]+\s*-\s*[\d\.\-]+|<[ \d\.]+|>[ \d\.]+)', remainder)
                        ref_range = ref_match.group(1).strip() if ref_match else ""
                        unit_match = re.search(r'([a-zA-Z/%]+)', remainder)
                        unit = unit_match.group(1) if unit_match else "mg/dL"
                        if unit.upper() == "UIL":
                            unit = "U/L"
                        try:
                            value = float(value_str)
                            original_name = cleaned_line[match.start():match.end()].strip()
                            results.append({
                                "name": std_name,
                                "original_name": original_name,
                                "value": value,
                                "unit": unit,
                                "reference_range": ref_range,
                                "extraction_status": "available" if ref_range else "unavailable"
                            })
                            found_params.add(std_name)
                            matched = True
                            break
                        except ValueError:
                            pass
                    else:
                        # Case 2: Result value is in remainder after test name (standard layout)
                        val_match = re.search(r'^.*?(\d+\.?\d*)\s*([a-zA-Z/%]+)\s*(.*)$', remainder)

                        if val_match:
                            value_str = val_match.group(1)
                            unit = val_match.group(2)
                            rest = val_match.group(3).strip()

                            # If unit is a status indicator like 'high', 'low', extract the real unit from rest
                            if unit.lower() in ['high', 'low', 'normal', 'abnormal', 'critical']:
                                real_unit_match = re.search(r'^([a-zA-Z/%]+)\s*(.*)$', rest)
                                if real_unit_match:
                                    unit = real_unit_match.group(1)
                                    rest = real_unit_match.group(2).strip()

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
                                original_name = cleaned_line[:match.end()].strip()
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
                                matched = True
                                break
                            except ValueError:
                                pass
                if matched:
                    break

    return results
