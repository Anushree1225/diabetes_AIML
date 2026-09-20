import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import io

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Preprocess image for better OCR accuracy."""
    # Convert bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply adaptive thresholding or Otsu's
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    
    return thresh

def pil_preprocess_image(pil_image: Image.Image) -> np.ndarray:
    """Preprocess PIL image for better OCR accuracy."""
    # Convert PIL Image to cv2 Image (numpy array)
    img = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply Otsu's thresholding
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    return thresh

def perform_ocr_on_image(preprocessed_img: np.ndarray) -> str:
    """Run Tesseract OCR on a preprocessed image."""
    custom_config = r'--oem 3 --psm 6'
    # Windows might need tesseract cmd path set if it's not in PATH.
    # We will assume it's in PATH or handled externally for now.
    text = pytesseract.image_to_string(preprocessed_img, config=custom_config)
    return text

def process_document(file_bytes: bytes, filename: str) -> str:
    """Main entry point to process a document (PDF or Image) and extract text."""
    extracted_text = ""
    
    try:
        if filename.lower().endswith('.pdf'):
            # It's a PDF
            # Note: poppler must be installed and in PATH for pdf2image to work
            images = convert_from_bytes(file_bytes)
            for i, page_img in enumerate(images):
                preprocessed = pil_preprocess_image(page_img)
                text = perform_ocr_on_image(preprocessed)
                extracted_text += f"\n--- Page {i+1} ---\n{text}"
        else:
            # It's an image (JPG, PNG, etc)
            preprocessed = preprocess_image(file_bytes)
            extracted_text = perform_ocr_on_image(preprocessed)
            
        return extracted_text.strip()
    except Exception as e:
        raise Exception(f"Error processing document: {str(e)}")
