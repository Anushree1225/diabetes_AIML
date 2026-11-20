import cv2
import numpy as np
import pytesseract
from PIL import Image
import io
import os
from pypdf import PdfReader
from pypdf.errors import PdfReadError

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Preprocess image for better OCR accuracy."""
    if not image_bytes:
        raise ValueError("Image data is empty.")

    # Convert bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Could not decode image. The file may be corrupted or in an unsupported format.")

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Apply Otsu's thresholding
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
    try:
        text = pytesseract.image_to_string(preprocessed_img, config=custom_config)
        return text
    except pytesseract.TesseractNotFoundError:
        # Fallback to standard Windows installation path if tesseract is not in system PATH
        win_tesseract = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        if os.path.exists(win_tesseract):
            pytesseract.pytesseract.tesseract_cmd = win_tesseract
            return pytesseract.image_to_string(preprocessed_img, config=custom_config)
        raise RuntimeError("Tesseract OCR engine is not installed or not found in system PATH.")
    except Exception as e:
        raise RuntimeError(f"OCR execution failed: {str(e)}")

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract text from a PDF document.
    First attempts direct digital text extraction (fast and accurate for text-based PDFs).
    If no text is found (e.g. scanned PDF), falls back to OCR.
    """
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except (PdfReadError, Exception) as e:
        raise ValueError(f"Could not read PDF document: {str(e)}")

    if len(reader.pages) == 0:
        raise ValueError("The uploaded PDF has no pages.")

    # 1. Direct text extraction (for digital/selectable PDFs)
    direct_text = ""
    for i, page in enumerate(reader.pages):
        page_text = page.extract_text() or ""
        if page_text.strip():
            direct_text += f"\n--- Page {i+1} ---\n{page_text}"

    # If substantial text was extracted, return it immediately
    if len(direct_text.strip()) >= 30:
        return direct_text.strip()

    # 2. Fallback for scanned PDFs: extract embedded page images for OCR
    scanned_text = ""
    for i, page in enumerate(reader.pages):
        page_ocr = ""
        if hasattr(page, 'images') and page.images:
            for img_file in page.images:
                try:
                    preprocessed = preprocess_image(img_file.data)
                    txt = perform_ocr_on_image(preprocessed)
                    if txt.strip():
                        page_ocr += "\n" + txt.strip()
                except Exception:
                    continue
        if page_ocr.strip():
            scanned_text += f"\n--- Page {i+1} ---\n{page_ocr.strip()}"

    if len(scanned_text.strip()) >= 20:
        return scanned_text.strip()

    # 3. Fallback: pdf2image convert_from_bytes (if poppler is available on the system)
    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(file_bytes)
        pdf2img_text = ""
        for i, page_img in enumerate(images):
            preprocessed = pil_preprocess_image(page_img)
            txt = perform_ocr_on_image(preprocessed)
            if txt.strip():
                pdf2img_text += f"\n--- Page {i+1} ---\n{txt.strip()}"
        if pdf2img_text.strip():
            return pdf2img_text.strip()
    except Exception:
        pass

    if direct_text.strip():
        return direct_text.strip()

    raise ValueError("No text could be extracted from the PDF. The document may be blank, unreadable, or scanned at low resolution.")

def process_document(file_bytes: bytes, filename: str) -> str:
    """Main entry point to process a document (PDF or Image) and extract text."""
    if not file_bytes or len(file_bytes.strip() if isinstance(file_bytes, (bytes, bytearray)) else file_bytes) == 0:
        raise ValueError("The uploaded file is empty. Please upload a valid document.")

    filename_lower = filename.lower()
    if filename_lower.endswith('.pdf'):
        return extract_text_from_pdf(file_bytes)
    else:
        # It's an image (JPG, PNG, etc.)
        preprocessed = preprocess_image(file_bytes)
        text = perform_ocr_on_image(preprocessed)
        if not text.strip():
            raise ValueError("No text could be extracted from the image. Please ensure the image is clear and legible.")
        return text.strip()
