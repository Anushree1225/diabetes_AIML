import re

def parse_range(ref_range_str):
    # Try to find a hyphen-separated range
    match = re.search(r'([\d\.]+)\s*-\s*([\d\.]+)', ref_range_str)
    if match:
        try:
            return float(match.group(1)), float(match.group(2))
        except ValueError:
            return None, None
            
    # Try < or > inequalities
    match_lt = re.search(r'<\s*([\d\.]+)', ref_range_str)
    if match_lt:
        try:
            return None, float(match_lt.group(1))
        except ValueError:
            return None, None
            
    match_gt = re.search(r'>\s*([\d\.]+)', ref_range_str)
    if match_gt:
        try:
            return float(match_gt.group(1)), None
        except ValueError:
            return None, None
            
    return None, None

def analyze_status(extracted_data: list) -> list:
    for item in extracted_data:
        value = item.get("value")
        ref_range = item.get("reference_range", "")
        extraction_status = item.get("extraction_status", "unavailable")
        
        # If extraction was not successful or no range available
        if extraction_status != "available" or not ref_range:
            item["status"] = "Reference unavailable"
            continue
            
        min_val, max_val = parse_range(ref_range)
        
        if min_val is None and max_val is None:
            item["status"] = "Attention / Uncertain"
            continue
            
        # Sanity check for OCR hallucination in reference ranges
        # e.g., missing decimal points (24-44 instead of 2.4-4.4 for a value of 4.3)
        suspicious = False
        
        # If value is significantly smaller than the minimum (e.g. missing decimal in range)
        if min_val is not None and min_val > 0 and (value / min_val) < 0.25:
            suspicious = True
            
        if suspicious:
            item["status"] = "Attention / Uncertain"
            item["reference_status"] = "uncertain" # Update reference status as well
            continue
            
        # Determine status
        status = "Normal"
        if min_val is not None and value < min_val:
            status = "Low"
        elif max_val is not None and value > max_val:
            status = "High"
            
        item["status"] = status
        
    return extracted_data
